/**
 * Cursor ACP advertises bracketed model ids (e.g. grok-4.5[effort=high,fast=true]),
 * while Cursor CLI --list-models uses catalog ids (cursor-grok-4.5-medium).
 * acpx validates sessionOptions.model against the ACP advertisement, so OpenClaw
 * must request advertised ids (or aliases that expand to them).
 *
 * OpenClaw Prime's Cursor policy uses grok-4.5[effort=high,fast=true]. Normalize
 * every Grok 4.5 alias/variant to that canonical ACP id before session creation.
 */

/** Canonical Cursor ACP Grok policy id. */
const CURSOR_ACP_GROK_ADVERTISED_PREFERENCE = ["grok-4.5[effort=high,fast=true]"] as const;

const CURSOR_GROK_ALIAS_TO_ADVERTISED: Record<string, readonly string[]> = {
  // CLI/catalog aliases map to the canonical ACP session id.
  "cursor-grok-4.5-medium": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-medium-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-high": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-high-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-low": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-low-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  // Bare family name must never be passed to set_config_option (ACP -32602).
  "grok-4.5": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
};

function normalizeModelId(raw: string): string {
  return raw.trim();
}

/** True when the id looks like a Cursor ACP advertised bracketed model. */
function isCursorAcpAdvertisedModelId(modelId: string): boolean {
  const normalized = normalizeModelId(modelId);
  return /^[a-z0-9][a-z0-9._-]*\[[^\]]+\]$/i.test(normalized);
}

/**
 * Expand a requested Cursor/Grok model (CLI catalog alias or advertised id)
 * into an ordered list of ACP-advertised candidates to try.
 *
 * Bracketed Grok variants also remap to high-fast so configuration and older
 * prompts cannot silently override the fork's Cursor model policy.
 */
export function expandCursorAcpGrokModelCandidates(model: string | undefined): string[] {
  const normalized = normalizeModelId(model ?? "");
  if (!normalized) {
    return [...CURSOR_ACP_GROK_ADVERTISED_PREFERENCE];
  }
  const lower = normalized.toLowerCase();
  if (lower.startsWith("grok-4.5[")) {
    return [...CURSOR_ACP_GROK_ADVERTISED_PREFERENCE];
  }
  if (isCursorAcpAdvertisedModelId(normalized)) {
    return [normalized];
  }
  const aliased = CURSOR_GROK_ALIAS_TO_ADVERTISED[lower];
  if (aliased) {
    return [...aliased];
  }
  // Unknown id: keep as-is so callers still see a clear advertise error.
  return [normalized];
}

/**
 * Default harness candidate chain for Cursor ACP coding.
 * Uses the canonical ACP form so aliases and stale config cannot change the first attempt.
 */
export function resolveCursorAcpGrokHarnessCandidates(): string[] {
  return [...CURSOR_ACP_GROK_ADVERTISED_PREFERENCE];
}
