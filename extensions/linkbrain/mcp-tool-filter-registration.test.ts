import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
/**
 * Extension-scoped proof that Brain feature flags drive the registered MCP
 * toolFilter overlay (public plugin API only — no core agent deep imports).
 */
import { describe, expect, it } from "vitest";
import linkbrainPlugin from "./index.js";
import { LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST } from "./mcp-tool-filter.js";
import { parseLinkbrainConfig } from "./src/config.js";
import { buildLinkbrainFlaggedMcpToolFilter } from "./src/feature-flags.js";

describe("linkbrain managed MCP toolFilter registration (extension scope)", () => {
  it("registers a live resolve overlay that deny-alls when all flags are false", () => {
    const liveConfig: Record<string, unknown> = {
      mcpRead: false,
      captureEnqueue: false,
      captureDrain: false,
      coordinationWrites: false,
    };
    let resolve: (() => { include: string[] } | null) | undefined;
    const api = createTestPluginApi({
      pluginConfig: liveConfig,
      registerMcpServerToolFilter: (resolver) => {
        expect(resolver.serverName).toBe("linkbrain");
        resolve = resolver.resolve as () => { include: string[] } | null;
      },
      registerService: () => undefined,
      on: () => undefined,
    });

    linkbrainPlugin.register(api);
    expect(resolve).toBeTypeOf("function");
    expect(resolve?.()).toBeNull();

    Object.assign(liveConfig, {
      mcpRead: true,
      captureEnqueue: false,
      captureDrain: false,
      coordinationWrites: false,
    });
    const partial = resolve?.();
    expect(partial?.include).toContain("brain_browse");
    expect(partial?.include).not.toContain("brain_capture_batch");

    Object.assign(liveConfig, {
      mcpRead: true,
      captureEnqueue: true,
      captureDrain: true,
      coordinationWrites: true,
    });
    expect(resolve?.()?.include?.length).toBe(LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST.length);
    expect(
      buildLinkbrainFlaggedMcpToolFilter(parseLinkbrainConfig(liveConfig))?.include.length,
    ).toBe(LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST.length);
  });

  it("exposes unregisterMcpServerToolFilter on the test API surface", () => {
    const api = createTestPluginApi();
    expect(() => api.unregisterMcpServerToolFilter("linkbrain")).not.toThrow();
  });
});
