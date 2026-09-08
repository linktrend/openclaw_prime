import assert from "node:assert/strict";
import test from "node:test";
import {
  executeParityDeployment,
  loadOverlay,
  parseOverlay,
  protectedFieldsEqual,
  validateTechnicalOverlay,
} from "./overlay.mjs";

const overlay = loadOverlay();

test("technical overlay is allowlisted and preserves protected config fields", () => {
  assert.deepEqual(validateTechnicalOverlay(overlay), []);
  const before = {
    agents: {
      defaults: {
        model: { primary: "openai/gpt-5.6-luna", fallbacks: ["openrouter/openai/gpt-5.6-luna"] },
        thinkingDefault: "medium",
        models: {
          "openai/gpt-5.6-sol": { params: { thinking: "medium" }, agentRuntime: { id: "codex" } },
          "openrouter/openai/gpt-5.6-luna": { params: { thinking: "medium" } },
        },
      },
    },
    channels: { telegram: { account: "agent-specific" } },
    memory: { private: true },
    plugins: {
      entries: {
        googlechat: { enabled: false },
        custom: { enabled: true, config: { private: true } },
      },
    },
  };
  const after = structuredClone(before);
  after.agents.defaults.model.primary = "openai/gpt-5.6-sol";
  after.agents.defaults.model.fallbacks = ["openrouter/openai/gpt-5.6-luna"];
  after.agents.defaults.thinkingDefault = "low";
  after.agents.defaults.models["openai/gpt-5.6-sol"].params.thinking = "low";
  after.agents.defaults.models["openrouter/openai/gpt-5.6-luna"].params.thinking = "high";
  after.plugins.entries.googlechat.enabled = false;
  assert.equal(protectedFieldsEqual(before, after), true);
});

test("deployment guard captures all baselines and backups before first write", async () => {
  const agents = ["lisa", "david"];
  const events = [];
  const configs = new Map(
    agents.map((agent) => [
      agent,
      {
        agents: {
          defaults: {
            model: { primary: "openai/gpt-5.6-sol", fallbacks: ["openrouter/openai/gpt-5.6-luna"] },
            thinkingDefault: "low",
            models: {
              "openai/gpt-5.6-sol": { params: { thinking: "low" }, agentRuntime: { id: "codex" } },
              "openrouter/openai/gpt-5.6-luna": { params: { thinking: "high" } },
            },
          },
        },
        plugins: { entries: { googlechat: { enabled: false } } },
      },
    ]),
  );
  const result = await executeParityDeployment({
    agents,
    captureStructuralBaseline: async (agent) => {
      events.push(`baseline:${agent}`);
      return {
        agent,
        runtimeRoot: `/srv/${agent}`,
        workspacePath: `/srv/${agent}/workspace`,
        stateDbPath: `/srv/${agent}/state/openclaw.sqlite`,
        configuredAgentIds: ["main"],
        topLevelKeys: [],
        agentsKeys: [],
        pluginIds: [],
        channelIds: [],
        model: {},
        presence: {
          identity: true,
          soul: true,
          tools: true,
          agents: true,
          jobs: false,
          schedules: false,
          memory: true,
          recipients: false,
        },
      };
    },
    backupRuntimeRoot: async (agent) => {
      events.push(`backup:${agent}`);
      return `backup-${agent}`;
    },
    readConfig: async (agent) => configs.get(agent),
    writeConfig: async (agent, config) => {
      events.push(`write:${agent}`);
      configs.set(agent, config);
    },
    writeEphemeralReceipt: async (receipt) => events.push(`receipt:${receipt.status}`),
    restoreRuntimeRoot: async (agent, backup) => events.push(`restore:${agent}:${backup}`),
  });
  assert.equal(result.status, "complete");
  assert.deepEqual(events.slice(0, 6), [
    "baseline:lisa",
    "baseline:david",
    "receipt:baseline-captured",
    "backup:lisa",
    "backup:david",
    "receipt:backups-captured",
  ]);
  assert.ok(events.indexOf("write:lisa") > events.indexOf("backup:david"));
});

test("deployment guard rolls back already-written agents on protected mismatch", async () => {
  const events = [];
  const reads = new Map();
  let config = {
    agents: {
      defaults: {
        model: { primary: "openai/gpt-5.6-sol", fallbacks: ["openrouter/openai/gpt-5.6-luna"] },
        thinkingDefault: "low",
        models: {
          "openai/gpt-5.6-sol": { params: { thinking: "low" }, agentRuntime: { id: "codex" } },
          "openrouter/openai/gpt-5.6-luna": { params: { thinking: "high" } },
        },
      },
    },
    plugins: { entries: { googlechat: { enabled: false } } },
    channels: { telegram: { account: "original" } },
  };
  await assert.rejects(
    () =>
      executeParityDeployment({
        agents: ["lisa", "david"],
        captureStructuralBaseline: async (agent) => ({
          agent,
          runtimeRoot: `/srv/${agent}`,
          workspacePath: `/srv/${agent}/workspace`,
          stateDbPath: `/srv/${agent}/state/openclaw.sqlite`,
          configuredAgentIds: ["main"],
          topLevelKeys: [],
          agentsKeys: [],
          pluginIds: [],
          channelIds: [],
          model: {},
          presence: {
            identity: true,
            soul: true,
            tools: true,
            agents: true,
            jobs: false,
            schedules: false,
            memory: true,
            recipients: false,
          },
        }),
        backupRuntimeRoot: async (agent) => `backup-${agent}`,
        readConfig: async (agent) => {
          const count = (reads.get(agent) ?? 0) + 1;
          reads.set(agent, count);
          return agent === "david" && count === 2
            ? { ...config, channels: { telegram: { account: "changed" } } }
            : config;
        },
        writeConfig: async (agent, next) => {
          events.push(`write:${agent}`);
          config = next;
        },
        writeEphemeralReceipt: async (receipt) => events.push(`receipt:${receipt.status}`),
        restoreRuntimeRoot: async (agent, backup) => events.push(`restore:${agent}:${backup}`),
      }),
    /rollback=complete/,
  );
  assert.deepEqual(events, [
    "receipt:baseline-captured",
    "receipt:backups-captured",
    "write:lisa",
    "write:david",
    "restore:david:backup-david",
    "restore:lisa:backup-lisa",
    "receipt:rolled-back",
  ]);
});

test("overlay parser rejects protected domains", () => {
  const invalid = parseOverlay("{ identity: { name: 'Lisa' } }");
  assert.match(validateTechnicalOverlay(invalid).join("\n"), /not allowlisted|protected domain/u);
});
