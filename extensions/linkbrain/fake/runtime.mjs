/**
 * Deterministic Brain fake runtime for OpenClaw Lisa integration tests.
 *
 * Phase 1 limitation: idempotency map is in-memory only. Crash/restart of the
 * fake process clears replay state; callers must not treat this as durable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BRAIN_CONTRACT_VERSION = "1.0.0";

export const BRAIN_TOOL_NAMES = Object.freeze([
  "brain_browse",
  "brain_search",
  "brain_load",
  "brain_append_finding",
  "brain_capture_batch",
  "brain_episode_checkpoint",
  "brain_private_search",
  "brain_private_load",
  "brain_task_start",
  "brain_task_update",
  "brain_inbox_read",
  "brain_conflict_respond",
  "brain_message_send",
  "brain_checkpoint_write",
  "brain_handoff_create",
  "brain_handoff_accept",
  "brain_task_close",
]);

export const BRAIN_WRITE_TOOLS = Object.freeze(
  new Set([
    "brain_append_finding",
    "brain_capture_batch",
    "brain_episode_checkpoint",
    "brain_task_start",
    "brain_task_update",
    "brain_conflict_respond",
    "brain_message_send",
    "brain_checkpoint_write",
    "brain_handoff_create",
    "brain_handoff_accept",
    "brain_task_close",
  ]),
);

/** Fields Brain must never accept on capture/write payloads. */
export const BRAIN_PROHIBITED_FIELDS = Object.freeze([
  "reasoning",
  "chainOfThought",
  "chain_of_thought",
  "secrets",
  "secret",
  "authorization",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "rawToolOutput",
  "unboundedToolOutput",
  "raw_tool_output",
]);

/** Skills-shaped fields that prove cross-domain rejection on the Brain fake. */
export const SKILLS_SHAPED_FIELDS = Object.freeze([
  "skillId",
  "skillsReleaseHash",
  "skillsRunId",
  "skills_run_id",
  "telemetry",
]);

const AUTH_TOKEN_OUTCOMES = Object.freeze({
  "fake-valid-token": "ok",
  "fake-expired-token": "expired",
  "fake-revoked-token": "revoked",
  "fake-rotated-token": "revoked",
  "fake-wrong-audience-token": "wrong_audience",
  "fake-wrong-scope-token": "wrong_service",
});

/** Brain Gateway BrainErrorCode failure fixture names. */
const BRAIN_FAILURE_FIXTURES = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "unauthorized",
  not_found: "unauthorized",
  validation_error: "validation_error",
  conflict: "validation_error",
  payload_too_large: "validation_error",
  rate_limited: "rate_limited",
  internal_error: "internal_error",
  // Legacy forceFailure aliases accepted by tests during taxonomy migration.
  authentication: "unauthorized",
  terminal: "validation_error",
  retryable: "internal_error",
  throttled: "rate_limited",
});

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveBrainFixturesDir(customDir) {
  if (customDir) {
    return path.resolve(customDir);
  }
  return path.resolve(moduleDir, "../fixtures");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toolFamily(toolName) {
  if (
    toolName === "brain_browse" ||
    toolName === "brain_search" ||
    toolName === "brain_load" ||
    toolName === "brain_append_finding"
  ) {
    return "knowledge";
  }
  if (
    toolName === "brain_capture_batch" ||
    toolName === "brain_episode_checkpoint" ||
    toolName === "brain_private_search" ||
    toolName === "brain_private_load"
  ) {
    return "private";
  }
  return "coordination";
}

function collectKeys(value, found = new Set(), depth = 0) {
  if (depth > 12 || value === null || typeof value !== "object") {
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, found, depth + 1);
    }
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    found.add(key);
    collectKeys(child, found, depth + 1);
  }
  return found;
}

/**
 * Reject secret/reasoning/unbounded categories and Skills-shaped fields.
 * @returns {{ ok: true } | { ok: false, code: string, fields: string[], safeMessage: string }}
 */
export function validateBrainPayload(payload) {
  const keys = collectKeys(payload);
  const prohibited = BRAIN_PROHIBITED_FIELDS.filter((field) => keys.has(field));
  if (prohibited.length > 0) {
    return {
      ok: false,
      code: "validation_error",
      fields: prohibited,
      message: "Payload contains prohibited Brain capture/write fields.",
      safeMessage: "Payload contains prohibited Brain capture/write fields.",
      details: { reason: "prohibited_field", fields: prohibited },
    };
  }
  const crossDomain = SKILLS_SHAPED_FIELDS.filter((field) => keys.has(field));
  if (crossDomain.length > 0) {
    return {
      ok: false,
      code: "validation_error",
      fields: crossDomain,
      message: "Payload contains Skills-shaped fields rejected by Brain fake.",
      safeMessage: "Payload contains Skills-shaped fields rejected by Brain fake.",
      details: { reason: "cross_domain_field", fields: crossDomain },
    };
  }
  return { ok: true };
}

export function listBrainTools() {
  return BRAIN_TOOL_NAMES.map((name) => ({
    name,
    description: `LiNKbrain draft tool ${name} (OpenClaw Phase 1 fake).`,
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        idempotencyKey: { type: "string" },
      },
    },
  }));
}

/**
 * Create an isolated Brain fake instance (process-local in-memory state).
 */
export function createBrainFake(options = {}) {
  const fixturesDir = resolveBrainFixturesDir(options.fixturesDir);
  const now = typeof options.now === "function" ? options.now : () => "2026-07-27T10:00:00.000Z";
  /** @type {Map<string, { tool: string, result: unknown }>} */
  const idempotency = new Map();
  let throttleRemaining = typeof options.throttleAfter === "number" ? options.throttleAfter : null;
  let forceFailure = options.forceFailure ?? null;

  function failureFixture(name) {
    const mapped = BRAIN_FAILURE_FIXTURES[name] ?? name;
    return readJson(path.join(fixturesDir, "failures", `${mapped}.json`));
  }

  function authOutcome(token) {
    if (!token || typeof token !== "string") {
      return "missing";
    }
    return AUTH_TOKEN_OUTCOMES[token] ?? "unknown";
  }

  function envelope(extra = {}) {
    return {
      contractVersion: BRAIN_CONTRACT_VERSION,
      serverTime: now(),
      actorId: "actor_test_lisa",
      actorBindingId: "binding_test_lisa_openclaw",
      ...extra,
    };
  }

  function normalizeError(error) {
    const code = typeof error?.code === "string" ? error.code : "internal_error";
    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof error?.safeMessage === "string"
          ? error.safeMessage
          : "Brain Gateway error";
    const safeMessage = typeof error?.safeMessage === "string" ? error.safeMessage : message;
    return {
      code,
      message,
      safeMessage,
      retryable: Boolean(error?.retryable),
      ...(error?.details && typeof error.details === "object" ? { details: error.details } : {}),
      ...(typeof error?.retryAfterMs === "number" ? { retryAfterMs: error.retryAfterMs } : {}),
      ...(Array.isArray(error?.fields) ? { fields: error.fields } : {}),
      ...(typeof error?.detail === "string" ? { detail: error.detail } : {}),
    };
  }

  function errorResult(error, requestId) {
    const normalized = normalizeError(error);
    return {
      ok: false,
      ...envelope({
        requestId,
        warnings: [],
        error: normalized,
      }),
    };
  }

  function health() {
    return readJson(path.join(fixturesDir, "health", "health-ok.json"));
  }

  function negotiateVersion(requested) {
    const ok = readJson(path.join(fixturesDir, "health", "version-negotiate.json"));
    if (!requested || requested === BRAIN_CONTRACT_VERSION) {
      return { ok: true, ...ok, requested: requested ?? BRAIN_CONTRACT_VERSION };
    }
    const bad = readJson(path.join(fixturesDir, "health", "version-incompatible.json"));
    return { ok: false, ...bad, requested };
  }

  function loadToolResponse(toolName) {
    const family = toolFamily(toolName);
    return readJson(path.join(fixturesDir, "tools", family, `${toolName}.response.json`));
  }

  function callTool(toolName, args = {}, meta = {}) {
    const requestId = meta.requestId ?? `req_${toolName}_${idempotency.size + 1}`;
    const token = meta.authToken ?? args["_authBearer"] ?? args.authToken;

    if (!BRAIN_TOOL_NAMES.includes(toolName)) {
      return errorResult(
        {
          code: "not_found",
          message: `Unknown Brain tool: ${toolName}`,
          safeMessage: `Unknown Brain tool: ${toolName}`,
          retryable: false,
        },
        requestId,
      );
    }

    const outcome = authOutcome(token);
    if (outcome !== "ok") {
      const authError = failureFixture("unauthorized");
      authError.detail = outcome === "missing" ? "missing" : outcome;
      authError.details = { reason: outcome === "missing" ? "missing" : outcome };
      return errorResult(authError, requestId);
    }

    if (forceFailure === "internal_error" || forceFailure === "retryable") {
      return errorResult(failureFixture("internal_error"), requestId);
    }
    if (forceFailure === "validation_error" || forceFailure === "terminal") {
      return errorResult(failureFixture("validation_error"), requestId);
    }
    if (forceFailure === "rate_limited" || forceFailure === "throttled") {
      return errorResult(failureFixture("rate_limited"), requestId);
    }
    if (forceFailure === "unauthorized" || forceFailure === "authentication") {
      return errorResult(failureFixture("unauthorized"), requestId);
    }
    if (throttleRemaining !== null) {
      if (throttleRemaining <= 0) {
        return errorResult(failureFixture("rate_limited"), requestId);
      }
      throttleRemaining -= 1;
    }

    const domainArgs = { ...args };
    delete domainArgs["_authBearer"];
    delete domainArgs.authToken;
    delete domainArgs.claims;

    const validation = validateBrainPayload(domainArgs);
    if (!validation.ok) {
      return errorResult(
        {
          code: validation.code,
          message: validation.message ?? validation.safeMessage,
          safeMessage: validation.safeMessage,
          retryable: false,
          fields: validation.fields,
          details: validation.details,
        },
        requestId,
      );
    }

    const idempotencyKey = (() => {
      if (typeof domainArgs.idempotencyKey === "string") {
        return domainArgs.idempotencyKey;
      }
      // Live MCP brain_capture_batch schema has no top-level idempotencyKey;
      // durable key lives at batch.idempotencyKey (additionalProperties:false).
      if (
        toolName === "brain_capture_batch" &&
        domainArgs.batch &&
        typeof domainArgs.batch === "object" &&
        !Array.isArray(domainArgs.batch) &&
        typeof domainArgs.batch.idempotencyKey === "string"
      ) {
        return domainArgs.batch.idempotencyKey;
      }
      return null;
    })();
    if (BRAIN_WRITE_TOOLS.has(toolName)) {
      if (!idempotencyKey) {
        return errorResult(
          {
            code: "validation_error",
            message: "Brain writes require an idempotencyKey.",
            safeMessage: "Brain writes require an idempotencyKey.",
            retryable: false,
          },
          requestId,
        );
      }
      const prior = idempotency.get(idempotencyKey);
      if (prior) {
        if (prior.tool !== toolName) {
          return errorResult(
            {
              code: "conflict",
              message: "Idempotency key reused for a different Brain tool.",
              safeMessage: "Idempotency key reused for a different Brain tool.",
              retryable: false,
            },
            requestId,
          );
        }
        return {
          ok: true,
          ...envelope({
            requestId,
            idempotencyKey,
            result: { ...prior.result, replayed: true },
            warnings: [],
            retryability: { retryable: false },
            replayed: true,
          }),
        };
      }
    }

    const fixture = loadToolResponse(toolName);
    const result = {
      ...(fixture.result && typeof fixture.result === "object" ? fixture.result : {}),
      replayed: false,
    };
    if (idempotencyKey) {
      idempotency.set(idempotencyKey, { tool: toolName, result: { ...result } });
    }

    return {
      ok: true,
      ...envelope({
        requestId,
        idempotencyKey,
        result,
        warnings: Array.isArray(fixture.warnings) ? fixture.warnings : [],
        retryability: { retryable: false },
        replayed: false,
      }),
    };
  }

  return {
    fixturesDir,
    contractVersion: BRAIN_CONTRACT_VERSION,
    listTools: listBrainTools,
    callTool,
    health,
    negotiateVersion,
    authOutcome,
    validateBrainPayload,
    /** Test/control seam: inject next forced failure class. */
    setForceFailure(kind) {
      forceFailure = kind;
    },
    /** Test/control seam: after N successful calls, throttle. */
    setThrottleAfter(count) {
      throttleRemaining = count;
    },
    /**
     * Phase 1 limitation: in-memory only. Exposed for crash/restart docs/tests.
     */
    getIdempotencySize() {
      return idempotency.size;
    },
    clearIdempotency() {
      idempotency.clear();
    },
  };
}

/**
 * Handle a single JSON-RPC MCP message against a Brain fake instance.
 */
export function handleBrainMcpMessage(fake, message) {
  if (!message || typeof message !== "object") {
    return null;
  }
  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "linkbrain-fake",
          version: BRAIN_CONTRACT_VERSION,
        },
      },
    };
  }
  if (message.method === "notifications/initialized") {
    return null;
  }
  if (message.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: fake.listTools() },
    };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    const meta = {
      authToken: message.params?.["_meta"]?.authToken ?? args["_authBearer"] ?? args.authToken,
      requestId: message.params?.["_meta"]?.requestId,
    };
    const outcome = fake.callTool(name, args, meta);
    if (!outcome.ok) {
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          isError: true,
          content: [{ type: "text", text: outcome.error?.safeMessage ?? "Brain fake error" }],
          structuredContent: outcome,
        },
      };
    }
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(outcome.result) }],
        structuredContent: outcome,
      },
    };
  }
  if (message.id !== undefined) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    };
  }
  return null;
}
