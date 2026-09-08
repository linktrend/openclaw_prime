import { Type } from "typebox";
import type { OpenClawPluginApi, OpenClawPluginToolContext } from "../runtime-api.js";
import type { LinkbrainConfig } from "./config.js";
import { parseLinkbrainConfig } from "./config.js";
import { sanitizeCaptureText } from "./sanitize.js";
import { LINKBRAIN_CAPTURE_TOOL, LINKBRAIN_CHECKPOINT_TOOL } from "./tools.js";
import { callLinkbrainMcpTool, resolveLinkbrainTransport } from "./transport.js";

const brainReadSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("brain_browse"),
      Type.Literal("brain_search"),
      Type.Literal("brain_load"),
    ]),
    arguments: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

const prohibitedActorFields = new Set(["actor_id", "actorId", "platformActorId", "actorBindingId"]);

const MAX_ID_CHARS = 256;
const MAX_TIMESTAMP_CHARS = 64;
const MAX_CAPTURE_EVENTS = 64;
const MAX_CAPTURE_TEXT_CHARS = 4_000;
const MAX_CHECKPOINT_LIST_ITEMS = 32;
const MAX_CHECKPOINT_TEXT_CHARS = 4_000;
const MAX_NATIVE_WRITE_BYTES = 65_536;
const ISO_TIMESTAMP_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$";
const ISO_TIMESTAMP_RE = new RegExp(ISO_TIMESTAMP_PATTERN, "u");

const boundedIdSchema = Type.String({ minLength: 1, maxLength: MAX_ID_CHARS });
const boundedTimestampSchema = Type.String({
  minLength: 1,
  maxLength: MAX_TIMESTAMP_CHARS,
  pattern: ISO_TIMESTAMP_PATTERN,
});
const boundedCaptureTextSchema = Type.String({ maxLength: MAX_CAPTURE_TEXT_CHARS });
const boundedCheckpointTextSchema = Type.String({
  minLength: 1,
  maxLength: MAX_CHECKPOINT_TEXT_CHARS,
});

const brainCaptureEventSchema = Type.Object(
  {
    eventId: boundedIdSchema,
    sequence: Type.Integer({ minimum: 0 }),
    occurredAt: boundedTimestampSchema,
    role: Type.Union([
      Type.Literal("actor"),
      Type.Literal("principal"),
      Type.Literal("assistant"),
      Type.Literal("tool"),
      Type.Literal("system"),
    ]),
    eventType: Type.Union([
      Type.Literal("message"),
      Type.Literal("tool_call"),
      Type.Literal("tool_result"),
      Type.Literal("decision"),
      Type.Literal("status"),
    ]),
    content: Type.Optional(boundedCaptureTextSchema),
    summary: Type.Optional(boundedCaptureTextSchema),
    classification: Type.Optional(
      Type.Union([Type.Literal("private"), Type.Literal("org"), Type.Literal("public")]),
    ),
  },
  { additionalProperties: false },
);

const brainCaptureBatchSchema = Type.Object(
  {
    batchId: boundedIdSchema,
    sessionId: boundedIdSchema,
    taskId: Type.Optional(boundedIdSchema),
    idempotencyKey: Type.String({ minLength: 8, maxLength: MAX_ID_CHARS }),
    capturedAt: boundedTimestampSchema,
    events: Type.Array(brainCaptureEventSchema, {
      minItems: 1,
      maxItems: MAX_CAPTURE_EVENTS,
    }),
  },
  { additionalProperties: false },
);

const brainCheckpointSchema = Type.Object(
  {
    idempotencyKey: Type.String({ minLength: 8, maxLength: MAX_ID_CHARS }),
    summary: boundedCheckpointTextSchema,
    decisions: Type.Optional(
      Type.Array(boundedCheckpointTextSchema, { maxItems: MAX_CHECKPOINT_LIST_ITEMS }),
    ),
    nextActions: Type.Optional(
      Type.Array(boundedCheckpointTextSchema, { maxItems: MAX_CHECKPOINT_LIST_ITEMS }),
    ),
    openQuestions: Type.Optional(
      Type.Array(boundedCheckpointTextSchema, { maxItems: MAX_CHECKPOINT_LIST_ITEMS }),
    ),
    visibility: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  },
  { additionalProperties: false },
);

const brainWriteSchema = Type.Union([
  Type.Object(
    {
      operation: Type.Literal(LINKBRAIN_CAPTURE_TOOL),
      arguments: Type.Object({ batch: brainCaptureBatchSchema }, { additionalProperties: false }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(LINKBRAIN_CHECKPOINT_TOOL),
      arguments: brainCheckpointSchema,
    },
    { additionalProperties: false },
  ),
]);

function hasActorOverride(value: Record<string, unknown>): boolean {
  for (const [key, child] of Object.entries(value)) {
    if (prohibitedActorFields.has(key)) {
      return true;
    }
    if (Array.isArray(child)) {
      if (child.some((entry) => isRecord(entry) && hasActorOverride(entry))) {
        return true;
      }
    } else if (isRecord(child) && hasActorOverride(child)) {
      return true;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedId(value: unknown, minimum = 1): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= MAX_ID_CHARS &&
    value === value.trim()
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TIMESTAMP_CHARS &&
    ISO_TIMESTAMP_RE.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isBoundedString(value: unknown, maxChars: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" && value.length <= maxChars && (allowEmpty || value.trim().length > 0)
  );
}

function boundedJsonBytes(value: unknown): number | null {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
}

const CAPTURE_ARGUMENT_KEYS = new Set(["batch"]);
const CAPTURE_BATCH_KEYS = new Set([
  "batchId",
  "sessionId",
  "taskId",
  "idempotencyKey",
  "capturedAt",
  "events",
]);
const CAPTURE_EVENT_KEYS = new Set([
  "eventId",
  "sequence",
  "occurredAt",
  "role",
  "eventType",
  "content",
  "summary",
  "classification",
]);
const CHECKPOINT_KEYS = new Set([
  "idempotencyKey",
  "summary",
  "decisions",
  "nextActions",
  "openQuestions",
  "visibility",
]);
const BRAIN_ROLES = new Set(["actor", "principal", "assistant", "tool", "system"]);
const BRAIN_EVENT_TYPES = new Set(["message", "tool_call", "tool_result", "decision", "status"]);
const BRAIN_CLASSIFICATIONS = new Set(["private", "org", "public"]);

function validateAndSanitizeCapture(
  argumentsValue: Record<string, unknown>,
  config: LinkbrainConfig,
): { idempotencyKey: string; arguments: Record<string, unknown> } | null {
  if (!hasOnlyKeys(argumentsValue, CAPTURE_ARGUMENT_KEYS) || !isRecord(argumentsValue.batch)) {
    return null;
  }
  const batch = argumentsValue.batch;
  if (
    !hasOnlyKeys(batch, CAPTURE_BATCH_KEYS) ||
    hasActorOverride(batch) ||
    !isBoundedId(batch.batchId) ||
    !isBoundedId(batch.sessionId) ||
    (batch.taskId !== undefined && !isBoundedId(batch.taskId)) ||
    !isBoundedId(batch.idempotencyKey, 8) ||
    !isIsoTimestamp(batch.capturedAt) ||
    !Array.isArray(batch.events) ||
    batch.events.length === 0 ||
    batch.events.length > Math.min(config.batchMaxEvents, MAX_CAPTURE_EVENTS)
  ) {
    return null;
  }

  let previousSequence = -1;
  let latestOccurredAt = Number.NEGATIVE_INFINITY;
  const events: Array<Record<string, unknown>> = [];
  for (const eventValue of batch.events) {
    if (
      !isRecord(eventValue) ||
      !hasOnlyKeys(eventValue, CAPTURE_EVENT_KEYS) ||
      hasActorOverride(eventValue) ||
      !isBoundedId(eventValue.eventId) ||
      !Number.isInteger(eventValue.sequence) ||
      (eventValue.sequence as number) < 0 ||
      (eventValue.sequence as number) <= previousSequence ||
      !isIsoTimestamp(eventValue.occurredAt) ||
      typeof eventValue.role !== "string" ||
      !BRAIN_ROLES.has(eventValue.role) ||
      typeof eventValue.eventType !== "string" ||
      !BRAIN_EVENT_TYPES.has(eventValue.eventType) ||
      (eventValue.content !== undefined &&
        !isBoundedString(eventValue.content, MAX_CAPTURE_TEXT_CHARS, true)) ||
      (eventValue.summary !== undefined &&
        !isBoundedString(eventValue.summary, MAX_CAPTURE_TEXT_CHARS)) ||
      (eventValue.classification !== undefined &&
        (typeof eventValue.classification !== "string" ||
          !BRAIN_CLASSIFICATIONS.has(eventValue.classification)))
    ) {
      return null;
    }
    previousSequence = eventValue.sequence as number;
    latestOccurredAt = Math.max(latestOccurredAt, Date.parse(eventValue.occurredAt as string));
    events.push({
      eventId: eventValue.eventId,
      sequence: eventValue.sequence,
      occurredAt: eventValue.occurredAt,
      role: eventValue.role,
      eventType: eventValue.eventType,
      ...(typeof eventValue.content === "string"
        ? { content: sanitizeCaptureText(eventValue.content, MAX_CAPTURE_TEXT_CHARS) }
        : {}),
      ...(typeof eventValue.summary === "string"
        ? { summary: sanitizeCaptureText(eventValue.summary, MAX_CAPTURE_TEXT_CHARS) }
        : {}),
      classification: eventValue.classification ?? "private",
    });
  }
  if (Date.parse(batch.capturedAt) < latestOccurredAt) {
    return null;
  }

  const sanitizedBatch = {
    batchId: batch.batchId,
    sessionId: batch.sessionId,
    ...(typeof batch.taskId === "string" ? { taskId: batch.taskId } : {}),
    idempotencyKey: batch.idempotencyKey,
    capturedAt: batch.capturedAt,
    events,
  };
  const bytes = boundedJsonBytes(sanitizedBatch);
  if (bytes === null || bytes > Math.min(config.batchMaxBytes, MAX_NATIVE_WRITE_BYTES)) {
    return null;
  }
  return {
    idempotencyKey: batch.idempotencyKey,
    arguments: { batch: sanitizedBatch },
  };
}

function validateCheckpoint(
  argumentsValue: Record<string, unknown>,
  trustedTaskId: string,
): { idempotencyKey: string; arguments: Record<string, unknown> } | null {
  if (
    !hasOnlyKeys(argumentsValue, CHECKPOINT_KEYS) ||
    hasActorOverride(argumentsValue) ||
    !isBoundedId(argumentsValue.idempotencyKey, 8) ||
    !isBoundedString(argumentsValue.summary, MAX_CHECKPOINT_TEXT_CHARS) ||
    (argumentsValue.visibility !== undefined && !isBoundedString(argumentsValue.visibility, 64))
  ) {
    return null;
  }
  for (const key of ["decisions", "nextActions", "openQuestions"] as const) {
    const list = argumentsValue[key];
    if (
      list !== undefined &&
      (!Array.isArray(list) ||
        list.length > MAX_CHECKPOINT_LIST_ITEMS ||
        list.some((item) => !isBoundedString(item, MAX_CHECKPOINT_TEXT_CHARS)))
    ) {
      return null;
    }
  }
  const sanitized = {
    taskId: trustedTaskId,
    idempotencyKey: argumentsValue.idempotencyKey,
    summary: sanitizeCaptureText(argumentsValue.summary as string, MAX_CHECKPOINT_TEXT_CHARS),
    ...(Array.isArray(argumentsValue.decisions)
      ? {
          decisions: argumentsValue.decisions.map((item) =>
            sanitizeCaptureText(item as string, MAX_CHECKPOINT_TEXT_CHARS),
          ),
        }
      : {}),
    ...(Array.isArray(argumentsValue.nextActions)
      ? {
          nextActions: argumentsValue.nextActions.map((item) =>
            sanitizeCaptureText(item as string, MAX_CHECKPOINT_TEXT_CHARS),
          ),
        }
      : {}),
    ...(Array.isArray(argumentsValue.openQuestions)
      ? {
          openQuestions: argumentsValue.openQuestions.map((item) =>
            sanitizeCaptureText(item as string, MAX_CHECKPOINT_TEXT_CHARS),
          ),
        }
      : {}),
    ...(typeof argumentsValue.visibility === "string"
      ? { visibility: argumentsValue.visibility }
      : {}),
  };
  const bytes = boundedJsonBytes(sanitized);
  if (bytes === null || bytes > MAX_NATIVE_WRITE_BYTES) {
    return null;
  }
  return { idempotencyKey: argumentsValue.idempotencyKey, arguments: sanitized };
}

const LINKBRAIN_WRITE_TOOL_NAME = "linkbrain_write";
const LINKBRAIN_TOOL_BINDING_KEY = "linkbrain";

function resolveContextConfig(context: OpenClawPluginToolContext) {
  return context.getRuntimeConfig?.() ?? context.runtimeConfig ?? context.config;
}

function hasExplicitAgentWriteGrant(context: OpenClawPluginToolContext): boolean {
  const agentId = context.agentId?.trim();
  if (!agentId) {
    return false;
  }
  const agent = resolveContextConfig(context)?.agents?.list?.find((entry) => entry.id === agentId);
  return (
    Array.isArray(agent?.tools?.alsoAllow) &&
    agent.tools.alsoAllow.some(
      (entry) => typeof entry === "string" && entry.trim() === LINKBRAIN_WRITE_TOOL_NAME,
    )
  );
}

function resolveTrustedTaskId(context: OpenClawPluginToolContext): string | null {
  if (!context.sessionKey && !context.sessionId) {
    return null;
  }
  const binding = context.toolBindings?.[LINKBRAIN_TOOL_BINDING_KEY];
  if (!isRecord(binding) || !hasOnlyKeys(binding, new Set(["taskId"]))) {
    return null;
  }
  return isBoundedId(binding.taskId) ? binding.taskId : null;
}

type NativeWriteOutcome = { ok: true } | { ok: false; errorCode: string };

type InvokeNativeWrite = (params: {
  api: OpenClawPluginApi;
  config: LinkbrainConfig;
  toolName: typeof LINKBRAIN_CAPTURE_TOOL | typeof LINKBRAIN_CHECKPOINT_TOOL;
  idempotencyKey: string;
  arguments: Record<string, unknown>;
}) => Promise<NativeWriteOutcome>;

const SAFE_WRITE_ERROR_CODES = new Set([
  "aborted",
  "authentication",
  "credential_missing",
  "credential_unresolved",
  "endpoint_insecure",
  "machine_token_error",
  "mcp_connect_error",
  "mcp_server_unavailable",
  "mcp_tool_error",
  "retryable",
  "terminal",
  "throttled",
  "tool_not_allowlisted",
  "transport_disabled",
]);

const invokeNativeWrite: InvokeNativeWrite = async (params) => {
  if (!params.config.machineToken || !params.api.machineTokenFacade) {
    return { ok: false, errorCode: "machine_token_unavailable" };
  }
  try {
    const result = await resolveLinkbrainTransport({
      api: params.api,
      config: params.config,
      machineTokenFacade: params.api.machineTokenFacade,
    }).write({
      toolName: params.toolName,
      idempotencyKey: params.idempotencyKey,
      arguments: params.arguments,
    });
    if (result.ok) {
      return { ok: true };
    }
    const errorCode =
      typeof result.errorCode === "string" && SAFE_WRITE_ERROR_CODES.has(result.errorCode)
        ? result.errorCode
        : "write_failed";
    return { ok: false, errorCode };
  } catch {
    return { ok: false, errorCode: "write_failed" };
  }
};

function boundedJson(value: unknown): string {
  const text = JSON.stringify(value ?? {});
  return text.length <= 24_000 ? text : `${text.slice(0, 24_000)}…[truncated]`;
}

/**
 * A local, read-only Brain bridge for models whose external runtime cannot
 * safely receive managed MCP machine credentials.
 */
export function createLinkbrainReadTool(api: OpenClawPluginApi) {
  return {
    name: "linkbrain_read",
    label: "LiNKbrain Read",
    description: "Browse, search, or load authorised LiNKbrain knowledge.",
    parameters: brainReadSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const config = parseLinkbrainConfig(api.pluginConfig);
      if (!config.mcpRead) {
        return {
          content: [{ type: "text" as const, text: "LiNKbrain reading is disabled." }],
          details: { ok: false, reason: "disabled" },
        };
      }
      const operation = params.operation;
      const argumentsValue = params.arguments;
      if (
        (operation !== "brain_browse" &&
          operation !== "brain_search" &&
          operation !== "brain_load") ||
        typeof argumentsValue !== "object" ||
        argumentsValue === null ||
        Array.isArray(argumentsValue)
      ) {
        return {
          content: [{ type: "text" as const, text: "Invalid LiNKbrain read request." }],
          details: { ok: false, reason: "invalid_request" },
        };
      }
      if (hasActorOverride(argumentsValue as Record<string, unknown>)) {
        return {
          content: [{ type: "text" as const, text: "Actor identity is assigned by LiNKbrain." }],
          details: { ok: false, reason: "actor_override_rejected" },
        };
      }
      const result = await callLinkbrainMcpTool({
        api,
        config,
        toolName: operation,
        arguments: argumentsValue as Record<string, unknown>,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: result.ok
              ? boundedJson(result.result)
              : `LiNKbrain request failed: ${result.safeMessage}`,
          },
        ],
        details: result.ok
          ? { ok: true, result: result.result ?? {} }
          : { ok: false, reason: result.safeMessage },
      };
    },
  };
}

/**
 * A separately gated native write bridge. It deliberately exposes only capture
 * and checkpoint operations, requires host-owned machine-token auth, and never
 * returns Brain result payloads to the model.
 */
export function createLinkbrainWriteTool(
  api: OpenClawPluginApi,
  context: OpenClawPluginToolContext,
  dependencies?: { invokeWrite?: InvokeNativeWrite },
) {
  if (!hasExplicitAgentWriteGrant(context)) {
    return null;
  }
  const invokeWrite = dependencies?.invokeWrite ?? invokeNativeWrite;
  return {
    name: "linkbrain_write",
    label: "LiNKbrain Write",
    description: "Submit a bounded private capture batch or owned-task checkpoint to LiNKbrain.",
    parameters: brainWriteSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      if (!hasExplicitAgentWriteGrant(context)) {
        return {
          content: [
            { type: "text" as const, text: "LiNKbrain writing is not explicitly granted." },
          ],
          details: { ok: false, reason: "policy_denied" },
        };
      }
      const config = parseLinkbrainConfig(api.pluginConfig);
      const operation = params.operation;
      const argumentsValue = params.arguments;
      if (
        (operation !== LINKBRAIN_CAPTURE_TOOL && operation !== LINKBRAIN_CHECKPOINT_TOOL) ||
        !isRecord(argumentsValue) ||
        hasActorOverride(argumentsValue)
      ) {
        return {
          content: [{ type: "text" as const, text: "Invalid LiNKbrain write request." }],
          details: { ok: false, reason: "invalid_request" },
        };
      }
      if (
        operation === LINKBRAIN_CAPTURE_TOOL &&
        (!config.captureEnqueue || !config.captureDrain)
      ) {
        return {
          content: [{ type: "text" as const, text: "LiNKbrain capture writing is disabled." }],
          details: { ok: false, reason: "disabled" },
        };
      }
      if (operation === LINKBRAIN_CHECKPOINT_TOOL && !config.coordinationWrites) {
        return {
          content: [{ type: "text" as const, text: "LiNKbrain coordination writing is disabled." }],
          details: { ok: false, reason: "disabled" },
        };
      }
      if (!config.machineToken || !api.machineTokenFacade) {
        return {
          content: [
            { type: "text" as const, text: "LiNKbrain write authentication is unavailable." },
          ],
          details: { ok: false, reason: "machine_token_unavailable" },
        };
      }

      const trustedTaskId =
        operation === LINKBRAIN_CHECKPOINT_TOOL ? resolveTrustedTaskId(context) : null;
      if (operation === LINKBRAIN_CHECKPOINT_TOOL && !trustedTaskId) {
        return {
          content: [
            { type: "text" as const, text: "A trusted LiNKbrain task binding is required." },
          ],
          details: { ok: false, reason: "task_binding_unavailable" },
        };
      }
      const validated =
        operation === LINKBRAIN_CAPTURE_TOOL
          ? validateAndSanitizeCapture(argumentsValue, config)
          : trustedTaskId
            ? validateCheckpoint(argumentsValue, trustedTaskId)
            : null;
      if (!validated) {
        return {
          content: [{ type: "text" as const, text: "Invalid LiNKbrain write request." }],
          details: { ok: false, reason: "invalid_request" },
        };
      }
      let outcome: NativeWriteOutcome;
      try {
        outcome = await invokeWrite({
          api,
          config,
          toolName: operation,
          idempotencyKey: validated.idempotencyKey,
          arguments: validated.arguments,
        });
      } catch {
        outcome = { ok: false, errorCode: "write_failed" };
      }
      if (!outcome.ok) {
        return {
          content: [{ type: "text" as const, text: "LiNKbrain write failed safely." }],
          details: { ok: false, reason: outcome.errorCode },
        };
      }
      return {
        content: [{ type: "text" as const, text: "LiNKbrain write accepted." }],
        details: { ok: true, operation },
      };
    },
  };
}
