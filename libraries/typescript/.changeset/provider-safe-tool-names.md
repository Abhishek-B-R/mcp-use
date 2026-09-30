---
"@mcp-use/agent": patch
---

Expose MCP tool names with characters outside `[a-zA-Z0-9_-]` (such as `files.read`) to the LLM with those characters replaced by underscores, so OpenAI and Anthropic no longer reject the request. Tool calls are still dispatched to the MCP server under the original name.
