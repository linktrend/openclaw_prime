/**
 * OpenClaw → LiNKbrain capture-batch wire adapter.
 *
 * Internal buffers keep sequence/role/text (+ acceptedAtMs). The remote
 * `brain_capture_batch` body must match Brain PrivateCaptureBatch input:
 * sessionId, idempotencyKey, capturedAt, and ConversationEvent fields.
 * Actor override keys are never copied from untrusted capture content.
 */
import { opaqueId } from "./opaque.js";
import { sanitizeCaptureText } from "./sanitize.js";

/** Local buffer / enqueue roles (not Brain wire roles). */
export type CaptureInputRole =
  | "user"
  | "human"
  | "assistant"
  | "tool_summary"
  | "tool"
  | "system"
  | "actor"
  | "principal";

/** Authoritative Brain ConversationEvent.role values. */
export type BrainWireRole = "actor" | "principal" | "assistant" | "tool" | "system";

/** Authoritative Brain ConversationEvent.eventType values. */
export type BrainWireEventType = "message" | "tool_call" | "tool_result" | "decision" | "status";

export type BrainWireClassification = "private" | "org" | "public";

export type CaptureBufferEvent = {
  sequence: number;
  role: CaptureInputRole;
  text: string;
  /** Wall time when the event was durably accepted — used for stable ISO stamps. */
  acceptedAtMs: number;
};

export type BrainWireCaptureEvent = {
  eventId: string;
  sequence: number;
  occurredAt: string;
  role: BrainWireRole;
  eventType: BrainWireEventType;
  content?: string;
  summary?: string;
  classification: BrainWireClassification;
};

/** Brain CaptureBatchInput.batch shape (actorBindingId set by Brain from auth). */
export type BrainWireCaptureBatch = {
  batchId: string;
  sessionId: string;
  taskId?: string;
  idempotencyKey: string;
  capturedAt: string;
  events: BrainWireCaptureEvent[];
};

/** Identity fields Brain rejects when spoofed from request bodies. */
export const BRAIN_ACTOR_OVERRIDE_KEYS = Object.freeze([
  "actor_id",
  "actorId",
  "platformActorId",
  "actorBindingId",
] as const);

const BRAIN_WIRE_ROLES = new Set<BrainWireRole>([
  "actor",
  "principal",
  "assistant",
  "tool",
  "system",
]);

const BRAIN_WIRE_EVENT_TYPES = new Set<BrainWireEventType>([
  "message",
  "tool_call",
  "tool_result",
  "decision",
  "status",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toIsoTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new Error("linkbrain: capture timestamp must be finite");
  }
  return new Date(ms).toISOString();
}

/**
 * Map local capture roles onto Brain wire roles.
 * user/human → principal; tool_summary → tool; unknown safe roles preserved.
 */
export function mapCaptureRoleToBrain(role: CaptureInputRole | string): BrainWireRole {
  switch (role) {
    case "user":
    case "human":
      return "principal";
    case "principal":
      return "principal";
    case "assistant":
      return "assistant";
    case "tool_summary":
    case "tool":
      return "tool";
    case "system":
      return "system";
    case "actor":
      return "actor";
    default:
      throw new Error(`linkbrain: unsupported capture role "${String(role)}"`);
  }
}

export function mapCaptureEventType(role: CaptureInputRole | string): BrainWireEventType {
  switch (role) {
    case "tool_summary":
      return "tool_result";
    case "tool":
      return "tool_call";
    default:
      return "message";
  }
}

/** Drop actor spoof fields from a shallow record (batch or tool args). */
export function stripActorOverrideFields<T extends Record<string, unknown>>(
  value: T,
): Omit<T, (typeof BRAIN_ACTOR_OVERRIDE_KEYS)[number]> {
  const next = { ...value };
  for (const key of BRAIN_ACTOR_OVERRIDE_KEYS) {
    delete next[key];
  }
  return next;
}

export function buildBrainWireCaptureEvent(params: {
  sessionId: string;
  event: CaptureBufferEvent;
}): BrainWireCaptureEvent {
  const content = sanitizeCaptureText(params.event.text);
  const role = mapCaptureRoleToBrain(params.event.role);
  const eventType = mapCaptureEventType(params.event.role);
  return {
    eventId: opaqueId("event", `${params.sessionId}:${params.event.sequence}`),
    sequence: params.event.sequence,
    occurredAt: toIsoTimestamp(params.event.acceptedAtMs),
    role,
    eventType,
    ...(content.length > 0 ? { content } : {}),
    classification: "private",
  };
}

export type BuildBrainWireCaptureBatchParams = {
  sessionId: string;
  events: CaptureBufferEvent[];
  /** Optional opaque task id — never invented from untrusted content. */
  taskId?: string;
  /**
   * Flush reason is intentionally excluded from batchId/idempotency so the same
   * sequence window always hashes identically for Brain idempotent replay.
   */
  fromSequence?: number;
  toSequence?: number;
};

/**
 * Deterministic Brain-compatible batch for a durable sequence window.
 * Same session + sequences + acceptedAtMs ⇒ same batchId, stamps, and eventIds.
 */
export function buildBrainWireCaptureBatch(
  params: BuildBrainWireCaptureBatchParams,
): BrainWireCaptureBatch {
  if (!params.sessionId || typeof params.sessionId !== "string") {
    throw new Error("linkbrain: capture batch requires sessionId");
  }
  if (!Array.isArray(params.events) || params.events.length === 0) {
    throw new Error("linkbrain: capture batch requires a non-empty events[]");
  }

  const ordered = [...params.events].toSorted((a, b) => a.sequence - b.sequence);
  const fromSequence = params.fromSequence ?? ordered[0]!.sequence;
  const toSequence = params.toSequence ?? ordered[ordered.length - 1]!.sequence;
  if (
    fromSequence !== ordered[0]!.sequence ||
    toSequence !== ordered[ordered.length - 1]!.sequence
  ) {
    throw new Error("linkbrain: capture batch sequence window mismatch");
  }

  const wireEvents = ordered.map((event) =>
    buildBrainWireCaptureEvent({ sessionId: params.sessionId, event }),
  );
  const capturedAtMs = Math.max(...ordered.map((event) => event.acceptedAtMs));
  const idempotencyKey = `cap:${params.sessionId}:${fromSequence}:${toSequence}`;
  const batchId = opaqueId("batch", `${params.sessionId}:${fromSequence}:${toSequence}`);

  const batch: BrainWireCaptureBatch = {
    batchId,
    sessionId: params.sessionId,
    idempotencyKey,
    capturedAt: toIsoTimestamp(capturedAtMs),
    events: wireEvents,
  };
  if (typeof params.taskId === "string" && params.taskId.length > 0) {
    batch.taskId = params.taskId;
  }
  return stripActorOverrideFields(batch as Record<string, unknown>) as BrainWireCaptureBatch;
}

/**
 * Fields Brain includes in capture requestHash — used for deterministic replay proofs.
 * Mirrors LiNKbrain captureBatch canonicalRequestHash inputs (no actorBindingId).
 */
export function brainCaptureRequestHashMaterial(batch: BrainWireCaptureBatch): unknown {
  return {
    batchId: batch.batchId,
    sessionId: batch.sessionId,
    taskId: batch.taskId ?? null,
    capturedAt: batch.capturedAt,
    events: batch.events,
  };
}

export function assertBrainWireCaptureEvent(value: unknown): BrainWireCaptureEvent {
  if (!isRecord(value)) {
    throw new Error("linkbrain: capture event must be an object");
  }
  if (typeof value.eventId !== "string" || value.eventId.length === 0) {
    throw new Error("linkbrain: capture event requires eventId");
  }
  if (typeof value.sequence !== "number" || !Number.isFinite(value.sequence)) {
    throw new Error("linkbrain: capture event sequence is required");
  }
  if (typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) {
    throw new Error("linkbrain: capture event requires occurredAt ISO timestamp");
  }
  if (typeof value.role !== "string" || !BRAIN_WIRE_ROLES.has(value.role as BrainWireRole)) {
    throw new Error("linkbrain: capture event role is invalid");
  }
  if (
    typeof value.eventType !== "string" ||
    !BRAIN_WIRE_EVENT_TYPES.has(value.eventType as BrainWireEventType)
  ) {
    throw new Error("linkbrain: capture event eventType is invalid");
  }
  const classification = value.classification === undefined ? "private" : value.classification;
  if (classification !== "private" && classification !== "org" && classification !== "public") {
    throw new Error("linkbrain: capture event classification is invalid");
  }
  return {
    eventId: value.eventId,
    sequence: value.sequence,
    occurredAt: value.occurredAt,
    role: value.role as BrainWireRole,
    eventType: value.eventType as BrainWireEventType,
    ...(typeof value.content === "string" ? { content: value.content } : {}),
    ...(typeof value.summary === "string" ? { summary: value.summary } : {}),
    classification,
  };
}

export function assertBrainWireCaptureBatch(value: unknown): BrainWireCaptureBatch {
  if (!isRecord(value)) {
    throw new Error("linkbrain: capture batch body must be an object");
  }
  for (const key of BRAIN_ACTOR_OVERRIDE_KEYS) {
    if (key in value && value[key] !== undefined && value[key] !== null) {
      throw new Error(`linkbrain: capture batch must not include actor override field ${key}`);
    }
  }
  if (typeof value.batchId !== "string" || typeof value.sessionId !== "string") {
    throw new Error("linkbrain: capture batch requires batchId and sessionId");
  }
  if (typeof value.idempotencyKey !== "string" || value.idempotencyKey.length < 8) {
    throw new Error("linkbrain: capture batch requires idempotencyKey");
  }
  if (typeof value.capturedAt !== "string" || Number.isNaN(Date.parse(value.capturedAt))) {
    throw new Error("linkbrain: capture batch requires capturedAt ISO timestamp");
  }
  if (!Array.isArray(value.events) || value.events.length === 0) {
    throw new Error("linkbrain: capture batch requires a non-empty events[]");
  }
  return {
    batchId: value.batchId,
    sessionId: value.sessionId,
    ...(typeof value.taskId === "string" && value.taskId.length > 0
      ? { taskId: value.taskId }
      : {}),
    idempotencyKey: value.idempotencyKey,
    capturedAt: value.capturedAt,
    events: value.events.map(assertBrainWireCaptureEvent),
  };
}
