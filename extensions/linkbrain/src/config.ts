/** Linkbrain plugin config (§12.1 / §12.2). */

import { assertMachineTokenIssuerUrl } from "openclaw/plugin-sdk/machine-token-runtime";

export type LinkbrainSecretRef = {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
};

/** Credential fields may still accept a resolved string or SecretRef. */
export type LinkbrainSecretInput = string | LinkbrainSecretRef;

type LinkbrainEnvironment = "test" | "stage" | "production";

export type LinkbrainTransportMode = "disabled" | "fake" | "mcp" | "http";

/** Optional machine-token binding for non-interactive HTTP/MCP auth. */
export type LinkbrainMachineTokenConfig = {
  bindingId: string;
  issuerUrl: string;
  clientId: string;
  audience?: string;
  scope?: string;
  /**
   * Explicit HTTPS trusted-private issuer opt-in (Tailscale/CGNAT/private overlay).
   * Default unset/false. Never use environment=test / localTest for stage PACI.
   */
  allowPrivateNetwork?: boolean;
  /** SecretRef only — never literal PEM/JWK/env/CLI strings in config. */
  clientAssertionKeyRef: LinkbrainSecretRef;
};

export type LinkbrainConfig = {
  mcpRead: boolean;
  captureEnqueue: boolean;
  captureDrain: boolean;
  coordinationWrites: boolean;
  /** Remote write adapter. Default disabled — no remote calls until operators opt in. */
  transportMode: LinkbrainTransportMode;
  /** Managed MCP server key under api.config.mcp.servers. */
  mcpServerName: string;
  /**
   * Permit the co-located production Brain MCP gateway at exactly
   * http://127.0.0.1:18789/mcp. Default unset/false; no other HTTP target is
   * permitted outside explicit local-test mode.
   */
  allowProductionLoopbackHttp?: boolean;
  ingestionEndpoint?: string;
  ingestionCredential?: LinkbrainSecretInput;
  /**
   * Optional machine-token binding. When set, HTTP transport uses
   * client_credentials + private_key_jwt instead of ingestionCredential.
   * Absent = existing SecretRef / MCP behavior unchanged.
   */
  machineToken?: LinkbrainMachineTokenConfig;
  redactionPolicyVersion: string;
  batchMaxEvents: number;
  batchMaxBytes: number;
  flushIntervalMs: number;
  outboxMaxEntries: number;
  outboxAgeAlarmMs: number;
  environment: LinkbrainEnvironment;
};

export const DEFAULT_LINKBRAIN_CONFIG: LinkbrainConfig = Object.freeze({
  mcpRead: false,
  captureEnqueue: false,
  captureDrain: false,
  coordinationWrites: false,
  transportMode: "disabled",
  mcpServerName: "linkbrain",
  redactionPolicyVersion: "brain.redaction.v0",
  batchMaxEvents: 32,
  batchMaxBytes: 49_152,
  flushIntervalMs: 5_000,
  outboxMaxEntries: 1_000,
  outboxAgeAlarmMs: 3_600_000,
  environment: "test",
});

const PRODUCTION_LINKBRAIN_MCP_LOOPBACK_URL = "http://127.0.0.1:18789/mcp";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInt(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    return fallback;
  }
  return value;
}

/** Explicit local-test loopback only — never private LAN/VPC ranges. */
export function isLinkbrainLocalTestLoopbackHost(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Require HTTPS for remote endpoints. HTTP is allowed only for explicit
 * local-test loopback (localhost / 127.0.0.1 / ::1). Private networks are not
 * broadly allowed for production PACI/MCP/HTTP endpoints.
 */
export function assertLinkbrainRemoteHttpsUrl(
  urlString: string,
  fieldName: string,
  localTest?: boolean,
  allowProductionLoopbackHttp?: boolean,
): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (cause) {
    throw new Error(`linkbrain: ${fieldName} must be a valid absolute URL`, { cause });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`linkbrain: ${fieldName} must use http or https`);
  }
  if (url.username || url.password) {
    throw new Error(`linkbrain: ${fieldName} must not include userinfo`);
  }
  const loopback = isLinkbrainLocalTestLoopbackHost(url.hostname);
  const exactProductionBrainMcp =
    localTest !== true &&
    allowProductionLoopbackHttp === true &&
    urlString === PRODUCTION_LINKBRAIN_MCP_LOOPBACK_URL &&
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    url.port === "18789" &&
    url.pathname === "/mcp" &&
    url.search === "" &&
    url.hash === "";
  if (url.protocol === "http:") {
    if (!(localTest === true && loopback) && !exactProductionBrainMcp) {
      throw new Error(
        `linkbrain: ${fieldName} must use HTTPS (HTTP allowed only for explicit loopback)`,
      );
    }
  }
  if (localTest !== true && loopback && !exactProductionBrainMcp) {
    throw new Error(
      `linkbrain: ${fieldName} must not target loopback outside explicit local-test mode`,
    );
  }
  return url;
}

function parseSecretInput(value: unknown, fieldName: string): LinkbrainSecretInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!isRecord(value)) {
    throw new Error(`linkbrain: ${fieldName} must be a string or SecretRef object`);
  }
  return parseSecretRefObject(value, fieldName);
}

/**
 * Accept only supported SecretRef objects. Reject literal strings (including
 * PEM/JWK-looking values), env projections into config, and CLI literals.
 */
function parseSecretRefOnly(value: unknown, fieldName: string): LinkbrainSecretRef {
  if (typeof value === "string") {
    throw new Error(
      `linkbrain: ${fieldName} must be a SecretRef object (literal strings, PEM/JWK, env projections, and CLI literals are rejected)`,
    );
  }
  if (!isRecord(value)) {
    throw new Error(`linkbrain: ${fieldName} must be a SecretRef object`);
  }
  return parseSecretRefObject(value, fieldName);
}

function parseSecretRefObject(
  value: Record<string, unknown>,
  fieldName: string,
): LinkbrainSecretRef {
  const source = value.source;
  const provider = value.provider;
  const id = value.id;
  if (
    (source !== "env" && source !== "file" && source !== "exec") ||
    typeof provider !== "string" ||
    provider.length === 0 ||
    typeof id !== "string" ||
    id.length === 0
  ) {
    throw new Error(
      `linkbrain: ${fieldName} SecretRef requires source ("env"|"file"|"exec"), provider, and id`,
    );
  }
  if (Object.keys(value).some((key) => key !== "source" && key !== "provider" && key !== "id")) {
    throw new Error(`linkbrain: ${fieldName} SecretRef has unexpected properties`);
  }
  return { source, provider, id };
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`linkbrain: ${fieldName} must be a non-empty string`);
  }
  return value;
}

/**
 * Parses an optional machine-token binding. Returns undefined when absent.
 * Used for plugin config and loosely-typed mcp.servers[*].machineToken blocks.
 */
export function parseLinkbrainMachineToken(
  value: unknown,
  options?: { localTest?: boolean },
): LinkbrainMachineTokenConfig | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error("linkbrain: machineToken must be an object");
  }
  const clientAssertionKeyRef = parseSecretRefOnly(
    value.clientAssertionKeyRef,
    "machineToken.clientAssertionKeyRef",
  );
  const bindingId = parseNonEmptyString(value.bindingId, "machineToken.bindingId");
  const clientId = parseNonEmptyString(value.clientId, "machineToken.clientId");
  const issuerUrl = parseNonEmptyString(value.issuerUrl, "machineToken.issuerUrl");
  try {
    assertMachineTokenIssuerUrl(issuerUrl, options?.localTest);
  } catch (error) {
    throw new Error(
      `linkbrain: machineToken.issuerUrl invalid: ${error instanceof Error ? error.message : "rejected"}`,
      { cause: error },
    );
  }
  const binding: LinkbrainMachineTokenConfig = {
    bindingId,
    issuerUrl,
    clientId,
    clientAssertionKeyRef,
  };
  // Present audience/scope must be non-empty strings — never silently drop.
  if ("audience" in value) {
    if (typeof value.audience !== "string" || value.audience.length === 0) {
      throw new Error("linkbrain: machineToken.audience must be a non-empty string when set");
    }
    binding.audience = value.audience;
  }
  if ("scope" in value) {
    if (typeof value.scope !== "string" || value.scope.length === 0) {
      throw new Error("linkbrain: machineToken.scope must be a non-empty string when set");
    }
    binding.scope = value.scope;
  }
  if ("allowPrivateNetwork" in value) {
    if (typeof value.allowPrivateNetwork !== "boolean") {
      throw new Error("linkbrain: machineToken.allowPrivateNetwork must be a boolean when set");
    }
    if (value.allowPrivateNetwork) {
      binding.allowPrivateNetwork = true;
    }
  }
  return binding;
}

function parseEnvironment(value: unknown): LinkbrainEnvironment {
  if (value === "test" || value === "stage" || value === "production") {
    return value;
  }
  return DEFAULT_LINKBRAIN_CONFIG.environment;
}

function parseTransportMode(value: unknown): LinkbrainTransportMode {
  if (value === "disabled" || value === "fake" || value === "mcp" || value === "http") {
    return value;
  }
  return DEFAULT_LINKBRAIN_CONFIG.transportMode;
}

/**
 * Validates and normalizes plugin config. Independent Brain flags default off
 * so an enabled plugin still does no remote work until operators opt in.
 */
export function parseLinkbrainConfig(value: unknown): LinkbrainConfig {
  const raw = isRecord(value) ? value : {};
  const environment = parseEnvironment(raw.environment);
  const localTest = environment === "test";
  const ingestionEndpoint =
    typeof raw.ingestionEndpoint === "string" && raw.ingestionEndpoint.length > 0
      ? raw.ingestionEndpoint
      : undefined;
  if (ingestionEndpoint) {
    assertLinkbrainRemoteHttpsUrl(ingestionEndpoint, "ingestionEndpoint", localTest);
  }
  const redactionPolicyVersion =
    typeof raw.redactionPolicyVersion === "string" && raw.redactionPolicyVersion.length > 0
      ? raw.redactionPolicyVersion
      : DEFAULT_LINKBRAIN_CONFIG.redactionPolicyVersion;
  const mcpServerName =
    typeof raw.mcpServerName === "string" && raw.mcpServerName.length > 0
      ? raw.mcpServerName
      : DEFAULT_LINKBRAIN_CONFIG.mcpServerName;
  const allowProductionLoopbackHttp = raw.allowProductionLoopbackHttp === true;
  const machineToken = parseLinkbrainMachineToken(raw.machineToken, { localTest });

  return {
    mcpRead: readBoolean(raw.mcpRead, DEFAULT_LINKBRAIN_CONFIG.mcpRead),
    captureEnqueue: readBoolean(raw.captureEnqueue, DEFAULT_LINKBRAIN_CONFIG.captureEnqueue),
    captureDrain: readBoolean(raw.captureDrain, DEFAULT_LINKBRAIN_CONFIG.captureDrain),
    coordinationWrites: readBoolean(
      raw.coordinationWrites,
      DEFAULT_LINKBRAIN_CONFIG.coordinationWrites,
    ),
    transportMode: parseTransportMode(raw.transportMode),
    mcpServerName,
    ...(ingestionEndpoint ? { ingestionEndpoint } : {}),
    ...(raw.ingestionCredential !== undefined
      ? { ingestionCredential: parseSecretInput(raw.ingestionCredential, "ingestionCredential") }
      : {}),
    ...(machineToken ? { machineToken } : {}),
    redactionPolicyVersion,
    batchMaxEvents: readPositiveInt(raw.batchMaxEvents, DEFAULT_LINKBRAIN_CONFIG.batchMaxEvents, 1),
    batchMaxBytes: readPositiveInt(raw.batchMaxBytes, DEFAULT_LINKBRAIN_CONFIG.batchMaxBytes, 1024),
    flushIntervalMs: readPositiveInt(
      raw.flushIntervalMs,
      DEFAULT_LINKBRAIN_CONFIG.flushIntervalMs,
      100,
    ),
    outboxMaxEntries: readPositiveInt(
      raw.outboxMaxEntries,
      DEFAULT_LINKBRAIN_CONFIG.outboxMaxEntries,
      1,
    ),
    outboxAgeAlarmMs: readPositiveInt(
      raw.outboxAgeAlarmMs,
      DEFAULT_LINKBRAIN_CONFIG.outboxAgeAlarmMs,
      1000,
    ),
    environment,
    ...(allowProductionLoopbackHttp ? { allowProductionLoopbackHttp: true } : {}),
  };
}

export const linkbrainConfigSchema = {
  parse(value: unknown): LinkbrainConfig {
    return parseLinkbrainConfig(value);
  },
};
