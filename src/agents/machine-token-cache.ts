/**
 * Process-memory cache for resolved machine-token access credentials.
 *
 * Keyed by immutable binding fingerprint (not operator bindingId labels).
 * Early renewal when remaining TTL < 20% of total lifetime.
 * Never persists to disk or SQLite.
 */
import type { ResolvedMachineToken } from "./machine-token-types.js";

/** Renew when remaining lifetime falls below this fraction of total TTL. */
export const MACHINE_TOKEN_EARLY_RENEWAL_REMAINING_FRACTION = 0.2;

export type CachedMachineToken = ResolvedMachineToken & {
  /** When the token was minted (ms epoch); used for early-renewal math. */
  issuedAt: number;
};

const cache = new Map<string, CachedMachineToken>();

export function getCachedMachineToken(bindingFingerprint: string): CachedMachineToken | undefined {
  return cache.get(bindingFingerprint);
}

export function setCachedMachineToken(entry: CachedMachineToken): void {
  cache.set(entry.bindingFingerprint, entry);
}

export function deleteCachedMachineToken(bindingFingerprint: string): void {
  cache.delete(bindingFingerprint);
}

/** Drop every process-memory machine-token entry (tests / process teardown). */
export function clearMachineTokenCache(): void {
  cache.clear();
}

/**
 * True when the cached token is still usable without early renewal.
 *
 * Remaining TTL must be at least 20% of the original lifetime.
 */
export function isCachedMachineTokenFresh(entry: CachedMachineToken, nowMs: number): boolean {
  const remainingMs = entry.expiresAt - nowMs;
  if (remainingMs <= 0) {
    return false;
  }
  const totalMs = entry.expiresAt - entry.issuedAt;
  if (totalMs <= 0) {
    return false;
  }
  return remainingMs >= totalMs * MACHINE_TOKEN_EARLY_RENEWAL_REMAINING_FRACTION;
}
