/**
 * Maps an MCP tool name to a name LLM tool-calling APIs accept.
 *
 * MCP tool names may contain dots (for example `files.read`), but OpenAI and
 * Anthropic reject function names outside `[a-zA-Z0-9_-]`. Every other
 * character becomes an underscore, so names that are already valid pass
 * through unchanged. Callers still dedupe the result and dispatch by the
 * original MCP name.
 *
 * @param name - Tool name as advertised by the MCP server.
 * @returns A provider-safe tool name, or `"tool"` when `name` is empty.
 * @internal
 */
export function providerToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_") || "tool";
}
