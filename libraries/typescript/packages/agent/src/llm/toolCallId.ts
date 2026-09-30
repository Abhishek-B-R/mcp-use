/**
 * Create an id for a tool call when the provider does not return one
 * (Gemini, Ollama).
 *
 * The call's index in the response is not enough: every turn of a tool loop
 * is a new request that starts counting at 0 again, so the same tool called
 * on two turns would get the same id and be merged wherever calls are
 * tracked by id. The result stays within `[a-zA-Z0-9_-]` and 40 characters
 * so it is also a valid id if the conversation is later sent to OpenAI or
 * Anthropic.
 */
export function generateToolCallId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `call_${hex}`;
}
