import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../config/config.js";
import { resolveSecretInputString } from "../config/types.secrets.js";
import type { LinktrendGovernanceInput } from "../linktrend/governance-types.js";
import { LINKTREND_GOVERNANCE_ONLY_DEFAULT_MESSAGE } from "../linktrend/governance.js";
import { normalizeLinktrendGovernanceInbound } from "../linktrend/normalize-governance-inbound.js";
import { safeEqualSecret } from "../security/secret-equal.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { readJsonBodyOrError, sendJson, sendMethodNotAllowed } from "./http-common.js";
import {
  authorizeScopedGatewayHttpRequestOrReply,
  getBearerToken,
  resolveOpenAiCompatibleHttpOperatorScopes,
} from "./http-utils.js";
import { ErrorCodes, formatValidationErrors, validateAgentParams } from "./protocol/index.js";
import { agentHandlers } from "./server-methods/agent.js";
import type { GatewayRequestContext } from "./server-methods/types.js";

export const DEFAULT_LINKTREND_AGENT_RUN_PATH = "/v1/linktrend/agent-run";

const DEFAULT_BODY_BYTES = 8 * 1024 * 1024;

function resolveDedicatedBearer(cfg: ReturnType<typeof loadConfig>): string | undefined {
  const fromEnv = process.env.OPENCLAW_LINKTREND_RUN_BEARER?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const raw = cfg.gateway?.linktrendAgentRun?.bearerToken;
  if (!raw) {
    return undefined;
  }
  const resolved = resolveSecretInputString({
    value: raw,
    mode: "strict",
    path: "gateway.linktrendAgentRun.bearerToken",
  });
  return resolved.status === "available" ? resolved.value.trim() : undefined;
}

function resolveIngressPath(cfg: ReturnType<typeof loadConfig>): string {
  const p = cfg.gateway?.linktrendAgentRun?.path?.trim();
  if (p?.startsWith("/")) {
    return p;
  }
  return DEFAULT_LINKTREND_AGENT_RUN_PATH;
}

function prepareAgentParams(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!validateAgentParams(body)) {
    return null;
  }
  const mutableParams: Record<string, unknown> = { ...body };
  if (!("message" in mutableParams)) {
    mutableParams.message = LINKTREND_GOVERNANCE_ONLY_DEFAULT_MESSAGE;
  }
  const idemIncoming = mutableParams.idempotencyKey;
  if (typeof idemIncoming !== "string" || !idemIncoming.trim()) {
    mutableParams.idempotencyKey = randomUUID();
  }
  if (mutableParams.linktrendGovernance && typeof mutableParams.linktrendGovernance === "object") {
    mutableParams.linktrendGovernance = normalizeLinktrendGovernanceInbound(
      mutableParams.linktrendGovernance as LinktrendGovernanceInput,
    );
  }
  return mutableParams;
}

/**
 * POST JSON body matching gateway `agent` RPC params (including `linktrendGovernance`).
 * Uses the same validation and execution path as WebSocket `agent`.
 */
export async function handleLinktrendAgentRunHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    gatewayRequestContextRef: { current: GatewayRequestContext | null };
    trustedProxies: string[];
    allowRealIpFallback: boolean;
    rateLimiter?: AuthRateLimiter;
    resolvedAuth: ResolvedGatewayAuth;
    maxBodyBytes?: number;
  },
): Promise<boolean> {
  const cfg = loadConfig();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = resolveIngressPath(cfg);
  if (url.pathname !== path) {
    return false;
  }
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return true;
  }
  const dedicated = resolveDedicatedBearer(cfg);
  if (dedicated) {
    const presented = getBearerToken(req);
    if (!presented || !safeEqualSecret(presented, dedicated)) {
      sendJson(res, 401, {
        ok: false,
        error: {
          type: "unauthorized",
          message: "LiNKtrend agent run requires a valid Authorization: Bearer token.",
        },
      });
      return true;
    }
  } else {
    const scoped = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth: opts.resolvedAuth,
      trustedProxies: opts.trustedProxies,
      allowRealIpFallback: opts.allowRealIpFallback,
      rateLimiter: opts.rateLimiter,
      operatorMethod: "agent",
      resolveOperatorScopes: resolveOpenAiCompatibleHttpOperatorScopes,
    });
    if (!scoped) {
      return true;
    }
  }

  const ctx = opts.gatewayRequestContextRef.current;
  if (!ctx) {
    sendJson(res, 503, {
      ok: false,
      error: {
        type: "unavailable",
        message: "Gateway request context not ready yet; retry shortly.",
      },
    });
    return true;
  }

  const raw = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? DEFAULT_BODY_BYTES);
  if (raw === undefined) {
    return true;
  }
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const prepared = prepareAgentParams(body);
  if (!prepared) {
    sendJson(res, 400, {
      ok: false,
      error: {
        type: "invalid_request",
        message: `invalid agent params: ${formatValidationErrors(validateAgentParams.errors)}`,
      },
    });
    return true;
  }

  const frameId = randomUUID();
  await new Promise<void>((resolvePromise) => {
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        resolvePromise();
      }
    };
    Promise.resolve(
      agentHandlers.agent({
        req: { type: "req", id: frameId, method: "agent", params: prepared },
        params: prepared,
        client: null,
        isWebchatConnect: () => false,
        respond: (ok, payload, err) => {
          if (err) {
            const code = err.code ?? ErrorCodes.INVALID_REQUEST;
            const status = code === ErrorCodes.UNAVAILABLE ? 503 : 400;
            if (!res.headersSent) {
              sendJson(res, status, {
                ok: false,
                error: err,
                payload,
              });
            }
            finish();
            return;
          }
          const statusField =
            payload && typeof payload === "object" && "status" in payload
              ? (payload as { status?: string }).status
              : undefined;
          if (statusField === "accepted") {
            return;
          }
          if (!res.headersSent) {
            sendJson(res, ok ? 200 : 400, {
              ok,
              ...(typeof payload === "object" && payload !== null ? payload : {}),
            });
          }
          finish();
        },
        context: ctx,
      }),
    ).catch((e: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          ok: false,
          error: { type: "internal_error", message: String(e) },
        });
      }
      finish();
    });
  });

  return true;
}
