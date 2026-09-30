import { afterEach, describe, expect, it, vi } from "vitest";

import * as google from "../providers/google.js";
import * as ollama from "../providers/ollama/index.js";
import type { LlmStreamEvent } from "../types.js";

// Gemini and Ollama do not return tool call ids, so the providers make them
// up. Each turn of a tool loop is a separate request, and a model that calls
// the same tool on two turns must still get two distinct ids, otherwise the
// second call overwrites the first wherever calls are tracked by id.

const messages = [{ role: "user" as const, content: "search twice" }];

async function readyIds(
  stream: AsyncGenerator<LlmStreamEvent, void, unknown>
): Promise<string[]> {
  const ids: string[] = [];
  for await (const event of stream) {
    if (event.type === "tool-call-ready") ids.push(event.toolCallId);
  }
  return ids;
}

function geminiSse(): Response {
  const chunk = {
    candidates: [
      {
        content: {
          parts: [{ functionCall: { name: "search", args: { q: "mcp" } } }],
        },
      },
    ],
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function geminiJson(): Response {
  return Response.json({
    candidates: [
      {
        content: {
          parts: [{ functionCall: { name: "search", args: { q: "mcp" } } }],
        },
      },
    ],
  });
}

function ollamaNdjson(): Response {
  const chunk = {
    message: {
      role: "assistant",
      content: "",
      tool_calls: [{ function: { name: "search", arguments: { q: "mcp" } } }],
    },
    done: true,
  };
  return new Response(`${JSON.stringify(chunk)}\n`, { status: 200 });
}

function ollamaJson(): Response {
  return Response.json({
    message: {
      role: "assistant",
      content: "",
      tool_calls: [{ function: { name: "search", arguments: { q: "mcp" } } }],
    },
    done: true,
  });
}

function expectDistinctSafeIds(ids: string[]): void {
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe(ids[1]);
  for (const id of ids) {
    expect(id).toMatch(/^[a-zA-Z0-9_-]{1,40}$/);
  }
}

describe("generated tool call ids", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Gemini streaming gives the same tool a new id on every turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => geminiSse())
    );
    const config = {
      provider: "google" as const,
      model: "gemini-test",
      apiKey: "test-key",
    };

    const ids = [
      ...(await readyIds(google.streamChat({ config, messages }))),
      ...(await readyIds(google.streamChat({ config, messages }))),
    ];

    expectDistinctSafeIds(ids);
  });

  it("Gemini chat gives the same tool a new id on every turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => geminiJson())
    );
    const config = {
      provider: "google" as const,
      model: "gemini-test",
      apiKey: "test-key",
    };

    const first = await google.chat({ config, messages });
    const second = await google.chat({ config, messages });

    expectDistinctSafeIds([first.toolCalls[0]!.id, second.toolCalls[0]!.id]);
  });

  it("Ollama streaming gives the same tool a new id on every turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => ollamaNdjson())
    );
    const config = {
      provider: "ollama" as const,
      model: "llama-test",
      apiKey: "",
    };

    const ids = [
      ...(await readyIds(ollama.streamChat({ config, messages }))),
      ...(await readyIds(ollama.streamChat({ config, messages }))),
    ];

    expectDistinctSafeIds(ids);
  });

  it("Ollama chat gives the same tool a new id on every turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => ollamaJson())
    );
    const config = {
      provider: "ollama" as const,
      model: "llama-test",
      apiKey: "",
    };

    const first = await ollama.chat({ config, messages });
    const second = await ollama.chat({ config, messages });

    expectDistinctSafeIds([first.toolCalls[0]!.id, second.toolCalls[0]!.id]);
  });
});
