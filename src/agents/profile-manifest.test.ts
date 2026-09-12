import { describe, expect, it, vi } from "vitest";
import { applyAgentConfig, buildAgentSummaries } from "../commands/agents.config.js";
import { createAgent } from "./agent-create.js";
import { resolveSessionAgentIds, setAgentEffectiveModelPrimary } from "./agent-scope.js";
import {
  OPENCLAW_PROFILE_RUNTIME_PIN,
  cloneCommonProfileManifest,
  dryRunInactiveProfileProvisioning,
  parseCommonProfileManifest,
  profileCanAuthenticate,
  profileCanRoute,
  profileCanSchedule,
} from "./profile-manifest.js";

const DAVID_MANIFEST = {
  schemaVersion: 1,
  profileId: "david",
  roleRefs: ["role:cpo", "scope:product"],
  identityRef: "platform-identity:pending:david",
  activation: "inactive",
  capabilityClasses: ["product", "research"],
  providerPins: {
    platform: "platform-contract:actor-grants-v1",
    openclaw: OPENCLAW_PROFILE_RUNTIME_PIN,
  },
  skillPins: {
    product: "skills-qualified:product:v1",
  },
  modelPolicyRef: "model-policy:future:david",
  toolExposure: ["product.read"],
  stateOwners: {
    profile: "openclaw-agent-sqlite",
    approval: "platform-approval-authority",
  },
  channelRefs: ["channel:telegram:pending"],
  accountRefs: ["account:platform:pending:david"],
  exclusions: {
    credentials: true,
    accountIds: true,
    privateState: true,
    sessions: true,
    recipients: true,
    schedules: true,
    jobs: true,
    cookies: true,
    downloads: true,
    workspace: true,
  },
} as const;

const LISA_GENERIC_SOURCE = {
  schemaVersion: 1,
  profileId: "future-exec",
  roleRefs: ["role:executive-assistant"],
  identityRef: "platform-identity:pending:future-exec",
  activation: { profile: "active", sourceSchedules: "disabled" },
  capabilityClasses: ["operations"],
  providerPins: {
    platform: "platform-contract:actor-grants-v1",
    openclaw: OPENCLAW_PROFILE_RUNTIME_PIN,
  },
  skillPins: {
    operations: "skills-qualified:operations:v1",
  },
  modelPolicyRef: "model-policy:future:future-exec",
  toolExposure: ["operations.read"],
  stateOwners: {
    profile: "openclaw-agent-sqlite",
  },
};

const LISA_PRIVATE_SOURCE = {
  ...LISA_GENERIC_SOURCE,
  credentials: { liveField: "synthetic non-secret fixture" },
  privateState: { memory: "instance-private" },
  accountIds: ["acct_live"],
  recipients: ["user@example.com"],
};

describe("common inactive profile manifests", () => {
  it("parses a versioned inactive blueprint and dry-runs with no effects", () => {
    const parsed = parseCommonProfileManifest(DAVID_MANIFEST);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value.activation).toBe("inactive");
    expect(parsed.value.providerPins.openclaw).toBe(OPENCLAW_PROFILE_RUNTIME_PIN);
    const provisioned = dryRunInactiveProfileProvisioning(parsed.value);
    expect(provisioned).toEqual({
      ok: true,
      value: {
        mode: "dry-run",
        activation: "inactive",
        profileId: "david",
        runtimeActor: false,
        credential: false,
        grant: false,
        session: false,
        channel: false,
        job: false,
        recipient: false,
        privateState: false,
        effects: [],
      },
    });
  });

  it("rejects live secret fields and missing runtime pins", () => {
    expect(
      parseCommonProfileManifest({ ...DAVID_MANIFEST, credentials: { apiKey: "x" } }),
    ).toMatchObject({
      ok: false,
      error: { code: "live-fields-present" },
    });
    expect(
      parseCommonProfileManifest({
        ...DAVID_MANIFEST,
        providerPins: { platform: "platform-contract:actor-grants-v1" },
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "missing-runtime-pin" },
    });
    expect(
      parseCommonProfileManifest({ ...DAVID_MANIFEST, identityRef: "david@example.com" }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid-opaque-ref" },
    });
  });

  it("fail-closes live activation because no shipped config gate exists", () => {
    const parsed = parseCommonProfileManifest({ ...DAVID_MANIFEST, activation: "active" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(dryRunInactiveProfileProvisioning(parsed.value)).toMatchObject({
      ok: false,
      error: { code: "activation-not-authorized" },
    });
  });

  it("clones Lisa-shaped generic structure and rejects private instance data", () => {
    const cloned = cloneCommonProfileManifest(LISA_GENERIC_SOURCE);
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) {
      return;
    }
    expect(cloned.value.activation).toBe("inactive");
    expect(cloned.value.profileId).toBe("future-exec");
    expect(cloned.value.exclusions).toEqual({
      credentials: true,
      accountIds: true,
      privateState: true,
      sessions: true,
      recipients: true,
      schedules: true,
      jobs: true,
      cookies: true,
      downloads: true,
      workspace: true,
    });
    expect(cloned.value).not.toMatchObject({ activation: "active" });
    expect(cloneCommonProfileManifest(LISA_PRIVATE_SOURCE)).toMatchObject({
      ok: false,
      error: { code: "live-fields-present" },
    });
  });
});

describe("safe provisioning through createAgent and agent config", () => {
  it("does not mutate config or bind channels for inactive manifests", async () => {
    const transformConfig = vi.fn();
    const result = await createAgent({
      profileManifest: DAVID_MANIFEST,
      bindingSpecs: ["telegram:default"],
      transformConfig: transformConfig as never,
    });
    expect(result).toMatchObject({
      status: "error",
      reason: "invalid-bindings",
    });
    expect(transformConfig).not.toHaveBeenCalled();

    const inactive = await createAgent({
      profileManifest: DAVID_MANIFEST,
      transformConfig: transformConfig as never,
    });
    expect(inactive).toMatchObject({
      status: "inactive",
      agentId: "david",
      provisioning: { mode: "dry-run", effects: [] },
    });
    expect(transformConfig).not.toHaveBeenCalled();
  });

  it("clones through createAgent without creating a live actor", async () => {
    const result = await createAgent({
      cloneProfileManifestFrom: LISA_GENERIC_SOURCE,
    });
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") {
      return;
    }
    expect(result.profileManifest.activation).toBe("inactive");
    expect(result.config).toEqual({});
  });

  it("rejects clone-create when the Lisa source carries private fields", async () => {
    await expect(
      createAgent({ cloneProfileManifestFrom: LISA_PRIVATE_SOURCE }),
    ).resolves.toMatchObject({
      status: "error",
      reason: "profile-clone-rejected",
    });
  });

  it("does not add inactive profiles to the live roster", () => {
    const cfg = { agents: { list: [{ id: "main" }] } };
    const next = applyAgentConfig(cfg, {
      agentId: "david",
      name: "david",
      workspace: "/tmp/david",
      profileManifest: DAVID_MANIFEST,
    });
    expect(next).toBe(cfg);
    expect(next.agents?.list).toEqual([{ id: "main" }]);
  });

  it("keeps current agent creation compatible when no manifest is supplied", async () => {
    const result = await createAgent({ name: "  " });
    expect(result).toMatchObject({ status: "error", reason: "invalid-name" });
  });
});

describe("inactive profiles cannot route, schedule, or authenticate", () => {
  const cfg = {
    agents: {
      list: [
        { id: "main" },
        {
          id: "david",
          profileManifest: DAVID_MANIFEST,
        },
      ],
    },
  };

  it("denies routing, scheduling, and authentication", () => {
    expect(profileCanRoute(cfg, "david")).toBe(false);
    expect(profileCanSchedule(cfg, "david")).toBe(false);
    expect(profileCanAuthenticate(cfg, "david")).toBe(false);
    expect(profileCanRoute(cfg, "main")).toBe(true);
  });

  it("fails session selection and model writes for inactive profiles", () => {
    expect(() =>
      resolveSessionAgentIds({
        config: cfg,
        sessionKey: "agent:david:main",
      }),
    ).toThrow(/inactive profile "david"/);
    expect(() => setAgentEffectiveModelPrimary(cfg, "david", "openai/gpt-5.6-luna")).toThrow(
      /inactive profile "david"/,
    );
  });

  it("does not treat inactive profiles as live summaries", () => {
    const summaries = buildAgentSummaries(cfg);
    expect(summaries.find((entry) => entry.id === "david")).toEqual({
      id: "david",
      name: undefined,
      workspace: "",
      agentDir: "",
      bindings: 0,
      isDefault: false,
    });
    expect(summaries.find((entry) => entry.id === "main")).toMatchObject({
      id: "main",
    });
  });
});
