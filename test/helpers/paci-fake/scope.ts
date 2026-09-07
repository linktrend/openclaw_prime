/**
 * TEST ONLY — Platform PACI Phase-1 authoritative least-privilege scope rules.
 *
 * Frozen rule: reject any ungranted. Requested scopes must be an exact subset of
 * credential.serviceScopes; any ungranted value → invalid_scope.
 *
 * Omitted / empty scope → grant the full credential set.
 */

export class PaciFakeScopeError extends Error {
  readonly code = "invalid_scope" as const;
  readonly httpStatus = 400;

  constructor(message: string) {
    super(message);
    this.name = "PaciFakeScopeError";
  }
}

/** Parse a space-separated OAuth scope string into unique tokens (order preserved). */
export function parseRequestedScopes(scope: string | undefined | null): string[] {
  if (scope === undefined || scope === null) {
    return [];
  }
  const trimmed = scope.trim();
  if (!trimmed) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of trimmed.split(/\s+/u)) {
    if (!part || seen.has(part)) {
      continue;
    }
    seen.add(part);
    out.push(part);
  }
  return out;
}

/**
 * Resolve the granted service-scope set for mint.
 * Returns the authoritative granted list (never an unvalidated caller copy).
 */
export function resolveGrantedServiceScopes(options: {
  credentialServiceScopes: readonly string[];
  requestedScope?: string;
}): readonly string[] {
  const authoritative = [...options.credentialServiceScopes];
  if (authoritative.length === 0) {
    throw new PaciFakeScopeError("Credential has no serviceScopes");
  }
  const grantedSet = new Set(authoritative);
  const requested = parseRequestedScopes(options.requestedScope);

  if (requested.length === 0) {
    return authoritative;
  }

  const ungranted = requested.filter((s) => !grantedSet.has(s));
  if (ungranted.length > 0) {
    throw new PaciFakeScopeError(
      `Requested scope includes ungranted value(s): ${ungranted.join(" ")}`,
    );
  }

  return requested;
}

/** Space-separated scope string for registry / introspection (matches AuthClaims). */
export function formatScopeString(scopes: readonly string[]): string {
  return scopes.join(" ");
}
