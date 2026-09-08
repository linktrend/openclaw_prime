// Defines MCP server and tool approval configuration types.
import type { SecretRef } from "./types.secrets.js";

export type McpCodexToolApprovalMode = "auto" | "prompt" | "approve";

/** Machine-token (client_credentials / private_key_jwt) binding for remote MCP HTTP. */
export type McpServerMachineTokenConfig = {
  bindingId: string;
  issuerUrl: string;
  clientId: string;
  audience?: string;
  scope?: string;
  /**
   * Explicit HTTPS trusted-private issuer opt-in (Tailscale/CGNAT/private overlay).
   * Default unset/false. Does not broadly disable SSRF; pins the configured issuer.
   */
  allowPrivateNetwork?: boolean;
  /**
   * SecretRef for private_key_jwt signing key custody.
   * Literal PEM/string secrets are rejected by config schema.
   */
  clientAssertionKeyRef: SecretRef;
};

export type McpServerCodexConfig = {
  /** OpenClaw agent ids that should receive this server in Codex app-server threads. */
  agents?: string[];
  /** Codex MCP tool approval mode emitted as default_tools_approval_mode. */
  defaultToolsApprovalMode?: McpCodexToolApprovalMode;
};

export type McpServerToolFilterConfig = {
  /**
   * Exact MCP tool names or simple "*" globs to expose from this server.
   *
   * When omitted, all server tools remain eligible unless excluded.
   */
  include?: string[];
  /** Exact MCP tool names or simple "*" globs to hide from this server. */
  exclude?: string[];
};

export type McpServerConfig = {
  /** Set false to keep the saved definition while excluding it from runtime/probe sessions. */
  enabled?: boolean;
  /** Stdio transport: command to spawn. */
  command?: string;
  /** Stdio transport: arguments for the command. */
  args?: string[];
  /** Environment variables passed to the server process (stdio only). */
  env?: Record<string, string | number | boolean>;
  /** Working directory for stdio server. */
  cwd?: string;
  /** HTTP transport: URL of the remote MCP server (http or https). */
  url?: string;
  /** Transport type — "stdio" for command-bearing servers, "sse" or "streamable-http" for remote URLs. */
  transport?: "stdio" | "sse" | "streamable-http";
  /** HTTP transport: extra HTTP headers sent with every request. */
  headers?: Record<string, string | number | boolean>;
  /** Optional connection timeout in milliseconds. */
  connectionTimeoutMs?: number;
  /** Optional per-request timeout in milliseconds. */
  requestTimeoutMs?: number;
  /** Whether this server can safely handle concurrent tool calls. */
  supportsParallelToolCalls?: boolean;
  /**
   * HTTP auth mode.
   * Selection is explicit: `"oauth"` or `"machine_token"`.
   * A machineToken block never overrides auth="oauth" and never auto-activates
   * when auth is absent. auth="machine_token" requires a complete machineToken binding.
   */
  auth?: "oauth" | "machine_token";
  /** Optional OAuth client metadata overrides for HTTP MCP servers. */
  oauth?: {
    /** Credential ownership for this server. Defaults to shared operator credentials. */
    identity?: "shared" | "per-requester";
    /** Refresh-capable auth profile used to inject the current bearer token. */
    authProfileId?: string;
    scope?: string;
    redirectUrl?: string;
    clientMetadataUrl?: string;
  };
  /**
   * Machine-token binding for non-interactive client_credentials / private_key_jwt.
   * Active only when auth is explicitly "machine_token"; ignored otherwise.
   */
  machineToken?: McpServerMachineTokenConfig;
  /** HTTP TLS verification, disabled only for explicitly trusted private endpoints. */
  sslVerify?: boolean;
  /** HTTP mutual TLS client certificate path. */
  clientCert?: string;
  /** HTTP mutual TLS client key path. */
  clientKey?: string;
  /** Optional per-server OpenClaw MCP tool selection. */
  toolFilter?: McpServerToolFilterConfig;
  /** Codex-specific projection controls for Codex app-server/runtime config. */
  codex?: McpServerCodexConfig;
  [key: string]: unknown;
};

export type McpConfig = {
  /** Named MCP server definitions managed by OpenClaw. */
  servers?: Record<string, McpServerConfig>;
  /** Opt-in MCP Apps rendering and app-to-server bridge. */
  apps?: {
    enabled?: boolean;
    /** Dedicated public origin that proxies to the sandbox listener. */
    sandboxOrigin?: string;
    /** Dedicated listener port. Defaults to the Gateway port plus one. */
    sandboxPort?: number;
  };
};
