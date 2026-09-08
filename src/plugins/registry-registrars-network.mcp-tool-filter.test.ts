/** Verifies MCP tool-filter registration ownership is fail-closed. */
import { afterEach, describe, expect, it } from "vitest";
import { testing as toolFilterTesting } from "../agents/mcp-tool-filter-resolver.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { getMcpToolFilterRegistrationGeneration } from "./mcp-tool-filter-registration.js";
import { createPluginRegistry } from "./registry.js";
import type { PluginRuntime } from "./runtime/types.js";
import { createPluginRecord } from "./status.test-fixtures.js";

function createRegistryHarness() {
  const pluginRegistry = createPluginRegistry({
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
    runtime: {} as PluginRuntime,
    activateGlobalSideEffects: false,
  });
  const config = {} as OpenClawConfig;
  const apiFor = (id: string) => {
    const record = createPluginRecord({ id, source: `/plugins/${id}/index.ts` });
    pluginRegistry.registry.plugins.push(record);
    return pluginRegistry.createApi(record, { config });
  };
  return { pluginRegistry, apiFor };
}

describe("registerMcpServerToolFilter ownership", () => {
  afterEach(() => {
    toolFilterTesting.reset();
  });

  it("rejects a duplicate serverName from another plugin with an error diagnostic", () => {
    const { pluginRegistry, apiFor } = createRegistryHarness();
    const firstResolve = () => ({ include: ["a"] });
    apiFor("plugin-a").registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: firstResolve,
    });
    apiFor("plugin-b").registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: () => ({ include: ["hijack"] }),
    });

    expect(pluginRegistry.registry.mcpServerToolFilters).toHaveLength(1);
    expect(pluginRegistry.registry.mcpServerToolFilters[0]).toMatchObject({
      pluginId: "plugin-a",
      resolver: { serverName: "linkbrain", resolve: firstResolve },
    });
    expect(pluginRegistry.registry.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        pluginId: "plugin-b",
        message: expect.stringContaining('already registered by plugin "plugin-a"'),
      }),
    );
  });

  it("lets the owning plugin replace its own resolver and bumps generation", () => {
    const { pluginRegistry, apiFor } = createRegistryHarness();
    const api = apiFor("plugin-a");
    const before = getMcpToolFilterRegistrationGeneration();
    const replacement = () => ({ include: ["brain_search"] });
    api.registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: () => ({ include: ["brain_browse"] }),
    });
    api.registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: replacement,
    });

    expect(pluginRegistry.registry.mcpServerToolFilters).toHaveLength(1);
    expect(pluginRegistry.registry.mcpServerToolFilters[0]?.resolver.resolve).toBe(replacement);
    expect(getMcpToolFilterRegistrationGeneration()).toBeGreaterThan(before);
    expect(
      pluginRegistry.registry.diagnostics.filter((diagnostic) => diagnostic.level === "error"),
    ).toEqual([]);
  });

  it("lets the owning plugin unregister and rejects foreign unregister", () => {
    const { pluginRegistry, apiFor } = createRegistryHarness();
    const owner = apiFor("plugin-a");
    const other = apiFor("plugin-b");
    owner.registerMcpServerToolFilter({
      serverName: "linkbrain",
      resolve: () => ({ include: ["brain_browse"] }),
    });
    const before = getMcpToolFilterRegistrationGeneration();
    other.unregisterMcpServerToolFilter("linkbrain");
    expect(pluginRegistry.registry.mcpServerToolFilters).toHaveLength(1);
    expect(pluginRegistry.registry.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        pluginId: "plugin-b",
        message: expect.stringContaining("unregister rejected"),
      }),
    );
    owner.unregisterMcpServerToolFilter("linkbrain");
    expect(pluginRegistry.registry.mcpServerToolFilters).toHaveLength(0);
    expect(getMcpToolFilterRegistrationGeneration()).toBeGreaterThan(before);
  });
});
