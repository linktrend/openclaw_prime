/**
 * Host-internal machine-token facade construction and privileged cache controls.
 *
 * Plugins must never import this module. They receive an already identity /
 * binding / domain-scoped `MachineTokenPluginFacade` from the host.
 *
 * The host owns an immutable normalized binding registry. Public acquire accepts
 * only `bindingId` (+ signal/forceRefresh); SecretRef → PEM resolution and
 * MachineTokenBinding assembly happen inside the facade.
 */
import { createHash } from "node:crypto";
import { isSecretRef, type SecretRef } from "../config/types.secrets.js";
import {
  getCachedMachineToken,
  clearMachineTokenCache as clearMachineTokenCacheCore,
} from "./machine-token-cache.js";
import {
  buildMachineTokenBindingFingerprint,
  fingerprintMachineTokenKeyRef,
} from "./machine-token-fingerprint.js";
import type {
  MachineTokenBinding,
  MachineTokenBindingHealth,
  MachineTokenKeyRefIdentity,
  MachineTokenPluginFacade,
} from "./machine-token-types.js";
import {
  invalidateMachineTokenCache as invalidateMachineTokenCacheCore,
  resolveMachineTokenAccess as resolveMachineTokenAccessCore,
} from "./machine-token.js";

/** Domain separator for ownership fingerprints — upgrades must bump this tag. */
const MACHINE_TOKEN_OWNERSHIP_DOMAIN = "machine-token-ownership-v1";

export type {
  MachineTokenBinding,
  MachineTokenBindingHealth,
  MachineTokenKeyRefIdentity,
  MachineTokenPluginFacade,
} from "./machine-token-types.js";

/**
 * Host-internal normalized binding record — no PEM.
 *
 * Public SDK types must not expose this shape; plugins never supply credential
 * material alongside an allowed bindingId.
 */
export type HostMachineTokenBindingRecord = {
  bindingId: string;
  issuerUrl: string;
  clientId: string;
  audience?: string;
  scope?: string;
  operations?: readonly string[];
  scopes?: readonly string[];
  environment?: string;
  service?: string;
  discoveryUrl?: string;
  tokenEndpoint?: string;
  /**
   * Explicit HTTPS trusted-private issuer opt-in. Fingerprinted; default unset/false.
   */
  allowPrivateNetwork?: boolean;
  /** SecretRef identity used to resolve PEM at acquire time. */
  keyRef: MachineTokenKeyRefIdentity;
  keyRefFingerprint: string;
  /** Owning plugin id (cross-plugin isolation). */
  pluginId: string;
  /** Domain partition (defaults to pluginId). */
  domain: string;
  /** Immutable fingerprint of normalized credential scope (no PEM). */
  bindingFingerprint: string;
};

/** Host-injected SecretRef → PEM resolver (closure over config/env). */
export type MachineTokenResolveKeyPem = (params: {
  bindingId: string;
  keyRef: MachineTokenKeyRefIdentity;
  signal?: AbortSignal;
}) => Promise<string>;

/** Params for host construction of a binding-scoped plugin facade. */
export type MachineTokenPluginFacadeParams = {
  /** Plugin identity that owns the granted bindings. */
  pluginId: string;
  /**
   * Normalized host-owned binding records this plugin may acquire.
   * Prefer this over bare binding ids — the registry is the credential source.
   */
  grantedRecords: readonly HostMachineTokenBindingRecord[];
  /** Host-owned SecretRef → PEM resolution (required for real mint). */
  resolveKeyPem: MachineTokenResolveKeyPem;
  /** Optional host/test injection for mint. */
  resolveAccess?: typeof resolveMachineTokenAccessCore;
  /** Optional host/test injection for per-binding invalidation. */
  invalidateCache?: typeof invalidateMachineTokenCacheCore;
  /** Optional host/test injection for cache health reads. */
  getCached?: typeof getCachedMachineToken;
};

/**
 * Opaque ownership handle for one facade generation (candidate or live).
 *
 * Cleanup and publish must target this handle — never every facade for a pluginId.
 */
export type MachineTokenFacadeGenerationHandle = {
  readonly pluginId: string;
  readonly generationId: string;
};

/** Result of building a candidate generation without publishing it live. */
export type MachineTokenFacadeGeneration = {
  readonly handle: MachineTokenFacadeGenerationHandle;
  readonly facade: MachineTokenPluginFacade;
};

type MachineTokenFacadeGenerationState = "candidate" | "live" | "retired";

type MachineTokenFacadeGenerationRecord = {
  handle: MachineTokenFacadeGenerationHandle;
  facade: MachineTokenPluginFacade;
  state: MachineTokenFacadeGenerationState;
  /**
   * Host-armed consumers (started plugin services) still holding this generation.
   * While > 0, plugin-side unregister must not retire — cache-hit reloads stop and
   * restart the same live generation.
   */
  leases: number;
  /**
   * Stable fingerprint of granted binding descriptors (no PEM). Same-ownership
   * rematerialize reuses this live generation instead of publishing a replacement
   * that would force-retire service-held facades.
   */
  ownershipFingerprint: string;
  /** Retire this generation's facade (idempotent). */
  retire: () => void;
};

/**
 * Canonical authorization tuple for one granted binding.
 *
 * Structured JSON (not delimiter-joined operator strings) so bindingId values
 * containing `=` / `,` cannot collide two grant sets into one ownership key.
 * Includes bindingId, domain partition (tenant/org when represented), endpoints,
 * keyRef identity, client, audience, scopes, environment, and bindingFingerprint.
 */
function canonicalizeMachineTokenOwnershipTuple(
  record: HostMachineTokenBindingRecord,
): readonly unknown[] {
  return [
    record.bindingId,
    record.pluginId,
    record.domain,
    record.issuerUrl,
    record.discoveryUrl ?? null,
    record.tokenEndpoint ?? null,
    record.clientId,
    record.keyRef.source,
    record.keyRef.provider,
    record.keyRef.id,
    record.keyRefFingerprint,
    record.audience ?? null,
    record.scope ?? null,
    record.operations ? [...record.operations].toSorted() : null,
    record.scopes ? [...record.scopes].toSorted() : null,
    record.environment ?? null,
    record.service ?? null,
    record.allowPrivateNetwork === true,
    record.bindingFingerprint,
  ];
}

/**
 * Total order over JSON encodings for ownership tuples.
 * UTF-8 bytewise (not localeCompare): en collation equates distinct Unicode
 * forms (e.g. NFC é vs NFD e+acute), so reversed equal-keys would change the
 * hashed fingerprint.
 */
export function compareMachineTokenCanonicalJson(left: unknown, right: unknown): number {
  return Buffer.compare(
    Buffer.from(JSON.stringify(left), "utf8"),
    Buffer.from(JSON.stringify(right), "utf8"),
  );
}

/** Per-plugin ownership fingerprint from granted binding descriptors. */
export function fingerprintMachineTokenGrantedRecords(
  grantedRecords: readonly HostMachineTokenBindingRecord[],
): string {
  // Collision-safe: sorted length-safe JSON tuples hashed under an explicit
  // version/domain separator. Delimiter joins of operator bindingId values are
  // unsafe — `a`/`FPA` + `b`/`FPB` equals one record `a=FPA,b`/`FPB`.
  const tuples = grantedRecords
    .map((record) => canonicalizeMachineTokenOwnershipTuple(record))
    .toSorted(compareMachineTokenCanonicalJson);
  return createHash("sha256")
    .update(MACHINE_TOKEN_OWNERSHIP_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(tuples), "utf8")
    .digest("hex");
}

/**
 * True when the live generation for pluginId matches these granted descriptors.
 * Used to reuse live ownership across activating rematerialize without retiring
 * facades closed over by already-started plugin services.
 */
export function liveMachineTokenOwnershipMatchesGrantedRecords(
  pluginId: string,
  grantedRecords: readonly HostMachineTokenBindingRecord[],
): boolean {
  const trimmed = pluginId.trim();
  if (!trimmed || grantedRecords.length === 0) {
    return false;
  }
  const live = liveGenerationByPluginId.get(trimmed);
  if (!live || live.state !== "live") {
    return false;
  }
  return live.ownershipFingerprint === fingerprintMachineTokenGrantedRecords(grantedRecords);
}

/**
 * Destroy only a candidate generation. No-op for live/retired — rollback and
 * abandon paths must not retire a reused live generation.
 */
export function destroyCandidateMachineTokenFacadeGeneration(
  handle: MachineTokenFacadeGenerationHandle,
): void {
  const generation = generationsById.get(handle.generationId);
  if (!generation || generation.state !== "candidate") {
    return;
  }
  destroyMachineTokenFacadeGeneration(handle);
}

/** Live generation only — pluginId → current published generation. */
const liveGenerationByPluginId = new Map<string, MachineTokenFacadeGenerationRecord>();

/** All non-GC'd generations by opaque id (candidates + live). */
const generationsById = new Map<string, MachineTokenFacadeGenerationRecord>();

let nextGenerationSeq = 0;

function allocateGenerationId(pluginId: string): string {
  nextGenerationSeq += 1;
  return `${pluginId}#${nextGenerationSeq}`;
}

function isLiveGeneration(handle: MachineTokenFacadeGenerationHandle): boolean {
  const live = liveGenerationByPluginId.get(handle.pluginId);
  return live?.handle.generationId === handle.generationId && live.state === "live";
}

function assertGrantedBinding(
  facade: Pick<MachineTokenPluginFacade, "pluginId" | "grantedBindingIds">,
  bindingId: string,
): void {
  if (!facade.grantedBindingIds.has(bindingId)) {
    throw new Error(
      `Plugin "${facade.pluginId}" is not granted machine-token binding "${bindingId}"`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return items.length > 0 ? items : undefined;
}

function normalizeKeyRef(ref: SecretRef): MachineTokenKeyRefIdentity {
  return {
    source: ref.source,
    provider: ref.provider.trim(),
    id: ref.id.trim(),
  };
}

/**
 * Build the immutable binding fingerprint for a host record (no PEM).
 */
export function buildHostMachineTokenBindingFingerprint(
  record: Omit<HostMachineTokenBindingRecord, "bindingFingerprint">,
): string {
  return buildMachineTokenBindingFingerprint({
    bindingId: record.bindingId,
    issuerUrl: record.issuerUrl,
    clientId: record.clientId,
    ...(record.audience ? { audience: record.audience } : {}),
    ...(record.scope ? { scope: record.scope } : {}),
    ...(record.operations ? { operations: record.operations } : {}),
    ...(record.scopes ? { scopes: record.scopes } : {}),
    ...(record.environment ? { environment: record.environment } : {}),
    ...(record.service ? { service: record.service } : {}),
    ...(record.discoveryUrl ? { discoveryUrl: record.discoveryUrl } : {}),
    ...(record.tokenEndpoint ? { tokenEndpoint: record.tokenEndpoint } : {}),
    ...(record.allowPrivateNetwork === true ? { allowPrivateNetwork: true } : {}),
    keyRefFingerprint: record.keyRefFingerprint,
    // Unused when keyRefFingerprint is set; required by MachineTokenBinding.
    clientAssertionKeyPem: "",
  });
}

function normalizeMachineTokenConfigRecord(params: {
  raw: Record<string, unknown>;
  pluginId: string;
  domain: string;
  environment?: string;
  service?: string;
}): HostMachineTokenBindingRecord | undefined {
  const bindingId = readOptionalNonEmptyString(params.raw.bindingId);
  const issuerUrl = readOptionalNonEmptyString(params.raw.issuerUrl);
  const clientId = readOptionalNonEmptyString(params.raw.clientId);
  if (!bindingId || !issuerUrl || !clientId || !isSecretRef(params.raw.clientAssertionKeyRef)) {
    return undefined;
  }
  const keyRef = normalizeKeyRef(params.raw.clientAssertionKeyRef);
  const keyRefFingerprint = fingerprintMachineTokenKeyRef(keyRef);
  const audience = readOptionalNonEmptyString(params.raw.audience);
  const scope = readOptionalNonEmptyString(params.raw.scope);
  const operations = readOptionalStringList(params.raw.operations);
  const scopes = readOptionalStringList(params.raw.scopes);
  const environment = readOptionalNonEmptyString(params.raw.environment) ?? params.environment;
  const service = readOptionalNonEmptyString(params.raw.service) ?? params.service;
  const discoveryUrl = readOptionalNonEmptyString(params.raw.discoveryUrl);
  const tokenEndpoint = readOptionalNonEmptyString(params.raw.tokenEndpoint);
  const allowPrivateNetwork = params.raw.allowPrivateNetwork === true ? true : undefined;
  const base = {
    bindingId,
    issuerUrl,
    clientId,
    ...(audience ? { audience } : {}),
    ...(scope ? { scope } : {}),
    ...(operations ? { operations } : {}),
    ...(scopes ? { scopes } : {}),
    ...(environment ? { environment } : {}),
    ...(service ? { service } : {}),
    ...(discoveryUrl ? { discoveryUrl } : {}),
    ...(tokenEndpoint ? { tokenEndpoint } : {}),
    ...(allowPrivateNetwork ? { allowPrivateNetwork } : {}),
    keyRef,
    keyRefFingerprint,
    pluginId: params.pluginId,
    domain: params.domain,
  };
  return {
    ...base,
    bindingFingerprint: buildHostMachineTokenBindingFingerprint(base),
  };
}

function assembleBindingFromRecord(
  record: HostMachineTokenBindingRecord,
  clientAssertionKeyPem: string,
): MachineTokenBinding {
  return {
    bindingId: record.bindingId,
    issuerUrl: record.issuerUrl,
    clientId: record.clientId,
    ...(record.audience ? { audience: record.audience } : {}),
    ...(record.scope ? { scope: record.scope } : {}),
    ...(record.operations ? { operations: record.operations } : {}),
    ...(record.scopes ? { scopes: record.scopes } : {}),
    ...(record.environment ? { environment: record.environment } : {}),
    ...(record.service ? { service: record.service } : {}),
    ...(record.discoveryUrl ? { discoveryUrl: record.discoveryUrl } : {}),
    ...(record.tokenEndpoint ? { tokenEndpoint: record.tokenEndpoint } : {}),
    ...(record.allowPrivateNetwork === true ? { allowPrivateNetwork: true } : {}),
    keyRefFingerprint: record.keyRefFingerprint,
    clientAssertionKeyPem,
  };
}

function normalizeOptionalStringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalStringListField(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .toSorted()
    .join("\0");
}

/**
 * Deep-compare a smuggled binding-like object against the registered record.
 * Any difference fails closed — plugins must not substitute credential scope.
 */
function assertSmuggledBindingMatchesRegistry(
  record: HostMachineTokenBindingRecord,
  smuggled: Record<string, unknown>,
): void {
  const mismatches: string[] = [];
  const expectString = (field: string, expected: string | undefined, actual: unknown) => {
    const got = normalizeOptionalStringField(actual);
    const want = expected ?? "";
    if (got !== want) {
      mismatches.push(field);
    }
  };
  expectString("bindingId", record.bindingId, smuggled.bindingId);
  expectString("issuerUrl", record.issuerUrl, smuggled.issuerUrl);
  expectString("clientId", record.clientId, smuggled.clientId);
  expectString("audience", record.audience, smuggled.audience);
  expectString("scope", record.scope, smuggled.scope);
  expectString("environment", record.environment, smuggled.environment);
  expectString("service", record.service, smuggled.service);
  expectString("discoveryUrl", record.discoveryUrl, smuggled.discoveryUrl);
  expectString("tokenEndpoint", record.tokenEndpoint, smuggled.tokenEndpoint);
  const wantAllowPrivate = record.allowPrivateNetwork === true;
  const gotAllowPrivate = smuggled.allowPrivateNetwork === true;
  if (wantAllowPrivate !== gotAllowPrivate) {
    mismatches.push("allowPrivateNetwork");
  }
  const wantOperations = [...(record.operations ?? [])]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .toSorted()
    .join("\0");
  if (normalizeOptionalStringListField(smuggled.operations) !== wantOperations) {
    mismatches.push("operations");
  }
  const wantScopes = [...(record.scopes ?? [])]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .toSorted()
    .join("\0");
  if (normalizeOptionalStringListField(smuggled.scopes) !== wantScopes) {
    mismatches.push("scopes");
  }
  if ("keyRefFingerprint" in smuggled) {
    expectString("keyRefFingerprint", record.keyRefFingerprint, smuggled.keyRefFingerprint);
  }
  if ("bindingFingerprint" in smuggled) {
    expectString("bindingFingerprint", record.bindingFingerprint, smuggled.bindingFingerprint);
  }
  if ("pluginId" in smuggled) {
    expectString("pluginId", record.pluginId, smuggled.pluginId);
  }
  if ("domain" in smuggled) {
    expectString("domain", record.domain, smuggled.domain);
  }
  if (isSecretRef(smuggled.keyRef) || isSecretRef(smuggled.clientAssertionKeyRef)) {
    const smuggledRef = isSecretRef(smuggled.keyRef)
      ? normalizeKeyRef(smuggled.keyRef)
      : normalizeKeyRef(smuggled.clientAssertionKeyRef as SecretRef);
    if (
      smuggledRef.source !== record.keyRef.source ||
      smuggledRef.provider !== record.keyRef.provider ||
      smuggledRef.id !== record.keyRef.id
    ) {
      mismatches.push("keyRef");
    }
  }
  // Any PEM material on a smuggled binding is forbidden — host resolves keys.
  if (
    typeof smuggled.clientAssertionKeyPem === "string" &&
    smuggled.clientAssertionKeyPem.trim().length > 0
  ) {
    mismatches.push("clientAssertionKeyPem");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Machine-token binding "${record.bindingId}" does not match the host registry (${mismatches.join(", ")} differ)`,
    );
  }
}

function freezeBindingRegistry(
  records: readonly HostMachineTokenBindingRecord[],
  pluginId: string,
): ReadonlyMap<string, HostMachineTokenBindingRecord> {
  const map = new Map<string, HostMachineTokenBindingRecord>();
  for (const record of records) {
    if (record.pluginId !== pluginId) {
      throw new Error(
        `createMachineTokenPluginFacade for plugin "${pluginId}" received foreign pluginId "${record.pluginId}" on binding "${record.bindingId}"`,
      );
    }
    const existing = map.get(record.bindingId);
    if (existing && existing.bindingFingerprint !== record.bindingFingerprint) {
      throw new Error(
        `createMachineTokenPluginFacade for plugin "${pluginId}" has conflicting records for binding "${record.bindingId}"`,
      );
    }
    // Freeze each record so callers cannot mutate registry credential scope.
    map.set(record.bindingId, Object.freeze({ ...record }));
  }
  return map;
}

/**
 * Build a candidate facade generation without changing the live generation.
 *
 * Acquire/invalidate succeed only after {@link publishMachineTokenFacadeGeneration}.
 * Failure/cancel paths must call {@link destroyMachineTokenFacadeGeneration} so
 * only this candidate is retired.
 */
export function createMachineTokenFacadeGeneration(
  params: MachineTokenPluginFacadeParams,
): MachineTokenFacadeGeneration {
  const pluginId = params.pluginId.trim();
  if (!pluginId) {
    throw new Error("createMachineTokenFacadeGeneration requires a non-empty pluginId");
  }
  if (!params.resolveKeyPem) {
    throw new Error(
      `createMachineTokenFacadeGeneration for plugin "${pluginId}" requires resolveKeyPem`,
    );
  }
  const registry = freezeBindingRegistry(params.grantedRecords, pluginId);
  if (registry.size === 0) {
    throw new Error(
      `createMachineTokenFacadeGeneration for plugin "${pluginId}" requires at least one granted binding record`,
    );
  }
  const grantedBindingIds = new Set(registry.keys());

  const resolveAccess = params.resolveAccess ?? resolveMachineTokenAccessCore;
  const invalidateCache = params.invalidateCache ?? invalidateMachineTokenCacheCore;
  const getCached = params.getCached ?? getCachedMachineToken;
  const resolveKeyPem = params.resolveKeyPem;
  const handle: MachineTokenFacadeGenerationHandle = Object.freeze({
    pluginId,
    generationId: allocateGenerationId(pluginId),
  });
  /** Last acquired binding fingerprint per operator bindingId (cache is fingerprint-keyed). */
  const fingerprintsByBindingId = new Map<string, string>();
  let retired = false;

  const assertUsable = (): void => {
    if (retired || !isLiveGeneration(handle)) {
      throw new Error(
        `Machine-token facade for plugin "${pluginId}" is unregistered; reload must create a new facade`,
      );
    }
  };

  const retireFacade = (): void => {
    if (retired) {
      return;
    }
    for (const bindingId of grantedBindingIds) {
      const fingerprint =
        fingerprintsByBindingId.get(bindingId) ?? registry.get(bindingId)?.bindingFingerprint;
      if (fingerprint) {
        invalidateCache(fingerprint);
      }
    }
    fingerprintsByBindingId.clear();
    retired = true;
  };

  const facade: MachineTokenPluginFacade = {
    pluginId,
    grantedBindingIds,
    async acquire(acquireParams) {
      assertUsable();
      const bindingId =
        typeof acquireParams.bindingId === "string" ? acquireParams.bindingId.trim() : "";
      if (!bindingId) {
        throw new Error(
          `Machine-token facade for plugin "${pluginId}" requires a non-empty bindingId`,
        );
      }
      assertGrantedBinding(facade, bindingId);
      const record = registry.get(bindingId);
      if (!record) {
        throw new Error(
          `Plugin "${pluginId}" has no host registry record for machine-token binding "${bindingId}"`,
        );
      }
      // Compat/smuggle guard: if a caller still passes a binding object, every
      // normalized field must match the registry. Credential material is never
      // taken from the smuggled object.
      const smuggled = (acquireParams as { binding?: unknown }).binding;
      if (smuggled !== undefined) {
        if (!isRecord(smuggled)) {
          throw new Error(
            `Machine-token binding "${bindingId}" smuggled binding must be an object matching the host registry`,
          );
        }
        assertSmuggledBindingMatchesRegistry(record, smuggled);
      }

      const pem = await resolveKeyPem({
        bindingId: record.bindingId,
        keyRef: record.keyRef,
        ...(acquireParams.signal ? { signal: acquireParams.signal } : {}),
      });
      if (typeof pem !== "string" || pem.trim().length === 0) {
        throw new Error(`Machine-token binding "${bindingId}" key SecretRef resolved to empty PEM`);
      }
      const binding = assembleBindingFromRecord(record, pem);
      // Public facade deliberately omits fetchFn/now. Even if a caller smuggles
      // those keys at runtime, only binding/signal/forceRefresh reach resolveAccess.
      // Re-check live ownership after await so a concurrent publish/retire wins.
      assertUsable();
      const resolved = await resolveAccess({
        binding,
        ...(acquireParams.signal ? { signal: acquireParams.signal } : {}),
        ...(acquireParams.forceRefresh !== undefined
          ? { forceRefresh: acquireParams.forceRefresh }
          : {}),
      });
      assertUsable();
      const fingerprint =
        resolved.bindingFingerprint ??
        record.bindingFingerprint ??
        buildMachineTokenBindingFingerprint(binding);
      fingerprintsByBindingId.set(bindingId, fingerprint);
      return resolved;
    },
    invalidate(bindingId) {
      assertUsable();
      assertGrantedBinding(facade, bindingId);
      const fingerprint =
        fingerprintsByBindingId.get(bindingId) ?? registry.get(bindingId)?.bindingFingerprint;
      if (fingerprint) {
        invalidateCache(fingerprint);
        fingerprintsByBindingId.delete(bindingId);
      }
    },
    health(bindingId): MachineTokenBindingHealth {
      const granted = grantedBindingIds.has(bindingId);
      const live = !retired && isLiveGeneration(handle);
      const fingerprint =
        fingerprintsByBindingId.get(bindingId) ?? registry.get(bindingId)?.bindingFingerprint;
      const cachedEntry = granted && live && fingerprint ? getCached(fingerprint) : undefined;
      return {
        pluginId,
        bindingId,
        granted,
        registered: live,
        cached: Boolean(cachedEntry),
        ...(cachedEntry ? { expiresAt: cachedEntry.expiresAt } : {}),
      };
    },
    unregister() {
      // Plugin-side release. Host leases protect a still-needed live generation
      // across cache-hit service stop/restart; without a lease this remains the
      // authoritative teardown for standalone/test embeddings.
      releaseMachineTokenFacadeGeneration(handle);
    },
  };

  const record: MachineTokenFacadeGenerationRecord = {
    handle,
    facade,
    state: "candidate",
    leases: 0,
    ownershipFingerprint: fingerprintMachineTokenGrantedRecords(params.grantedRecords),
    retire: retireFacade,
  };
  generationsById.set(handle.generationId, record);
  return { handle, facade };
}

/**
 * Plugin-side release for one generation (service.stop / unload).
 *
 * No-op while the host holds a lease so a duplicate or stale stop cannot retire
 * a live facade a reused registry still needs. With no lease, retires exactly
 * this generation (standalone embeddings and tests).
 */
export function releaseMachineTokenFacadeGeneration(
  handle: MachineTokenFacadeGenerationHandle,
): void {
  const generation = generationsById.get(handle.generationId);
  if (!generation || generation.state === "retired") {
    return;
  }
  if (generation.leases > 0) {
    return;
  }
  destroyMachineTokenFacadeGeneration(handle);
}

/**
 * Host-owned lease on a plugin's live generation, taken when a plugin service
 * starts. Returns a single-use release; the lease closes over this record so a
 * later replacement generation is never touched. Does not retire on release —
 * owner force-retire is publish / destroy / unregisterMachineTokenFacadesForPlugin.
 */
export function acquireMachineTokenFacadeLeaseForPlugin(pluginId: string): () => void {
  const trimmed = pluginId.trim();
  if (!trimmed) {
    return () => undefined;
  }
  const live = liveGenerationByPluginId.get(trimmed);
  if (!live || live.state !== "live") {
    return () => undefined;
  }
  live.leases += 1;
  let done = false;
  return () => {
    if (done) {
      return;
    }
    done = true;
    if (live.leases > 0) {
      live.leases -= 1;
    }
  };
}

/**
 * Atomically publish a candidate as the live generation for its plugin.
 *
 * Retires only the prior live generation (if any). Idempotent when the handle
 * is already live. No-op when the generation was already destroyed/retired.
 */
export function publishMachineTokenFacadeGeneration(
  handle: MachineTokenFacadeGenerationHandle,
): void {
  const generation = generationsById.get(handle.generationId);
  if (!generation || generation.state === "retired") {
    return;
  }
  if (generation.handle.pluginId !== handle.pluginId) {
    throw new Error(
      `Machine-token generation handle pluginId mismatch for "${handle.generationId}"`,
    );
  }
  if (generation.state === "live" && isLiveGeneration(handle)) {
    return;
  }

  const prior = liveGenerationByPluginId.get(handle.pluginId);
  // Swap the live pointer before retiring prior so both generations never mint.
  liveGenerationByPluginId.set(handle.pluginId, generation);
  generation.state = "live";

  if (prior && prior.handle.generationId !== handle.generationId) {
    prior.state = "retired";
    generationsById.delete(prior.handle.generationId);
    prior.retire();
  }
}

/**
 * Destroy exactly one generation (candidate or live).
 *
 * Idempotent. A stale cleanup for an old generation must not remove a newer
 * live replacement — only the matching live pointer is cleared.
 */
export function destroyMachineTokenFacadeGeneration(
  handle: MachineTokenFacadeGenerationHandle,
): void {
  const generation = generationsById.get(handle.generationId);
  if (!generation || generation.state === "retired") {
    return;
  }
  if (generation.state === "live") {
    const live = liveGenerationByPluginId.get(handle.pluginId);
    if (live?.handle.generationId === handle.generationId) {
      liveGenerationByPluginId.delete(handle.pluginId);
    }
  }
  // Owner force-retire ignores outstanding leases (reload commit / shutdown).
  generation.leases = 0;
  generation.state = "retired";
  generationsById.delete(handle.generationId);
  generation.retire();
}

/**
 * Create a binding-scoped machine-token facade for one plugin and publish it live.
 *
 * Host/runtime only. Prefer {@link createMachineTokenFacadeGeneration} +
 * publish/destroy for registration/reload two-phase replacement. Plugins
 * receive the resulting facade; they must not call this constructor.
 */
export function createMachineTokenPluginFacade(
  params: MachineTokenPluginFacadeParams,
): MachineTokenPluginFacade {
  const created = createMachineTokenFacadeGeneration(params);
  publishMachineTokenFacadeGeneration(created.handle);
  return created.facade;
}

/**
 * Unregister the live facade generation for one plugin (stop/deactivate/unload).
 *
 * Generation-scoped: does not destroy an unrelated candidate that failed to
 * become live under a different handle path — callers that own candidates must
 * {@link destroyMachineTokenFacadeGeneration}. Does **not** call
 * `clearMachineTokenCacheForHost` — other plugins' cache entries stay intact.
 */
export function unregisterMachineTokenFacadesForPlugin(pluginId: string): void {
  const trimmed = pluginId.trim();
  if (!trimmed) {
    return;
  }
  const live = liveGenerationByPluginId.get(trimmed);
  if (live) {
    destroyMachineTokenFacadeGeneration(live.handle);
  }
}

/**
 * Host/test helper: return the live generation facade for a plugin, if any.
 */
export function getLiveMachineTokenPluginFacade(
  pluginId: string,
): MachineTokenPluginFacade | undefined {
  const trimmed = pluginId.trim();
  if (!trimmed) {
    return undefined;
  }
  return liveGenerationByPluginId.get(trimmed)?.facade;
}

/**
 * Host/test helper: return the live generation handle for a plugin, if any.
 */
export function getLiveMachineTokenFacadeGenerationHandle(
  pluginId: string,
): MachineTokenFacadeGenerationHandle | undefined {
  const trimmed = pluginId.trim();
  if (!trimmed) {
    return undefined;
  }
  return liveGenerationByPluginId.get(trimmed)?.handle;
}

/**
 * Host/test helper: exact candidate vs live generation counts for leak proofs.
 *
 * Retired generations are removed from the tracking maps and are not counted.
 */
export function countMachineTokenFacadeGenerations(): {
  candidate: number;
  live: number;
  total: number;
} {
  let candidate = 0;
  let live = 0;
  for (const generation of generationsById.values()) {
    if (generation.state === "candidate") {
      candidate += 1;
    } else if (generation.state === "live") {
      live += 1;
    }
  }
  return { candidate, live, total: generationsById.size };
}

/**
 * Host/test helper: plugin ids that currently own a live facade generation.
 */
export function listLiveMachineTokenFacadePluginIds(): string[] {
  return [...liveGenerationByPluginId.keys()].toSorted();
}

/**
 * Commit the machine-token half of a combined runtime ownership snapshot.
 *
 * Publishes staged candidate handles, then retires any live generation that is
 * outside the keep-set and inside the reconcile scope. Synchronous and
 * intended to run only after the replacement plugin registry is activated so a
 * failed activation cannot retire predecessors.
 */
export function commitMachineTokenOwnershipSnapshot(params: {
  publish: readonly MachineTokenFacadeGenerationHandle[];
  /**
   * `"full"` retires every live generation not published in this commit.
   * A set retires only plugin ids inside that scope (scoped onlyPluginIds loads).
   */
  reconcileScope: "full" | ReadonlySet<string>;
}): void {
  const keep = new Set<string>();
  for (const handle of params.publish) {
    keep.add(handle.pluginId);
    publishMachineTokenFacadeGeneration(handle);
  }
  for (const pluginId of listLiveMachineTokenFacadePluginIds()) {
    if (keep.has(pluginId)) {
      continue;
    }
    if (params.reconcileScope === "full" || params.reconcileScope.has(pluginId)) {
      unregisterMachineTokenFacadesForPlugin(pluginId);
    }
  }
}

/**
 * Collect full host-owned binding records the host may grant to a plugin from
 * pluginConfig.machineToken plus that plugin's managed MCP server machineToken
 * bindings. Incomplete blocks (missing issuer/client/keyRef) are omitted.
 */
export function collectGrantedMachineTokenBindingRecords(params: {
  pluginId: string;
  pluginConfig?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
}): HostMachineTokenBindingRecord[] {
  const pluginId = params.pluginId.trim();
  if (!pluginId) {
    return [];
  }
  const domain = pluginId;
  const pluginConfig = params.pluginConfig;
  const environment = readOptionalNonEmptyString(pluginConfig?.environment);
  const byId = new Map<string, HostMachineTokenBindingRecord>();

  const upsert = (record: HostMachineTokenBindingRecord | undefined) => {
    if (!record) {
      return;
    }
    const existing = byId.get(record.bindingId);
    if (existing && existing.bindingFingerprint !== record.bindingFingerprint) {
      // Conflicting credential scope for the same id — fail closed by dropping both.
      byId.delete(record.bindingId);
      return;
    }
    byId.set(record.bindingId, record);
  };

  const pluginMachineToken = pluginConfig?.machineToken;
  if (isRecord(pluginMachineToken)) {
    upsert(
      normalizeMachineTokenConfigRecord({
        raw: pluginMachineToken,
        pluginId,
        domain,
        ...(environment ? { environment } : {}),
        service: pluginId,
      }),
    );
  }

  const configuredServerName =
    typeof pluginConfig?.mcpServerName === "string" ? pluginConfig.mcpServerName.trim() : "";
  const serverNames = new Set<string>();
  if (configuredServerName) {
    serverNames.add(configuredServerName);
  }
  serverNames.add(pluginId);

  const mcpServers = params.mcpServers;
  if (mcpServers) {
    for (const serverName of serverNames) {
      const entry = mcpServers[serverName];
      if (!isRecord(entry) || entry.auth !== "machine_token") {
        continue;
      }
      const serverToken = entry.machineToken;
      if (!isRecord(serverToken)) {
        continue;
      }
      upsert(
        normalizeMachineTokenConfigRecord({
          raw: serverToken,
          pluginId,
          domain,
          ...(environment ? { environment } : {}),
          service: pluginId,
        }),
      );
    }
  }

  return [...byId.values()];
}

/**
 * Collect binding ids the host may grant to a plugin from pluginConfig plus
 * that plugin's managed MCP server `machine_token` bindings.
 *
 * Prefer {@link collectGrantedMachineTokenBindingRecords} when constructing
 * facades — ids alone are insufficient for immutable credential scope.
 */
export function collectGrantedMachineTokenBindingIds(params: {
  pluginId: string;
  pluginConfig?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
}): string[] {
  return collectGrantedMachineTokenBindingRecords(params).map((record) => record.bindingId);
}

/**
 * Host/test helper: mint an access token without plugin binding grants.
 * Plugins must use an injected `MachineTokenPluginFacade` instead.
 */
export const resolveMachineTokenAccessForHost = resolveMachineTokenAccessCore;

/**
 * Host/test helper: invalidate one binding cache entry without grant checks.
 * Plugins must use facade.invalidate instead.
 */
export const invalidateMachineTokenCacheForHost = invalidateMachineTokenCacheCore;

/**
 * Host/test helper: clear every process-memory machine-token cache entry.
 * Never expose this to plugins.
 */
export const clearMachineTokenCacheForHost = clearMachineTokenCacheCore;
