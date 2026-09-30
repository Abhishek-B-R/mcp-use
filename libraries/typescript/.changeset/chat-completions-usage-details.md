---
"@mcp-use/agent": patch
---

Token usage now includes cached and reasoning tokens for OpenAI-compatible and OpenRouter models (read from `prompt_tokens_details` and `completion_tokens_details`) and cached tokens for Gemini (`cachedContentTokenCount`). Before, both were always reported as absent for these providers.
