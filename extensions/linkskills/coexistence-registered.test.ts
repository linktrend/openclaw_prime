import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { describe, expect, it, vi } from "vitest";
import linkbrainPlugin from "../linkbrain/index.js";
import type { OpenClawPluginApi } from "../linkbrain/runtime-api.js";
import linkskillsPlugin from "../linkskills/index.js";

/**
 * Registered-plugin coexistence: Brain and Skills can register independently
 * without claiming ownership of native memory, compaction, sessions, cron,
 * channels, or native skills. Failure/disablement of one domain does not
 * unregister the other.
 */
describe("linkbrain+linkskills registered-plugin coexistence", () => {
  it("registers both plugins with governed Brain hooks when allowConversationAccess===true", () => {
    const brainHooks: string[] = [];
    const skillsHooks: string[] = [];
    const memory = vi.fn();
    const channel = vi.fn();
    const compaction = vi.fn();

    const brainApi = createTestPluginApi({
      id: "linkbrain",
      config: {
        plugins: {
          entries: {
            linkbrain: {
              hooks: { allowConversationAccess: true },
            },
          },
        },
      },
      pluginConfig: {
        mcpRead: false,
        captureEnqueue: true,
        captureDrain: false,
        coordinationWrites: false,
      },
      on: (name: string) => {
        brainHooks.push(name);
      },
      registerService: () => undefined,
      registerMemoryCapability: memory,
      registerChannel: channel,
      registerCompactionProvider: compaction,
    } as unknown as Partial<OpenClawPluginApi>);

    const skillsApi = createTestPluginApi({
      id: "linkskills",
      pluginConfig: {
        mcpDiscoveryRead: false,
        governedExecution: false,
        telemetryEnqueue: true,
        telemetryDrain: false,
      },
      on: (name: string) => {
        skillsHooks.push(name);
      },
      registerService: () => undefined,
      registerMemoryCapability: memory,
      registerChannel: channel,
      registerCompactionProvider: compaction,
    } as unknown as Partial<OpenClawPluginApi>);

    linkbrainPlugin.register(brainApi as OpenClawPluginApi);
    linkskillsPlugin.register(skillsApi as OpenClawPluginApi);

    expect(brainHooks).toContain("before_compaction");
    expect(brainHooks).toContain("session_start");
    expect(skillsHooks).toContain("after_tool_call");
    expect(skillsHooks).not.toContain("agent_end");

    // Native ownership remains with core/other plugins.
    expect(memory).not.toHaveBeenCalled();
    expect(channel).not.toHaveBeenCalled();
    expect(compaction).not.toHaveBeenCalled();
  });

  it("absent allowConversationAccess: Brain stays service-only while Skills still register", () => {
    const brainHooks: string[] = [];
    const skillsHooks: string[] = [];
    const memory = vi.fn();
    const channel = vi.fn();
    const compaction = vi.fn();

    const brainApi = createTestPluginApi({
      id: "linkbrain",
      pluginConfig: {
        mcpRead: false,
        captureEnqueue: true,
        captureDrain: false,
        coordinationWrites: false,
      },
      on: (name: string) => {
        brainHooks.push(name);
      },
      registerService: () => undefined,
      registerMemoryCapability: memory,
      registerChannel: channel,
      registerCompactionProvider: compaction,
    } as unknown as Partial<OpenClawPluginApi>);

    const skillsApi = createTestPluginApi({
      id: "linkskills",
      pluginConfig: {
        mcpDiscoveryRead: false,
        governedExecution: false,
        telemetryEnqueue: true,
        telemetryDrain: false,
      },
      on: (name: string) => {
        skillsHooks.push(name);
      },
      registerService: () => undefined,
      registerMemoryCapability: memory,
      registerChannel: channel,
      registerCompactionProvider: compaction,
    } as unknown as Partial<OpenClawPluginApi>);

    linkbrainPlugin.register(brainApi as OpenClawPluginApi);
    linkskillsPlugin.register(skillsApi as OpenClawPluginApi);

    expect(brainHooks).toEqual(["gateway_start", "gateway_stop"]);
    expect(brainHooks).not.toContain("before_compaction");
    expect(brainHooks).not.toContain("session_start");
    expect(skillsHooks).toContain("after_tool_call");
    expect(skillsHooks).not.toContain("agent_end");
    expect(memory).not.toHaveBeenCalled();
    expect(channel).not.toHaveBeenCalled();
    expect(compaction).not.toHaveBeenCalled();
  });

  it("independent flag disablement: Skills off does not remove Brain hooks", () => {
    const brainHooks: string[] = [];
    const brainApi = createTestPluginApi({
      pluginConfig: { captureEnqueue: true },
      on: (name: string) => {
        brainHooks.push(name);
      },
      registerService: () => undefined,
    });
    const skillsApi = createTestPluginApi({
      pluginConfig: {
        telemetryEnqueue: false,
        telemetryDrain: false,
        mcpDiscoveryRead: false,
        governedExecution: false,
      },
      on: () => undefined,
      registerService: () => undefined,
    });

    linkbrainPlugin.register(brainApi);
    linkskillsPlugin.register(skillsApi);

    expect(brainHooks.length).toBeGreaterThan(0);
    expect(brainHooks).toContain("gateway_stop");
  });
});
