import { describe, expect, it } from "vitest";
import { mergeTokenUsage, tokenUsageFromRecord } from "../usage.js";

describe("tokenUsageFromRecord", () => {
  it("maps exact counters from common provider shapes", () => {
    expect(
      tokenUsageFromRecord({
        promptTokenCount: 12,
        candidatesTokenCount: 5,
        totalTokenCount: 17,
      })
    ).toEqual({
      inputTokens: 12,
      outputTokens: 5,
      totalTokens: 17,
      cachedInputTokens: undefined,
      reasoningTokens: undefined,
    });

    expect(
      tokenUsageFromRecord({
        prompt_tokens: 10,
        completion_tokens: 4,
        input_tokens_details: { cached_tokens: 3 },
      })
    ).toMatchObject({
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      cachedInputTokens: 3,
    });
  });

  it("reads cached and reasoning tokens from Chat Completions usage", () => {
    // OpenAI Chat Completions, OpenRouter and most OpenAI-compatible servers
    // report these under prompt_tokens_details / completion_tokens_details.
    expect(
      tokenUsageFromRecord({
        prompt_tokens: 1200,
        completion_tokens: 300,
        total_tokens: 1500,
        prompt_tokens_details: { cached_tokens: 1024 },
        completion_tokens_details: { reasoning_tokens: 256 },
      })
    ).toEqual({
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1500,
      cachedInputTokens: 1024,
      cacheCreationInputTokens: undefined,
      reasoningTokens: 256,
    });
  });

  it("reads cached tokens from Gemini usageMetadata", () => {
    expect(
      tokenUsageFromRecord({
        promptTokenCount: 5000,
        candidatesTokenCount: 40,
        totalTokenCount: 5040,
        cachedContentTokenCount: 4096,
      })
    ).toMatchObject({
      inputTokens: 5000,
      totalTokens: 5040,
      cachedInputTokens: 4096,
    });
  });

  it("does not fabricate usage when counters are absent", () => {
    expect(tokenUsageFromRecord({ duration_ms: 42 })).toBeUndefined();
  });
});

describe("Anthropic cache counters", () => {
  it("counts every billed input token in totalTokens", () => {
    // Anthropic reports input_tokens NET of the cache and bills all three counters, so
    // input_tokens + output_tokens is not what the call is charged on.
    expect(
      tokenUsageFromRecord({
        input_tokens: 3,
        cache_read_input_tokens: 20000,
        cache_creation_input_tokens: 1500,
        output_tokens: 120,
      })
    ).toMatchObject({
      inputTokens: 3,
      outputTokens: 120,
      cachedInputTokens: 20000,
      cacheCreationInputTokens: 1500,
      totalTokens: 21623,
    });
  });

  it("does not add OpenAI cached tokens, which are already inside prompt_tokens", () => {
    expect(
      tokenUsageFromRecord({
        prompt_tokens: 10,
        completion_tokens: 4,
        input_tokens_details: { cached_tokens: 3 },
      })
    ).toMatchObject({ cachedInputTokens: 3, totalTokens: 14 });
  });
});

describe("mergeTokenUsage", () => {
  it("keeps counters that the later record does not mention", () => {
    // Anthropic's streaming message_delta carries output_tokens only. A spread merge
    // overwrote inputTokens and cachedInputTokens with undefined, because
    // tokenUsageFromRecord returns every key and sets the absent ones to undefined.
    const start = tokenUsageFromRecord({
      input_tokens: 3,
      cache_read_input_tokens: 20000,
      cache_creation_input_tokens: 1500,
      output_tokens: 1,
    });
    const delta = tokenUsageFromRecord({ output_tokens: 500 });

    // Cache creation is billed above the base rate, so it has to survive the merge for the
    // same reason cache reads do.
    expect(mergeTokenUsage(start, delta)).toMatchObject({
      inputTokens: 3,
      cachedInputTokens: 20000,
      cacheCreationInputTokens: 1500,
      outputTokens: 500,
    });
  });

  it("returns whichever side is present when the other is undefined", () => {
    const only = tokenUsageFromRecord({ output_tokens: 7 });
    expect(mergeTokenUsage(undefined, only)).toBe(only);
    expect(mergeTokenUsage(only, undefined)).toBe(only);
  });
});
