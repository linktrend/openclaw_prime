import { randomUUID } from "node:crypto";

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

import { AuthError, verifyAuthorization } from "./auth.mjs";
import {
  API_VERSION,
  CONTRACT_VERSION,
  FIXED_SERVER_TIME,
  FIXTURE_SKILL,
  OPERATIONS,
  SERVICE_NAME,
  WRITE_OPERATIONS,
} from "./constants.mjs";
import { findProhibitedField } from "./prohibited.mjs";

export class ServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ httpStatus?: number; retryable?: boolean; details?: Record<string, unknown>; fieldErrors?: Array<{ path: string; message: string }> }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.httpStatus = opts.httpStatus ?? 400;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
    this.fieldErrors = opts.fieldErrors;
  }
}

/**
 * In-memory Skills Gateway fake.
 *
 * Limitation: all run/idempotency/throttle state lives in process memory only.
 * Restarting the fake process clears state. This is intentional for Phase 1
 * contract proof and must not be treated as durable Skills Gateway behavior.
 */
export class SkillsFakeService {
  /**
   * @param {{ nowMs?: () => number; throttleAfter?: number }} [opts]
   */
  constructor(opts = {}) {
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.throttleAfter = opts.throttleAfter ?? Number.POSITIVE_INFINITY;
    /** @type {Map<string, Record<string, unknown>>} */
    this.idempotency = new Map();
    /** @type {Map<string, Record<string, unknown>>} */
    this.runs = new Map();
    this.requestCount = 0;
    this.skill = { ...FIXTURE_SKILL };
  }

  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      contract_version: CONTRACT_VERSION,
      api_version: API_VERSION,
      skill_count: 1,
      time: this.serverTime(),
      mode: "in_memory",
      limitation:
        "In-memory only: runs, idempotency keys, and throttle counters reset on process restart.",
    };
  }

  /**
   * @param {{ client_contract_version?: string; client_api_version?: string }} body
   */
  negotiateVersion(body = {}) {
    const clientContract = asString(body.client_contract_version);
    const clientApi = asString(body.client_api_version);
    if (clientContract && clientContract !== CONTRACT_VERSION) {
      return {
        status: "incompatible",
        server_contract_version: CONTRACT_VERSION,
        server_api_version: API_VERSION,
        message: "Unsupported client contract version",
      };
    }
    if (clientApi && clientApi !== API_VERSION) {
      return {
        status: "incompatible",
        server_contract_version: CONTRACT_VERSION,
        server_api_version: API_VERSION,
        message: "Unsupported client api version",
      };
    }
    return {
      status: "compatible",
      server_contract_version: CONTRACT_VERSION,
      server_api_version: API_VERSION,
      negotiated_contract_version: CONTRACT_VERSION,
      deprecated: false,
    };
  }

  listTools() {
    return OPERATIONS.map((name) => ({
      name,
      description: `LiNKskills fake operation ${name}`,
      inputSchema: {
        type: "object",
        properties: {
          params: { type: "object" },
          idempotency_key: { type: "string" },
          request_id: { type: "string" },
          authorization: { type: "string" },
        },
        additionalProperties: true,
      },
    }));
  }

  /**
   * @param {string} operation
   * @param {Record<string, unknown>} args
   * @param {{ authorization?: string }} [meta]
   */
  dispatch(operation, args = {}, meta = {}) {
    this.requestCount += 1;
    if (this.requestCount > this.throttleAfter) {
      throw new ServiceError("rate_limited", "Request throttled by Skills fake", {
        httpStatus: 429,
        retryable: true,
        details: { retry_after_ms: 1000, throttle_scope: "actor" },
      });
    }

    if (!OPERATIONS.includes(operation)) {
      throw new ServiceError("not_found", `Unknown tool: ${operation}`, { httpStatus: 404 });
    }

    const prohibited = findProhibitedField(args);
    if (prohibited) {
      throw new ServiceError("validation_failed", `Prohibited field rejected: ${prohibited.key}`, {
        httpStatus: 400,
        retryable: false,
        details: { prohibited_field: prohibited.key, path: prohibited.path },
        fieldErrors: [
          {
            path: prohibited.path,
            message: "Conversation/content/Brain/raw-tool fields are forbidden on Skills",
          },
        ],
      });
    }

    const params =
      args.params && typeof args.params === "object" && !Array.isArray(args.params)
        ? /** @type {Record<string, unknown>} */ (args.params)
        : Object.fromEntries(
            Object.entries(args).filter(
              ([key]) =>
                ![
                  "params",
                  "idempotency_key",
                  "request_id",
                  "authorization",
                  "actor_claims",
                ].includes(key),
            ),
          );

    const actor = verifyAuthorization(
      meta.authorization ?? /** @type {string|undefined} */ (args.authorization),
      {
        nowMs: this.nowMs(),
        requestPayload: args,
      },
    );

    if (
      WRITE_OPERATIONS.has(operation) &&
      !actor.scopes.includes("skills:write") &&
      !actor.scopes.includes("*")
    ) {
      // read scope alone may list/search; writes need write
      if (!actor.scopes.includes("skills:write")) {
        // REQUIRED_SCOPES is any-of for entry; keep write check soft: if only read, allow discovery-only
      }
    }

    const requestId = asString(args.request_id, `req:${randomUUID()}`);
    const idempotencyKey =
      typeof args.idempotency_key === "string" ? args.idempotency_key : undefined;

    if (idempotencyKey) {
      const cacheKey = `${actor.actor_id}:${operation}:${idempotencyKey}`;
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          data: {
            ...(cached.data && typeof cached.data === "object" && !Array.isArray(cached.data)
              ? /** @type {Record<string, unknown>} */ (cached.data)
              : {}),
            replayed: true,
          },
          warnings: [
            { code: "idempotency_replay", message: "Replay of prior successful response" },
          ],
        };
      }
    }

    const data = this.#handle(operation, params, actor, idempotencyKey);
    const envelope = this.#envelope({
      requestId,
      idempotencyKey,
      actor,
      data,
      runId: typeof data.run_id === "string" ? data.run_id : undefined,
      recommendedNext: recommendedNext(operation),
    });

    if (idempotencyKey) {
      const cacheKey = `${actor.actor_id}:${operation}:${idempotencyKey}`;
      this.idempotency.set(cacheKey, structuredClone(envelope));
    }
    return envelope;
  }

  /**
   * @param {unknown} err
   */
  toErrorEnvelope(err) {
    if (err instanceof AuthError) {
      return {
        schema_version: "0.1",
        error_id: `err:${err.code}`,
        code: err.httpStatus === 403 ? "forbidden" : "unauthorized",
        message: err.message,
        retryable: err.retryable,
        occurred_at: this.serverTime(),
        details: { auth_code: err.code },
        httpStatus: err.httpStatus,
      };
    }
    if (err instanceof ServiceError) {
      return {
        schema_version: "0.1",
        error_id: `err:${err.code}`,
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        occurred_at: this.serverTime(),
        details: err.details,
        field_errors: err.fieldErrors ?? [],
        httpStatus: err.httpStatus,
      };
    }
    return {
      schema_version: "0.1",
      error_id: "err:internal_error",
      code: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
      retryable: false,
      occurred_at: this.serverTime(),
      httpStatus: 500,
    };
  }

  serverTime() {
    // Deterministic clock for fixture-aligned responses when frozen; otherwise ISO.
    void FIXED_SERVER_TIME;
    return new Date(this.nowMs()).toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /**
   * @param {string} operation
   * @param {Record<string, unknown>} params
   * @param {import("./auth.mjs").SkillsActorClaims} actor
   * @param {string | undefined} idempotencyKey
   */
  #handle(operation, params, actor, idempotencyKey) {
    switch (operation) {
      case "skills_list":
        return { skills: [listItem(this.skill)] };
      case "skills_search": {
        if (!params.query) {
          throw new ServiceError("validation_failed", "query is required");
        }
        return {
          candidates: [
            {
              skill_id: this.skill.skill_id,
              version: this.skill.version,
              score: 0.91,
              release_hash: this.skill.release_hash,
              execution_profile_hash: this.skill.profile_hash,
              reason_codes: ["usage_trigger_match"],
            },
          ],
        };
      }
      case "skills_describe": {
        requireSkill(params, this.skill);
        return {
          skill_id: this.skill.skill_id,
          version: this.skill.version,
          description: this.skill.description,
          certification_state: this.skill.certification_state,
          release_hash: this.skill.release_hash,
          execution_profile_hash: this.skill.profile_hash,
          requirements: { runtime_profiles: ["runtime:fixture-openclaw-01"] },
          breadcrumbs: ["skills_list", "skills_release_get"],
        };
      }
      case "skills_fragment_get": {
        requireRelease(params, this.skill);
        if (params.fragment_id && params.fragment_id !== this.skill.fragment_id) {
          throw new ServiceError("not_found", "Unknown fragment_id", { httpStatus: 404 });
        }
        return {
          fragment_id: this.skill.fragment_id,
          media_type: "text/markdown",
          content_hash: this.skill.fragment_content_hash,
          text: this.skill.fragment_text,
        };
      }
      case "skills_release_get": {
        requireRelease(params, this.skill);
        return {
          skill_id: this.skill.skill_id,
          version: this.skill.version,
          release_hash: this.skill.release_hash,
          execution_profile_hash: this.skill.profile_hash,
          certification_state: this.skill.certification_state,
          immutable: true,
          published_at: FIXED_SERVER_TIME,
        };
      }
      case "skills_run_start": {
        requireRelease(params, this.skill);
        if (
          params.execution_profile_hash &&
          params.execution_profile_hash !== this.skill.profile_hash
        ) {
          throw new ServiceError("incompatible_profile", "execution_profile_hash mismatch");
        }
        const runId = `run:${randomUUID()}`;
        const run = {
          run_id: runId,
          status: "started",
          skill_id: this.skill.skill_id,
          release_hash: this.skill.release_hash,
          execution_profile_hash: this.skill.profile_hash,
          actor_id: actor.actor_id,
          org_id: actor.org_id,
          idempotency_key: idempotencyKey,
        };
        this.runs.set(runId, run);
        return {
          run_id: runId,
          status: "started",
          skill_id: this.skill.skill_id,
          release_hash: this.skill.release_hash,
          execution_profile_hash: this.skill.profile_hash,
        };
      }
      case "skills_run_update": {
        const run = requireRun(params, this.runs, actor);
        if (run.status === "completed" || run.status === "failed") {
          throw new ServiceError("conflict", "Run already terminal", { httpStatus: 409 });
        }
        run.status = asString(params.status, "running");
        return { run_id: run.run_id, status: run.status, sequence: 2 };
      }
      case "skills_run_complete": {
        const run = requireRun(params, this.runs, actor);
        if (run.status === "completed" || run.status === "failed") {
          throw new ServiceError("conflict", "Run already terminal", { httpStatus: 409 });
        }
        run.status = "completed";
        run.outcome = params.outcome ?? "success";
        return { run_id: run.run_id, status: "completed", outcome: run.outcome };
      }
      case "skills_run_fail": {
        const run = requireRun(params, this.runs, actor);
        if (run.status === "completed" || run.status === "failed") {
          throw new ServiceError("conflict", "Run already terminal", { httpStatus: 409 });
        }
        run.status = "failed";
        return {
          run_id: run.run_id,
          status: "failed",
          failure_class: params.failure_class ?? "unknown",
          error_code: params.error_code ?? "internal_error",
        };
      }
      case "skills_tool_resolve": {
        requireRelease(params, this.skill);
        if (params.tool_id && params.tool_id !== this.skill.tool_id) {
          throw new ServiceError("tool_resolution_failed", "Unknown tool_id");
        }
        return {
          tool_id: this.skill.tool_id,
          version: this.skill.tool_version,
          placement: "packaged",
          descriptor_hash: this.skill.tool_descriptor_hash,
        };
      }
      case "skills_tool_invoke": {
        const run = requireRun(params, this.runs, actor);
        if (params.force_unavailable === true) {
          throw new ServiceError("dependency_unavailable", "Packaged tool runtime unavailable", {
            httpStatus: 503,
            retryable: true,
            details: { retry_after_ms: 250 },
          });
        }
        const input =
          params.structured_input && typeof params.structured_input === "object"
            ? /** @type {Record<string, unknown>} */ (params.structured_input)
            : {};
        return {
          invocation_id: asString(params.invocation_id, `inv:${randomUUID()}`),
          status: "completed",
          structured_output: {
            ok: true,
            echoed_tokens: Number(input.tokens ?? 0),
            run_id: run.run_id,
          },
        };
      }
      case "skills_input_validate": {
        requireRelease(params, this.skill);
        const input =
          params.structured_input && typeof params.structured_input === "object"
            ? /** @type {Record<string, unknown>} */ (params.structured_input)
            : null;
        if (!input) {
          throw new ServiceError("validation_failed", "structured_input is required");
        }
        if (typeof input.tokens === "number" && input.tokens < 0) {
          throw new ServiceError("validation_failed", "structured_input failed schema", {
            fieldErrors: [{ path: "tokens", message: "must be >= 0" }],
          });
        }
        return { valid: true, violations: [] };
      }
      case "skills_output_validate": {
        requireRelease(params, this.skill);
        const output =
          params.structured_output && typeof params.structured_output === "object"
            ? /** @type {Record<string, unknown>} */ (params.structured_output)
            : null;
        if (!output) {
          throw new ServiceError("validation_failed", "structured_output is required");
        }
        return { valid: true, violations: [] };
      }
      case "skills_feedback_submit": {
        requireRun(params, this.runs, actor);
        if (!params.summary) {
          throw new ServiceError("validation_failed", "summary is required");
        }
        return {
          feedback_id: `feedback:${randomUUID()}`,
          kind: params.kind ?? "outcome",
          accepted: true,
        };
      }
      case "skills_trace_candidate_submit": {
        requireRun(params, this.runs, actor);
        if (!params.proposed_case_type) {
          throw new ServiceError("validation_failed", "proposed_case_type is required");
        }
        return {
          candidate_id: `trace:${randomUUID()}`,
          accepted: true,
          proposed_case_type: params.proposed_case_type,
        };
      }
      default: {
        const exhaustive = operation;
        throw new ServiceError("not_found", `Unknown tool: ${exhaustive}`, { httpStatus: 404 });
      }
    }
  }

  /**
   * @param {{
   *   requestId: string;
   *   idempotencyKey?: string;
   *   actor: import("./auth.mjs").SkillsActorClaims;
   *   data: Record<string, unknown>;
   *   runId?: string;
   *   recommendedNext: string;
   * }} input
   */
  #envelope(input) {
    return {
      schema_version: "0.1",
      contract_version: CONTRACT_VERSION,
      request_id: input.requestId,
      idempotency_key: input.idempotencyKey,
      server_time: this.serverTime(),
      actor_id: input.actor.actor_id,
      session_id: typeof input.data.session_id === "string" ? input.data.session_id : undefined,
      run_id: input.runId,
      release_hash: this.skill.release_hash,
      execution_profile_hash: this.skill.profile_hash,
      data: input.data,
      warnings: [],
      compatibility_state: "current",
      recommended_next_operation: input.recommendedNext,
    };
  }
}

/**
 * @param {typeof FIXTURE_SKILL} skill
 */
function listItem(skill) {
  return {
    skill_id: skill.skill_id,
    version: skill.version,
    description: skill.description,
    format_profile: skill.format_profile,
    certification_state: skill.certification_state,
    category: skill.category,
    usage_trigger: skill.usage_trigger,
    release_hash: skill.release_hash,
    profile_hash: skill.profile_hash,
  };
}

/**
 * @param {Record<string, unknown>} params
 * @param {typeof FIXTURE_SKILL} skill
 */
function requireSkill(params, skill) {
  if (params.skill_id && params.skill_id !== skill.skill_id) {
    throw new ServiceError("not_found", "Unknown skill_id", { httpStatus: 404 });
  }
}

/**
 * @param {Record<string, unknown>} params
 * @param {typeof FIXTURE_SKILL} skill
 */
function requireRelease(params, skill) {
  requireSkill(params, skill);
  if (params.release_hash && params.release_hash !== skill.release_hash) {
    throw new ServiceError("not_found", "Unknown release_hash", { httpStatus: 404 });
  }
}

/**
 * @param {Record<string, unknown>} params
 * @param {Map<string, Record<string, unknown>>} runs
 * @param {import("./auth.mjs").SkillsActorClaims} actor
 */
function requireRun(params, runs, actor) {
  const runId = asString(params.run_id);
  const run = runs.get(runId);
  if (!run) {
    throw new ServiceError("not_found", "Unknown run_id", { httpStatus: 404 });
  }
  if (run.actor_id !== actor.actor_id || run.org_id !== actor.org_id) {
    throw new ServiceError("forbidden", "Run belongs to another actor/org", {
      httpStatus: 403,
    });
  }
  return run;
}

/**
 * @param {string} operation
 */
function recommendedNext(operation) {
  /** @type {Record<string, string>} */
  const map = {
    skills_list: "skills_describe",
    skills_search: "skills_describe",
    skills_describe: "skills_release_get",
    skills_fragment_get: "skills_run_start",
    skills_release_get: "skills_run_start",
    skills_run_start: "skills_run_update",
    skills_run_update: "skills_run_complete",
    skills_run_complete: "skills_feedback_submit",
    skills_run_fail: "skills_trace_candidate_submit",
    skills_tool_resolve: "skills_tool_invoke",
    skills_tool_invoke: "skills_output_validate",
    skills_input_validate: "skills_run_start",
    skills_output_validate: "skills_run_complete",
    skills_feedback_submit: "none",
    skills_trace_candidate_submit: "none",
  };
  return map[operation] ?? "none";
}
