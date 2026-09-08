/**
 * Typed internal Brain envelopes + allowlist redaction.
 *
 * Conversation/data-bearing §10.1 hooks fail closed unless operators set
 * `plugins.entries.linkbrain.hooks.allowConversationAccess=true`.
 */

import {
  assertBrainWireCaptureBatch,
  type BrainWireCaptureBatch,
} from "./capture-batch-adapter.js";
import { isLinkbrainProhibitedField } from "./sanitize.js";

export { LINKBRAIN_PROHIBITED_FIELDS } from "./sanitize.js";

export const LINKBRAIN_REDACTION_POLICY_VERSION = "brain.redaction.v0";

/** @deprecated Prefer CaptureBufferEvent / BrainWireCaptureEvent — kept for enqueue API. */
export type BrainCaptureEvent = {
  sequence: number;
  role: "user" | "assistant" | "tool_summary" | "system";
  text: string;
};

type BrainCaptureBatchBody = BrainWireCaptureBatch;

type BrainCoordinationBody = {
  taskId?: string;
  summary?: string;
  [key: string]: unknown;
};

export type BrainWriteKind = "capture_batch" | "coordination";

export type BrainInternalEnvelope = {
  version: 1;
  kind: BrainWriteKind;
  toolName: string;
  idempotencyKey: string;
  redactionPolicyVersion: string;
  createdAtMs: number;
  /** Allowlisted payload only — never includes prohibited fields. */
  body: BrainCaptureBatchBody | BrainCoordinationBody;
};

export type OutboxRecord = {
  version: 1;
  domain: "brain";
  key: string;
  createdAtMs: number;
  toolName: string;
  idempotencyKey: string;
  kind: BrainWriteKind;
  envelope: BrainInternalEnvelope;
  attemptCount: number;
  nextAttemptAtMs: number;
  lastErrorCode?: string;
  lastErrorSafeMessage?: string;
};

export type DeadLetterRecord = {
  version: 1;
  domain: "brain";
  key: string;
  createdAtMs: number;
  movedAtMs: number;
  toolName: string;
  idempotencyKey: string;
  kind: BrainWriteKind;
  attemptCount: number;
  terminalCode: string;
  safeMessage: string;
  /** Redacted metadata only — no payload body. */
  redactedMeta: {
    batchId?: string;
    sessionId?: string;
    taskId?: string;
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

function stripProhibited(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripProhibited);
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isLinkbrainProhibitedField(key)) {
      continue;
    }
    next[key] = stripProhibited(child);
  }
  return next;
}

/**
 * Builds a typed allowlisted envelope. Prohibited fields are dropped; unknown
 * capture shapes throw rather than being forwarded.
 */
export function redactBrainEnvelope(params: {
  kind: BrainWriteKind;
  toolName: string;
  idempotencyKey: string;
  redactionPolicyVersion: string;
  createdAtMs: number;
  body: unknown;
}): BrainInternalEnvelope {
  const cleaned = stripProhibited(params.body);
  const body =
    params.kind === "capture_batch"
      ? assertBrainWireCaptureBatch(cleaned)
      : (cleaned as BrainCoordinationBody);

  return {
    version: 1,
    kind: params.kind,
    toolName: params.toolName,
    idempotencyKey: params.idempotencyKey,
    redactionPolicyVersion: params.redactionPolicyVersion,
    createdAtMs: params.createdAtMs,
    body,
  };
}

export function deadLetterMetaFromEnvelope(
  envelope: BrainInternalEnvelope,
): DeadLetterRecord["redactedMeta"] {
  if (envelope.kind === "capture_batch") {
    const body = envelope.body as BrainCaptureBatchBody;
    return { batchId: body.batchId, sessionId: body.sessionId };
  }
  const body = envelope.body as BrainCoordinationBody;
  return typeof body.taskId === "string" ? { taskId: body.taskId } : {};
}
