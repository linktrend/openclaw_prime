/**
 * Governed browser policy shared by sandbox and Lisa browser runtimes.
 *
 * Browser page content is always untrusted. This module owns the small,
 * deterministic decisions that must happen before a browser action or URL is
 * handed to a driver; it does not perform browser I/O or persist approvals.
 */
import path from "node:path";
import {
  isBlockedHostnameOrIp,
  isPrivateNetworkAllowedByPolicy,
  matchesHostnameAllowlist,
  resolvePinnedHostnameWithPolicy,
  type LookupFn,
  type PinnedHostname,
  type SsrFPolicy,
} from "../../infra/net/ssrf.js";

export const GOVERNED_BROWSER_RUNTIME_MODE = "source-only" as const;

export const GOVERNED_BROWSER_CAPABILITY_CLASSES = [
  "public_read",
  "approved_authenticated_read",
  "navigation",
  "login",
  "form_submission",
  "upload",
  "download",
  "purchase",
  "terms",
  "external_commitment",
] as const;

export type GovernedBrowserCapabilityClass = (typeof GOVERNED_BROWSER_CAPABILITY_CLASSES)[number];

export type BrowserPolicyDecision = {
  status: "allow" | "ask" | "deny";
  capability: GovernedBrowserCapabilityClass;
  reason: string;
  /** Page text, DOM, and instructions can never be approval evidence. */
  pageContentUntrusted: true;
};

export type BrowserApprovalEvidence = {
  approved: boolean;
  /** Only Platform may activate a standing rule or approve a risky action. */
  actor: "platform" | "operator" | "lisa" | "page";
  expiresAtMs?: number;
};

export type BrowserCapabilityRequest = {
  capability: GovernedBrowserCapabilityClass;
  authenticated?: boolean;
  identityUncertain?: boolean;
  termsUnclear?: boolean;
  botProtection?: boolean;
  /** Credentials supplied by model/page text are never accepted. */
  credentialSource?: "vault" | "operator_visual" | "model" | "page";
  standingRule?: BrowserApprovalEvidence;
  currentApproval?: BrowserApprovalEvidence;
  /** Lisa cannot grant herself a new standing rule. */
  activateStandingRule?: boolean;
};

const APPROVAL_REQUIRED_CAPABILITIES = new Set<GovernedBrowserCapabilityClass>([
  "approved_authenticated_read",
  "login",
  "form_submission",
  "upload",
  "download",
  "purchase",
  "terms",
  "external_commitment",
]);

const DENY_ON_UNCERTAINTY_CAPABILITIES = new Set<GovernedBrowserCapabilityClass>([
  "login",
  "form_submission",
  "upload",
  "download",
  "purchase",
  "terms",
  "external_commitment",
]);

function decision(
  status: BrowserPolicyDecision["status"],
  capability: GovernedBrowserCapabilityClass,
  reason: string,
): BrowserPolicyDecision {
  return { status, capability, reason, pageContentUntrusted: true };
}

function isCurrentApproval(evidence: BrowserApprovalEvidence | undefined, nowMs: number): boolean {
  return (
    evidence?.approved === true &&
    evidence.actor === "platform" &&
    (evidence.expiresAtMs === undefined || evidence.expiresAtMs > nowMs)
  );
}

/**
 * Evaluate a capability without consulting page content or mutable browser
 * state. Approval records are inputs from the Platform owner, not generated
 * here, so this function is safe to call at every action boundary.
 */
export function evaluateBrowserCapability(
  request: BrowserCapabilityRequest,
  nowMs = Date.now(),
): BrowserPolicyDecision {
  const capability = request.capability;
  if (!GOVERNED_BROWSER_CAPABILITY_CLASSES.includes(capability)) {
    return decision("deny", capability, "unknown browser capability");
  }

  if (request.activateStandingRule) {
    return decision("deny", capability, "Lisa cannot activate a standing browser rule");
  }
  if (request.credentialSource === "model" || request.credentialSource === "page") {
    return decision("deny", capability, "credentials must remain outside model and page content");
  }
  if (request.identityUncertain) {
    return decision("deny", capability, "identity is uncertain");
  }
  if (request.botProtection) {
    return decision("deny", capability, "bot protection or challenge requires operator handling");
  }

  const effectiveCapability =
    request.authenticated && capability === "public_read"
      ? "approved_authenticated_read"
      : capability;
  const requiresApproval = APPROVAL_REQUIRED_CAPABILITIES.has(effectiveCapability);
  if (request.termsUnclear && DENY_ON_UNCERTAINTY_CAPABILITIES.has(effectiveCapability)) {
    return decision("deny", effectiveCapability, "terms or legal effect is uncertain");
  }
  if (!requiresApproval) {
    return decision("allow", effectiveCapability, "public browser read/navigation is low risk");
  }

  if (
    isCurrentApproval(request.standingRule, nowMs) ||
    isCurrentApproval(request.currentApproval, nowMs)
  ) {
    return decision("allow", effectiveCapability, "current Platform approval is valid");
  }
  return decision("ask", effectiveCapability, "Platform approval is required before this action");
}

/** Alias that reads naturally at an action boundary. */
export const authorizeBrowserCapability = evaluateBrowserCapability;

export type GovernedBrowserUrlOptions = {
  /** Canonical SSRF policy supplied by the browser runtime boundary. */
  policy?: SsrFPolicy;
  /** Explicit operator policy for an approved private endpoint. */
  allowPrivateNetwork?: boolean;
  allowedHostnames?: string[];
  hostnameAllowlist?: string[];
  lookupFn?: LookupFn;
  /** Previously admitted DNS result for this hostname during one navigation. */
  pinnedHostname?: PinnedHostname;
};

const NETWORK_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_NON_NETWORK_URL = "about:blank";

export class GovernedBrowserUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernedBrowserUrlError";
  }
}

function trimAsciiEdges(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 0x20) {
    start += 1;
  }
  while (end > start && value.charCodeAt(end - 1) <= 0x20) {
    end -= 1;
  }
  return value.slice(start, end);
}

/** Parse a navigation URL and reject credentials or unsupported protocols. */
export function parseGovernedBrowserUrl(rawUrl: string): URL {
  // ASCII-only edges: web_fetch preserves trailing Unicode path text such as NBSP.
  const value = trimAsciiEdges(rawUrl);
  if (!value) {
    throw new GovernedBrowserUrlError("browser URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GovernedBrowserUrlError("browser URL is invalid");
  }
  if (parsed.username || parsed.password) {
    throw new GovernedBrowserUrlError("URL-embedded credentials are not permitted");
  }
  if (parsed.href === ALLOWED_NON_NETWORK_URL) {
    return parsed;
  }
  if (!NETWORK_PROTOCOLS.has(parsed.protocol)) {
    throw new GovernedBrowserUrlError(`unsupported browser URL protocol: ${parsed.protocol}`);
  }
  return parsed;
}

function buildSsrFPolicy(options: GovernedBrowserUrlOptions): SsrFPolicy {
  return {
    ...(options.policy ?? {}),
    ...(options.allowPrivateNetwork ? { dangerouslyAllowPrivateNetwork: true } : {}),
    ...(options.allowedHostnames?.length ? { allowedHostnames: options.allowedHostnames } : {}),
    ...(options.hostnameAllowlist?.length ? { hostnameAllowlist: options.hostnameAllowlist } : {}),
  };
}

/** The DNS answer admitted for one browser navigation hostname. */
export type GovernedBrowserUrlBinding = {
  url: URL;
  pinnedHostname?: PinnedHostname;
};

/**
 * Validate a URL and retain the DNS answer that passed policy.
 *
 * Browser callers use this binding at their request interception boundary so
 * a navigation does not silently discard the address that was checked.
 */
export async function resolveGovernedBrowserUrl(
  rawUrl: string,
  options: GovernedBrowserUrlOptions = {},
): Promise<GovernedBrowserUrlBinding> {
  const parsed = parseGovernedBrowserUrl(rawUrl);
  if (parsed.href === ALLOWED_NON_NETWORK_URL) {
    return { url: parsed };
  }

  const policy = buildSsrFPolicy(options);
  const normalizedHostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const exactAllowedHostnames = [
    ...(options.policy?.allowedHostnames ?? []),
    ...(options.allowedHostnames ?? []),
  ];
  const hostnameAllowlist = [
    ...(options.policy?.hostnameAllowlist ?? []),
    ...(options.hostnameAllowlist ?? []),
  ]
    .map((hostname) => hostname.trim().toLowerCase().replace(/\.+$/, ""))
    .filter(Boolean);
  const explicitlyAllowedHostname =
    exactAllowedHostnames.some(
      (hostname) => hostname.trim().toLowerCase().replace(/\.+$/, "") === normalizedHostname,
    ) || matchesHostnameAllowlist(normalizedHostname, hostnameAllowlist);
  if (
    !isPrivateNetworkAllowedByPolicy(policy) &&
    !explicitlyAllowedHostname &&
    isBlockedHostnameOrIp(parsed.hostname, policy)
  ) {
    throw new GovernedBrowserUrlError("private or special-use browser target is blocked");
  }
  if (options.pinnedHostname) {
    if (options.pinnedHostname.hostname !== normalizedHostname) {
      throw new GovernedBrowserUrlError("browser DNS binding does not match the requested host");
    }
    return { url: parsed, pinnedHostname: options.pinnedHostname };
  }
  try {
    const pinnedHostname = await resolvePinnedHostnameWithPolicy(parsed.hostname, {
      lookupFn: options.lookupFn,
      policy,
    });
    return { url: parsed, pinnedHostname };
  } catch (error) {
    if (error instanceof GovernedBrowserUrlError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "browser URL failed network policy";
    throw new GovernedBrowserUrlError(message);
  }
}

/** Validate one URL before handing it to Chromium. DNS is pinned and checked. */
export async function assertGovernedBrowserUrl(
  rawUrl: string,
  options: GovernedBrowserUrlOptions = {},
): Promise<URL> {
  return (await resolveGovernedBrowserUrl(rawUrl, options)).url;
}

/** Validate every URL in a redirect chain, preserving order for diagnostics. */
export async function assertGovernedBrowserRedirectChain(
  urls: readonly string[],
  options: GovernedBrowserUrlOptions & { maxRedirects?: number } = {},
): Promise<URL[]> {
  const maxRedirects = Math.max(0, Math.floor(options.maxRedirects ?? 10));
  if (urls.length > maxRedirects + 1) {
    throw new GovernedBrowserUrlError("browser redirect limit exceeded");
  }
  const checked: URL[] = [];
  for (const url of urls) {
    checked.push(await assertGovernedBrowserUrl(url, options));
  }
  return checked;
}

export const DEFAULT_BROWSER_MAX_CONCURRENT_SESSIONS = 2;
export const DEFAULT_BROWSER_MAX_MEMORY_MB = 1_024;
export const DEFAULT_BROWSER_IDLE_TIMEOUT_MS = 5 * 60 * 1_000;

export type BrowserRuntimeLimits = {
  maxConcurrentSessions: number;
  maxMemoryMb: number;
  idleTimeoutMs: number;
  maxDownloadsPerSession: number;
};

export function resolveBrowserRuntimeLimits(
  input: Partial<BrowserRuntimeLimits> = {},
): BrowserRuntimeLimits {
  const positive = (value: number | undefined, fallback: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.min(max, Math.floor(value))
      : fallback;
  return {
    maxConcurrentSessions: positive(
      input.maxConcurrentSessions,
      DEFAULT_BROWSER_MAX_CONCURRENT_SESSIONS,
      16,
    ),
    maxMemoryMb: positive(input.maxMemoryMb, DEFAULT_BROWSER_MAX_MEMORY_MB, 16_384),
    idleTimeoutMs: positive(
      input.idleTimeoutMs,
      DEFAULT_BROWSER_IDLE_TIMEOUT_MS,
      24 * 60 * 60 * 1_000,
    ),
    maxDownloadsPerSession: positive(input.maxDownloadsPerSession, 4, 100),
  };
}

export type BrowserSessionAdmission = {
  activeSessions: number;
  estimatedMemoryMb?: number;
};

/** Return an admission decision before starting a browser process/container. */
export function admitBrowserSession(
  limitsInput: Partial<BrowserRuntimeLimits>,
  request: BrowserSessionAdmission,
): { allowed: true } | { allowed: false; reason: string } {
  const limits = resolveBrowserRuntimeLimits(limitsInput);
  if (!Number.isSafeInteger(request.activeSessions) || request.activeSessions < 0) {
    return { allowed: false, reason: "active browser session count is invalid" };
  }
  if (request.activeSessions >= limits.maxConcurrentSessions) {
    return { allowed: false, reason: "browser concurrency limit reached" };
  }
  if (
    request.estimatedMemoryMb !== undefined &&
    (!Number.isFinite(request.estimatedMemoryMb) ||
      request.estimatedMemoryMb < 0 ||
      request.estimatedMemoryMb > limits.maxMemoryMb)
  ) {
    return { allowed: false, reason: "browser memory budget exceeded" };
  }
  return { allowed: true };
}

export type BrowserDownloadPolicy = {
  directory: string;
  openAfterDownload: false;
  executeAfterDownload: false;
};

/** Build an isolated, non-executable download policy for one browser session. */
export function resolveBrowserDownloadPolicy(rootDirectory: string): BrowserDownloadPolicy {
  const root = path.resolve(rootDirectory);
  return {
    directory: path.join(root, "downloads"),
    openAfterDownload: false,
    executeAfterDownload: false,
  };
}

/** Reject path traversal before a driver writes a download to the session dir. */
export function resolveBrowserDownloadPath(
  policy: BrowserDownloadPolicy,
  requestedName: string,
): string {
  const name = requestedName.trim();
  if (!name || name === "." || name === ".." || path.basename(name) !== name) {
    throw new GovernedBrowserUrlError("download filename must stay inside the session directory");
  }
  const resolved = path.resolve(policy.directory, name);
  const relative = path.relative(policy.directory, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new GovernedBrowserUrlError("download filename escapes the session directory");
  }
  return resolved;
}

/** PKT-06 is source-only: importing policy never starts Chromium or spends. */
export function startGovernedBrowserRuntime(): never {
  throw new GovernedBrowserUrlError(
    "governed browser runtime is source-only; live Chromium is not started",
  );
}
