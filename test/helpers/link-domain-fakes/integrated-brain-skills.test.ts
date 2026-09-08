/**
 * Phase 6 — Integrated local/isolated QA (fakes only).
 *
 * Evidence tier: fake / integration-local. Never claims stage or production.
 * Proves Brain + Skills plugins and both fakes coexist without cross-domain leakage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLinkbrainConfig } from "../../../extensions/linkbrain/src/config.js";
import {
  LINKBRAIN_NAMESPACES,
  LINKBRAIN_NAMESPACE_LIST,
  LINKBRAIN_PLUGIN_ID,
} from "../../../extensions/linkbrain/src/namespaces.js";
import {
  createBrainFakeTransport,
  createLinkbrainRuntime,
} from "../../../extensions/linkbrain/src/runtime.js";
import { openLinkbrainStores } from "../../../extensions/linkbrain/src/stores.js";
import { createMemoryKeyedStore as createBrainMemoryStore } from "../../../extensions/linkbrain/src/test-support/memory-store.js";
import { SkillsFakeService } from "../../../extensions/linkskills/fake/service.mjs";
import { parseLinkskillsConfig } from "../../../extensions/linkskills/src/config.js";
import {
  buildSkillsTelemetryEnvelope,
  findProhibitedSkillsField,
} from "../../../extensions/linkskills/src/envelopes.js";
import {
  LINKSKILLS_CONVERSATION_HOOK_POLICY,
  LINKSKILLS_NAMESPACES,
  LINKSKILLS_NAMESPACE_LIST,
  LINKSKILLS_PLUGIN_ID,
} from "../../../extensions/linkskills/src/namespaces.js";
import {
  createLinkskillsRuntime,
  createSkillsFakeTransport,
} from "../../../extensions/linkskills/src/runtime.js";
import { openLinkskillsStores } from "../../../extensions/linkskills/src/stores.js";
import { createMemoryKeyedStore as createSkillsMemoryStore } from "../../../extensions/linkskills/src/test-support/memory-store.js";
import {
  createBrainFake,
  startBrainFakeHttpServer,
  type BrainFakeHttpServer,
} from "./brain-fake.js";
import {
  fixtureSkillsClaim,
  mintFakeToken,
  startChildProcessSkillsFake,
  type SkillsFakeHandle,
} from "./skills-fake.js";

/** Evidence tier label required on Phase 6 proofs. */
export const PHASE6_EVIDENCE_TIER = "fake/integration-local" as const;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const sampleBrainBatch = {
  batchId: "batch_phase6_integrated",
  sessionId: "session_phase6_lisa",
  idempotencyKey: "cap:session_phase6_lisa:1:2",
  capturedAt: "2026-07-27T11:00:02.000Z",
  events: [
    {
      eventId: "event_phase6_integrated_1",
      sequence: 1,
      occurredAt: "2026-07-27T11:00:01.000Z",
      role: "principal" as const,
      eventType: "message" as const,
      content: "Private conversation for Brain only.",
      classification: "private" as const,
    },
    {
      eventId: "event_phase6_integrated_2",
      sequence: 2,
      occurredAt: "2026-07-27T11:00:02.000Z",
      role: "assistant" as const,
      eventType: "message" as const,
      content: "Acknowledged in Brain capture.",
      classification: "private" as const,
    },
  ],
};

const sampleSkillsTelemetry = {
  schema_version: "0.1",
  event_id: "evt:phase6-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-27T11:00:00Z",
  sequence: 1,
  idempotency_key: "idem:phase6-run-01",
  correlation_id: "corr:phase6-opaque-01",
  actor_id: "actor:fixture-lisa-01",
  runtime_profile_id: "runtime:fixture-openclaw-01",
  session_id: "session:fixture-opaque-01",
  run_id: "run:fixture-skills-01",
  skill_id: "skill.fixture.echo",
  skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  execution_profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  outcome: "info",
  sensitivity: "public_internal",
  metrics: { duration_ms: 0, tool_calls: 0 },
  payload: { status: "started", note: "structured only" },
};

type TrackedOpen = {
  domain: string;
  namespace: string;
  store: { entries: () => Promise<unknown[]> };
};

/**
 * Thin harness: open both plugin memory stores while recording domain+namespace opens.
 * Proves in-process KV isolation even when bare namespace strings overlap ("outbox").
 */
function createIsolatedDomainStores(maxEntries = 100) {
  const opened: TrackedOpen[] = [];
  const brainStoresByNs = new Map<string, { size(): number; entries: () => Promise<unknown[]> }>();
  const skillsStoresByNs = new Map<string, { size(): number; entries: () => Promise<unknown[]> }>();

  const brain = openLinkbrainStores({
    maxEntries,
    openKeyedStore: <T>(options: {
      namespace: string;
      maxEntries: number;
      overflowPolicy: "reject-new";
    }) => {
      const store = createBrainMemoryStore<T>({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      });
      brainStoresByNs.set(options.namespace, store);
      opened.push({ domain: LINKBRAIN_PLUGIN_ID, namespace: options.namespace, store });
      return store;
    },
  });

  const skills = openLinkskillsStores({
    maxEntries,
    openKeyedStore: <T>(options: {
      namespace: string;
      maxEntries: number;
      overflowPolicy: "reject-new";
    }) => {
      const store = createSkillsMemoryStore<T>({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      });
      skillsStoresByNs.set(options.namespace, store);
      opened.push({ domain: LINKSKILLS_PLUGIN_ID, namespace: options.namespace, store });
      return store;
    },
  });

  return { brain, skills, opened, brainStoresByNs, skillsStoresByNs };
}

function seedSkillsRun(fake: SkillsFakeService, auth: string, runId = "run:fixture-skills-01") {
  const started = fake.dispatch(
    "skills_run_start",
    {
      params: {
        skill_id: "skill.fixture.echo",
        release_hash: sampleSkillsTelemetry.skill_release_hash,
        execution_profile_hash: sampleSkillsTelemetry.execution_profile_hash,
        session_id: sampleSkillsTelemetry.session_id,
      },
      idempotency_key: `idem:seed-${runId}`,
      request_id: `req:seed-${runId}`,
      authorization: auth,
    },
    { authorization: auth },
  );
  const data = started.data as Record<string, unknown>;
  const actualRunId = String(data.run_id);
  if (actualRunId !== runId) {
    const run = fake.runs.get(actualRunId);
    if (run) {
      fake.runs.delete(actualRunId);
      fake.runs.set(runId, { ...run, run_id: runId });
    }
  }
  return runId;
}

describe(`Phase 6 integrated Brain+Skills (${PHASE6_EVIDENCE_TIER})`, () => {
  let brainHttp: BrainFakeHttpServer | undefined;
  let skillsHttp: SkillsFakeHandle | undefined;

  afterEach(async () => {
    await brainHttp?.stop();
    brainHttp = undefined;
    await skillsHttp?.stop();
    skillsHttp = undefined;
  });

  it("starts both fake HTTP servers on distinct 127.0.0.1 ports (process isolated)", async () => {
    brainHttp = await startBrainFakeHttpServer();
    skillsHttp = await startChildProcessSkillsFake();

    expect(brainHttp.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(skillsHttp.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(brainHttp.baseUrl).not.toBe(skillsHttp.baseUrl);
    expect(brainHttp.pid).toBeTruthy();
    expect(skillsHttp.pid).toBeTruthy();
    expect(brainHttp.pid).not.toBe(skillsHttp.pid);

    const [brainHealth, skillsHealth] = await Promise.all([
      fetch(`${brainHttp.baseUrl}/health`).then((r) => r.json()),
      skillsHttp.health(),
    ]);
    expect(brainHealth).toMatchObject({ status: "ok" });
    expect(skillsHealth).toMatchObject({ status: "ok" });
    expect(PHASE6_EVIDENCE_TIER).toBe("fake/integration-local");
  });

  it("runs Brain capture/outbox and Skills telemetry concurrently without leakage", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);

    const { brain: brainStores, skills: skillsStores } = createIsolatedDomainStores();
    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brainStores,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skillsStores,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });

    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await Promise.all([
      brainRuntime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:concurrent:001",
        body: sampleBrainBatch,
      }),
      skillsRuntime.enqueueTelemetry({
        idempotencyKey: "idem:phase6:concurrent:001",
        body: sampleSkillsTelemetry,
      }),
    ]);

    const [brainDrain, skillsDrain] = await Promise.all([
      brainRuntime.drainOnce(),
      skillsRuntime.drainOnce(),
    ]);
    expect(brainDrain.drained).toBe(1);
    expect(skillsDrain.drained).toBe(1);

    const [brainDiag, skillsDiag] = await Promise.all([
      brainRuntime.diagnostics(),
      skillsRuntime.diagnostics(),
    ]);
    expect(brainDiag.outboxCount).toBe(0);
    expect(skillsDiag.outboxCount).toBe(0);

    // Brain conversation text must never appear in Skills diagnostics or fake idempotency store.
    const skillsDiagJson = JSON.stringify(skillsDiag);
    expect(skillsDiagJson).not.toContain("Private conversation");
    expect(skillsDiagJson).not.toContain("conversation");
    expect(skillsFake.idempotency.size).toBeGreaterThan(0);
    for (const cached of skillsFake.idempotency.values()) {
      const json = JSON.stringify(cached);
      expect(json).not.toContain("Private conversation");
      expect(cached).not.toHaveProperty("conversation");
      expect(cached).not.toHaveProperty("content");
      expect(cached).not.toHaveProperty("events");
    }

    expect(brainFake.getIdempotencySize()).toBeGreaterThan(0);
  });

  it("rejects Brain conversation/content fields on Skills enqueue and fake ingress", async () => {
    expect(findProhibitedSkillsField({ conversation: "leak" })?.key).toBe("conversation");
    expect(findProhibitedSkillsField({ content: "leak" })?.key).toBe("content");
    expect(findProhibitedSkillsField({ brain_capture: sampleBrainBatch })?.key).toBe(
      "brain_capture",
    );

    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_feedback_submit",
        idempotencyKey: "idem:phase6:leak",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: {
          ...sampleSkillsTelemetry,
          conversation: sampleBrainBatch.events,
          content: "must never enqueue",
        },
      }),
    ).toThrow(/unknown field rejected|prohibited field rejected/);

    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);

    expect(() =>
      skillsFake.dispatch(
        "skills_feedback_submit",
        {
          params: {
            run_id: "run:fixture-skills-01",
            conversation: "Brain conversation must not reach Skills",
            content: sampleBrainBatch.events,
          },
          idempotency_key: "idem:phase6:fake-reject",
          request_id: "req:phase6:fake-reject",
          authorization: auth,
        },
        { authorization: auth },
      ),
    ).toThrow(/Prohibited field rejected/);

    // Brain path still accepts conversation-bearing capture batches.
    const brainFake = await createBrainFake();
    const capture = brainFake.callTool(
      "brain_capture_batch",
      {
        idempotencyKey: "cap:phase6:brain-ok",
        batch: sampleBrainBatch,
      },
      { authToken: "fake-valid-token" },
    );
    expect(capture.ok).toBe(true);
  });

  it("keeps cross-domain KV/namespace isolation with in-process memory stores", async () => {
    const { brain, skills, opened, brainStoresByNs, skillsStoresByNs } =
      createIsolatedDomainStores();

    expect(
      opened
        .filter((e) => e.domain === LINKBRAIN_PLUGIN_ID)
        .map((e) => e.namespace)
        .toSorted(),
    ).toEqual([...LINKBRAIN_NAMESPACE_LIST].toSorted());
    expect(
      opened
        .filter((e) => e.domain === LINKSKILLS_PLUGIN_ID)
        .map((e) => e.namespace)
        .toSorted(),
    ).toEqual([...LINKSKILLS_NAMESPACE_LIST].toSorted());

    // Overlapping bare names open distinct store instances.
    expect(brainStoresByNs.get("outbox")).not.toBe(skillsStoresByNs.get("outbox"));
    expect(LINKBRAIN_NAMESPACES.captureBuffer).toBe("capture-buffer");
    expect(brainStoresByNs.has("capture-buffer")).toBe(true);
    expect(skillsStoresByNs.has("capture-buffer")).toBe(false);
    expect(Object.values(LINKSKILLS_NAMESPACES)).not.toContain("capture-buffer");

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: false }),
      stores: brain,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: false }),
      stores: skills,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:kv:001",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:kv:001",
      body: sampleSkillsTelemetry,
    });

    const brainKeys = (await brain.outbox.entries()).map((e) => e.key);
    const skillsKeys = (await skills.outbox.entries()).map((e) => e.key);
    expect(brainKeys).toHaveLength(1);
    expect(skillsKeys).toHaveLength(1);
    expect(brainKeys[0]).toMatch(/^brain:capture_batch:/);
    expect(skillsKeys[0]).toMatch(/^skills:structured_event:/);
    expect(brainKeys[0]).not.toBe(skillsKeys[0]);

    // No shared entries across domain store instances.
    expect(await skills.outbox.lookup(brainKeys[0]!)).toBeUndefined();
    expect(await brain.outbox.lookup(skillsKeys[0]!)).toBeUndefined();
    expect(JSON.stringify(await skills.outbox.entries())).not.toContain("Private conversation");
  });

  it("independently disables Brain without breaking Skills and vice versa", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain: brainStores, skills: skillsStores } = createIsolatedDomainStores();

    // Brain flags off; Skills on.
    const brainOff = createLinkbrainRuntime({
      config: parseLinkbrainConfig({}),
      stores: brainStores,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsOn = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skillsStores,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainOff.open(), skillsOn.open()]);

    await expect(
      brainOff.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:brain-off",
        body: sampleBrainBatch,
      }),
    ).rejects.toThrow(/captureEnqueue is disabled/);
    expect(await brainOff.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });

    await skillsOn.enqueueTelemetry({
      idempotencyKey: "idem:phase6:skills-while-brain-off",
      body: sampleSkillsTelemetry,
    });
    expect((await skillsOn.drainOnce()).drained).toBe(1);

    // Skills flags off; Brain on (fresh stores).
    const again = createIsolatedDomainStores();
    const brainOn = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: again.brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsOff = createLinkskillsRuntime({
      config: parseLinkskillsConfig({}),
      stores: again.skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainOn.open(), skillsOff.open()]);

    await expect(
      skillsOff.enqueueTelemetry({
        idempotencyKey: "idem:phase6:skills-off",
        body: sampleSkillsTelemetry,
      }),
    ).rejects.toThrow(/telemetryEnqueue is disabled/);
    expect(await skillsOff.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });

    await brainOn.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:brain-while-skills-off",
      body: sampleBrainBatch,
    });
    expect((await brainOn.drainOnce()).drained).toBe(1);
  });

  it("native-regression smoke: both packages present keep plugin-disabled baselines", async () => {
    const brainManifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "extensions/linkbrain/openclaw.plugin.json"), "utf8"),
    ) as { id: string; enabledByDefault: boolean; activation: { onStartup: boolean } };
    const skillsManifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "extensions/linkskills/openclaw.plugin.json"), "utf8"),
    ) as { id: string; enabledByDefault: boolean; activation: { onStartup: boolean } };

    expect(brainManifest).toMatchObject({
      id: "linkbrain",
      enabledByDefault: false,
      activation: { onStartup: true },
    });
    expect(skillsManifest).toMatchObject({
      id: "linkskills",
      enabledByDefault: false,
      activation: { onStartup: true },
    });
    expect(LINKSKILLS_CONVERSATION_HOOK_POLICY).toMatch(/never registers conversation/i);

    const brainWrite = vi.fn(async () => ({ ok: true }));
    const skillsWrite = vi.fn(async () => ({ ok: true }));
    const { brain: brainStores, skills: skillsStores } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({}),
      stores: brainStores,
      transport: { write: brainWrite },
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({}),
      stores: skillsStores,
      transport: { write: skillsWrite },
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await expect(
      brainRuntime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:disabled",
        body: sampleBrainBatch,
      }),
    ).rejects.toThrow(/captureEnqueue is disabled/);
    await expect(
      skillsRuntime.enqueueTelemetry({
        idempotencyKey: "idem:phase6:disabled",
        body: sampleSkillsTelemetry,
      }),
    ).rejects.toThrow(/telemetryEnqueue is disabled/);

    expect(await brainRuntime.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });
    expect(await skillsRuntime.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });
    expect(brainWrite).not.toHaveBeenCalled();
    expect(skillsWrite).not.toHaveBeenCalled();
  });

  it("child-process fakes reject Skills conversation while Brain capture HTTP succeeds", async () => {
    brainHttp = await startBrainFakeHttpServer();
    skillsHttp = await startChildProcessSkillsFake();
    const auth = mintFakeToken(fixtureSkillsClaim());

    const capture = await fetch(`${brainHttp.baseUrl}/tools/call`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-valid-token",
      },
      body: JSON.stringify({
        name: "brain_capture_batch",
        arguments: {
          idempotencyKey: "cap:phase6:http:001",
          batch: sampleBrainBatch,
        },
      }),
    });
    expect(capture.status).toBe(200);
    expect(await capture.json()).toMatchObject({ ok: true });

    const rejected = await skillsHttp.invoke(
      "skills_feedback_submit",
      {
        params: {
          run_id: "run:missing",
          conversation: "must not cross",
          content: sampleBrainBatch,
        },
        idempotency_key: "idem:phase6:http-reject",
        request_id: "req:phase6:http-reject",
      },
      { authorization: auth },
    );
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(rejected.body).toLowerCase()).toMatch(/prohibited|conversation|content/);
  });
});
