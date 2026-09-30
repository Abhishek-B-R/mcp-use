import type { BaseConnector } from "@mcp-use/client";
import { describe, expect, it, vi } from "vitest";

import { LangChainAdapter } from "../../../src/adapters/langchain_adapter.js";
import { NativeAdapter } from "../../../src/adapters/native_adapter.js";
import { MCPAgent } from "../../../src/agents/mcp_agent.js";

// OpenAI and Anthropic both reject tool names outside this pattern, while MCP
// tool names may also contain dots.
const PROVIDER_TOOL_NAME = /^[a-zA-Z0-9_-]+$/;

function fakeConnector(names: string[]) {
  const callTool = vi.fn().mockResolvedValue({ content: [] });
  const connector = {
    tools: names.map((name) => ({
      name,
      inputSchema: { type: "object", properties: {} },
    })),
    callTool,
  } as unknown as BaseConnector;
  return { connector, callTool };
}

describe("tool names exposed to LLM providers", () => {
  it("native adapter exposes provider-safe names and dispatches by MCP name", async () => {
    const { connector, callTool } = fakeConnector([
      "files.read",
      "files_read",
      "get-weather",
    ]);
    const adapter = new NativeAdapter();

    const entries = await adapter.createToolsFromConnectors([connector]);
    const names = entries.map((entry) => entry.name);

    expect(names).toEqual(["files_read", "files_read_2", "get-weather"]);
    for (const name of names) expect(name).toMatch(PROVIDER_TOOL_NAME);

    const callToolByName = adapter.createCallTool();
    await callToolByName("files_read", {});
    await callToolByName("files_read_2", {});
    await callToolByName("get-weather", {});
    expect(callTool.mock.calls.map(([name]) => name)).toEqual([
      "files.read",
      "files_read",
      "get-weather",
    ]);
  });

  it("langchain adapter exposes provider-safe names and dispatches by MCP name", async () => {
    const { connector, callTool } = fakeConnector([
      "files.read",
      "Get-Weather",
    ]);
    const adapter = new LangChainAdapter();

    const tools = await adapter.createToolsFromConnectors([connector]);

    expect(tools.map((tool) => tool.name)).toEqual([
      "files_read",
      "Get-Weather",
    ]);
    await tools[0]!.invoke({});
    expect(callTool).toHaveBeenCalledWith("files.read", {});
  });

  it("MCPAgent with live connections exposes provider-safe names", async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [] });
    const agent = new MCPAgent({
      llm: { provider: "openai", model: "gpt-test", apiKey: "test-key" },
      mcpServers: [
        {
          tools: [
            {
              name: "files.read",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          callTool,
        },
      ],
    });
    const internals = agent as unknown as {
      providerTools: Array<{ name: string }>;
      callTool: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<unknown>;
    };

    expect(internals.providerTools.map((tool) => tool.name)).toEqual([
      "files_read",
    ]);
    await internals.callTool("files_read", {});
    expect(callTool).toHaveBeenCalledWith("files.read", {});
  });
});
