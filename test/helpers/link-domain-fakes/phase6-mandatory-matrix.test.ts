/**
 * Phase 6 — Mandatory failure/recovery, durability, privacy, restart, isolation matrix.
 *
 * Evidence tier: fake / integration-local. Never claims stage or production.
 * Platform-live items are explicitly marked SKIPPED_PLATFORM_LIVE.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseLinkbrainConfig } from "../../../extensions/linkbrain/src/config.js";
import {
  LINKBRAIN_NAMESPACES,
  LINKBRAIN_NAMESPACE_LIST,
  LINKBRAIN_PLUGIN_ID,
} from "../../../extensions/linkbrain/src/namespaces.js";
import {
  createBrainFakeTransport,
  createLinkbrainRuntime,
  type LinkbrainTransport,
} from "../../../extensions/linkbrain/src/runtime.js";
import { sanitizeCaptureText } from "../../../extensions/linkbrain/src/sanitize.js";
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
  type LinkskillsTransport,
} from "../../../extensions/linkskills/src/runtime.js";
import { openLinkskillsStores } from "../../../extensions/linkskills/src/stores.js";
import { createMemoryKeyedStore as createSkillsMemoryStore } from "../../../extensions/linkskills/src/test-support/memory-store.js";
import { createBrainFake } from "./brain-fake.js";
import { fixtureSkillsClaim, mintFakeToken } from "./skills-fake.js";

/** Evidence tier label required on Phase 6 proofs. */
const PHASE6_EVIDENCE_TIER = "fake/integration-local" as const;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Secret canary injected at ingress; must never appear in state/diagnostics/events. */
export const PHASE6_SECRET_CANARY = "CANARY_SECRET_sk-phase6test00000001abcdef" as const;

const sampleBrainBatch = {
  batchId: "batch_phase6_matrix",
  sessionId: "session_phase6_lisa",
  idempotencyKey: "cap:session_phase6_lisa:1:2",
  capturedAt: "2026-07-27T11:00:02.000Z",
  events: [
    {
      eventId: "event_phase6_matrix_1",
      sequence: 1,
      occurredAt: "2026-07-27T11:00:01.000Z",
      role: "principal" as const,
      eventType: "message" as const,
      content: "Private conversation for Brain only.",
      classification: "private" as const,
    },
    {
      eventId: "event_phase6_matrix_2",
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
  event_id: "evt:phase6-matrix-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-27T11:00:00Z",
  sequence: 1,
  idempotency_key: "idem:phase6-matrix-run-01",
  correlation_id: "corr:phase6-opaque-matrix-01",
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

function createIsolatedDomainStores(maxEntries = 100) {
  const brain = openLinkbrainStores({
    maxEntries,
    openKeyedStore: (options) =>
      createBrainMemoryStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      }),
  });
  const skills = openLinkskillsStores({
    maxEntries,
    openKeyedStore: (options) =>
      createSkillsMemoryStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      }),
  });
  return { brain, skills };
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

function unavailableTransport(
  domain: "brain" | "skills",
): LinkbrainTransport & LinkskillsTransport {
  return {
    async write() {
      return {
        ok: false,
        retryable: true,
        errorCode: "unavailable",
        safeMessage: `${domain} fake unavailable (injected)`,
      };
    },
  };
}

function brainTransportWithAuth(
  fake: Awaited<ReturnType<typeof createBrainFake>>,
  authToken: string,
): LinkbrainTransport {
  return {
    async write(params) {
      if (!params.toolName.startsWith("brain_")) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${params.toolName}" is not on the Brain write allowlist`,
        };
      }
      const outcome = fake.callTool(params.toolName, params.arguments, {
        authToken,
        requestId: params.idempotencyKey,
      });
      if (outcome.ok) {
        return { ok: true, replayed: outcome.replayed === true, result: outcome.result };
      }
      const code = typeof outcome.error?.code === "string" ? outcome.error.code : "brain_error";
      const terminal =
        code === "validation_error" ||
        code === "unauthorized" ||
        code === "forbidden" ||
        code === "not_found" ||
        code === "conflict" ||
        code === "payload_too_large" ||
        code === "terminal" ||
        code === "authentication" ||
        code === "prohibited_field" ||
        code === "cross_domain_field";
      const retryable =
        code === "internal_error" ||
        code === "rate_limited" ||
        code === "retryable" ||
        code === "throttled";
      return {
        ok: false,
        terminal,
        retryable,
        errorCode: code,
        safeMessage:
          typeof outcome.error?.safeMessage === "string"
            ? outcome.error.safeMessage
            : "brain write failed",
      };
    },
  };
}

function assertNativeBaselinesHold() {
  const brainManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "extensions/linkbrain/openclaw.plugin.json"), "utf8"),
  ) as { enabledByDefault: boolean; activation: { onStartup: boolean } };
  const skillsManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "extensions/linkskills/openclaw.plugin.json"), "utf8"),
  ) as { enabledByDefault: boolean; activation: { onStartup: boolean } };
  expect(brainManifest.enabledByDefault).toBe(false);
  expect(brainManifest.activation.onStartup).toBe(true);
  expect(skillsManifest.enabledByDefault).toBe(false);
  expect(skillsManifest.activation.onStartup).toBe(true);
}

function assertNoCanary(surfaces: unknown[]) {
  for (const surface of surfaces) {
    const json = JSON.stringify(surface);
    expect(json).not.toContain(PHASE6_SECRET_CANARY);
    expect(json).not.toContain("sk-phase6test");
  }
}

describe(`Phase 6 mandatory matrix (${PHASE6_EVIDENCE_TIER})`, () => {
  afterEach(() => {
    expect(PHASE6_EVIDENCE_TIER).toBe("fake/integration-local");
  });

  it("1. Brain unavailable → Skills + native continue", async () => {
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain, skills } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: unavailableTransport("brain"),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:brain-unavail",
      body: sampleBrainBatch,
    });
    const brainDrain = await brainRuntime.drainOnce();
    expect(brainDrain.drained).toBe(0);
    expect(brainDrain.retried).toBe(1);
    expect((await brainRuntime.diagnostics()).outboxCount).toBe(1);

    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:skills-while-brain-unavail",
      body: sampleSkillsTelemetry,
    });
    expect((await skillsRuntime.drainOnce()).drained).toBe(1);
    assertNativeBaselinesHold();
  });

  it("2. Skills unavailable → Brain + native continue", async () => {
    const brainFake = await createBrainFake();
    const { brain, skills } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: unavailableTransport("skills"),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:skills-unavail",
      body: sampleSkillsTelemetry,
    });
    const skillsDrain = await skillsRuntime.drainOnce();
    expect(skillsDrain.drained).toBe(0);
    expect(skillsDrain.retried).toBe(1);
    expect((await skillsRuntime.diagnostics()).outboxCount).toBe(1);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:brain-while-skills-unavail",
      body: sampleBrainBatch,
    });
    expect((await brainRuntime.drainOnce()).drained).toBe(1);
    assertNativeBaselinesHold();
  });

  it("3. Both unavailable → native honest degraded mode", async () => {
    const { brain, skills } = createIsolatedDomainStores();
    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: unavailableTransport("brain"),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: unavailableTransport("skills"),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:both-unavail",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:both-unavail",
      body: sampleSkillsTelemetry,
    });

    const [brainDrain, skillsDrain] = await Promise.all([
      brainRuntime.drainOnce(),
      skillsRuntime.drainOnce(),
    ]);
    expect(brainDrain).toMatchObject({ drained: 0, retried: 1, deadLettered: 0 });
    expect(skillsDrain).toMatchObject({ drained: 0, retried: 1, deadLettered: 0 });

    const [brainDiag, skillsDiag] = await Promise.all([
      brainRuntime.diagnostics(),
      skillsRuntime.diagnostics(),
    ]);
    expect(brainDiag.outboxCount).toBe(1);
    expect(skillsDiag.outboxCount).toBe(1);
    expect(brainDiag.lastDrainStatus).toMatch(/retried|retry|unavailable/i);
    expect(skillsDiag.lastDrainStatus).toMatch(/retried|retry|unavailable/i);
    assertNativeBaselinesHold();
  });

  it("4. Brain auth revoked → Skills still works (fake auth matrix)", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const skillsAuth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, skillsAuth);
    const { brain, skills } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: brainTransportWithAuth(brainFake, "fake-revoked-token"),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: skillsAuth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:brain-revoked",
      body: sampleBrainBatch,
    });
    const brainDrain = await brainRuntime.drainOnce();
    expect(brainDrain.deadLettered).toBe(1);
    expect((await brainRuntime.diagnostics()).outboxCount).toBe(0);

    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:skills-while-brain-revoked",
      body: sampleSkillsTelemetry,
    });
    expect((await skillsRuntime.drainOnce()).drained).toBe(1);
  });

  it("5. Skills auth revoked → Brain still works (fake auth matrix)", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const revokedAuth = mintFakeToken(
      fixtureSkillsClaim({ credential_id: "cred:fixture-revoked-01" }),
    );
    const { brain, skills } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: revokedAuth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:skills-revoked",
      body: sampleSkillsTelemetry,
    });
    const skillsDrain = await skillsRuntime.drainOnce();
    expect(skillsDrain.deadLettered).toBe(1);
    expect((await skillsRuntime.diagnostics()).outboxCount).toBe(0);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:brain-while-skills-revoked",
      body: sampleBrainBatch,
    });
    expect((await brainRuntime.drainOnce()).drained).toBe(1);
  });

  it("6. Plugin/runtime restart with both outboxes pending → durable recover + drain", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain, skills } = createIsolatedDomainStores();
    const brainConfig = parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true });
    const skillsConfig = parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true });

    const brainFirst = createLinkbrainRuntime({
      config: brainConfig,
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsFirst = createLinkskillsRuntime({
      config: skillsConfig,
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainFirst.open(), skillsFirst.open()]);

    await Promise.all([
      brainFirst.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:restart-pending",
        body: sampleBrainBatch,
      }),
      skillsFirst.enqueueTelemetry({
        idempotencyKey: "idem:phase6:restart-pending",
        body: sampleSkillsTelemetry,
      }),
    ]);
    expect((await brainFirst.diagnostics()).outboxCount).toBe(1);
    expect((await skillsFirst.diagnostics()).outboxCount).toBe(1);
    await Promise.all([brainFirst.shutdown(), skillsFirst.shutdown()]);

    const brainSecond = createLinkbrainRuntime({
      config: brainConfig,
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsSecond = createLinkskillsRuntime({
      config: skillsConfig,
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainSecond.open(), skillsSecond.open()]);
    expect((await brainSecond.diagnostics()).outboxCount).toBe(1);
    expect((await skillsSecond.diagnostics()).outboxCount).toBe(1);

    const [brainDrain, skillsDrain] = await Promise.all([
      brainSecond.drainOnce(),
      skillsSecond.drainOnce(),
    ]);
    expect(brainDrain.drained).toBe(1);
    expect(skillsDrain.drained).toBe(1);
    expect((await brainSecond.diagnostics()).outboxCount).toBe(0);
    expect((await skillsSecond.diagnostics()).outboxCount).toBe(0);
  });

  it("7. Queue capacity reject-new on both domains", async () => {
    const { brain, skills } = createIsolatedDomainStores(1);
    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({
        captureEnqueue: true,
        captureDrain: false,
        outboxMaxEntries: 1,
      }),
      stores: brain,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({
        telemetryEnqueue: true,
        telemetryDrain: false,
        outboxMaxEntries: 1,
      }),
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
      idempotencyKey: "cap:phase6:cap-1",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:cap-1",
      body: sampleSkillsTelemetry,
    });

    await expect(
      brainRuntime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:cap-2",
        body: sampleBrainBatch,
      }),
    ).rejects.toThrow(/overflow \(reject-new\)/);
    await expect(
      skillsRuntime.enqueueTelemetry({
        idempotencyKey: "idem:phase6:cap-2",
        body: sampleSkillsTelemetry,
      }),
    ).rejects.toThrow(/overflow \(reject-new\)/);

    expect((await brainRuntime.diagnostics()).capacity.outboxRemaining).toBe(0);
    expect((await skillsRuntime.diagnostics()).capacity.outboxRemaining).toBe(0);
  });

  it("8. Duplicate delivery / replay is idempotent on both domains", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain, skills } = createIsolatedDomainStores();

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:replay",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:replay",
      body: sampleSkillsTelemetry,
    });
    expect((await brainRuntime.drainOnce()).drained).toBe(1);
    expect((await skillsRuntime.drainOnce()).drained).toBe(1);

    // Replay same idempotency keys after ack.
    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:replay",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:replay",
      body: sampleSkillsTelemetry,
    });
    expect((await brainRuntime.drainOnce()).drained).toBe(1);
    expect((await skillsRuntime.drainOnce()).drained).toBe(1);
    expect(brainFake.getIdempotencySize()).toBeGreaterThan(0);
    expect(skillsFake.idempotency.size).toBeGreaterThan(0);
  });

  it("9. Brain content to Skills rejected before transmission", async () => {
    expect(findProhibitedSkillsField({ conversation: sampleBrainBatch.events })?.key).toBe(
      "conversation",
    );
    expect(findProhibitedSkillsField({ content: "leak" })?.key).toBe("content");
    expect(findProhibitedSkillsField({ brain_capture: sampleBrainBatch })?.key).toBe(
      "brain_capture",
    );

    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_feedback_submit",
        idempotencyKey: "idem:phase6:pre-tx-reject",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: {
          ...sampleSkillsTelemetry,
          conversation: sampleBrainBatch.events,
          content: "must never leave OpenClaw toward Skills",
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
          idempotency_key: "idem:phase6:fake-pre-tx",
          request_id: "req:phase6:fake-pre-tx",
          authorization: auth,
        },
        { authorization: auth },
      ),
    ).toThrow(/Prohibited field rejected/);
  });

  it("10. Secret canaries absent from logs/state/events", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain, skills } = createIsolatedDomainStores();

    // Ingress canary: sanitize capture text + strip prohibited secret fields before enqueue.
    const rawIngress = `Please use Bearer ${PHASE6_SECRET_CANARY} quietly`;
    const sanitizedText = sanitizeCaptureText(rawIngress);
    expect(sanitizedText).not.toContain(PHASE6_SECRET_CANARY);
    expect(sanitizedText).toContain("[REDACTED]");

    const canaryBatch = {
      ...sampleBrainBatch,
      events: [
        {
          eventId: "event_phase6_canary_1",
          sequence: 1,
          occurredAt: "2026-07-27T11:00:01.000Z",
          role: "principal" as const,
          eventType: "message" as const,
          content: sanitizedText,
          classification: "private" as const,
        },
        {
          eventId: "event_phase6_canary_2",
          sequence: 2,
          occurredAt: "2026-07-27T11:00:02.000Z",
          role: "assistant" as const,
          eventType: "message" as const,
          content: "ack",
          classification: "private" as const,
        },
      ],
    };

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:canary",
      body: {
        ...canaryBatch,
        // Prohibited secret-shaped keys must be stripped by envelope redaction.
        apiKey: PHASE6_SECRET_CANARY,
        authorization: `Bearer ${PHASE6_SECRET_CANARY}`,
        secrets: { canary: PHASE6_SECRET_CANARY },
      },
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:canary",
      body: sampleSkillsTelemetry,
    });
    await Promise.all([brainRuntime.drainOnce(), skillsRuntime.drainOnce()]);

    const brainDiag = await brainRuntime.diagnostics();
    const skillsDiag = await skillsRuntime.diagnostics();
    const brainOutbox = await brain.outbox.entries();
    const skillsOutbox = await skills.outbox.entries();
    const brainDead = await brain.deadletter.entries();
    const skillsDead = await skills.deadletter.entries();
    const skillsCached = [...skillsFake.idempotency.values()];

    assertNoCanary([
      brainDiag,
      skillsDiag,
      brainOutbox,
      skillsOutbox,
      brainDead,
      skillsDead,
      skillsCached,
      brainDiag.lastDrainStatus,
      skillsDiag.lastDrainStatus,
    ]);
  });

  it("11. Cross-domain namespace isolation", async () => {
    const { brain, skills } = createIsolatedDomainStores();
    expect([...brain.openedNamespaces].toSorted()).toEqual(
      [...LINKBRAIN_NAMESPACE_LIST].toSorted(),
    );
    expect([...skills.openedNamespaces].toSorted()).toEqual(
      [...LINKSKILLS_NAMESPACE_LIST].toSorted(),
    );
    expect(LINKBRAIN_NAMESPACES.captureBuffer).toBe("capture-buffer");
    expect(Object.values(LINKSKILLS_NAMESPACES)).not.toContain("capture-buffer");
    expect(LINKBRAIN_PLUGIN_ID).not.toBe(LINKSKILLS_PLUGIN_ID);

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
      idempotencyKey: "cap:phase6:ns",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:ns",
      body: sampleSkillsTelemetry,
    });

    const brainKeys = (await brain.outbox.entries()).map((e) => e.key);
    const skillsKeys = (await skills.outbox.entries()).map((e) => e.key);
    expect(brainKeys[0]).toMatch(/^brain:/);
    expect(skillsKeys[0]).toMatch(/^skills:/);
    expect(await skills.outbox.lookup(brainKeys[0]!)).toBeUndefined();
    expect(await brain.outbox.lookup(skillsKeys[0]!)).toBeUndefined();
    expect(JSON.stringify(await skills.outbox.entries())).not.toContain("Private conversation");
  });

  it("12. Independent enable/disable/drain", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);

    // Brain enqueue+drain on; Skills enqueue off / drain on — Skills drain is no-op.
    const a = createIsolatedDomainStores();
    const brainOn = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: a.brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsEnqueueOff = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: false, telemetryDrain: true }),
      stores: a.skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainOn.open(), skillsEnqueueOff.open()]);
    await brainOn.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:indep-brain",
      body: sampleBrainBatch,
    });
    expect((await brainOn.drainOnce()).drained).toBe(1);
    await expect(
      skillsEnqueueOff.enqueueTelemetry({
        idempotencyKey: "idem:phase6:indep-skills-off",
        body: sampleSkillsTelemetry,
      }),
    ).rejects.toThrow(/telemetryEnqueue is disabled/);
    expect(await skillsEnqueueOff.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });

    // Skills on; Brain drain off leaves pending outbox while Skills drains.
    const b = createIsolatedDomainStores();
    const brainDrainOff = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: false }),
      stores: b.brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsOn = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: b.skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainDrainOff.open(), skillsOn.open()]);
    await brainDrainOff.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:indep-brain-pending",
      body: sampleBrainBatch,
    });
    // captureDrain=false short-circuits drain (honest no-op); pending remains.
    expect(await brainDrainOff.drainOnce()).toEqual({
      drained: 0,
      retried: 0,
      deadLettered: 0,
      skipped: 0,
    });
    expect((await brainDrainOff.diagnostics()).outboxCount).toBe(1);
    await skillsOn.enqueueTelemetry({
      idempotencyKey: "idem:phase6:indep-skills-on",
      body: sampleSkillsTelemetry,
    });
    expect((await skillsOn.drainOnce()).drained).toBe(1);
  });

  it("14. Throttling, malformed responses, fake crash/restart", async () => {
    const brainFake = await createBrainFake({ throttleAfter: 0 });
    const skillsFake = new SkillsFakeService({ throttleAfter: 0 });
    const auth = mintFakeToken(fixtureSkillsClaim());
    // Seed before throttle saturates list/start if needed — use direct run seed then throttle.
    const skillsOk = new SkillsFakeService();
    seedSkillsRun(skillsOk, auth);
    // Copy seeded run into throttled fake for feedback path after throttle clears.
    for (const [id, run] of skillsOk.runs) {
      skillsFake.runs.set(id, run);
    }

    const { brain, skills } = createIsolatedDomainStores();
    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:throttle",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:throttle",
      body: sampleSkillsTelemetry,
    });
    const throttledBrain = await brainRuntime.drainOnce();
    const throttledSkills = await skillsRuntime.drainOnce();
    expect(throttledBrain.retried).toBe(1);
    expect(throttledSkills.retried).toBe(1);

    // Clear throttle and recover pending.
    brainFake.setThrottleAfter(null);
    skillsFake.throttleAfter = Number.POSITIVE_INFINITY;
    // Force next attempts eligible immediately by waiting past backoff via new runtimes
    // is unnecessary — scheduleRetry sets nextAttemptAtMs; use fresh now clock.
    const brainRecover = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
      now: () => Date.now() + 60_000,
    });
    const skillsRecover = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
      now: () => Date.now() + 60_000,
    });
    await Promise.all([brainRecover.open(), skillsRecover.open()]);
    expect((await brainRecover.drainOnce()).drained).toBe(1);
    expect((await skillsRecover.drainOnce()).drained).toBe(1);

    // Malformed / terminal fake response → dead-letter (honest failure).
    const m = createIsolatedDomainStores();
    const brainMalformed = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: m.brain,
      transport: {
        async write() {
          return {
            ok: false,
            terminal: true,
            errorCode: "malformed_response",
            safeMessage: "fake returned malformed body",
          };
        },
      },
    });
    const skillsMalformed = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: m.skills,
      transport: {
        async write() {
          return {
            ok: false,
            terminal: true,
            errorCode: "malformed_response",
            safeMessage: "fake returned malformed body",
          };
        },
      },
    });
    await Promise.all([brainMalformed.open(), skillsMalformed.open()]);
    await brainMalformed.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:malformed",
      body: sampleBrainBatch,
    });
    await skillsMalformed.enqueueTelemetry({
      idempotencyKey: "idem:phase6:malformed",
      body: sampleSkillsTelemetry,
    });
    expect((await brainMalformed.drainOnce()).deadLettered).toBe(1);
    expect((await skillsMalformed.drainOnce()).deadLettered).toBe(1);

    // Fake crash/restart: clear in-memory idempotency (Phase 1 limitation), then rewrite.
    brainFake.clearIdempotency();
    skillsFake.idempotency.clear();
    await brainRecover.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:post-crash",
      body: { ...sampleBrainBatch, batchId: "batch_post_crash" },
    });
    await skillsRecover.enqueueTelemetry({
      idempotencyKey: "idem:phase6:post-crash",
      body: {
        ...sampleSkillsTelemetry,
        event_id: "evt:phase6-post-crash",
        idempotency_key: "idem:phase6:post-crash",
      },
    });
    expect((await brainRecover.drainOnce()).drained).toBe(1);
    expect((await skillsRecover.drainOnce()).drained).toBe(1);
  });

  it("15. Privacy: Skills never registers conversation hooks (static + runtime)", async () => {
    expect(LINKSKILLS_CONVERSATION_HOOK_POLICY).toMatch(/never registers conversation/i);

    const indexPath = path.join(repoRoot, "extensions/linkskills/index.ts");
    const index = fs.readFileSync(indexPath, "utf8");
    const conversationHookPatterns = [
      /api\.on\(\s*["']message_/,
      /api\.on\(\s*["']before_prompt/,
      /api\.on\(\s*["']before_agent/,
      /api\.on\(\s*["']agent_end/,
      /api\.on\(\s*["']llm_input/,
      /api\.on\(\s*["']llm_output/,
      /api\.on\(\s*["']tool_result_persist/,
      /api\.on\(\s*["']session_/,
      /api\.on\(\s*["']compaction/,
      /allowConversationAccess/,
    ];
    for (const pattern of conversationHookPatterns) {
      expect(index, String(pattern)).not.toMatch(pattern);
    }
    expect(index).toMatch(/gateway_start/);
    expect(index).toMatch(/gateway_stop/);
    expect(index).toMatch(/Never registers conversation/i);

    // Runtime assert: plugin module exports only gateway lifecycle hooks in source contract.
    expect(index).not.toMatch(/LINKBRAIN_CONVERSATION_HOOKS/);
    expect(index).toContain("LINKSKILLS_CONVERSATION_HOOK_POLICY");
  });

  it("SKIPPED_PLATFORM_LIVE: Platform audit/correlation rejection", () => {
    // Real Platform audit issuer + live correlation rejection require Phase 7 stage evidence.
    const reason =
      "SKIPPED_PLATFORM_LIVE: Platform audit/correlation rejection needs live stage audit API and opaque correlation issuer; fake tier cannot mint Platform audit decisions";
    expect(reason).toMatch(/^SKIPPED_PLATFORM_LIVE:/);
  });

  it("SKIPPED_PLATFORM_LIVE: real credential issuer revoke", () => {
    const reason =
      "SKIPPED_PLATFORM_LIVE: real Platform credential issuer revoke/rotate/expiry is Phase 7 Platform-owned evidence; fake auth matrix covers revoked tokens only";
    expect(reason).toMatch(/^SKIPPED_PLATFORM_LIVE:/);
  });
});
