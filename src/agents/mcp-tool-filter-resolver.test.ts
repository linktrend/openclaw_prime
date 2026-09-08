/** Unit tests for MCP tool-filter composition (operator ∩ plugin overlay). */
import { afterEach, describe, expect, it } from "vitest";
import { resetPluginRuntimeStateForTest } from "../plugins/runtime.js";
import {
  describeComposedMcpToolFilter,
  resolveMcpToolFilterComposition,
  serverAllowsMcpUtilityTool,
  shouldExposeComposedMcpTool,
  testing,
} from "./mcp-tool-filter-resolver.js";

describe("mcp tool filter composition", () => {
  afterEach(() => {
    testing.reset();
    resetPluginRuntimeStateForTest();
  });

  it("passes config-only when no plugin resolver is registered", async () => {
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search", "brain_load"] },
    });
    expect(composition).toEqual({
      kind: "config-only",
      selection: { include: ["brain_search", "brain_load"] },
    });
    expect(shouldExposeComposedMcpTool(composition, "brain_search")).toBe(true);
    expect(shouldExposeComposedMcpTool(composition, "brain_browse")).toBe(false);
  });

  it("omits all tools when plugin resolve returns null", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkbrain",
          {
            pluginId: "linkbrain",
            serverName: "linkbrain",
            resolve: () => null,
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search"] },
    });
    expect(composition).toEqual({ kind: "omit" });
    expect(shouldExposeComposedMcpTool(composition, "brain_search")).toBe(false);
    expect(describeComposedMcpToolFilter(composition)).toEqual({ denyAll: true });
  });

  it("treats explicit empty include as deny-all, not unrestricted", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkbrain",
          {
            pluginId: "linkbrain",
            serverName: "linkbrain",
            resolve: () => ({ include: [] }),
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search"] },
    });
    expect(composition).toEqual({ kind: "omit" });
    expect(describeComposedMcpToolFilter(composition)).toEqual({ denyAll: true });
  });

  it("intersects operator ceiling with plugin include overlay", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkskills",
          {
            pluginId: "linkskills",
            serverName: "linkskills",
            resolve: () => ({
              include: ["skills_list", "skills_feedback_submit"],
            }),
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkskills",
      configSelection: {
        include: ["skills_list", "skills_run_start", "skills_feedback_submit"],
      },
    });
    expect(composition.kind).toBe("intersect");
    expect(shouldExposeComposedMcpTool(composition, "skills_list")).toBe(true);
    expect(shouldExposeComposedMcpTool(composition, "skills_feedback_submit")).toBe(true);
    expect(shouldExposeComposedMcpTool(composition, "skills_run_start")).toBe(false);
    const described = describeComposedMcpToolFilter(composition);
    expect(described?.denyAll).toBeUndefined();
    expect(described?.operator?.include).toEqual([
      "skills_list",
      "skills_run_start",
      "skills_feedback_submit",
    ]);
    expect(described?.plugin?.include).toEqual(["skills_list", "skills_feedback_submit"]);
  });

  it("exposes nothing when operator and plugin includes are disjoint", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkbrain",
          {
            pluginId: "linkbrain",
            serverName: "linkbrain",
            resolve: () => ({ include: ["brain_capture_batch"] }),
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search", "brain_load"] },
    });
    expect(shouldExposeComposedMcpTool(composition, "brain_search")).toBe(false);
    expect(shouldExposeComposedMcpTool(composition, "brain_capture_batch")).toBe(false);
  });

  it("does not let plugin include widen past the operator ceiling", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkbrain",
          {
            pluginId: "linkbrain",
            serverName: "linkbrain",
            resolve: () => ({
              include: ["brain_search", "brain_secret_widen"],
            }),
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search"] },
    });
    expect(shouldExposeComposedMcpTool(composition, "brain_search")).toBe(true);
    expect(shouldExposeComposedMcpTool(composition, "brain_secret_widen")).toBe(false);
  });
  it("fails closed when plugin resolve throws", async () => {
    testing.setResolversByServerName(
      new Map([
        [
          "linkbrain",
          {
            pluginId: "linkbrain",
            serverName: "linkbrain",
            resolve: () => {
              throw new Error("boom");
            },
          },
        ],
      ]),
    );
    const composition = await resolveMcpToolFilterComposition({
      serverName: "linkbrain",
      configSelection: { include: ["brain_search"] },
    });
    expect(composition).toEqual({ kind: "omit" });
  });

  it("denies utility tools on denyAll and requires operator ∩ plugin", () => {
    expect(serverAllowsMcpUtilityTool({ denyAll: true }, "resources_list")).toBe(false);
    expect(serverAllowsMcpUtilityTool({ include: [] }, "resources_list")).toBe(true);
    expect(
      serverAllowsMcpUtilityTool(
        {
          operator: { include: ["resources_*"] },
          plugin: { include: ["brain_search"] },
        },
        "resources_list",
      ),
    ).toBe(false);
    expect(
      serverAllowsMcpUtilityTool(
        {
          operator: { include: ["resources_*", "brain_search"] },
          plugin: { include: ["resources_list", "brain_search"] },
        },
        "resources_list",
      ),
    ).toBe(true);
  });
});
