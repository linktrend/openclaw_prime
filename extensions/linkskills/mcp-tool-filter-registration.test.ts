import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
/**
 * Extension-scoped proof that Skills feature flags drive the registered MCP
 * toolFilter overlay (public plugin API only — no core agent deep imports).
 */
import { describe, expect, it } from "vitest";
import linkskillsPlugin from "./index.js";
import { LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST } from "./mcp-tool-filter.js";
import { parseLinkskillsConfig } from "./src/config.js";
import { buildLinkskillsFlaggedMcpToolFilter } from "./src/feature-flags.js";

describe("linkskills managed MCP toolFilter registration (extension scope)", () => {
  it("registers a live resolve overlay that deny-alls when all flags are false", () => {
    const liveConfig: Record<string, unknown> = {
      mcpDiscoveryRead: false,
      governedExecution: false,
      telemetryEnqueue: false,
      telemetryDrain: false,
    };
    let resolve: (() => { include: string[] } | null) | undefined;
    const api = createTestPluginApi({
      pluginConfig: liveConfig,
      registerMcpServerToolFilter: (resolver) => {
        expect(resolver.serverName).toBe("linkskills");
        resolve = resolver.resolve as () => { include: string[] } | null;
      },
      registerService: () => undefined,
      on: () => undefined,
    });

    linkskillsPlugin.register(api);
    expect(resolve).toBeTypeOf("function");
    expect(resolve?.()).toBeNull();

    Object.assign(liveConfig, {
      mcpDiscoveryRead: true,
      governedExecution: false,
      telemetryEnqueue: false,
      telemetryDrain: false,
    });
    const partial = resolve?.();
    expect(partial?.include).toContain("skills_catalog_list");
    expect(partial?.include).not.toContain("skills_list");
    expect(partial?.include).not.toContain("skills_run_start");

    Object.assign(liveConfig, {
      mcpDiscoveryRead: true,
      governedExecution: true,
      telemetryEnqueue: true,
      telemetryDrain: true,
    });
    expect(resolve?.()?.include?.length).toBe(LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST.length);
    expect(
      buildLinkskillsFlaggedMcpToolFilter(parseLinkskillsConfig(liveConfig))?.include.length,
    ).toBe(LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST.length);
  });

  it("exposes unregisterMcpServerToolFilter on the test API surface", () => {
    const api = createTestPluginApi();
    expect(() => api.unregisterMcpServerToolFilter("linkskills")).not.toThrow();
  });
});
