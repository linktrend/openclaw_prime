/** Linkskills plugin config (§12.1 / §12.2). */

import { assertMachineTokenIssuerUrl } from "openclaw/plugin-sdk/machine-token-runtime";

export type LinkskillsSecretRef = {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
};

/** Credential fields may still accept a resolved string or SecretRef. */
export type LinkskillsSecretInput = string | LinkskillsSecretRef;

type LinkskillsEnvironment = "test" | "stage" | "production";

export type LinkskillsTransportMode = "disabled" | "fake" | "mcp" | "http";

/** Optional machine-token binding for non-interactive HTTP/MCP auth. */
export type LinkskillsMachineTokenConfig = {
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
  clientAssertionKeyRef: LinkskillsSecretRef;
};

export type LinkskillsConfig = {
  mcpDiscoveryRead: boolean;
  governedExecution: boolean;
  telemetryEnqueue: boolean;
  telemetryDrain: boolean;
  /** Remote write adapter. Default disabled — no remote calls until operators opt in. */
  transportMode: LinkskillsTransportMode;
  /** Managed MCP server key under api.config.mcp.servers. */
  mcpServerName: string;
  skillsEndpoint?: string; // Gateway HTTPS base for transportMode=http (POST /v1/{operation})
  /**
   * Permit plain HTTP only to an explicit same-host loopback endpoint in a
   * non-test environment. This is for a service co-located with OpenClaw; it
   * never permits LAN, VPC, Tailscale, or public HTTP.
   */
  allowProductionLoopbackHttp?: boolean;
  skillsCredential?: LinkskillsSecretInput;
  /**
   * Optional machine-token binding. When set, HTTP transport uses
   * client_credentials + private_key_jwt instead of skillsCredential.
   * Absent = existing SecretRef / MCP behavior unchanged.
   */
  machineToken?: LinkskillsMachineTokenConfig;
  redactionPolicyVersion: string;
  batchMaxEvents: number;
  flushIntervalMs: number;
  outboxMaxEntries: number;
  outboxAgeAlarmMs: number;
  environment: LinkskillsEnvironment;
};

export const DEFAULT_LINKSKILLS_CONFIG: LinkskillsConfig = Object.freeze({
  mcpDiscoveryRead: false,
  governedExecution: false,
  telemetryEnqueue: false,
  telemetryDrain: false,
  transportMode: "disabled",
  mcpServerName: "linkskills",
  redactionPolicyVersion: "skills.telemetry.v0",
  batchMaxEvents: 32,
  flushIntervalMs: 5_000,
  outboxMaxEntries: 1_000,
  outboxAgeAlarmMs: 3_600_000,
  environment: "test",
});

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
export function isLinkskillsLocalTestLoopbackHost(hostname: string): boolean {
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
export function assertLinkskillsRemoteHttpsUrl(
  urlString: string,
  fieldName: string,
  localTest?: boolean,
  allowProductionLoopbackHttp?: boolean,
): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (cause) {
    throw new Error(`linkskills: ${fieldName} must be a valid absolute URL`, { cause });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`linkskills: ${fieldName} must use http or https`);
  }
  if (url.username || url.password) {
    throw new Error(`linkskills: ${fieldName} must not include userinfo`);
  }
  const loopback = isLinkskillsLocalTestLoopbackHost(url.hostname);
  const explicitlyAllowedProductionLoopback =
    localTest !== true && allowProductionLoopbackHttp === true && loopback;
  if (url.protocol === "http:") {
    if (!(localTest === true && loopback) && !explicitlyAllowedProductionLoopback) {
      throw new Error(
        `linkskills: ${fieldName} must use HTTPS (HTTP allowed only for explicit loopback)`,
      );
    }
  }
  if (localTest !== true && loopback && !explicitlyAllowedProductionLoopback) {
    throw new Error(
      `linkskills: ${fieldName} must not target loopback outside explicit local-test mode`,
    );
  }
  return url;
}

function parseSecretInput(value: unknown, fieldName: string): LinkskillsSecretInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!isRecord(value)) {
    throw new Error(`linkskills: ${fieldName} must be a string or SecretRef object`);
  }
  return parseSecretRefObject(value, fieldName);
}

/**
 * Accept only supported SecretRef objects. Reject literal strings (including
 * PEM/JWK-looking values), env projections into config, and CLI literals.
 */
function parseSecretRefOnly(value: unknown, fieldName: string): LinkskillsSecretRef {
  if (typeof value === "string") {
    throw new Error(
      `linkskills: ${fieldName} must be a SecretRef object (literal strings, PEM/JWK, env projections, and CLI literals are rejected)`,
    );
  }
  if (!isRecord(value)) {
    throw new Error(`linkskills: ${fieldName} must be a SecretRef object`);
  }
  return parseSecretRefObject(value, fieldName);
}

function parseSecretRefObject(
  value: Record<string, unknown>,
  fieldName: string,
): LinkskillsSecretRef {
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
      `linkskills: ${fieldName} SecretRef requires source ("env"|"file"|"exec"), provider, and id`,
    );
  }
  if (Object.keys(value).some((key) => key !== "source" && key !== "provider" && key !== "id")) {
    throw new Error(`linkskills: ${fieldName} SecretRef has unexpected properties`);
  }
  return { source, provider, id };
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`linkskills: ${fieldName} must be a non-empty string`);
  }
  return value;
}

/**
 * Parses an optional machine-token binding. Returns undefined when absent.
 * Used for plugin config and loosely-typed mcp.servers[*].machineToken blocks.
 */
export function parseLinkskillsMachineToken(
  value: unknown,
  options?: { localTest?: boolean },
): LinkskillsMachineTokenConfig | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error("linkskills: machineToken must be an object");
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
      `linkskills: machineToken.issuerUrl invalid: ${error instanceof Error ? error.message : "rejected"}`,
      { cause: error },
    );
  }
  const binding: LinkskillsMachineTokenConfig = {
    bindingId,
    issuerUrl,
    clientId,
    clientAssertionKeyRef,
  };
  // Present audience/scope must be non-empty strings — never silently drop.
  if ("audience" in value) {
    if (typeof value.audience !== "string" || value.audience.length === 0) {
      throw new Error("linkskills: machineToken.audience must be a non-empty string when set");
    }
    binding.audience = value.audience;
  }
  if ("scope" in value) {
    if (typeof value.scope !== "string" || value.scope.length === 0) {
      throw new Error("linkskills: machineToken.scope must be a non-empty string when set");
    }
    binding.scope = value.scope;
  }
  if ("allowPrivateNetwork" in value) {
    if (typeof value.allowPrivateNetwork !== "boolean") {
      throw new Error("linkskills: machineToken.allowPrivateNetwork must be a boolean when set");
    }
    if (value.allowPrivateNetwork) {
      binding.allowPrivateNetwork = true;
    }
  }
  return binding;
}

function parseEnvironment(value: unknown): LinkskillsEnvironment {
  if (value === "test" || value === "stage" || value === "production") {
    return value;
  }
  return DEFAULT_LINKSKILLS_CONFIG.environment;
}

function parseTransportMode(value: unknown): LinkskillsTransportMode {
  if (value === "disabled" || value === "fake" || value === "mcp" || value === "http") {
    return value;
  }
  return DEFAULT_LINKSKILLS_CONFIG.transportMode;
}

/**
 * Validates and normalizes plugin config. Independent Skills flags default off
 * so an enabled plugin still does no remote work until operators opt in.
 */
export function parseLinkskillsConfig(value: unknown): LinkskillsConfig {
  const raw = isRecord(value) ? value : {};
  const environment = parseEnvironment(raw.environment);
  const localTest = environment === "test";
  const skillsEndpoint =
    typeof raw.skillsEndpoint === "string" && raw.skillsEndpoint.length > 0
      ? raw.skillsEndpoint
      : undefined;
  const allowProductionLoopbackHttp = raw.allowProductionLoopbackHttp === true;
  if (skillsEndpoint) {
    assertLinkskillsRemoteHttpsUrl(
      skillsEndpoint,
      "skillsEndpoint",
      localTest,
      allowProductionLoopbackHttp,
    );
  }
  const redactionPolicyVersion =
    typeof raw.redactionPolicyVersion === "string" && raw.redactionPolicyVersion.length > 0
      ? raw.redactionPolicyVersion
      : DEFAULT_LINKSKILLS_CONFIG.redactionPolicyVersion;
  const mcpServerName =
    typeof raw.mcpServerName === "string" && raw.mcpServerName.length > 0
      ? raw.mcpServerName
      : DEFAULT_LINKSKILLS_CONFIG.mcpServerName;
  const machineToken = parseLinkskillsMachineToken(raw.machineToken, { localTest });

  return {
    mcpDiscoveryRead: readBoolean(raw.mcpDiscoveryRead, DEFAULT_LINKSKILLS_CONFIG.mcpDiscoveryRead),
    governedExecution: readBoolean(
      raw.governedExecution,
      DEFAULT_LINKSKILLS_CONFIG.governedExecution,
    ),
    telemetryEnqueue: readBoolean(raw.telemetryEnqueue, DEFAULT_LINKSKILLS_CONFIG.telemetryEnqueue),
    telemetryDrain: readBoolean(raw.telemetryDrain, DEFAULT_LINKSKILLS_CONFIG.telemetryDrain),
    transportMode: parseTransportMode(raw.transportMode),
    mcpServerName,
    ...(skillsEndpoint ? { skillsEndpoint } : {}),
    ...(allowProductionLoopbackHttp ? { allowProductionLoopbackHttp: true } : {}),
    ...(raw.skillsCredential !== undefined
      ? { skillsCredential: parseSecretInput(raw.skillsCredential, "skillsCredential") }
      : {}),
    ...(machineToken ? { machineToken } : {}),
    redactionPolicyVersion,
    batchMaxEvents: readPositiveInt(
      raw.batchMaxEvents,
      DEFAULT_LINKSKILLS_CONFIG.batchMaxEvents,
      1,
    ),
    flushIntervalMs: readPositiveInt(
      raw.flushIntervalMs,
      DEFAULT_LINKSKILLS_CONFIG.flushIntervalMs,
      100,
    ),
    outboxMaxEntries: readPositiveInt(
      raw.outboxMaxEntries,
      DEFAULT_LINKSKILLS_CONFIG.outboxMaxEntries,
      1,
    ),
    outboxAgeAlarmMs: readPositiveInt(
      raw.outboxAgeAlarmMs,
      DEFAULT_LINKSKILLS_CONFIG.outboxAgeAlarmMs,
      1000,
    ),
    environment,
  };
}

export const linkskillsConfigSchema = {
  parse(value: unknown): LinkskillsConfig {
    return parseLinkskillsConfig(value);
  },
};
