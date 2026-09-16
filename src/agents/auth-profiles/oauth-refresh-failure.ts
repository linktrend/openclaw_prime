import { normalizeProviderId } from "@openclaw/model-catalog-core/provider-id";
import { asOptionalRecord } from "@openclaw/normalization-core/record-coerce";
import { normalizeBoundedOptionalString } from "@openclaw/normalization-core/string-coerce";
import { sanitizeForLog } from "../../../packages/terminal-core/src/ansi.js";
import { formatCliCommand } from "../../cli/command-format.js";
/**
 * OAuth refresh failure classification and operator hints.
 * Parses provider/reason codes from refresh failures and formats safe login
 * commands without trusting raw provider text.
 */
import { formatInlineCodeSpan } from "../../shared/markdown-code.js";
import type { AuthProfileFailureReason } from "./types.js";

export type OAuthRefreshFailureReason =
  | "refresh_token_reused"
  | "expired"
  | "invalid_grant"
  | "sign_in_again"
  | "invalid_refresh_token"
  | "token_invalidated"
  | "revoked";

type OAuthRefreshFailure = {
  errorType?: string;
  provider: string | null;
  profileId?: string;
  reason: OAuthRefreshFailureReason | null;
  status?: number;
  summary?: string;
};

export type OAuthRefreshFailurePresentation = {
  errorType?: string;
  reason?: OAuthRefreshFailureReason;
  status?: number;
  summary?: string;
};

const OAUTH_REFRESH_FAILURE_ERROR_TYPE_MAX_CHARS = 100;
const OAUTH_REFRESH_FAILURE_SUMMARY_MAX_CHARS = 500;

function presentationFromOAuthRefreshFields(params: {
  summary?: unknown;
  errorType?: unknown;
  reason?: unknown;
  status?: unknown;
}): OAuthRefreshFailurePresentation | null {
  const summary = normalizeBoundedOptionalString(
    params.summary,
    OAUTH_REFRESH_FAILURE_SUMMARY_MAX_CHARS,
  );
  const errorType = normalizeBoundedOptionalString(
    params.errorType,
    OAUTH_REFRESH_FAILURE_ERROR_TYPE_MAX_CHARS,
  );
  const reason =
    typeof params.reason === "string" ? classifyOAuthRefreshFailureReason(params.reason) : null;
  const status =
    typeof params.status === "number" &&
    Number.isInteger(params.status) &&
    params.status >= 100 &&
    params.status <= 599
      ? params.status
      : undefined;
  if (!summary && !errorType && !reason && !status) {
    return null;
  }
  return {
    ...(errorType ? { errorType } : {}),
    ...(reason ? { reason } : {}),
    ...(status ? { status } : {}),
    ...(summary ? { summary } : {}),
  };
}

export function readProviderOAuthRefreshFailure(
  error: unknown,
): OAuthRefreshFailurePresentation | null {
  if (error instanceof OAuthRefreshFailureError) {
    return presentationFromOAuthRefreshFields({
      summary: error.summary ?? error.message,
      errorType: error.errorType,
      reason: error.reason,
      status: error.status,
    });
  }
  const presentation = asOptionalRecord(asOptionalRecord(error)?.oauthRefreshFailure);
  if (!presentation) {
    return null;
  }
  return presentationFromOAuthRefreshFields(presentation);
}

type StructuredClaudeCliAuthFailure = {
  provider?: unknown;
  rawError?: unknown;
  reason?: unknown;
  status?: unknown;
};

/** Error type that carries provider and classified OAuth refresh failure reason. */
export class OAuthRefreshFailureError extends Error {
  readonly errorType?: string;
  readonly provider: string;
  readonly profileId?: string;
  readonly reason: OAuthRefreshFailureReason | null;
  readonly status?: number;
  readonly summary?: string;

  constructor(params: {
    provider: string;
    profileId?: string;
    message: string;
    cause?: unknown;
    errorType?: string;
    reason?: OAuthRefreshFailureReason | null;
    status?: number;
    summary?: string;
  }) {
    super(params.message, { cause: params.cause });
    const inherited =
      params.cause instanceof OAuthRefreshFailureError
        ? params.cause
        : readProviderOAuthRefreshFailure(params.cause);
    this.name = "OAuthRefreshFailureError";
    this.errorType = normalizeBoundedOptionalString(
      params.errorType ?? inherited?.errorType,
      OAUTH_REFRESH_FAILURE_ERROR_TYPE_MAX_CHARS,
    );
    this.provider = params.provider;
    this.profileId = params.profileId;
    this.reason =
      params.reason !== undefined
        ? params.reason
        : (inherited?.reason ?? classifyOAuthRefreshFailureReason(params.message));
    this.status = params.status ?? inherited?.status;
    this.summary = normalizeBoundedOptionalString(
      params.summary ?? inherited?.summary,
      OAUTH_REFRESH_FAILURE_SUMMARY_MAX_CHARS,
    );
  }
}

const OAUTH_REFRESH_FAILURE_PROVIDER_RE = /OAuth token refresh failed for ([^:]+):/i;
const SAFE_PROVIDER_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
// Matches the error surfaced via FailoverError when the `claude` subprocess
// has an expired/invalid OAuth token.  The message always includes the
// "claude-cli" provider prefix (injected by the failover layer) and the
// literal 401 status plus Anthropic's "Invalid authentication credentials"
// phrase, so the pattern is narrow enough to avoid false-positives from
// unrelated provider 401 failures.
const CLAUDE_CLI_AUTH_FAILURE_RE =
  /\bclaude-cli\b.+?\b(failed to authenticate|401\s+invalid authentication credentials)\b/is;

function isClaudeCliExpiredOAuthMessage(message: string): boolean {
  return CLAUDE_CLI_AUTH_FAILURE_RE.test(message);
}

function readStructuredClaudeCliAuthFailure(err: unknown): StructuredClaudeCliAuthFailure | null {
  if (!err || typeof err !== "object") {
    return null;
  }
  const candidate = err as StructuredClaudeCliAuthFailure & { name?: unknown };
  if (
    candidate.name !== "FailoverError" ||
    candidate.provider !== "claude-cli" ||
    candidate.reason !== "auth" ||
    candidate.status !== 401
  ) {
    return null;
  }
  return candidate;
}

function classifyStructuredClaudeCliOAuthFailureReason(
  err: unknown,
): OAuthRefreshFailureReason | null {
  const failure = readStructuredClaudeCliAuthFailure(err);
  if (!failure) {
    return null;
  }
  const rawError = typeof failure.rawError === "string" ? failure.rawError : "";
  const message = err instanceof Error ? err.message : "";
  const combined = `${message}\n${rawError}`;
  const lower = combined.toLowerCase();
  if (/\bnot logged in\b\s*·\s*please run \/login\b/i.test(combined)) {
    return "sign_in_again";
  }
  const hasExpiredTokenSignal =
    lower.includes("failed to authenticate") ||
    lower.includes("invalid authentication credentials");
  return hasExpiredTokenSignal ? "revoked" : null;
}

function isOAuthRefreshFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("oauth token refresh failed") ||
    lower.includes("access token could not be refreshed") ||
    lower.includes("authentication session could not be refreshed automatically") ||
    isClaudeCliExpiredOAuthMessage(message)
  );
}

function extractOAuthRefreshFailureProvider(message: string): string | null {
  if (isClaudeCliExpiredOAuthMessage(message)) {
    // The message was produced by the claude-cli subprocess; the provider is
    // statically known — no need to parse it from the error text.
    return "claude-cli";
  }
  const provider = message.match(OAUTH_REFRESH_FAILURE_PROVIDER_RE)?.[1]?.trim();
  return provider && provider.length > 0 ? provider : null;
}

function sanitizeOAuthRefreshFailureProvider(provider: string | null | undefined): string | null {
  // Only return normalized provider ids that are safe to embed in shell guidance.
  const sanitized = provider ? sanitizeForLog(provider).replaceAll("`", "").trim() : "";
  const normalized = normalizeProviderId(sanitized);
  return normalized && SAFE_PROVIDER_ID_RE.test(normalized) ? normalized : null;
}

function sanitizeOAuthRefreshFailureProfileId(profileId: string | null | undefined): string | null {
  const sanitized = profileId ? sanitizeForLog(profileId).trim() : "";
  return sanitized || null;
}

function quoteShellArg(value: string): string {
  const escaped =
    process.platform === "win32" ? value.replaceAll("'", "''") : value.replaceAll("'", "'\\''");
  return `'${escaped}'`;
}

/** Wrap a rendered login command in a Markdown code span that survives embedded backticks. */
export function formatOAuthRefreshFailureLoginCommandMarkdown(command: string): string {
  return formatInlineCodeSpan(command);
}

/** Classify a raw OAuth refresh failure message into a stable reason code. */
export function classifyOAuthRefreshFailureReason(
  message: string,
): OAuthRefreshFailureReason | null {
  const lower = message.toLowerCase();
  if (lower.includes("refresh_token_reused")) {
    return "refresh_token_reused";
  }
  if (lower.includes("refresh_token_expired")) {
    return "expired";
  }
  if (lower.includes("invalid_grant")) {
    return "invalid_grant";
  }
  if (lower.includes("token_invalidated")) {
    return "token_invalidated";
  }
  if (
    lower.includes("sign_in_again") ||
    lower.includes("signing in again") ||
    lower.includes("sign in again") ||
    lower.includes("log in again")
  ) {
    return "sign_in_again";
  }
  if (lower.includes("invalid_refresh_token") || lower.includes("invalid refresh token")) {
    return "invalid_refresh_token";
  }
  if (lower.includes("expired or revoked") || lower.includes("revoked")) {
    return "revoked";
  }
  if (isClaudeCliExpiredOAuthMessage(message)) {
    // The claude subprocess emits "401 Invalid authentication credentials"
    // when its stored OAuth token has expired.  Map this to "revoked" so the
    // caller surfaces the targeted re-auth hint rather than the generic login
    // failure copy.
    return "revoked";
  }
  return null;
}

/** Classify provider/reason from a user-facing OAuth refresh failure message. */
export function classifyOAuthRefreshFailure(message: string): OAuthRefreshFailure | null {
  if (!isOAuthRefreshFailureMessage(message)) {
    return null;
  }
  return {
    provider: sanitizeOAuthRefreshFailureProvider(extractOAuthRefreshFailureProvider(message)),
    reason: classifyOAuthRefreshFailureReason(message),
  };
}

/** Classify provider/reason from the structured OAuth refresh failure error. */
/** Codex `external_auth.rs` JSON-RPC error wrap; code is native, never invented. */
const CODEX_APP_SERVER_AUTH_REFRESH_FAILED_RE = /^auth refresh request failed: code=(-?\d+)$/;
/** Codex `external_auth.rs` 10s deadline copy (duration is Codex-owned). */
const CODEX_APP_SERVER_AUTH_REFRESH_TIMEOUT_RE = /^auth refresh request timed out after \d+s$/;
const CODEX_APP_SERVER_AUTH_REFRESH_CANCELED_PREFIX = "auth refresh request canceled:";
/** Codex `external_auth.rs` parser failure after a JSON-RPC success (token-bearing payload redacted). */
const CODEX_APP_SERVER_AUTH_REFRESH_INVALID_RESPONSE = "invalid auth refresh response";
/** Codex `external_auth.rs` credential constructor failure (token-bearing payload redacted). */
const CODEX_APP_SERVER_AUTH_REFRESH_INVALID_CREDENTIALS = "auth refresh returned invalid credentials";

export const CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_ERROR_TYPE =
  "codex_app_server_external_auth_refresh";
export const CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_TIMEOUT_ERROR_TYPE =
  "codex_app_server_external_auth_refresh_timeout";
export const CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_CANCELED_ERROR_TYPE =
  "codex_app_server_external_auth_refresh_canceled";

export type ExternalAuthRefreshTerminalKind = "refresh_failed" | "timeout" | "canceled";

export type ExternalAuthRefreshTerminalFailure = {
  kind: ExternalAuthRefreshTerminalKind;
  jsonRpcCode?: number;
};

function readUnknownErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim();
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  return "";
}

function errorTypeForExternalAuthRefreshKind(kind: ExternalAuthRefreshTerminalKind): string {
  switch (kind) {
    case "timeout":
      return CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_TIMEOUT_ERROR_TYPE;
    case "canceled":
      return CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_CANCELED_ERROR_TYPE;
    default:
      return CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_ERROR_TYPE;
  }
}

function classifyExternalAuthRefreshErrorType(
  errorType: string | undefined,
): ExternalAuthRefreshTerminalKind | null {
  switch (errorType) {
    case CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_ERROR_TYPE:
      return "refresh_failed";
    case CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_TIMEOUT_ERROR_TYPE:
      return "timeout";
    case CODEX_APP_SERVER_EXTERNAL_AUTH_REFRESH_CANCELED_ERROR_TYPE:
      return "canceled";
    default:
      return null;
  }
}

function typedExternalAuthRefreshKind(error: unknown): ExternalAuthRefreshTerminalKind | null {
  return classifyExternalAuthRefreshErrorType(
    readProviderOAuthRefreshFailure(error)?.errorType ??
      (error instanceof OAuthRefreshFailureError ? error.errorType : undefined),
  );
}

/**
 * Classify Codex native refresh copy plus typed plugin stamps.
 * Generic JSON-RPC -32603 without this wrap is not a refresh failure.
 */
export function classifyExternalAuthRefreshTerminalFailure(
  error: unknown,
): ExternalAuthRefreshTerminalFailure | null {
  const typedKind = typedExternalAuthRefreshKind(error);
  if (typedKind) {
    return { kind: typedKind };
  }
  const message = readUnknownErrorMessage(error);
  const failed = message.match(CODEX_APP_SERVER_AUTH_REFRESH_FAILED_RE);
  if (failed) {
    const jsonRpcCode = Number(failed[1]);
    return {
      kind: "refresh_failed",
      ...(Number.isFinite(jsonRpcCode) ? { jsonRpcCode } : {}),
    };
  }
  if (
    message === CODEX_APP_SERVER_AUTH_REFRESH_INVALID_RESPONSE ||
    message === CODEX_APP_SERVER_AUTH_REFRESH_INVALID_CREDENTIALS
  ) {
    return { kind: "refresh_failed" };
  }
  if (CODEX_APP_SERVER_AUTH_REFRESH_TIMEOUT_RE.test(message)) {
    return { kind: "timeout" };
  }
  if (message.startsWith(CODEX_APP_SERVER_AUTH_REFRESH_CANCELED_PREFIX)) {
    return { kind: "canceled" };
  }
  return null;
}

/** Map typed plugin-owned refresh stamps onto OpenClaw failover reasons. */
export function failoverReasonForExternalAuthRefreshTerminalFailure(
  error: unknown,
): "auth_permanent" | "timeout" | null {
  const typedKind = typedExternalAuthRefreshKind(error);
  if (typedKind === "refresh_failed") {
    // ChatGPT refresh already failed for this turn. Skip same-model runtime
    // auth retry (`auth` only); JSON-RPC codes are not the permanence signal.
    return "auth_permanent";
  }
  if (typedKind === "timeout") {
    return "timeout";
  }
  return null;
}

export function isExternalAuthRefreshFallbackEligible(error: unknown): boolean {
  return failoverReasonForExternalAuthRefreshTerminalFailure(error) !== null;
}

/** Attach bounded Codex external-auth refresh provenance for OpenClaw failover. */
export function materializeExternalAuthRefreshPromptError(params: {
  message: string;
  cause?: unknown;
  kind?: ExternalAuthRefreshTerminalKind;
}): Error | null {
  const classified = params.kind
    ? { kind: params.kind }
    : classifyExternalAuthRefreshTerminalFailure(params.message);
  if (!classified) {
    return null;
  }
  const errorType = errorTypeForExternalAuthRefreshKind(classified.kind);
  if (classified.kind === "refresh_failed") {
    return new OAuthRefreshFailureError({
      provider: "openai",
      message: params.message,
      cause: params.cause,
      errorType,
      reason: null,
      summary: params.message,
    });
  }
  const error = new Error(
    params.message,
    params.cause !== undefined ? { cause: params.cause } : undefined,
  );
  Object.assign(error, {
    oauthRefreshFailure: {
      errorType,
      summary: params.message,
    },
  });
  return error;
}

export function classifyOAuthRefreshFailureError(err: unknown): OAuthRefreshFailure | null {
  const seen = new Set<object>();
  let rawFallback: OAuthRefreshFailure | null = null;
  let candidate = err;
  while (candidate && typeof candidate === "object") {
    const claudeCliReason = classifyStructuredClaudeCliOAuthFailureReason(candidate);
    if (claudeCliReason) {
      return {
        provider: "claude-cli",
        reason: claudeCliReason,
      };
    }
    if (candidate instanceof OAuthRefreshFailureError) {
      const profileId = sanitizeOAuthRefreshFailureProfileId(candidate.profileId);
      return {
        ...(candidate.errorType ? { errorType: candidate.errorType } : {}),
        provider: sanitizeOAuthRefreshFailureProvider(candidate.provider),
        ...(profileId ? { profileId } : {}),
        reason: candidate.reason,
        ...(candidate.status ? { status: candidate.status } : {}),
        ...(candidate.summary ? { summary: candidate.summary } : {}),
      };
    }
    const record = asOptionalRecord(candidate);
    const rawError = record?.rawError;
    if (typeof rawError === "string") {
      const classified = classifyOAuthRefreshFailure(rawError);
      if (classified) {
        const rawProfileId = record?.profileId;
        const profileId = sanitizeOAuthRefreshFailureProfileId(
          typeof rawProfileId === "string" ? rawProfileId : undefined,
        );
        rawFallback ??= { ...classified, ...(profileId ? { profileId } : {}) };
      }
    }
    if (seen.has(candidate)) {
      return rawFallback;
    }
    seen.add(candidate);
    candidate = (candidate as { cause?: unknown }).cause;
  }
  return rawFallback;
}

/** Build the login command operators should run after OAuth refresh failure. */
export function buildOAuthRefreshFailureLoginCommand(
  provider: string | null | undefined,
  options?: { profileId?: string | null },
): string {
  const sanitizedProvider = sanitizeOAuthRefreshFailureProvider(provider);
  const sanitizedProfileId = sanitizeOAuthRefreshFailureProfileId(options?.profileId);
  if (sanitizedProvider === "claude-cli") {
    // claude-cli is not a standalone provider id; it is the Anthropic provider
    // accessed via the CLI auth method. Refresh the local Claude CLI session
    // first, then re-register that auth method with OpenClaw.
    const claudeLoginCommand = formatCliCommand("claude auth login");
    const openclawLoginCommand = formatCliCommand(
      sanitizedProfileId
        ? `openclaw models auth login --provider anthropic --method cli --profile-id ${quoteShellArg(sanitizedProfileId)}`
        : "openclaw models auth login --provider anthropic --method cli",
    );
    return `${claudeLoginCommand} && ${openclawLoginCommand}`;
  }
  return sanitizedProvider
    ? formatCliCommand(
        sanitizedProfileId
          ? `openclaw models auth login --provider ${sanitizedProvider} --profile-id ${quoteShellArg(sanitizedProfileId)}`
          : `openclaw models auth login --provider ${sanitizedProvider}`,
      )
    : formatCliCommand("openclaw models auth login");
}

/** Build operator guidance for an active profile cooldown or disable window. */
export function buildAuthProfileUnusableHint(params: {
  kind: "cooldown" | "disabled";
  reason?: AuthProfileFailureReason;
  provider: string;
  profileId: string;
}): string {
  if (
    params.reason === "auth" ||
    params.reason === "auth_permanent" ||
    params.reason === "session_expired"
  ) {
    if (params.provider === "google-gemini-cli") {
      // The legacy runtime has no auth method of its own. Recovery creates a
      // supported Google API-key profile and then selects it for that runtime.
      const command = formatCliCommand("openclaw models auth login --provider google");
      return `Gemini CLI OAuth cannot be repaired by OpenClaw. Connect Google with an AI Studio API key using ${formatOAuthRefreshFailureLoginCommandMarkdown(command)}, then select that Google profile for the Gemini CLI runtime.`;
    }
    const command = buildOAuthRefreshFailureLoginCommand(params.provider, {
      profileId: params.profileId,
    });
    return `Re-authenticate with ${formatOAuthRefreshFailureLoginCommandMarkdown(command)}.`;
  }
  if (params.kind === "disabled" && params.reason === "billing") {
    return "Top up credits (provider billing) or switch provider.";
  }
  return "Wait for cooldown or switch provider.";
}
