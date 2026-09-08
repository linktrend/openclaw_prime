/**
 * Skills telemetry collection from the public after_tool_call seam.
 *
 * Filters to exact skills_* tool names, discards raw params/results, and builds
 * an allowlisted structured event. Non-Skills tools produce no telemetry.
 */
import type { SkillsTelemetryBody } from "./envelopes.js";
import { opaqueId } from "./opaque.js";
import { isObservedSkillsTool, mapSkillsEventTypeToToolName } from "./tools.js";

export type SkillsToolCallObservation = {
  toolName: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
  runId?: string;
  toolCallId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
};

export type SkillsTelemetryCollector = {
  /** Returns null when the call must not produce Skills telemetry. */
  observe(event: SkillsToolCallObservation): {
    toolName: string;
    idempotencyKey: string;
    body: SkillsTelemetryBody;
  } | null;
};

const PLACEHOLDER_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function readAllowlistedString(
  params: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!params) {
    return undefined;
  }
  const value = params[key];
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    return undefined;
  }
  return value;
}

function eventTypeForTool(toolName: string): string {
  switch (toolName) {
    case "skills_run_start":
      return "skill.run_started";
    case "skills_run_update":
      return "skill.run_updated";
    case "skills_run_complete":
      return "skill.run_completed";
    case "skills_run_fail":
      return "skill.run_failed";
    case "skills_feedback_submit":
      return "skill.feedback";
    case "skills_trace_candidate_submit":
      return "skill.trace_candidate";
    default:
      return "skill.tool_observed";
  }
}

/**
 * Creates a collector that never forwards raw tool params/results into telemetry.
 */
export function createSkillsTelemetryCollector(options?: {
  now?: () => number;
  sequenceStart?: number;
}): SkillsTelemetryCollector {
  const now = options?.now ?? (() => Date.now());
  let sequence = options?.sequenceStart ?? 0;

  return {
    observe(event) {
      if (!isObservedSkillsTool(event.toolName)) {
        return null;
      }

      // Discard raw params/results: only pull a few allowlisted identity strings.
      const skillId =
        readAllowlistedString(event.params, "skill_id") ??
        readAllowlistedString(event.params, "skillId") ??
        "skill.observed.unknown";
      const skillReleaseHash =
        readAllowlistedString(event.params, "release_hash") ??
        readAllowlistedString(event.params, "skill_release_hash") ??
        PLACEHOLDER_HASH;
      const executionProfileHash =
        readAllowlistedString(event.params, "execution_profile_hash") ?? PLACEHOLDER_HASH;
      const sessionIdRaw =
        readAllowlistedString(event.params, "session_id") ?? event.sessionId ?? event.sessionKey;
      const runMaterial = event.runId ?? event.toolCallId ?? `${event.toolName}:${now()}`;

      sequence += 1;
      const eventId = opaqueId("event", `${event.toolName}:${runMaterial}:${sequence}`);
      const idempotencyKey = `idem:obs:${opaqueId("toolcall", event.toolCallId ?? eventId)}`;
      const outcome = event.error ? "error" : "ok";
      const occurredAt = new Date(now()).toISOString();

      const body: SkillsTelemetryBody = {
        schema_version: "0.1",
        event_id: eventId,
        event_type: eventTypeForTool(event.toolName),
        occurred_at: occurredAt,
        sequence,
        idempotency_key: idempotencyKey,
        actor_id: opaqueId("actor", event.agentId),
        run_id: opaqueId("run", runMaterial),
        skill_id: skillId,
        skill_release_hash: skillReleaseHash,
        execution_profile_hash: executionProfileHash,
        outcome,
        sensitivity: "public_internal",
        metrics: {
          duration_ms: typeof event.durationMs === "number" ? Math.max(0, event.durationMs) : 0,
          tool_calls: 1,
        },
        payload: {
          status: outcome,
          tool_name: event.toolName,
          ...(event.error ? { error_code: "tool_error" } : {}),
          note: "structured observation; raw args/results discarded",
        },
      };
      if (sessionIdRaw) {
        body.session_id = opaqueId("session", sessionIdRaw);
      }

      return {
        toolName: mapSkillsEventTypeToToolName(body.event_type),
        idempotencyKey,
        body,
      };
    },
  };
}
