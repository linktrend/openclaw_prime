/**
 * Cursor ACP advertises bracketed model ids; CLI --list-models uses cursor-grok-*.
 * OpenClaw Prime normalizes every Grok 4.5 request to its canonical high-fast ACP id.
 */

const CURSOR_ACP_GROK_ADVERTISED_PREFERENCE = ["grok-4.5[effort=high,fast=true]"] as const;

const CURSOR_GROK_ALIAS_TO_ADVERTISED: Record<string, readonly string[]> = {
  "cursor-grok-4.5-medium": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-medium-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-high": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-high-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-low": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "cursor-grok-4.5-low-fast": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
  "grok-4.5": CURSOR_ACP_GROK_ADVERTISED_PREFERENCE,
};

function isCursorAcpAdvertisedModelId(modelId: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\[[^\]]+\]$/i.test(modelId.trim());
}

/** Expand CLI/alias ids to ordered ACP-advertised candidates. */
function expandCursorAcpGrokModelCandidates(model: string | undefined): string[] {
  const normalized = model?.trim() ?? "";
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
  return [normalized];
}

/** Map a requested Cursor model to the best first ACP-advertised candidate. */
export function mapCursorAcpRequestedModel(model: string | undefined): string | undefined {
  const candidates = expandCursorAcpGrokModelCandidates(model);
  return candidates[0];
}
