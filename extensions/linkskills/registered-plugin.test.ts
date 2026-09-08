import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { describe, expect, it, vi } from "vitest";
import linkskillsPlugin from "./index.js";
import type { OpenClawPluginApi } from "./runtime-api.js";
import { createSkillsTelemetryCollector } from "./src/collect.js";
import { parseLinkskillsConfig } from "./src/config.js";
import { buildLinkskillsFlaggedMcpToolFilter } from "./src/feature-flags.js";

describe("linkskills registered-plugin integration", () => {
  it("registers the scoped OAuth bridge without exposing raw skills_* tools", () => {
    const tools: string[] = [];
    const toolFilters: Array<{ serverName: string }> = [];
    const api = createTestPluginApi({
      pluginConfig: { mcpDiscoveryRead: true, governedExecution: true },
      registerTool: (tool) => {
        tools.push(typeof tool === "function" ? "factory" : String(tool.name));
      },
      registerService: () => undefined,
      on: () => undefined,
      registerMcpServerToolFilter: (resolver) => {
        toolFilters.push({ serverName: resolver.serverName });
      },
    });
    linkskillsPlugin.register(api);
    expect(tools.filter((n) => n.startsWith("skills_"))).toEqual([]);
    expect(tools).toContain("linkskills_use");
    expect(toolFilters).toEqual([{ serverName: "linkskills" }]);
    expect(
      buildLinkskillsFlaggedMcpToolFilter(
        parseLinkskillsConfig({
          mcpDiscoveryRead: false,
          governedExecution: false,
          telemetryEnqueue: false,
          telemetryDrain: false,
        }),
      ),
    ).toBeNull();
    expect(
      buildLinkskillsFlaggedMcpToolFilter(
        parseLinkskillsConfig({
          mcpDiscoveryRead: true,
          governedExecution: true,
          telemetryEnqueue: true,
          telemetryDrain: false,
        }),
      )?.include,
    ).toContain("skills_release_verify");
    expect(
      buildLinkskillsFlaggedMcpToolFilter(
        parseLinkskillsConfig({
          mcpDiscoveryRead: true,
          governedExecution: true,
          telemetryEnqueue: true,
          telemetryDrain: false,
        }),
      )?.include,
    ).not.toContain("skills_run_start");
  });

  it("registers after_tool_call and never conversation hooks; isolates from Brain", () => {
    const hooks: string[] = [];
    const api = createTestPluginApi({
      pluginConfig: { telemetryEnqueue: true, telemetryDrain: false },
      on: (name: string) => {
        hooks.push(name);
      },
      registerService: () => undefined,
      registerMemoryCapability: vi.fn(),
      registerChannel: vi.fn(),
    } as unknown as Partial<OpenClawPluginApi>);

    linkskillsPlugin.register(api as OpenClawPluginApi);

    expect(hooks).toContain("after_tool_call");
    expect(hooks).toContain("gateway_start");
    expect(hooks).toContain("gateway_stop");
    expect(hooks).not.toContain("agent_end");
    expect(hooks).not.toContain("message_received");
    expect(hooks).not.toContain("before_compaction");
    expect(api.registerMemoryCapability).not.toHaveBeenCalled();
    expect(api.registerChannel).not.toHaveBeenCalled();
  });

  it("non-Skills tools remain silent even when telemetryEnqueue is enabled", () => {
    const collector = createSkillsTelemetryCollector();
    expect(collector.observe({ toolName: "sessions_list" })).toBeNull();
    expect(collector.observe({ toolName: "memory_search" })).toBeNull();
    expect(collector.observe({ toolName: "cron" })).toBeNull();
    expect(collector.observe({ toolName: "brain_browse" })).toBeNull();
  });
});
