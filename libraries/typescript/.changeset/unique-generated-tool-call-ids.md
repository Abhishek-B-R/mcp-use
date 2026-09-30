---
"@mcp-use/agent": patch
---

Gemini and Ollama tool calls now get a unique id per call. The ids were built from the call's index in the response, which starts at 0 on every turn, so a model that called the same tool on two turns produced the same id twice and the second call was merged into the first in the inspector trace.
