import { describe, expect, it, vi } from "vitest";
import { createSkillsTelemetryCollector } from "./src/collect.js";
import { createSkillsDrainWorker } from "./src/drain-worker.js";
import {
  buildSkillsTelemetryEnvelope,
  findProhibitedSkillsField,
  SKILLS_TELEMETRY_ALLOWED_KEYS,
} from "./src/envelopes.js";
import { isObservedSkillsTool } from "./src/tools.js";

const validBody = {
  schema_version: "0.1",
  event_id: "evt:adv-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-28T10:00:00Z",
  sequence: 1,
  idempotency_key: "idem:adv-01",
  actor_id: "actor:fixture",
  run_id: "run:fixture",
  skill_id: "skill.fixture.echo",
  skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  execution_profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  outcome: "info",
  sensitivity: "public_internal",
  metrics: { duration_ms: 1, tool_calls: 1 },
  payload: { status: "started", note: "ok", tool_name: "skills_run_start" },
};

describe("linkskills allowlisted telemetry + adversarial rejection", () => {
  it("accepts exact allowlisted fixture-shaped bodies", () => {
    const envelope = buildSkillsTelemetryEnvelope({
      toolName: "skills_run_start",
      idempotencyKey: "idem:adv-01",
      redactionPolicyVersion: "skills.telemetry.v0",
      createdAtMs: Date.now(),
      body: validBody,
    });
    expect(envelope.body.event_type).toBe("skill.run_started");
    expect(envelope.body.metrics).toEqual({ duration_ms: 1, tool_calls: 1 });
  });

  it("rejects secrets, tokens, conversation, brain, and raw I/O fields", () => {
    const cases = [
      { secret: "s3cr3t" },
      { access_token: "tok" },
      { authorization: "Bearer x" },
      { conversation: "hi" },
      { message: "body" },
      { prompt: "p" },
      { brain_findings: [] },
      { tool_args: { q: 1 } },
      { tool_result: { out: 1 } },
      { content: "x" },
    ];
    for (const body of cases) {
      expect(() =>
        buildSkillsTelemetryEnvelope({
          toolName: "skills_feedback_submit",
          idempotencyKey: "idem:bad",
          redactionPolicyVersion: "skills.telemetry.v0",
          createdAtMs: 1,
          body: { ...validBody, ...body },
        }),
      ).toThrow(/unknown field rejected|not allowlisted/);
    }
  });

  it("rejects unknown nested metrics and payload keys", () => {
    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_run_start",
        idempotencyKey: "idem:m",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: { ...validBody, metrics: { duration_ms: 1, raw_tokens: 9 } },
      }),
    ).toThrow(/unknown field rejected: metrics.raw_tokens/);

    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_run_start",
        idempotencyKey: "idem:p",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: { ...validBody, payload: { status: "ok", nested: { a: 1 } } },
      }),
    ).toThrow(/unknown field rejected: payload.nested/);
  });

  it("rejects oversized string values", () => {
    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_run_start",
        idempotencyKey: "idem:big",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: { ...validBody, skill_id: "x".repeat(300) },
      }),
    ).toThrow(/exceeds 256 chars/);
  });

  it("findProhibitedSkillsField flags non-allowlisted keys", () => {
    expect(findProhibitedSkillsField({ conversation: "nope" })).toEqual({
      path: "conversation",
      key: "conversation",
    });
    expect(SKILLS_TELEMETRY_ALLOWED_KEYS).not.toContain("conversation");
  });

  it("collector emits for skills_* and stays silent for non-Skills tools", () => {
    const collector = createSkillsTelemetryCollector({ now: () => 1_700_000_000_000 });
    expect(isObservedSkillsTool("skills_run_start")).toBe(true);
    expect(isObservedSkillsTool("browser")).toBe(false);
    expect(isObservedSkillsTool("memory_search")).toBe(false);

    const skills = collector.observe({
      toolName: "skills_run_start",
      params: {
        skill_id: "skill.fixture.echo",
        release_hash: validBody.skill_release_hash,
        execution_profile_hash: validBody.execution_profile_hash,
        secret: "MUST_NOT_FORWARD",
        conversation: "MUST_NOT_FORWARD",
      },
      result: { raw_output: "MUST_NOT_FORWARD", brain_findings: ["x"] },
      durationMs: 12,
      runId: "run-raw",
      agentId: "lisa",
    });
    expect(skills).not.toBeNull();
    expect(JSON.stringify(skills?.body)).not.toMatch(/MUST_NOT_FORWARD|brain_findings|raw_output/);
    expect(skills?.body.payload?.tool_name).toBe("skills_run_start");

    expect(collector.observe({ toolName: "browser", params: { url: "https://x" } })).toBeNull();
    expect(collector.observe({ toolName: "memory_get", result: { text: "private" } })).toBeNull();
    expect(collector.observe({ toolName: "cron", params: {} })).toBeNull();
  });

  it("drain worker ticks when enabled and stops cleanly", async () => {
    const drainOnce = vi.fn(async () => ({ drained: 1, retried: 0, deadLettered: 0, skipped: 0 }));
    const timers: Array<() => void> = [];
    const worker = createSkillsDrainWorker({
      intervalMs: 20,
      shouldDrain: () => true,
      drainOnce,
      setIntervalFn: ((fn: () => void) => {
        timers.push(fn);
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: (() => undefined) as typeof clearInterval,
    });
    worker.start();
    expect(worker.running).toBe(true);
    await Promise.resolve();
    expect(drainOnce).toHaveBeenCalled();
    // Simulate interval tick
    timers[0]?.();
    await Promise.resolve();
    await worker.stop();
    expect(worker.running).toBe(false);
  });
});
