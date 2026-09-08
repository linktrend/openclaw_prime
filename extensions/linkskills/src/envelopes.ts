/**
 * Allowlisted Skills structured telemetry envelopes.
 *
 * Exact per-event schemas only: unknown top-level keys, unknown nested metrics/
 * payload keys, and oversized values are rejected. Conversation/content/Brain/
 * raw-tool fields are never accepted. Skills never registers conversation hooks.
 */

export const LINKSKILLS_REDACTION_POLICY_VERSION = "skills.telemetry.v0";

const MAX_STRING_LEN = 256;
const MAX_PAYLOAD_NOTE_LEN = 120;
const MAX_METRICS_VALUE = 86_400_000;

/** Exact top-level keys permitted on a structured telemetry body. */
export const SKILLS_TELEMETRY_ALLOWED_KEYS = Object.freeze([
  "schema_version",
  "event_id",
  "event_type",
  "occurred_at",
  "sequence",
  "idempotency_key",
  "correlation_id",
  "actor_id",
  "runtime_profile_id",
  "session_id",
  "run_id",
  "skill_id",
  "skill_release_hash",
  "execution_profile_hash",
  "outcome",
  "sensitivity",
  "metrics",
  "payload",
] as const);

/** Exact metrics keys; values must be finite non-negative numbers within bound. */
export const SKILLS_TELEMETRY_ALLOWED_METRICS_KEYS = Object.freeze([
  "duration_ms",
  "tool_calls",
] as const);

/** Exact payload keys; string values only, size-limited. */
export const SKILLS_TELEMETRY_ALLOWED_PAYLOAD_KEYS = Object.freeze([
  "status",
  "note",
  "tool_name",
  "error_code",
] as const);

export const SKILLS_TELEMETRY_ALLOWED_EVENT_TYPES = Object.freeze([
  "skill.run_started",
  "skill.run_updated",
  "skill.run_completed",
  "skill.run_failed",
  "skill.feedback",
  "skill.trace_candidate",
  "skill.tool_observed",
  "skills_run_start",
  "skills_run_update",
  "skills_run_complete",
  "skills_run_fail",
  "skills_feedback_submit",
  "skills_trace_candidate_submit",
] as const);

export const SKILLS_TELEMETRY_ALLOWED_OUTCOMES = Object.freeze([
  "info",
  "ok",
  "error",
  "failed",
  "skipped",
] as const);

export const SKILLS_TELEMETRY_ALLOWED_SENSITIVITY = Object.freeze([
  "public_internal",
  "internal",
] as const);

type SkillsTelemetryKind = "structured_event";

export type SkillsTelemetryMetrics = {
  duration_ms?: number;
  tool_calls?: number;
};

export type SkillsTelemetryPayload = {
  status?: string;
  note?: string;
  tool_name?: string;
  error_code?: string;
};

export type SkillsTelemetryBody = {
  schema_version: string;
  event_id: string;
  event_type: string;
  occurred_at: string;
  sequence: number;
  idempotency_key: string;
  correlation_id?: string;
  actor_id: string;
  runtime_profile_id?: string;
  session_id?: string;
  run_id: string;
  skill_id: string;
  skill_release_hash: string;
  execution_profile_hash: string;
  outcome: string;
  sensitivity: string;
  metrics?: SkillsTelemetryMetrics;
  payload?: SkillsTelemetryPayload;
};

export type SkillsInternalEnvelope = {
  version: 1;
  kind: SkillsTelemetryKind;
  toolName: string;
  idempotencyKey: string;
  redactionPolicyVersion: string;
  createdAtMs: number;
  body: SkillsTelemetryBody;
};

export type OutboxRecord = {
  version: 1;
  domain: "skills";
  key: string;
  createdAtMs: number;
  toolName: string;
  idempotencyKey: string;
  kind: SkillsTelemetryKind;
  envelope: SkillsInternalEnvelope;
  attemptCount: number;
  nextAttemptAtMs: number;
  lastErrorCode?: string;
  lastErrorSafeMessage?: string;
};

export type DeadLetterRecord = {
  version: 1;
  domain: "skills";
  key: string;
  createdAtMs: number;
  movedAtMs: number;
  toolName: string;
  idempotencyKey: string;
  kind: SkillsTelemetryKind;
  attemptCount: number;
  terminalCode: string;
  safeMessage: string;
  redactedMeta: {
    eventId?: string;
    eventType?: string;
    runId?: string;
    skillId?: string;
    skillReleaseHash?: string;
    executionProfileHash?: string;
  };
};

export type HealthRecord = {
  version: 1;
  status: "idle" | "ok" | "degraded" | "failed";
  updatedAtMs: number;
  lastSuccessAtMs?: number;
  lastFailureAtMs?: number;
  lastErrorCode?: string;
  lastDrainStatus?: string;
  outboxCount?: number;
  deadLetterCount?: number;
  oldestOutboxAgeMs?: number | null;
};

export type CursorRecord = {
  version: 1;
  drainGeneration?: string;
  lastDrainedKey?: string;
  updatedAtMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const allowedKeySet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_KEYS);
const allowedMetricsKeySet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_METRICS_KEYS);
const allowedPayloadKeySet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_PAYLOAD_KEYS);
const allowedEventTypeSet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_EVENT_TYPES);
const allowedOutcomeSet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_OUTCOMES);
const allowedSensitivitySet = new Set<string>(SKILLS_TELEMETRY_ALLOWED_SENSITIVITY);

function requireBoundedString(
  record: Record<string, unknown>,
  key: string,
  maxLen = MAX_STRING_LEN,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`linkskills: telemetry requires non-empty string ${key}`);
  }
  if (value.length > maxLen) {
    throw new Error(`linkskills: telemetry ${key} exceeds ${maxLen} chars`);
  }
  return value;
}

function optionalBoundedString(
  record: Record<string, unknown>,
  key: string,
  maxLen = MAX_STRING_LEN,
): string | undefined {
  if (!(key in record) || record[key] === undefined) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`linkskills: telemetry optional ${key} must be a non-empty string`);
  }
  if (value.length > maxLen) {
    throw new Error(`linkskills: telemetry ${key} exceeds ${maxLen} chars`);
  }
  return value;
}

function assertExactKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`linkskills: unknown field rejected: ${path ? `${path}.` : ""}${key}`);
    }
  }
}

function parseMetrics(raw: unknown): SkillsTelemetryMetrics | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    throw new Error("linkskills: telemetry metrics must be an object");
  }
  assertExactKeys(raw, allowedMetricsKeySet, "metrics");
  const metrics: SkillsTelemetryMetrics = {};
  for (const key of SKILLS_TELEMETRY_ALLOWED_METRICS_KEYS) {
    if (!(key in raw) || raw[key] === undefined) {
      continue;
    }
    const value = raw[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > MAX_METRICS_VALUE
    ) {
      throw new Error(`linkskills: telemetry metrics.${key} must be a bounded non-negative number`);
    }
    metrics[key] = value;
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function parsePayload(raw: unknown): SkillsTelemetryPayload | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    throw new Error("linkskills: telemetry payload must be an object");
  }
  assertExactKeys(raw, allowedPayloadKeySet, "payload");
  const payload: SkillsTelemetryPayload = {};
  for (const key of SKILLS_TELEMETRY_ALLOWED_PAYLOAD_KEYS) {
    if (!(key in raw) || raw[key] === undefined) {
      continue;
    }
    const value = raw[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`linkskills: telemetry payload.${key} must be a non-empty string`);
    }
    const maxLen = key === "note" ? MAX_PAYLOAD_NOTE_LEN : MAX_STRING_LEN;
    if (value.length > maxLen) {
      throw new Error(`linkskills: telemetry payload.${key} exceeds ${maxLen} chars`);
    }
    payload[key] = value;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

/**
 * Legacy helper retained for adversarial/negative tests: any nested key that is
 * not on the allowlisted schema surfaces as a prohibited path. Prefer the
 * allowlist errors from buildSkillsTelemetryEnvelope for production paths.
 */
export function findProhibitedSkillsField(
  value: unknown,
  path = "",
): { path: string; key: string } | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    return { path: path || "[array]", key: "[array]" };
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (path === "" && !allowedKeySet.has(key)) {
      return { path: childPath, key };
    }
    if (path === "metrics" && !allowedMetricsKeySet.has(key)) {
      return { path: childPath, key };
    }
    if (path === "payload" && !allowedPayloadKeySet.has(key)) {
      return { path: childPath, key };
    }
    if (path !== "" && path !== "metrics" && path !== "payload") {
      // Nested objects beyond metrics/payload are never allowed.
      if (typeof child === "object" && child !== null) {
        return { path: childPath, key };
      }
    }
    const hit = findProhibitedSkillsField(child, childPath);
    if (hit) {
      return hit;
    }
  }
  return null;
}

/**
 * Builds a typed allowlisted telemetry envelope. Unknown nested data is rejected.
 */
export function buildSkillsTelemetryEnvelope(params: {
  toolName: string;
  idempotencyKey: string;
  redactionPolicyVersion: string;
  createdAtMs: number;
  body: unknown;
}): SkillsInternalEnvelope {
  if (!isRecord(params.body)) {
    throw new Error("linkskills: telemetry body must be an object");
  }
  assertExactKeys(params.body, allowedKeySet, "");

  const sequence = params.body.sequence;
  if (typeof sequence !== "number" || !Number.isFinite(sequence) || sequence < 0) {
    throw new Error("linkskills: telemetry requires non-negative numeric sequence");
  }

  const eventType = requireBoundedString(params.body, "event_type");
  if (!allowedEventTypeSet.has(eventType)) {
    throw new Error(`linkskills: telemetry event_type not allowlisted: ${eventType}`);
  }

  const outcome = requireBoundedString(params.body, "outcome", 64);
  if (!allowedOutcomeSet.has(outcome)) {
    throw new Error(`linkskills: telemetry outcome not allowlisted: ${outcome}`);
  }

  const sensitivity = requireBoundedString(params.body, "sensitivity", 64);
  if (!allowedSensitivitySet.has(sensitivity)) {
    throw new Error(`linkskills: telemetry sensitivity not allowlisted: ${sensitivity}`);
  }

  const metrics = parseMetrics(params.body.metrics);
  const payload = parsePayload(params.body.payload);
  const correlationId = optionalBoundedString(params.body, "correlation_id");
  const runtimeProfileId = optionalBoundedString(params.body, "runtime_profile_id");
  const sessionId = optionalBoundedString(params.body, "session_id");

  const body: SkillsTelemetryBody = {
    schema_version: requireBoundedString(params.body, "schema_version", 32),
    event_id: requireBoundedString(params.body, "event_id"),
    event_type: eventType,
    occurred_at: requireBoundedString(params.body, "occurred_at", 64),
    sequence,
    idempotency_key: optionalBoundedString(params.body, "idempotency_key") ?? params.idempotencyKey,
    ...(correlationId ? { correlation_id: correlationId } : {}),
    actor_id: requireBoundedString(params.body, "actor_id"),
    ...(runtimeProfileId ? { runtime_profile_id: runtimeProfileId } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
    run_id: requireBoundedString(params.body, "run_id"),
    skill_id: requireBoundedString(params.body, "skill_id"),
    skill_release_hash: requireBoundedString(params.body, "skill_release_hash"),
    execution_profile_hash: requireBoundedString(params.body, "execution_profile_hash"),
    outcome,
    sensitivity,
    ...(metrics ? { metrics } : {}),
    ...(payload ? { payload } : {}),
  };

  return {
    version: 1,
    kind: "structured_event",
    toolName: params.toolName,
    idempotencyKey: params.idempotencyKey,
    redactionPolicyVersion: params.redactionPolicyVersion,
    createdAtMs: params.createdAtMs,
    body,
  };
}

export function deadLetterMetaFromEnvelope(
  envelope: SkillsInternalEnvelope,
): DeadLetterRecord["redactedMeta"] {
  return {
    eventId: envelope.body.event_id,
    eventType: envelope.body.event_type,
    runId: envelope.body.run_id,
    skillId: envelope.body.skill_id,
    skillReleaseHash: envelope.body.skill_release_hash,
    executionProfileHash: envelope.body.execution_profile_hash,
  };
}

function feedbackParamsFromEnvelope(envelope: SkillsInternalEnvelope): Record<string, unknown> {
  return {
    run_id: envelope.body.run_id,
    kind: "outcome",
    summary: `${envelope.body.event_type}:${envelope.body.outcome}`,
    skill_id: envelope.body.skill_id,
    skill_release_hash: envelope.body.skill_release_hash,
    execution_profile_hash: envelope.body.execution_profile_hash,
    event_id: envelope.body.event_id,
  };
}

/**
 * Builds drain/MCP/HTTP arguments for the exact frozen skills_* op.
 * Never includes conversation or unknown nested fields.
 */
export function skillsTransportArgsFromEnvelope(
  envelope: SkillsInternalEnvelope,
  toolName: string,
): Record<string, unknown> {
  const body = envelope.body;
  if (toolName === "skills_feedback_submit") {
    return feedbackParamsFromEnvelope(envelope);
  }
  if (toolName === "skills_trace_candidate_submit") {
    return {
      run_id: body.run_id,
      skill_id: body.skill_id,
      skill_release_hash: body.skill_release_hash,
      execution_profile_hash: body.execution_profile_hash,
      event_id: body.event_id,
      candidate: body.payload ?? {},
    };
  }
  return {
    run_id: body.run_id,
    skill_id: body.skill_id,
    release_hash: body.skill_release_hash,
    execution_profile_hash: body.execution_profile_hash,
    ...(typeof body.session_id === "string" ? { session_id: body.session_id } : {}),
    status: body.outcome,
    event_id: body.event_id,
    event_type: body.event_type,
    ...(body.metrics ? { metrics: body.metrics } : {}),
    ...(body.payload ? { payload: body.payload } : {}),
  };
}
