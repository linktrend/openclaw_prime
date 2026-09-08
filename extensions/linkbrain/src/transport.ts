/**
 * Configurable Brain transport adapters.
 *
 * Modes: disabled (default) | fake (test-only) | http | mcp.
 * Frozen write tool names only — no Brain Gateway alias mapping.
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
import { isAllowedLinkbrainMcpTool } from "../mcp-tool-filter.js";
import type { OpenClawPluginApi } from "../runtime-api.js";
import {
  assertLinkbrainRemoteHttpsUrl,
  isLinkbrainLocalTestLoopbackHost,
  parseLinkbrainMachineToken,
  type LinkbrainConfig,
  type LinkbrainMachineTokenConfig,
  type LinkbrainTransportMode,
} from "./config.js";
import {
  createBrainFakeTransport,
  type LinkbrainTransport,
  type LinkbrainTransportResult,
} from "./runtime.js";
import { isAllowedBrainWriteTool, LINKBRAIN_CAPTURE_TOOL } from "./tools.js";

/**
 * Map write params to MCP tool arguments.
 * brain_capture_batch: live schema is additionalProperties:false with batch
 * (+ optional actor overrides) only — idempotency is batch.idempotencyKey.
 * Other write tools still require a top-level idempotencyKey.
 */
function mcpCallToolArguments(writeParams: {
  toolName: string;
  idempotencyKey: string;
  arguments: Record<string, unknown>;
}): Record<string, unknown> {
  if (writeParams.toolName === LINKBRAIN_CAPTURE_TOOL) {
    return writeParams.arguments;
  }
  return {
    ...writeParams.arguments,
    idempotencyKey: writeParams.idempotencyKey,
  };
}

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
export type LinkbrainMcpCallResult =
  | { ok: true; result?: Record<string, unknown> }
  | { ok: false; safeMessage: string };

type ResolveMachineTokenAccessFn = (params: {
  bindingId: string;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}) => Promise<ResolvedMachineToken>;

type InvalidateMachineTokenCacheFn = (bindingId: string) => void;

export type ResolveLinkbrainTransportParams = {
  api: Pick<OpenClawPluginApi, "config" | "logger"> &
    Partial<Pick<OpenClawPluginApi, "machineTokenFacade">>;
  config: LinkbrainConfig;
  /** Explicit test injection — required for fake mode outside createBrainFakeTransport wiring. */
  fakeForTests?: Parameters<typeof createBrainFakeTransport>[0];
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
): Pick<LinkbrainTransportResult, "retryable" | "terminal" | "errorCode" | "safeMessage"> {
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

function createStaticResultTransport(result: LinkbrainTransportResult): LinkbrainTransport {
  return {
    async write() {
      return result;
    },
  };
}

function createDisabledTransport(): LinkbrainTransport {
  return createStaticResultTransport({
    ok: false,
    retryable: true,
    terminal: false,
    errorCode: "transport_disabled",
    safeMessage: "linkbrain transportMode is disabled",
  });
}

function createRejectedFakeTransport(safeMessage: string): LinkbrainTransport {
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
}): Promise<{ value?: string; bindingId?: string; error?: LinkbrainTransportResult }> {
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
  config: LinkbrainConfig;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  machineTokenFacade?: MachineTokenPluginFacade;
}): Promise<{ value?: string; bindingId?: string; error?: LinkbrainTransportResult }> {
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
          safeMessage: "linkbrain machine-token facade is not configured",
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
  if (params.config.ingestionCredential === undefined) {
    return {
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "credential_missing",
        safeMessage: "linkbrain ingestionCredential is not configured",
      },
    };
  }
  const resolved = await resolveConfiguredSecretInputString({
    config: params.apiConfig,
    env: params.env,
    value: params.config.ingestionCredential,
    path: "plugins.entries.linkbrain.config.ingestionCredential",
  });
  if (resolved.unresolvedRefReason || !resolved.value) {
    return {
      error: {
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "credential_unresolved",
        safeMessage: resolved.unresolvedRefReason ?? "linkbrain ingestionCredential unresolved",
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
  serverToken: LinkbrainMachineTokenConfig,
  pluginToken: LinkbrainMachineTokenConfig,
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
  pluginMachineToken: LinkbrainMachineTokenConfig | undefined,
  localTest?: boolean,
):
  | { status: "selected"; machineToken: LinkbrainMachineTokenConfig }
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
      let serverToken: LinkbrainMachineTokenConfig;
      try {
        const parsed = parseLinkbrainMachineToken(rawServerToken, { localTest });
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
  pluginMachineToken?: LinkbrainMachineTokenConfig;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  localTest?: boolean;
  machineTokenFacade?: MachineTokenPluginFacade;
}): Promise<{
  headers: Record<string, string>;
  authProfileOnly: boolean;
  bindingId?: string;
  error?: LinkbrainTransportResult;
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
          safeMessage: "linkbrain machine-token facade is not configured",
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
  const client = new Client({ name: "openclaw-linkbrain", version: "1.0.0" });
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
    throw new Error("linkbrain mcp server entry requires command or url");
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

function createHttpTransport(params: {
  endpoint: string;
  config: LinkbrainConfig;
  apiConfig: OpenClawPluginApi["config"];
  env: NodeJS.ProcessEnv;
  /** When set (tests), forwarded to the SSRF guard so mocks stay hermetic. */
  fetchImpl?: typeof fetch;
  machineTokenFacade?: MachineTokenPluginFacade;
}): LinkbrainTransport {
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
      if (!isAllowedBrainWriteTool(writeParams.toolName)) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${writeParams.toolName}" is not on the Brain write allowlist`,
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
      // Hostname pinned to configured endpoint. Private networks are not broadly
      // allowed — only explicit local-test loopback may opt into private allowance.
      const endpointUrl = new URL(params.endpoint);
      const localTestLoopback =
        params.config.environment === "test" &&
        isLinkbrainLocalTestLoopbackHost(endpointUrl.hostname);
      const policy = localTestLoopback
        ? mergeSsrFPolicies(ssrfPolicyFromHttpBaseUrlAllowedHostname(params.endpoint), {
            allowPrivateNetwork: true,
          })
        : ssrfPolicyFromHttpBaseUrlAllowedHostname(params.endpoint);

      const postOnce = async (accessToken: string) => {
        const guarded = await fetchWithSsrFGuard({
          url: params.endpoint,
          ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
          init: {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              toolName: writeParams.toolName,
              idempotencyKey: writeParams.idempotencyKey,
              arguments: writeParams.arguments,
            }),
          },
          signal: writeParams.signal,
          policy,
          auditContext: "linkbrain.http-transport",
        });
        return guarded;
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
  pluginMachineToken?: LinkbrainMachineTokenConfig;
  machineTokenFacade?: MachineTokenPluginFacade;
  localTest?: boolean;
  allowProductionLoopbackHttp?: boolean;
}): LinkbrainTransport {
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
      if (!isAllowedBrainWriteTool(writeParams.toolName)) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${writeParams.toolName}" is not on the Brain write allowlist`,
        };
      }

      if (typeof params.server.url === "string" && params.server.url.length > 0) {
        try {
          assertLinkbrainRemoteHttpsUrl(
            params.server.url,
            "mcp.servers.url",
            params.localTest,
            params.allowProductionLoopbackHttp,
          );
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
                "linkbrain MCP server uses oauth.authProfileId; Gateway must inject bearer auth before plugin-owned drain (prefer SecretRef Authorization header)",
            } satisfies LinkbrainTransportResult,
          };
        }

        let session: McpToolSession | undefined;
        try {
          const serverWithHeaders: ManagedMcpServerEntry = {
            ...params.server,
            headers,
          };
          session = await params.createMcpSession(serverWithHeaders);
          const outcome = await session.callTool(
            writeParams.toolName,
            mcpCallToolArguments(writeParams),
          );
          if (outcome.isError) {
            return {
              kind: "result" as const,
              result: {
                ok: false,
                terminal: true,
                errorCode: "mcp_tool_error",
                safeMessage: "MCP tool returned isError",
              } satisfies LinkbrainTransportResult,
            };
          }
          const result = isRecord(outcome.structuredContent)
            ? outcome.structuredContent
            : isRecord(outcome.content)
              ? outcome.content
              : undefined;
          return {
            kind: "result" as const,
            result: { ok: true, result } satisfies LinkbrainTransportResult,
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
 * Calls a frozen Brain MCP read tool from inside the plugin process.
 * This is intentionally separate from OpenClaw's model-side MCP projection:
 * native OAuth models must never receive a PACI bearer or client assertion.
 */
export async function callLinkbrainMcpTool(params: {
  api: Pick<OpenClawPluginApi, "config" | "logger"> &
    Partial<Pick<OpenClawPluginApi, "machineTokenFacade">>;
  config: LinkbrainConfig;
  toolName: string;
  arguments: Record<string, unknown>;
  signal?: AbortSignal;
  createMcpSession?: (server: ManagedMcpServerEntry) => Promise<McpToolSession>;
}): Promise<LinkbrainMcpCallResult> {
  if (params.config.transportMode !== "mcp") {
    return { ok: false, safeMessage: "linkbrain MCP transport is not enabled" };
  }
  if (!isAllowedLinkbrainMcpTool(params.toolName)) {
    return { ok: false, safeMessage: "linkbrain operation is not allowlisted" };
  }
  const server = readManagedServer(params.api.config, params.config.mcpServerName);
  if (!server || server.enabled === false) {
    return { ok: false, safeMessage: "linkbrain managed MCP server is unavailable" };
  }
  if (typeof server.url === "string" && server.url.length > 0) {
    try {
      assertLinkbrainRemoteHttpsUrl(
        server.url,
        "mcp.servers.url",
        params.config.environment === "test",
        params.config.environment === "production" &&
          params.config.allowProductionLoopbackHttp === true,
      );
    } catch {
      return { ok: false, safeMessage: "linkbrain MCP endpoint is rejected" };
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
    | { kind: "result"; result: LinkbrainMcpCallResult }
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
        result: { ok: false, safeMessage: "linkbrain authentication is unavailable" },
      };
    }
    let session: McpToolSession | undefined;
    try {
      session = await createSession({ ...server, headers: resolved.headers });
      const outcome = await session.callTool(params.toolName, params.arguments);
      if (outcome.isError) {
        return {
          kind: "result",
          result: { ok: false, safeMessage: "linkbrain rejected the request" },
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
  return { ok: false, safeMessage: "linkbrain MCP connection failed" };
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
 * Resolves the Brain write transport from plugin config.
 * Defaults to disabled. Fake is test-only. Does not require live MCP/HTTP servers at resolve time.
 */
export function resolveLinkbrainTransport(
  params: ResolveLinkbrainTransportParams,
): LinkbrainTransport {
  const mode: LinkbrainTransportMode = params.config.transportMode;
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
          pluginId: "linkbrain",
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
      return createBrainFakeTransport(params.fakeForTests);
    }
    if (params.config.environment !== "test") {
      return createRejectedFakeTransport(
        "linkbrain fake transport is not allowed outside test environment",
      );
    }
    return createRejectedFakeTransport(
      "linkbrain fake transport requires explicit test injection (fakeForTests)",
    );
  }

  if (mode === "http") {
    const endpoint = params.config.ingestionEndpoint;
    if (!endpoint) {
      return createStaticResultTransport({
        ok: false,
        retryable: true,
        terminal: false,
        errorCode: "endpoint_missing",
        safeMessage: "linkbrain ingestionEndpoint is required for http transportMode",
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
      allowProductionLoopbackHttp:
        params.config.environment === "production" &&
        params.config.allowProductionLoopbackHttp === true,
    });
  }

  const exhaustive: never = mode;
  void exhaustive;
  return createDisabledTransport();
}
