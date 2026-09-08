/**
 * Plugin-registered MCP tool-filter resolvers: lookup and compose with operator
 * `mcp.servers.<id>.toolFilter`. Process-local only — never writes config.
 */
import { normalizeOptionalString } from "@openclaw/normalization-core/string-coerce";
import { logWarn } from "../logger.js";
import {
  getMcpToolFilterRegistrationGeneration,
  resetMcpToolFilterRegistrationGeneration,
} from "../plugins/mcp-tool-filter-registration.js";
import { getActivePluginRegistry } from "../plugins/runtime.js";
import type {
  McpServerToolFilterResolved,
  OpenClawPluginMcpServerToolFilter,
} from "../plugins/types.js";
import { matchesMcpToolFilterPattern } from "./agent-bundle-mcp-filter.js";

export type McpToolSelection = {
  include?: string[];
  exclude?: string[];
};

/** Catalog / materialization projection of a composed tool filter. */
export type McpCatalogToolFilter = {
  denyAll?: boolean;
  include?: string[];
  exclude?: string[];
  operator?: McpToolSelection;
  plugin?: McpToolSelection;
};

type McpServerToolFilterEntry = OpenClawPluginMcpServerToolFilter & {
  pluginId: string;
};

const MCP_TOOL_FILTER_TEST_STATE_KEY = Symbol.for("openclaw.mcpServerToolFilterTestState");

type McpToolFilterTestState = {
  resolversByServerName?: Map<string, McpServerToolFilterEntry>;
  registrationGeneration?: number;
};

function getTestState(): McpToolFilterTestState {
  const globalStore = globalThis as Record<PropertyKey, unknown>;
  const existing = globalStore[MCP_TOOL_FILTER_TEST_STATE_KEY] as
    | McpToolFilterTestState
    | undefined;
  if (existing) {
    return existing;
  }
  const state: McpToolFilterTestState = {};
  globalStore[MCP_TOOL_FILTER_TEST_STATE_KEY] = state;
  return state;
}

export function observeMcpToolFilterRegistrationGeneration(): number {
  const testOverride = getTestState().registrationGeneration;
  if (typeof testOverride === "number" && Number.isFinite(testOverride)) {
    return Math.floor(testOverride);
  }
  return getMcpToolFilterRegistrationGeneration();
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

function normalizeResolvedOverlay(
  value: McpServerToolFilterResolved | null | undefined,
): McpToolSelection | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const hasIncludeKey = Array.isArray(value.include);
  const include = normalizeStringList(value.include);
  const exclude = normalizeStringList(value.exclude);
  // Explicit empty include is deny-all (same as null). Empty include must never
  // mean "unrestricted" — that is the no-include-key / omit-include semantics.
  if (hasIncludeKey && !include) {
    return null;
  }
  return {
    include,
    exclude,
  };
}

function listMcpServerToolFiltersByServerName(): Map<string, McpServerToolFilterEntry> {
  const testOverrides = getTestState().resolversByServerName;
  if (testOverrides) {
    return new Map([...testOverrides.entries()].toSorted(([a], [b]) => a.localeCompare(b)));
  }
  // Active registry is authoritative. Gateway startup must keep enabled
  // overlay owners in that registry (onStartup + forceFull reuse); do not
  // gap-fill from pinned surfaces.
  const registry = getActivePluginRegistry();
  const byName = new Map<string, McpServerToolFilterEntry>();
  for (const entry of registry?.mcpServerToolFilters ?? []) {
    const serverName = normalizeOptionalString(entry.resolver.serverName);
    if (!serverName || typeof entry.resolver.resolve !== "function") {
      continue;
    }
    byName.set(serverName, {
      pluginId: entry.pluginId,
      serverName,
      resolve: entry.resolver.resolve,
    });
  }
  return new Map([...byName.entries()].toSorted(([a], [b]) => a.localeCompare(b)));
}

export function shouldExposeMcpTool(selection: McpToolSelection, toolName: string): boolean {
  const include = selection.include ?? [];
  const exclude = selection.exclude ?? [];
  if (
    include.length > 0 &&
    !include.some((pattern) => matchesMcpToolFilterPattern(pattern, toolName))
  ) {
    return false;
  }
  return !exclude.some((pattern) => matchesMcpToolFilterPattern(pattern, toolName));
}

export type ResolvedMcpToolFilterComposition =
  | { kind: "config-only"; selection: McpToolSelection }
  | { kind: "omit" }
  | { kind: "intersect"; config: McpToolSelection; plugin: McpToolSelection };

/**
 * Resolve the owning plugin overlay and compose it with the operator ceiling.
 * `omit` means the plugin default-denies / rolled back this server for the run.
 */
export async function resolveMcpToolFilterComposition(params: {
  serverName: string;
  configSelection: McpToolSelection;
}): Promise<ResolvedMcpToolFilterComposition> {
  const resolver = listMcpServerToolFiltersByServerName().get(params.serverName);
  if (!resolver) {
    return { kind: "config-only", selection: params.configSelection };
  }
  let overlay: McpServerToolFilterResolved | null;
  try {
    overlay = await Promise.resolve(resolver.resolve());
  } catch (error) {
    logWarn(
      `mcp tool filter: resolve failed for server "${params.serverName}" (plugin "${resolver.pluginId}"): ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    return { kind: "omit" };
  }
  const pluginSelection = normalizeResolvedOverlay(overlay);
  if (pluginSelection === null) {
    return { kind: "omit" };
  }
  return {
    kind: "intersect",
    config: params.configSelection,
    plugin: pluginSelection,
  };
}

/** Apply composed selection to one listed tool name. */
export function shouldExposeComposedMcpTool(
  composition: ResolvedMcpToolFilterComposition,
  toolName: string,
): boolean {
  switch (composition.kind) {
    case "omit":
      return false;
    case "config-only":
      return shouldExposeMcpTool(composition.selection, toolName);
    case "intersect":
      return (
        shouldExposeMcpTool(composition.config, toolName) &&
        shouldExposeMcpTool(composition.plugin, toolName)
      );
    default: {
      const _exhaustive: never = composition;
      return _exhaustive;
    }
  }
}

function cloneSelection(selection: McpToolSelection): McpToolSelection | undefined {
  if (!selection.include && !selection.exclude) {
    return undefined;
  }
  return {
    ...(selection.include ? { include: [...selection.include] } : {}),
    ...(selection.exclude ? { exclude: [...selection.exclude] } : {}),
  };
}

/**
 * Catalog metadata projection of the effective filter.
 * Deny-all uses `denyAll: true` — never `include: []` (unrestricted).
 * Intersect preserves both sides so utility tools apply operator ∩ plugin.
 */
export function describeComposedMcpToolFilter(
  composition: ResolvedMcpToolFilterComposition,
): McpCatalogToolFilter | undefined {
  switch (composition.kind) {
    case "omit":
      return { denyAll: true };
    case "config-only":
      return cloneSelection(composition.selection);
    case "intersect": {
      const operator = cloneSelection(composition.config);
      const plugin = cloneSelection(composition.plugin);
      if (!operator && !plugin) {
        return undefined;
      }
      return {
        ...(operator ? { operator } : {}),
        ...(plugin ? { plugin } : {}),
        // Convenience flatten for diagnostics: plugin include under operator ceiling
        // is not authoritative alone — materialize must use operator ∩ plugin.
        ...(plugin?.include
          ? { include: [...plugin.include] }
          : operator?.include
            ? { include: [...operator.include] }
            : {}),
        ...(() => {
          const exclude = [
            ...(composition.config.exclude ?? []),
            ...(composition.plugin.exclude ?? []),
          ];
          return exclude.length > 0 ? { exclude } : {};
        })(),
      };
    }
    default: {
      const _exhaustive: never = composition;
      return _exhaustive;
    }
  }
}

/** Whether a utility operation (resources or prompts) passes catalog toolFilter metadata. */
export function serverAllowsMcpUtilityTool(
  toolFilter: McpCatalogToolFilter | undefined,
  operation: string,
): boolean {
  if (!toolFilter) {
    return true;
  }
  if (toolFilter.denyAll) {
    return false;
  }
  if (toolFilter.operator || toolFilter.plugin) {
    return (
      shouldExposeMcpTool(toolFilter.operator ?? {}, operation) &&
      shouldExposeMcpTool(toolFilter.plugin ?? {}, operation)
    );
  }
  return shouldExposeMcpTool(toolFilter, operation);
}

export const testing = {
  setResolversByServerName(resolvers: Map<string, McpServerToolFilterEntry> | undefined) {
    const state = getTestState();
    if (!resolvers) {
      delete state.resolversByServerName;
      return;
    }
    state.resolversByServerName = resolvers;
  },
  setRegistrationGeneration(generation: number | undefined) {
    const state = getTestState();
    if (generation === undefined) {
      delete state.registrationGeneration;
      return;
    }
    state.registrationGeneration = generation;
  },
  getRegistrationGeneration() {
    const testOverride = getTestState().registrationGeneration;
    if (typeof testOverride === "number" && Number.isFinite(testOverride)) {
      return Math.floor(testOverride);
    }
    return getMcpToolFilterRegistrationGeneration();
  },
  reset() {
    const globalStore = globalThis as Record<PropertyKey, unknown>;
    delete globalStore[MCP_TOOL_FILTER_TEST_STATE_KEY];
    resetMcpToolFilterRegistrationGeneration();
  },
};
