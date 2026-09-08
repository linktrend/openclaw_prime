/**
 * Capture-text sanitization: strip secrets, truncate, drop attachments /
 * prompt bodies / chain-of-thought before any durable enqueue.
 */

/** Fields never retained in internal envelopes or remote writes. */
export const LINKBRAIN_PROHIBITED_FIELDS = Object.freeze([
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
  "skillId",
  "skillsReleaseHash",
  "skillsRunId",
  "skills_run_id",
  "telemetry",
  // Attachments / prompt bodies excluded even when nested under capture payloads.
  "attachment",
  "attachments",
  "media",
  "mediaUrl",
  "mediaUrls",
  "prompt",
  "promptBody",
  "systemPrompt",
  "developerPrompt",
] as const);

const LINKBRAIN_PROHIBITED_FIELD_SET = new Set<string>(LINKBRAIN_PROHIBITED_FIELDS);

export function isLinkbrainProhibitedField(key: string): boolean {
  return LINKBRAIN_PROHIBITED_FIELD_SET.has(key);
}

/** Max characters retained per capture event text. */
const LINKBRAIN_MAX_EVENT_TEXT_CHARS = 4_000;

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._\-+=/]{8,}/gi,
  /\b(?:api[_-]?key|access[_-]?token|secret|authorization)\s*[:=]\s*['"]?[^\s'"]+/gi,
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
];

const ATTACHMENT_KEYS = Object.freeze([
  "attachment",
  "attachments",
  "media",
  "mediaUrl",
  "mediaUrls",
  "image",
  "images",
  "file",
  "files",
  "binary",
  "dataUrl",
  "prompt",
  "promptBody",
  "systemPrompt",
  "developerPrompt",
  "messages",
  "rawMessages",
]);
const ATTACHMENT_KEY_SET = new Set<string>(ATTACHMENT_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Replace secret-shaped substrings with a canary-safe placeholder. */
function redactSecretSubstrings(text: string): string {
  let next = text;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[REDACTED]");
  }
  return next;
}

/** Truncate and secret-redact approved capture text. */
export function sanitizeCaptureText(
  text: string,
  maxChars = LINKBRAIN_MAX_EVENT_TEXT_CHARS,
): string {
  const redacted = redactSecretSubstrings(text);
  if (redacted.length <= maxChars) {
    return redacted;
  }
  return `${redacted.slice(0, maxChars)}…`;
}

/**
 * Deep-strip prohibited + attachment/prompt fields. Returns a plain object
 * suitable for inspection; never retains CoT or credential payloads.
 */
export function stripUnsafeFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeFields);
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isLinkbrainProhibitedField(key) || ATTACHMENT_KEY_SET.has(key)) {
      continue;
    }
    next[key] = stripUnsafeFields(child);
  }
  return next;
}

/** True when a payload still contains a prohibited or attachment-bearing key. */
export function containsUnsafeField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsUnsafeField);
  }
  if (!isRecord(value)) {
    return false;
  }
  for (const [key, child] of Object.entries(value)) {
    if (isLinkbrainProhibitedField(key) || ATTACHMENT_KEY_SET.has(key)) {
      return true;
    }
    if (containsUnsafeField(child)) {
      return true;
    }
  }
  return false;
}
