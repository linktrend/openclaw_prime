/**
 * Configurable Skills transport adapters.
 *
 * Modes: disabled (default) | fake (test-only) | http | mcp.
 * Drain calls exact frozen skills_* ops. No conversation hooks.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  fingerprintMachineTokenKeyRef,
  type MachineTokenPluginFacade,
  type ResolvedMachineToken,
} from "openclaw/plugin-sdk/machine-token-runtime";
import {
  buildPluginMcpHttpFetch,
  withoutMcpAuthorizationHeader,
  withSameOriginMcpHttpHeaders,
} from "openclaw/plugin-sdk/mcp-http-fetch";
import { resolveConfiguredSecretInputString } from "openclaw/plugin-sdk/secret-input-runtime";
import {
  fetchWithSsrFGuard,
  mergeSsrFPolicies,
  ssrfPolicyFromHttpBaseUrlAllowedHostname,
} from "openclaw/plugin-sdk/ssrf-runtime";
import { isAllowedLinkskillsMcpTool } from "../mcp-tool-filter.js";
import type { OpenClawPluginApi } from "../runtime-api.js";
import {
  assertLinkskillsRemoteHttpsUrl,
  isLinkskillsLocalTestLoopbackHost,
  parseLinkskillsMachineToken,
  type LinkskillsConfig,
  type LinkskillsMachineTokenConfig,
  type LinkskillsTransportMode,
} from "./config.js";
import {
  createSkillsFakeTransport,
  type LinkskillsTransport,
  type LinkskillsTransportResult,
  type SkillsFakeDispatch,
} from "./runtime.js";
import { isSkillsDrainTool } from "./tools.js";

type ManagedMcpServerEntry = {
  enabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string | number | boolean>;
  cwd?: string;
  workingDirectory?: string;
  url?: string;
  transport?: "stdio" | "sse" | "streamable-http";
  headers?: Record<string, unknown>;
  auth?: string;
  oauth?: {
    authProfileId?: string;
    scope?: string;
    redirectUrl?: string;
    clientMetadataUrl?: string;
  };
  machineToken?: unknown;
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  [key: string]: unknown;
};

type McpToolSession = {
  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ isError?: boolean; structuredContent?: unknown; content?: unknown }>;
  close(): Promise<void>;
};

/** Safe result returned to a plugin-owned local tool. Credentials remain host-owned. */
export type LinkskillsMcpCallResult =
  | { ok: true; result?: Record<string, unknown> }
  | { ok: false; safeMessage: string };

const HTTP_IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/u;

type ResolveMachineTokenAccessFn = (params: {
  bindingId: string;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}) => Promise<ResolvedMachineToken>;

type InvalidateMachineTokenCacheFn = (bindingId: string) => void;

export type ResolveLinkskillsTransportParams = {
  api: Pick<OpenClawPluginApi, "config" | "logger"> &
    Partial<Pick<OpenClawPluginApi, "machineTokenFacade">>;
  config: LinkskillsConfig;
  fakeForTests?: {
    fake: SkillsFakeDispatch;
    authorization: string;
  };
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  createMcpSession?: (server: ManagedMcpServerEntry) => Promise<McpToolSession>;
  /** Host-injected binding-scoped facade (preferred). */
  machineTokenFacade?: MachineTokenPluginFacade;
  /** Test injection for machine-token mint (wrapped into a scoped facade). */
  resolveMachineTokenAccess?: ResolveMachineTokenAccessFn;
  /** Test injection for cache invalidation after HTTP 401. */
  invalidateMachineTokenCache?: InvalidateMachineTokenCacheFn;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapHttpStatus(
  status: number,
): Pick<LinkskillsTransportResult, "retryable" | "terminal" | "errorCode" | "safeMessage"> {
  if (status === 429 || status === 408 || status === 502 || status === 503 || status === 504) {
    return {
      retryable: true,
      terminal: false,
      errorCode: status === 429 ? "throttled" : "retryable",
      safeMessage: `HTTP ${status}`,
    };
  }
  if (status >= 500) {
    return {
      retryable: true,
      terminal: false,
      errorCode: "retryable",
      safeMessage: `HTTP ${status}`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      retryable: false,
      terminal: true,
      errorCode: "authentication",
      safeMessage: `HTTP ${status}`,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      retryable: false,
      terminal: true,
      errorCode: "terminal",
      safeMessage: `HTTP ${status}`,
    };
  }
  return {
    retryable: true,
    terminal: false,
    errorCode: "retryable",
    safeMessage: `HTTP ${status}`,
  };
}

/** Exactly one bounded machine-token reissue on resource 401 or 403. */
function isBoundedAuthReissueStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function isAuthReissueCandidateError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && isBoundedAuthReissueStatus(status)) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b|\b403\b|unauthorized|forbidden/iu.test(message);
}

function createStaticResultTransport(result: LinkskillsTransportResult): LinkskillsTransport {
  return {
    async write() {
      return result;
    },
  };
}

function createDisabledTransport(): LinkskillsTransport {
  return createStaticResultTransport({
    ok: false,
    retryable: true,
    terminal: false,
    errorCode: "transport_disabled",
    safeMessage: "linkskills transportMode is disabled",
  });
}

function createRejectedFakeTransport(safeMessage: string): LinkskillsTransport {
  return createStaticResultTransport({
    ok: false,
    retryable: false,
    terminal: true,
    errorCode: "fake_rejected",
    safeMessage,
  });
}

async function resolveMachineTokenBearer(params: {
  bindingId: string;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  machineTokenFacade: MachineTokenPluginFacade;
}): Promise<{ value?: string; bindingId?: string; error?: LinkskillsTransportResult }> {
  try {
    // Host owns credential scope — plugins pass only the granted bindingId.
    const resolved = await params.machineTokenFacade.acquire({
      bindingId: params.bindingId,
      ...(params.signal ? { signal: params.signal } : {}),
      ...(params.forceRefresh ? { forceRefresh: true } : {}),
    });
    return { value: resolved.accessToken, bindingId: resolved.bindingId };
  } catch (error) {
    return {
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "machine_token_error",
        safeMessage: error instanceof Error ? error.message : "machine token resolution failed",
      },
    };
  }
}

async function resolveBearerToken(params: {
  config: LinkskillsConfig;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  machineTokenFacade?: MachineTokenPluginFacade;
}): Promise<{ value?: string; bindingId?: string; error?: LinkskillsTransportResult }> {
  // Explicit machineToken config selects machine-token mode and fail-closes —
  // never fall through to SecretRef bearer when the binding is incomplete.
  if (params.config.machineToken) {
    if (!params.machineTokenFacade) {
      return {
        error: {
          ok: false,
          retryable: true,
          terminal: false,
          errorCode: "machine_token_error",
          safeMessage: "linkskills machine-token facade is not configured",
        },
      };
    }
    return await resolveMachineTokenBearer({
      bindingId: params.config.machineToken.bindingId,
      signal: params.signal,
      forceRefresh: params.forceRefresh,
      machineTokenFacade: params.machineTokenFacade,
    });
  }
  if (params.config.skillsCredential === undefined) {
    return {
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "credential_missing",
        safeMessage: "linkskills skillsCredential is not configured",
      },
    };
  }
  const resolved = await resolveConfiguredSecretInputString({
    config: params.apiConfig,
    env: params.env,
    value: params.config.skillsCredential,
    path: "plugins.entries.linkskills.config.skillsCredential",
  });
  if (resolved.unresolvedRefReason || !resolved.value) {
    return {
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "credential_unresolved",
        safeMessage: resolved.unresolvedRefReason ?? "linkskills skillsCredential unresolved",
      },
    };
  }
  return { value: resolved.value };
}

function coerceHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function expandEnvTemplate(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => env[name] ?? "");
}

function machineTokenBindingsConflict(
  serverToken: LinkskillsMachineTokenConfig,
  pluginToken: LinkskillsMachineTokenConfig,
): boolean {
  if (serverToken.bindingId !== pluginToken.bindingId) {
    return true;
  }
  if (serverToken.issuerUrl !== pluginToken.issuerUrl) {
    return true;
  }
  if (serverToken.clientId !== pluginToken.clientId) {
    return true;
  }
  if ((serverToken.audience ?? "") !== (pluginToken.audience ?? "")) {
    return true;
  }
  if ((serverToken.scope ?? "") !== (pluginToken.scope ?? "")) {
    return true;
  }
  if ((serverToken.allowPrivateNetwork === true) !== (pluginToken.allowPrivateNetwork === true)) {
    return true;
  }
  const serverFp = fingerprintMachineTokenKeyRef({
    source: serverToken.clientAssertionKeyRef.source,
    provider: serverToken.clientAssertionKeyRef.provider,
    id: serverToken.clientAssertionKeyRef.id,
  });
  const pluginFp = fingerprintMachineTokenKeyRef({
    source: pluginToken.clientAssertionKeyRef.source,
    provider: pluginToken.clientAssertionKeyRef.provider,
    id: pluginToken.clientAssertionKeyRef.id,
  });
  return serverFp !== pluginFp;
}

function selectMcpMachineToken(
  server: ManagedMcpServerEntry,
  pluginMachineToken: LinkskillsMachineTokenConfig | undefined,
  localTest?: boolean,
):
  | { status: "selected"; machineToken: LinkskillsMachineTokenConfig }
  | { status: "incomplete" }
  | { status: "invalid"; safeMessage: string }
  | { status: "none" } {
  // Never override interactive oauth merely because a machineToken block exists.
  if (server.auth === "oauth") {
    return { status: "none" };
  }
  // Explicit machine_token mode only — incomplete/absent vs present-invalid differ.
  if (server.auth === "machine_token") {
    const rawServerToken = server.machineToken;
    const serverTokenPresent = rawServerToken !== undefined && rawServerToken !== null;
    if (serverTokenPresent) {
      // Present block: parse must succeed. Never fall through to plugin binding.
      let serverToken: LinkskillsMachineTokenConfig;
      try {
        const parsed = parseLinkskillsMachineToken(rawServerToken, { localTest });
        if (!parsed) {
          return {
            status: "invalid",
            safeMessage: "mcp server machineToken binding is present but incomplete",
          };
        }
        serverToken = parsed;
      } catch (error) {
        return {
          status: "invalid",
          safeMessage:
            error instanceof Error ? error.message : "mcp server machineToken binding is invalid",
        };
      }
      if (pluginMachineToken && machineTokenBindingsConflict(serverToken, pluginMachineToken)) {
        return {
          status: "invalid",
          safeMessage: "mcp server machineToken conflicts with plugin-level machineToken binding",
        };
      }
      return { status: "selected", machineToken: serverToken };
    }
    // Absent per-server block: plugin-level binding may apply.
    if (pluginMachineToken) {
      return { status: "selected", machineToken: pluginMachineToken };
    }
    return { status: "incomplete" };
  }
  return { status: "none" };
}

async function resolveMcpHeaders(params: {
  server: ManagedMcpServerEntry;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  pluginMachineToken?: LinkskillsMachineTokenConfig;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  localTest?: boolean;
  machineTokenFacade?: MachineTokenPluginFacade;
}): Promise<{
  headers: Record<string, string>;
  authProfileOnly: boolean;
  bindingId?: string;
  error?: LinkskillsTransportResult;
}> {
  const headers: Record<string, string> = {};
  const raw = params.server.headers ?? {};
  for (const [key, value] of Object.entries(raw)) {
    if (isRecord(value) && typeof value.source === "string") {
      const resolved = await resolveConfiguredSecretInputString({
        config: params.apiConfig,
        env: params.env,
        value,
        path: `mcp.servers.headers.${key}`,
      });
      if (resolved.value) {
        headers[key] = resolved.value;
      }
      continue;
    }
    const coerced = coerceHeaderValue(value);
    if (coerced) {
      headers[key] = expandEnvTemplate(coerced, params.env);
    }
  }

  const selection = selectMcpMachineToken(
    params.server,
    params.pluginMachineToken,
    params.localTest,
  );
  if (selection.status === "incomplete") {
    return {
      headers,
      authProfileOnly: false,
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "machine_token_error",
        safeMessage:
          "mcp server auth is machine_token but no complete machineToken binding is configured",
      },
    };
  }
  if (selection.status === "invalid") {
    // Present-but-invalid or conflicting bindings — never fall through.
    return {
      headers,
      authProfileOnly: false,
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "machine_token_error",
        safeMessage: selection.safeMessage,
      },
    };
  }
  if (selection.status === "selected") {
    if (!params.machineTokenFacade) {
      return {
        headers,
        authProfileOnly: false,
        error: {
          ok: false,
          retryable: true,
          terminal: false,
          errorCode: "machine_token_error",
          safeMessage: "linkskills machine-token facade is not configured",
        },
      };
    }
    const bearer = await resolveMachineTokenBearer({
      bindingId: selection.machineToken.bindingId,
      signal: params.signal,
      forceRefresh: params.forceRefresh,
      machineTokenFacade: params.machineTokenFacade,
    });
    if (bearer.error) {
      return { headers, authProfileOnly: false, error: bearer.error };
    }
    if (bearer.value) {
      headers.Authorization = `Bearer ${bearer.value}`;
    }
    return {
      headers,
      authProfileOnly: false,
      ...(bearer.bindingId ? { bindingId: bearer.bindingId } : {}),
    };
  }

  const authProfileId =
    typeof params.server.oauth?.authProfileId === "string"
      ? params.server.oauth.authProfileId
      : undefined;
  const hasAuthorization = Object.keys(headers).some((key) => {
    const value = headers[key];
    return (
      key.toLowerCase() === "authorization" && typeof value === "string" && value.trim().length > 0
    );
  });
  // Interactive oauth-only without a resolved Authorization header needs Gateway auth-profile injection.
  // machine_token mode must never surface auth_profile_required when resolution succeeds.
  const wantsInteractiveOauth =
    params.server.auth === "oauth" ||
    (Boolean(authProfileId) && params.server.auth !== "machine_token");
  const authProfileOnly = wantsInteractiveOauth && !hasAuthorization;
  return { headers, authProfileOnly };
}

function readManagedServer(
  apiConfig: OpenClawPluginApi["config"],
  serverName: string,
): ManagedMcpServerEntry | undefined {
  const servers = apiConfig.mcp?.servers;
  if (!servers || typeof servers !== "object") {
    return undefined;
  }
  const entry = (servers as Record<string, unknown>)[serverName];
  if (!isRecord(entry)) {
    return undefined;
  }
  return entry as ManagedMcpServerEntry;
}

async function openDefaultMcpSession(
  server: ManagedMcpServerEntry,
  headers: Record<string, string>,
): Promise<McpToolSession> {
  const client = new Client({ name: "openclaw-linkskills", version: "1.0.0" });
  const cwd = server.cwd ?? server.workingDirectory;
  let transport;

  if (server.command) {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(server.env ?? {})) {
      env[key] = String(value);
    }
    transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: Object.keys(env).length > 0 ? env : undefined,
      cwd,
      stderr: "pipe",
    });
  } else if (typeof server.url === "string" && server.url.length > 0) {
    const url = new URL(server.url);
    const transportKind = server.transport ?? "streamable-http";
    const managedMachineToken = server.auth === "machine_token";
    // Managed machine_token must never place Authorization in requestInit
    // (SDK redirect / EventSource replay). Inject per-request via guarded fetch.
    const requestHeaders = managedMachineToken
      ? (withoutMcpAuthorizationHeader(headers) ?? {})
      : headers;
    const bearerFromHeaders = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === "authorization",
    )?.[1];
    const accessToken =
      managedMachineToken && bearerFromHeaders
        ? bearerFromHeaders.replace(/^Bearer\s+/iu, "").trim()
        : undefined;
    const baseFetch = buildPluginMcpHttpFetch({ resourceUrl: server.url });
    const resourceFetch = withSameOriginMcpHttpHeaders({
      fetchFn: baseFetch,
      headers: requestHeaders,
      resourceUrl: server.url,
    });
    let httpFetch = resourceFetch;
    if (managedMachineToken && accessToken) {
      const resourceOrigin = url.origin;
      const currentToken = accessToken;
      httpFetch = async (requestUrl, init) => {
        const target =
          typeof requestUrl === "string"
            ? requestUrl
            : requestUrl instanceof URL
              ? requestUrl.toString()
              : String(requestUrl);
        const sameOrigin = new URL(target).origin === resourceOrigin;
        if (!sameOrigin) {
          return resourceFetch(requestUrl, init);
        }
        const merged = new Headers(init?.headers);
        // Drop any smuggled Authorization; only the live token is sent.
        merged.delete("authorization");
        merged.set("authorization", `Bearer ${currentToken}`);
        return resourceFetch(requestUrl, { ...(init as RequestInit), headers: merged });
      };
    }
    const hasRequestHeaders = Object.keys(requestHeaders).length > 0;
    const sseEventSourceFetch = (requestUrl: string | URL, init?: RequestInit) => {
      const mergedHeaders: Record<string, string> = {};
      for (const [key, value] of new Headers(init?.headers)) {
        mergedHeaders[key.toLowerCase()] = value;
      }
      if (!managedMachineToken) {
        for (const [key, value] of Object.entries(requestHeaders)) {
          mergedHeaders[key.toLowerCase()] = value;
        }
      }
      return httpFetch(requestUrl, {
        ...(init as RequestInit),
        headers: mergedHeaders,
      });
    };
    if (transportKind === "sse") {
      transport = new SSEClientTransport(url, {
        requestInit: hasRequestHeaders ? { headers: requestHeaders } : undefined,
        fetch: httpFetch,
        eventSourceInit: {
          fetch: sseEventSourceFetch,
        },
      });
    } else {
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: hasRequestHeaders ? { headers: requestHeaders } : undefined,
        fetch: httpFetch,
      });
    }
  } else {
    throw new Error("linkskills mcp server entry requires command or url");
  }

  await client.connect(transport);
  return {
    async callTool(name, args) {
      return (await client.callTool({ name, arguments: args })) as {
        isError?: boolean;
        structuredContent?: unknown;
        content?: unknown;
      };
    },
    async close() {
      await client.close();
    },
  };
}

/**
 * Build the frozen LiNKskills Gateway operation URL: POST /v1/{operation}.
 *
 * `skillsEndpoint` is the Gateway HTTPS base (origin, optional safe mount
 * prefix, or an accidental `/v1/...` paste). The allowlisted `operation` is
 * the only path segment appended under `/v1/`. Rejects userinfo, raw
 * traversal probes, unsafe prefix segments, and any origin/host change.
 */
export function buildLinkskillsHttpOperationUrl(skillsEndpoint: string, operation: string): URL {
  if (!isAllowedLinkskillsMcpTool(operation)) {
    throw new Error(`linkskills: tool "${operation}" is not allowlisted`);
  }
  // Belt-and-suspenders: allowlist members are single path segments; never join raw input.
  if (!/^skills_[a-z0-9_]+$/u.test(operation)) {
    throw new Error("linkskills: invalid Skills operation name");
  }
  // Reject traversal probes in the raw config string before URL normalization hides them.
  if (/(?:^|[\\/]|%2f)(?:\.\.|%2e%2e)(?:[\\/]|%2f|$)/iu.test(skillsEndpoint)) {
    throw new Error("linkskills: skillsEndpoint path traversal rejected");
  }

  let base: URL;
  try {
    base = new URL(skillsEndpoint);
  } catch (cause) {
    throw new Error("linkskills: skillsEndpoint must be a valid absolute URL", { cause });
  }
  if (base.username || base.password) {
    throw new Error("linkskills: skillsEndpoint must not include userinfo");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("linkskills: skillsEndpoint must use http or https");
  }

  // Supported forms: origin base; optional safe mount prefix; `/v1` or `/v1/{op}` paste.
  let pathname = base.pathname || "/";
  if (/^\/v1(?:\/|$)/iu.test(pathname)) {
    pathname = "/";
  } else if (pathname !== "/" && pathname !== "") {
    const segments = pathname.replace(/\/+$/u, "").split("/").filter(Boolean);
    if (
      segments.length === 0 ||
      segments.some(
        (segment) => segment === "." || segment === ".." || !/^[a-zA-Z0-9_-]+$/u.test(segment),
      )
    ) {
      throw new Error("linkskills: skillsEndpoint path prefix rejected");
    }
  }

  const prefix = pathname === "/" || pathname === "" ? "" : pathname.replace(/\/+$/u, "");
  const target = new URL(base.origin);
  target.pathname = `${prefix}/v1/${operation}`;
  // Keep configured port/host identity; never inherit query/hash from a pasted URL.
  if (target.origin !== base.origin) {
    throw new Error("linkskills: operation URL origin mismatch");
  }
  if (target.pathname !== `${prefix}/v1/${operation}`) {
    throw new Error("linkskills: operation URL path mismatch");
  }
  return target;
}

function buildLinkskillsHttpPolicy(endpoint: string, config: LinkskillsConfig) {
  const endpointUrl = new URL(endpoint);
  const explicitlyAllowedLoopback =
    isLinkskillsLocalTestLoopbackHost(endpointUrl.hostname) &&
    (config.environment === "test" || config.allowProductionLoopbackHttp === true);
  return explicitlyAllowedLoopback
    ? mergeSsrFPolicies(ssrfPolicyFromHttpBaseUrlAllowedHostname(endpoint), {
        allowPrivateNetwork: true,
      })
    : ssrfPolicyFromHttpBaseUrlAllowedHostname(endpoint);
}

async function postLinkskillsHttpOperation(params: {
  endpoint: string;
  operation: string;
  arguments: Record<string, unknown>;
  bearer: string;
  idempotencyKey: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  config: LinkskillsConfig;
}) {
  const operationUrl = buildLinkskillsHttpOperationUrl(params.endpoint, params.operation);
  const headers = new Headers({
    "content-type": "application/json",
    "idempotency-key": params.idempotencyKey,
    "x-request-id": params.idempotencyKey,
  });
  headers.set("authorization", `Bearer ${params.bearer}`);
  return await fetchWithSsrFGuard({
    url: operationUrl.href,
    ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        params: params.arguments,
        idempotency_key: params.idempotencyKey,
        request_id: params.idempotencyKey,
      }),
    },
    signal: params.signal,
    policy: buildLinkskillsHttpPolicy(params.endpoint, params.config),
    auditContext: "linkskills.http-transport",
  });
}

function createHttpTransport(params: {
  endpoint: string;
  config: LinkskillsConfig;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  /** When set (tests), forwarded to the SSRF guard so mocks stay hermetic. */
  fetchImpl?: typeof fetch;
  machineTokenFacade?: MachineTokenPluginFacade;
}): LinkskillsTransport {
  return {
    async write(writeParams) {
      if (writeParams.signal?.aborted) {
        return {
          ok: false,
          retryable: true,
          errorCode: "aborted",
          safeMessage: "aborted",
        };
      }
      if (!isSkillsDrainTool(writeParams.toolName)) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${writeParams.toolName}" is not a Skills drain op`,
        };
      }
      try {
        buildLinkskillsHttpOperationUrl(params.endpoint, writeParams.toolName);
      } catch (error) {
        return {
          ok: false,
          retryable: false,
          terminal: true,
          errorCode: "endpoint_insecure",
          safeMessage: error instanceof Error ? error.message : "skillsEndpoint rejected",
        };
      }
      const bearer = await resolveBearerToken({
        config: params.config,
        apiConfig: params.apiConfig,
        env: params.env,
        signal: writeParams.signal,
        machineTokenFacade: params.machineTokenFacade,
      });
      if (bearer.error) {
        return bearer.error;
      }
      const postOnce = async (accessToken: string) => {
        // Frozen Gateway contract (LiNKskills server/client): POST /v1/{operation}
        // with envelope { params, request_id?, idempotency_key? }. Operation is path-only.
        return await postLinkskillsHttpOperation({
          endpoint: params.endpoint,
          operation: writeParams.toolName,
          arguments: writeParams.arguments,
          bearer: accessToken,
          idempotencyKey: writeParams.idempotencyKey,
          config: params.config,
          ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
          ...(writeParams.signal ? { signal: writeParams.signal } : {}),
        });
      };

      let release: (() => Promise<void>) | undefined;
      try {
        let guarded = await postOnce(bearer.value!);
        release = guarded.release;
        // Exactly one bounded machine-token reissue on remote 401/403 — no static bearer persistence.
        if (
          isBoundedAuthReissueStatus(guarded.response.status) &&
          bearer.bindingId &&
          params.machineTokenFacade
        ) {
          params.machineTokenFacade.invalidate(bearer.bindingId);
          await release();
          release = undefined;
          const refreshed = await resolveBearerToken({
            config: params.config,
            apiConfig: params.apiConfig,
            env: params.env,
            signal: writeParams.signal,
            forceRefresh: true,
            machineTokenFacade: params.machineTokenFacade,
          });
          if (refreshed.error) {
            return refreshed.error;
          }
          guarded = await postOnce(refreshed.value!);
          release = guarded.release;
        }
        const response = guarded.response;
        if (response.ok) {
          let result: Record<string, unknown> | undefined;
          try {
            const json = (await response.json()) as unknown;
            if (isRecord(json)) {
              result = json;
            }
          } catch {
            result = undefined;
          }
          return { ok: true, result };
        }
        return {
          ok: false,
          ...mapHttpStatus(response.status),
        };
      } catch (error) {
        if (writeParams.signal?.aborted) {
          return {
            ok: false,
            retryable: true,
            errorCode: "aborted",
            safeMessage: "aborted",
          };
        }
        return {
          ok: false,
          retryable: true,
          errorCode: "network_error",
          safeMessage: error instanceof Error ? error.message : "network error",
        };
      } finally {
        if (release) {
          await release();
        }
      }
    },
  };
}

function createMcpTransport(params: {
  server: ManagedMcpServerEntry;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  createMcpSession: (server: ManagedMcpServerEntry) => Promise<McpToolSession>;
  pluginMachineToken?: LinkskillsMachineTokenConfig;
  machineTokenFacade?: MachineTokenPluginFacade;
  localTest?: boolean;
}): LinkskillsTransport {
  return {
    async write(writeParams) {
      if (writeParams.signal?.aborted) {
        return {
          ok: false,
          retryable: true,
          errorCode: "aborted",
          safeMessage: "aborted",
        };
      }
      if (!isSkillsDrainTool(writeParams.toolName)) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${writeParams.toolName}" is not a Skills drain op`,
        };
      }

      if (typeof params.server.url === "string" && params.server.url.length > 0) {
        try {
          assertLinkskillsRemoteHttpsUrl(params.server.url, "mcp.servers.url", params.localTest);
        } catch (error) {
          return {
            ok: false,
            retryable: false,
            terminal: true,
            errorCode: "endpoint_insecure",
            safeMessage: error instanceof Error ? error.message : "mcp server URL rejected",
          };
        }
      }

      const runOnce = async (forceRefresh: boolean) => {
        const { headers, authProfileOnly, bindingId, error } = await resolveMcpHeaders({
          server: params.server,
          apiConfig: params.apiConfig,
          env: params.env,
          pluginMachineToken: params.pluginMachineToken,
          signal: writeParams.signal,
          forceRefresh,
          localTest: params.localTest,
          machineTokenFacade: params.machineTokenFacade,
        });
        if (error) {
          return { kind: "result" as const, result: error };
        }
        if (authProfileOnly) {
          return {
            kind: "result" as const,
            result: {
              ok: false,
              retryable: true,
              terminal: false,
              errorCode: "auth_profile_required",
              safeMessage:
                "linkskills MCP server uses oauth.authProfileId; Gateway must inject bearer auth before plugin-owned drain (prefer SecretRef Authorization header)",
            } satisfies LinkskillsTransportResult,
          };
        }

        let session: McpToolSession | undefined;
        try {
          const serverWithHeaders: ManagedMcpServerEntry = {
            ...params.server,
            headers,
          };
          session = await params.createMcpSession(serverWithHeaders);
          const outcome = await session.callTool(writeParams.toolName, {
            ...writeParams.arguments,
            idempotencyKey: writeParams.idempotencyKey,
          });
          if (outcome.isError) {
            return {
              kind: "result" as const,
              result: {
                ok: false,
                terminal: true,
                errorCode: "mcp_tool_error",
                safeMessage: "MCP tool returned isError",
              } satisfies LinkskillsTransportResult,
            };
          }
          const result = isRecord(outcome.structuredContent)
            ? outcome.structuredContent
            : isRecord(outcome.content)
              ? outcome.content
              : undefined;
          return {
            kind: "result" as const,
            result: { ok: true, result } satisfies LinkskillsTransportResult,
          };
        } catch (error) {
          return {
            kind: "throw" as const,
            error,
            bindingId,
          };
        } finally {
          if (session) {
            try {
              await session.close();
            } catch {
              // ignore close errors
            }
          }
        }
      };

      const first = await runOnce(false);
      if (first.kind === "result") {
        return first.result;
      }
      if (
        first.bindingId &&
        params.machineTokenFacade &&
        isAuthReissueCandidateError(first.error)
      ) {
        params.machineTokenFacade.invalidate(first.bindingId);
        const second = await runOnce(true);
        if (second.kind === "result") {
          return second.result;
        }
        return {
          ok: false,
          retryable: true,
          errorCode: "mcp_connect_error",
          safeMessage:
            second.error instanceof Error ? second.error.message : "MCP connect/call failed",
        };
      }
      return {
        ok: false,
        retryable: true,
        errorCode: "mcp_connect_error",
        safeMessage: first.error instanceof Error ? first.error.message : "MCP connect/call failed",
      };
    },
  };
}

/**
 * Calls the LiNKskills HTTP Gateway from inside the plugin process. Native
 * model runtimes receive only the response; PACI acquisition stays host-owned.
 */
export async function callLinkskillsHttpTool(params: {
  api: Pick<OpenClawPluginApi, "config" | "logger"> &
    Partial<Pick<OpenClawPluginApi, "machineTokenFacade">>;
  config: LinkskillsConfig;
  toolName: string;
  arguments: Record<string, unknown>;
  idempotencyKey: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<LinkskillsMcpCallResult> {
  if (params.config.transportMode !== "http") {
    return { ok: false, safeMessage: "linkskills HTTP transport is not enabled" };
  }
  if (!isAllowedLinkskillsMcpTool(params.toolName)) {
    return { ok: false, safeMessage: "linkskills operation is not allowlisted" };
  }
  if (!HTTP_IDEMPOTENCY_KEY_RE.test(params.idempotencyKey)) {
    return { ok: false, safeMessage: "linkskills request identity is invalid" };
  }
  const endpoint = params.config.skillsEndpoint;
  if (!endpoint) {
    return { ok: false, safeMessage: "linkskills HTTP endpoint is unavailable" };
  }
  try {
    assertLinkskillsRemoteHttpsUrl(
      endpoint,
      "skillsEndpoint",
      params.config.environment === "test",
      params.config.allowProductionLoopbackHttp,
    );
    buildLinkskillsHttpOperationUrl(endpoint, params.toolName);
  } catch {
    return { ok: false, safeMessage: "linkskills HTTP endpoint is rejected" };
  }
  const binding = params.config.machineToken;
  const facade = params.api.machineTokenFacade;
  // Native OAuth bridging is machine-token only. Never fall through to the
  // legacy skillsCredential path or project a credential into the model.
  if (!binding || !facade) {
    return { ok: false, safeMessage: "linkskills authentication is unavailable" };
  }

  const runOnce = async (
    forceRefresh: boolean,
  ): Promise<
    | { kind: "result"; result: LinkskillsMcpCallResult }
    | { kind: "http_error"; status: number; bindingId: string }
  > => {
    const bearer = await resolveMachineTokenBearer({
      bindingId: binding.bindingId,
      ...(params.signal ? { signal: params.signal } : {}),
      ...(forceRefresh ? { forceRefresh: true } : {}),
      machineTokenFacade: facade,
    });
    if (bearer.error || !bearer.value || !bearer.bindingId) {
      return {
        kind: "result",
        result: { ok: false, safeMessage: "linkskills authentication is unavailable" },
      };
    }

    let release: (() => Promise<void>) | undefined;
    try {
      const guarded = await postLinkskillsHttpOperation({
        endpoint,
        operation: params.toolName,
        arguments: params.arguments,
        bearer: bearer.value,
        idempotencyKey: params.idempotencyKey,
        config: params.config,
        ...(params.signal ? { signal: params.signal } : {}),
        ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
      });
      release = guarded.release;
      if (guarded.response.ok) {
        let result: Record<string, unknown> | undefined;
        try {
          const json = (await guarded.response.json()) as unknown;
          result = isRecord(json) ? json : undefined;
        } catch {
          result = undefined;
        }
        return { kind: "result", result: { ok: true, result } };
      }
      return {
        kind: "http_error",
        status: guarded.response.status,
        bindingId: bearer.bindingId,
      };
    } catch {
      return {
        kind: "result",
        result: { ok: false, safeMessage: "linkskills HTTP connection failed" },
      };
    } finally {
      await release?.();
    }
  };

  const first = await runOnce(false);
  if (first.kind === "result") {
    return first.result;
  }
  if (isBoundedAuthReissueStatus(first.status)) {
    facade.invalidate(first.bindingId);
    const second = await runOnce(true);
    if (second.kind === "result") {
      return second.result;
    }
    return {
      ok: false,
      safeMessage: `linkskills request failed (HTTP ${second.status})`,
    };
  }
  return {
    ok: false,
    safeMessage: `linkskills request failed (HTTP ${first.status})`,
  };
}

/**
 * Calls a frozen Skills MCP operation from inside the plugin process.
 * OAuth-backed models receive only this tool result, never a PACI credential.
 */
export async function callLinkskillsMcpTool(params: {
  api: Pick<OpenClawPluginApi, "config" | "logger"> &
    Partial<Pick<OpenClawPluginApi, "machineTokenFacade">>;
  config: LinkskillsConfig;
  toolName: string;
  arguments: Record<string, unknown>;
  signal?: AbortSignal;
  createMcpSession?: (server: ManagedMcpServerEntry) => Promise<McpToolSession>;
}): Promise<LinkskillsMcpCallResult> {
  if (params.config.transportMode !== "mcp") {
    return { ok: false, safeMessage: "linkskills MCP transport is not enabled" };
  }
  if (!isAllowedLinkskillsMcpTool(params.toolName)) {
    return { ok: false, safeMessage: "linkskills operation is not allowlisted" };
  }
  const server = readManagedServer(params.api.config, params.config.mcpServerName);
  if (!server || server.enabled === false) {
    return { ok: false, safeMessage: "linkskills managed MCP server is unavailable" };
  }
  if (typeof server.url === "string" && server.url.length > 0) {
    try {
      assertLinkskillsRemoteHttpsUrl(
        server.url,
        "mcp.servers.url",
        params.config.environment === "test",
      );
    } catch {
      return { ok: false, safeMessage: "linkskills MCP endpoint is rejected" };
    }
  }
  const createSession =
    params.createMcpSession ??
    ((entry: ManagedMcpServerEntry) =>
      openDefaultMcpSession(
        entry,
        Object.fromEntries(
          Object.entries(entry.headers ?? {}).flatMap(([key, value]) => {
            const coerced = coerceHeaderValue(value);
            return coerced ? [[key, coerced] as const] : [];
          }),
        ),
      ));
  const runOnce = async (
    forceRefresh: boolean,
  ): Promise<
    | { kind: "result"; result: LinkskillsMcpCallResult }
    | { kind: "throw"; error: unknown; bindingId?: string }
  > => {
    const resolved = await resolveMcpHeaders({
      server,
      apiConfig: params.api.config,
      env: process.env,
      pluginMachineToken: params.config.machineToken,
      signal: params.signal,
      forceRefresh,
      localTest: params.config.environment === "test",
      machineTokenFacade: params.api.machineTokenFacade,
    });
    if (resolved.error || resolved.authProfileOnly) {
      return {
        kind: "result",
        result: { ok: false, safeMessage: "linkskills authentication is unavailable" },
      };
    }
    let session: McpToolSession | undefined;
    try {
      session = await createSession({ ...server, headers: resolved.headers });
      const outcome = await session.callTool(params.toolName, params.arguments);
      if (outcome.isError) {
        return {
          kind: "result",
          result: { ok: false, safeMessage: "linkskills rejected the request" },
        };
      }
      const result = isRecord(outcome.structuredContent)
        ? outcome.structuredContent
        : isRecord(outcome.content)
          ? outcome.content
          : undefined;
      return { kind: "result", result: { ok: true, result } };
    } catch (error) {
      return { kind: "throw", error, bindingId: resolved.bindingId };
    } finally {
      await session?.close().catch(() => undefined);
    }
  };
  const first = await runOnce(false);
  if (first.kind === "result") {
    return first.result;
  }
  if (
    first.bindingId &&
    params.api.machineTokenFacade &&
    isAuthReissueCandidateError(first.error)
  ) {
    params.api.machineTokenFacade.invalidate(first.bindingId);
    const second = await runOnce(true);
    if (second.kind === "result") {
      return second.result;
    }
  }
  return { ok: false, safeMessage: "linkskills MCP connection failed" };
}

/**
 * Thin local adapter for test injection only.
 *
 * Residual: production must receive a host-injected `MachineTokenPluginFacade`
 * via plugin runtime API. `createMachineTokenPluginFacade` stays host-internal;
 * plugins must not import src/agents/machine-token-host.
 *
 * Acquire shape matches the public facade: `{ bindingId, signal?, forceRefresh? }`.
 */
function createLocalMachineTokenFacadeAdapter(params: {
  pluginId: string;
  grantedBindingIds: readonly string[];
  resolveAccess: ResolveMachineTokenAccessFn;
  invalidateCache?: InvalidateMachineTokenCacheFn;
}): MachineTokenPluginFacade {
  const grantedBindingIds = new Set(params.grantedBindingIds);
  const fingerprintsByBindingId = new Map<string, string>();
  let active = true;
  return {
    pluginId: params.pluginId,
    grantedBindingIds,
    async acquire(acquireParams) {
      if (!active) {
        throw new Error(`Machine-token facade for plugin "${params.pluginId}" is unregistered`);
      }
      const bindingId =
        typeof acquireParams.bindingId === "string" ? acquireParams.bindingId.trim() : "";
      if (!bindingId || !grantedBindingIds.has(bindingId)) {
        throw new Error(
          `Plugin "${params.pluginId}" is not granted machine-token binding "${bindingId || "(empty)"}"`,
        );
      }
      const resolved = await params.resolveAccess({
        bindingId,
        ...(acquireParams.signal ? { signal: acquireParams.signal } : {}),
        ...(acquireParams.forceRefresh !== undefined
          ? { forceRefresh: acquireParams.forceRefresh }
          : {}),
      });
      fingerprintsByBindingId.set(bindingId, resolved.bindingFingerprint ?? `fp-${bindingId}`);
      return resolved;
    },
    invalidate(bindingId) {
      if (!active) {
        throw new Error(`Machine-token facade for plugin "${params.pluginId}" is unregistered`);
      }
      if (!grantedBindingIds.has(bindingId)) {
        throw new Error(
          `Plugin "${params.pluginId}" is not granted machine-token binding "${bindingId}"`,
        );
      }
      const fingerprint = fingerprintsByBindingId.get(bindingId);
      if (fingerprint && params.invalidateCache) {
        params.invalidateCache(fingerprint);
        fingerprintsByBindingId.delete(bindingId);
      }
    },
    health(bindingId) {
      return {
        pluginId: params.pluginId,
        bindingId,
        granted: grantedBindingIds.has(bindingId),
        registered: active,
        cached: fingerprintsByBindingId.has(bindingId),
      };
    },
    unregister() {
      active = false;
      fingerprintsByBindingId.clear();
    },
  };
}

/**
 * Resolves the Skills drain transport from plugin config.
 * Defaults to disabled. Fake is test-only. Does not require live MCP/HTTP servers at resolve time.
 */
export function resolveLinkskillsTransport(
  params: ResolveLinkskillsTransportParams,
): LinkskillsTransport {
  const mode: LinkskillsTransportMode = params.config.transportMode;
  const env = params.env ?? process.env;
  const grantedBindingIds = new Set<string>();
  if (params.config.machineToken) {
    grantedBindingIds.add(params.config.machineToken.bindingId);
  }
  if (mode === "mcp") {
    const peekServer = readManagedServer(params.api.config, params.config.mcpServerName);
    if (peekServer) {
      // Lane D: only grant when selection is valid; invalid/conflict fail on write.
      const peekSelection = selectMcpMachineToken(
        peekServer,
        params.config.machineToken,
        params.config.environment === "test",
      );
      if (peekSelection.status === "selected") {
        grantedBindingIds.add(peekSelection.machineToken.bindingId);
      }
    }
  }
  // Prefer host-injected facade (api.machineTokenFacade or explicit param).
  // Local adapter is test-only when resolveMachineTokenAccess is injected.
  // Production without an injected facade fail-closes when machineToken is configured.
  const machineTokenFacade =
    params.machineTokenFacade ??
    params.api.machineTokenFacade ??
    (grantedBindingIds.size > 0 && params.resolveMachineTokenAccess
      ? createLocalMachineTokenFacadeAdapter({
          pluginId: "linkskills",
          grantedBindingIds: [...grantedBindingIds],
          resolveAccess: params.resolveMachineTokenAccess,
          ...(params.invalidateMachineTokenCache
            ? { invalidateCache: params.invalidateMachineTokenCache }
            : {}),
        })
      : undefined);

  if (mode === "disabled") {
    return createDisabledTransport();
  }

  if (mode === "fake") {
    if (params.fakeForTests) {
      return createSkillsFakeTransport(params.fakeForTests);
    }
    if (params.config.environment !== "test") {
      return createRejectedFakeTransport(
        "linkskills fake transport is not allowed outside test environment",
      );
    }
    return createRejectedFakeTransport(
      "linkskills fake transport requires explicit test injection (fakeForTests)",
    );
  }

  if (mode === "http") {
    const endpoint = params.config.skillsEndpoint;
    if (!endpoint) {
      return createStaticResultTransport({
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "endpoint_missing",
        safeMessage: "linkskills skillsEndpoint is required for http transportMode",
      });
    }
    return createHttpTransport({
      endpoint,
      config: params.config,
      apiConfig: params.api.config,
      env,
      ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
      machineTokenFacade,
    });
  }

  if (mode === "mcp") {
    const serverName = params.config.mcpServerName;
    const server = readManagedServer(params.api.config, serverName);
    if (!server) {
      return createStaticResultTransport({
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "mcp_server_missing",
        safeMessage: `mcp.servers.${serverName} is not configured`,
      });
    }
    if (server.enabled === false) {
      return createStaticResultTransport({
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "mcp_server_disabled",
        safeMessage: `mcp.servers.${serverName} is disabled`,
      });
    }
    const createMcpSession =
      params.createMcpSession ??
      ((entry: ManagedMcpServerEntry) =>
        openDefaultMcpSession(
          entry,
          Object.fromEntries(
            Object.entries(entry.headers ?? {}).flatMap(([key, value]) => {
              const coerced = coerceHeaderValue(value);
              return coerced ? [[key, coerced] as const] : [];
            }),
          ),
        ));
    return createMcpTransport({
      server,
      apiConfig: params.api.config,
      env,
      createMcpSession,
      pluginMachineToken: params.config.machineToken,
      machineTokenFacade,
      localTest: params.config.environment === "test",
    });
  }

  const exhaustive: never = mode;
  void exhaustive;
  return createDisabledTransport();
}
