// Host-owned machine-token facade: immutable registry, grants, isolation, smuggle reject.
import { describe, expect, it, vi } from "vitest";
import {
  buildMachineTokenBindingFingerprint,
  fingerprintMachineTokenKeyRef,
} from "./machine-token-fingerprint.js";
import {
  acquireMachineTokenFacadeLeaseForPlugin,
  buildHostMachineTokenBindingFingerprint,
  clearMachineTokenCacheForHost,
  collectGrantedMachineTokenBindingIds,
  collectGrantedMachineTokenBindingRecords,
  createMachineTokenFacadeGeneration,
  createMachineTokenPluginFacade,
  destroyCandidateMachineTokenFacadeGeneration,
  destroyMachineTokenFacadeGeneration,
  fingerprintMachineTokenGrantedRecords,
  getLiveMachineTokenFacadeGenerationHandle,
  invalidateMachineTokenCacheForHost,
  liveMachineTokenOwnershipMatchesGrantedRecords,
  publishMachineTokenFacadeGeneration,
  resolveMachineTokenAccessForHost,
  unregisterMachineTokenFacadesForPlugin,
  type HostMachineTokenBindingRecord,
  type MachineTokenKeyRefIdentity,
} from "./machine-token-host.js";
import type { MachineTokenBinding } from "./machine-token-types.js";

const KEY_REF: MachineTokenKeyRefIdentity = {
  source: "env",
  provider: "default",
  id: "LINKTREND_BRAIN_ASSERTION_PEM",
};

function invalidationFingerprint(value: string | MachineTokenBinding): string {
  return typeof value === "string" ? value : buildMachineTokenBindingFingerprint(value);
}

function record(
  bindingId: string,
  overrides: Partial<HostMachineTokenBindingRecord> = {},
): HostMachineTokenBindingRecord {
  const keyRef = overrides.keyRef ?? {
    ...KEY_REF,
    id: `${bindingId.toUpperCase().replace(/-/gu, "_")}_PEM`,
  };
  const keyRefFingerprint = overrides.keyRefFingerprint ?? fingerprintMachineTokenKeyRef(keyRef);
  const pluginId = overrides.pluginId ?? "linkbrain";
  const base = {
    bindingId,
    issuerUrl: overrides.issuerUrl ?? "https://issuer.example.test",
    clientId: overrides.clientId ?? `${bindingId}-client`,
    ...(overrides.audience !== undefined ? { audience: overrides.audience } : {}),
    ...(overrides.scope !== undefined ? { scope: overrides.scope } : {}),
    ...(overrides.operations !== undefined ? { operations: overrides.operations } : {}),
    ...(overrides.scopes !== undefined ? { scopes: overrides.scopes } : {}),
    ...(overrides.environment !== undefined ? { environment: overrides.environment } : {}),
    ...(overrides.service !== undefined ? { service: overrides.service } : {}),
    ...(overrides.discoveryUrl !== undefined ? { discoveryUrl: overrides.discoveryUrl } : {}),
    ...(overrides.tokenEndpoint !== undefined ? { tokenEndpoint: overrides.tokenEndpoint } : {}),
    keyRef,
    keyRefFingerprint,
    pluginId,
    domain: overrides.domain ?? pluginId,
  };
  return {
    ...base,
    bindingFingerprint:
      overrides.bindingFingerprint ?? buildHostMachineTokenBindingFingerprint(base),
  };
}

function resolveKeyPemStub() {
  return async ({ bindingId }: { bindingId: string }) => `PEM-${bindingId}`;
}

describe("agents machine-token-host", () => {
  it("exposes privileged construction and host cache controls", () => {
    expect(createMachineTokenPluginFacade).toBeTypeOf("function");
    expect(resolveMachineTokenAccessForHost).toBeTypeOf("function");
    expect(invalidateMachineTokenCacheForHost).toBeTypeOf("function");
    expect(clearMachineTokenCacheForHost).toBeTypeOf("function");
  });

  it("acquires only granted bindings and rejects foreign domains", async () => {
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.bindingId}`,
      accessToken: `token-${binding.bindingId}`,
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });

    const acquired = await facade.acquire({ bindingId: "linkbrain-stage" });
    expect(acquired.accessToken).toBe("token-linkbrain-stage");
    expect(resolveAccess).toHaveBeenCalledOnce();
    expect(resolveAccess.mock.calls[0]?.[0].binding.clientAssertionKeyPem).toBe(
      "PEM-linkbrain-stage",
    );

    await expect(facade.acquire({ bindingId: "linkskills-stage" })).rejects.toThrow(
      /not granted machine-token binding "linkskills-stage"/,
    );
    expect(() => facade.invalidate("linkskills-stage")).toThrow(
      /not granted machine-token binding "linkskills-stage"/,
    );
  });

  it("isolates invalidate and health across independent plugin facades", async () => {
    const invalidated: string[] = [];
    const cache = new Map<string, { expiresAt: number }>();
    const resolveAccess = vi.fn(async ({ binding }) => {
      const fingerprint = `fp-${binding.bindingId}`;
      const resolved = {
        bindingId: binding.bindingId,
        bindingFingerprint: fingerprint,
        accessToken: `token-${binding.bindingId}`,
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      };
      cache.set(fingerprint, { expiresAt: resolved.expiresAt });
      return resolved;
    });
    const brain = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { pluginId: "linkbrain" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        const cacheKey = invalidationFingerprint(fingerprint);
        invalidated.push(cacheKey);
        cache.delete(cacheKey);
      },
      getCached: (fingerprint) => {
        const entry = cache.get(fingerprint);
        return entry
          ? {
              bindingId: "linkbrain-stage",
              bindingFingerprint: fingerprint,
              accessToken: "redacted-should-not-surface",
              expiresAt: entry.expiresAt,
              tokenType: "Bearer",
              issuedAt: Date.now(),
            }
          : undefined;
      },
    });
    const skills = createMachineTokenPluginFacade({
      pluginId: "linkskills",
      grantedRecords: [record("linkskills-stage", { pluginId: "linkskills" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        const cacheKey = invalidationFingerprint(fingerprint);
        invalidated.push(cacheKey);
        cache.delete(cacheKey);
      },
      getCached: (fingerprint) => {
        const entry = cache.get(fingerprint);
        return entry
          ? {
              bindingId: "linkskills-stage",
              bindingFingerprint: fingerprint,
              accessToken: "redacted-should-not-surface",
              expiresAt: entry.expiresAt,
              tokenType: "Bearer",
              issuedAt: Date.now(),
            }
          : undefined;
      },
    });

    await brain.acquire({ bindingId: "linkbrain-stage" });
    await skills.acquire({ bindingId: "linkskills-stage" });

    brain.invalidate("linkbrain-stage");
    expect(invalidated).toEqual(["fp-linkbrain-stage"]);
    expect(brain.health("linkbrain-stage")).toMatchObject({
      pluginId: "linkbrain",
      granted: true,
      registered: true,
      cached: false,
    });
    expect(skills.health("linkskills-stage")).toMatchObject({
      pluginId: "linkskills",
      granted: true,
      cached: true,
    });
    expect(JSON.stringify(brain.health("linkbrain-stage"))).not.toContain(
      "redacted-should-not-surface",
    );
    expect(brain.health("linkskills-stage").granted).toBe(false);
  });

  it("unregister invalidates granted bindings and fail-closes later use", async () => {
    const invalidated: string[] = [];
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.bindingId}`,
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        invalidated.push(invalidationFingerprint(fingerprint));
      },
    });

    await facade.acquire({ bindingId: "linkbrain-stage" });
    facade.unregister();
    expect(invalidated).toEqual(["fp-linkbrain-stage"]);
    expect(facade.health("linkbrain-stage").registered).toBe(false);
    await expect(facade.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(/unregistered/);
    expect(() => facade.invalidate("linkbrain-stage")).toThrow(/unregistered/);
  });

  it("host lease blocks plugin unregister from retiring a still-needed live generation", async () => {
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess: async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }),
    });
    const generationId = getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId;
    expect(generationId).toBeTruthy();

    const releaseLease = acquireMachineTokenFacadeLeaseForPlugin("linkbrain");
    facade.unregister();
    facade.unregister();
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(generationId);
    expect(facade.health("linkbrain-stage").registered).toBe(true);
    await expect(facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token",
    });

    releaseLease();
    releaseLease();
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(generationId);
    expect(facade.health("linkbrain-stage").registered).toBe(true);
    await expect(facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token",
    });

    facade.unregister();
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")).toBeUndefined();
    expect(facade.health("linkbrain-stage").registered).toBe(false);
  });

  it("ownership match includes bindingId so label renames force replacement", () => {
    const stage = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess: async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }),
    });
    publishMachineTokenFacadeGeneration(stage.handle);
    expect(
      liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [record("linkbrain-stage")]),
    ).toBe(true);
    expect(
      liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [record("linkbrain-retained")]),
    ).toBe(false);
    destroyCandidateMachineTokenFacadeGeneration(stage.handle);
    unregisterMachineTokenFacadesForPlugin("linkbrain");
  });

  describe("ownership fingerprint collision safety", () => {
    function legacyDelimiterOwnershipFingerprint(
      grantedRecords: readonly HostMachineTokenBindingRecord[],
    ): string {
      return grantedRecords
        .map((entry) => `${entry.bindingId}=${entry.bindingFingerprint}`)
        .toSorted()
        .join(",");
    }

    function publishOwnership(grantedRecords: readonly HostMachineTokenBindingRecord[]) {
      const generation = createMachineTokenFacadeGeneration({
        pluginId: "linkbrain",
        grantedRecords,
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess: async ({ binding }) => ({
          bindingId: binding.bindingId,
          bindingFingerprint: `fp-${binding.bindingId}`,
          accessToken: "token",
          expiresAt: Date.now() + 60_000,
          tokenType: "Bearer" as const,
        }),
      });
      publishMachineTokenFacadeGeneration(generation.handle);
      return generation;
    }

    it("rejects delimiter-collision grant sets that the legacy join would equate", () => {
      // Legacy join: a/FPA + b/FPB → "a=FPA,b=FPB" equals one record bindingId "a=FPA,b" / FPB.
      const twoGrants = [
        record("a", {
          bindingFingerprint: "FPA",
          clientId: "client-a",
          issuerUrl: "https://a.example.test",
        }),
        record("b", {
          bindingFingerprint: "FPB",
          clientId: "client-b",
          issuerUrl: "https://b.example.test",
        }),
      ];
      const collidingSingle = [
        record("a=FPA,b", {
          bindingFingerprint: "FPB",
          clientId: "client-colliding",
          issuerUrl: "https://colliding.example.test",
        }),
      ];
      expect(legacyDelimiterOwnershipFingerprint(twoGrants)).toBe(
        legacyDelimiterOwnershipFingerprint(collidingSingle),
      );
      expect(fingerprintMachineTokenGrantedRecords(twoGrants)).not.toBe(
        fingerprintMachineTokenGrantedRecords(collidingSingle),
      );

      const live = publishOwnership(twoGrants);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", twoGrants)).toBe(true);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", collidingSingle)).toBe(
        false,
      );
      unregisterMachineTokenFacadesForPlugin("linkbrain");
      destroyCandidateMachineTokenFacadeGeneration(live.handle);
    });

    it("preserves same-owner exact reuse and ignores grant reorder", () => {
      const first = record("alpha", { clientId: "client-alpha" });
      const second = record("beta", { clientId: "client-beta" });
      const live = publishOwnership([first, second]);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [first, second])).toBe(
        true,
      );
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [second, first])).toBe(
        true,
      );
      expect(fingerprintMachineTokenGrantedRecords([first, second])).toBe(
        fingerprintMachineTokenGrantedRecords([second, first]),
      );
      unregisterMachineTokenFacadesForPlugin("linkbrain");
      destroyCandidateMachineTokenFacadeGeneration(live.handle);
    });

    it("keeps ownership fingerprints stable across Unicode bindingId reorder", () => {
      // localeCompare("en") equates NFC é and NFD e+acute (returns 0). Distinct
      // code-unit IDs with otherwise-identical authorization tuples must still
      // sort under a total order so reversed input cannot change the hash.
      const nfcBindingId = "\u00e9";
      const nfdBindingId = "e\u0301";
      expect(nfcBindingId.localeCompare(nfdBindingId, "en")).toBe(0);
      expect(String(nfcBindingId) === String(nfdBindingId)).toBe(false);

      const sharedKeyRef: MachineTokenKeyRefIdentity = {
        source: "env",
        provider: "default",
        id: "SHARED_UNICODE_PEM",
      };
      const shared = {
        pluginId: "linkbrain",
        domain: "shared-domain",
        clientId: "client-shared",
        issuerUrl: "https://issuer.example.test",
        bindingFingerprint: "FP-SHARED",
        keyRef: sharedKeyRef,
        keyRefFingerprint: fingerprintMachineTokenKeyRef(sharedKeyRef),
      } as const;
      const nfc = record(nfcBindingId, shared);
      const nfd = record(nfdBindingId, shared);

      expect(fingerprintMachineTokenGrantedRecords([nfc, nfd])).toBe(
        fingerprintMachineTokenGrantedRecords([nfd, nfc]),
      );
      expect(fingerprintMachineTokenGrantedRecords([nfc])).not.toBe(
        fingerprintMachineTokenGrantedRecords([nfd]),
      );

      const live = publishOwnership([nfc, nfd]);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [nfd, nfc])).toBe(true);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [nfc])).toBe(false);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [nfd])).toBe(false);
      unregisterMachineTokenFacadesForPlugin("linkbrain");
      destroyCandidateMachineTokenFacadeGeneration(live.handle);
    });

    it("forces replacement on binding add/remove and authorization field changes", () => {
      const base = record("linkbrain-stage", {
        clientId: "client-v1",
        audience: "aud-v1",
        scope: "read",
        environment: "stage",
        domain: "tenant-a",
        issuerUrl: "https://issuer-v1.example.test",
        tokenEndpoint: "https://issuer-v1.example.test/token",
        keyRef: { source: "env", provider: "default", id: "KEY_V1" },
      });
      const live = publishOwnership([base]);
      expect(liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", [base])).toBe(true);

      const cases: Array<{ label: string; next: HostMachineTokenBindingRecord[] }> = [
        { label: "binding-add", next: [base, record("linkbrain-extra")] },
        { label: "binding-remove", next: [] },
        {
          label: "tenant-domain",
          next: [record("linkbrain-stage", { ...base, domain: "tenant-b" })],
        },
        {
          label: "endpoint",
          next: [
            record("linkbrain-stage", {
              ...base,
              issuerUrl: "https://issuer-v2.example.test",
              tokenEndpoint: "https://issuer-v2.example.test/token",
            }),
          ],
        },
        {
          label: "keyRef",
          next: [
            record("linkbrain-stage", {
              ...base,
              keyRef: { source: "env", provider: "default", id: "KEY_V2" },
            }),
          ],
        },
        {
          label: "client",
          next: [record("linkbrain-stage", { ...base, clientId: "client-v2" })],
        },
        {
          label: "audience",
          next: [record("linkbrain-stage", { ...base, audience: "aud-v2" })],
        },
        {
          label: "scope",
          next: [record("linkbrain-stage", { ...base, scope: "write" })],
        },
        {
          label: "environment",
          next: [record("linkbrain-stage", { ...base, environment: "prod" })],
        },
      ];

      for (const entry of cases) {
        expect(
          liveMachineTokenOwnershipMatchesGrantedRecords("linkbrain", entry.next),
          entry.label,
        ).toBe(false);
        if (entry.next.length > 0) {
          expect(fingerprintMachineTokenGrantedRecords([base]), entry.label).not.toBe(
            fingerprintMachineTokenGrantedRecords(entry.next),
          );
        }
      }

      unregisterMachineTokenFacadesForPlugin("linkbrain");
      destroyCandidateMachineTokenFacadeGeneration(live.handle);
    });
  });

  it("lease release after a newer publish leaves the replacement live", async () => {
    const first = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess: async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "v1",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }),
    });
    publishMachineTokenFacadeGeneration(first.handle);
    const releaseFirst = acquireMachineTokenFacadeLeaseForPlugin("linkbrain");

    const second = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess: async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "v2",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }),
    });
    publishMachineTokenFacadeGeneration(second.handle);
    expect(first.facade.health("linkbrain-stage").registered).toBe(false);

    releaseFirst();
    first.facade.unregister();
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(
      second.handle.generationId,
    );
    expect(second.facade.health("linkbrain-stage").registered).toBe(true);
    destroyMachineTokenFacadeGeneration(second.handle);
  });

  it("rejects empty pluginId or empty grants at construction", () => {
    expect(() =>
      createMachineTokenPluginFacade({
        pluginId: " ",
        grantedRecords: [record("a")],
        resolveKeyPem: resolveKeyPemStub(),
      }),
    ).toThrow(/non-empty pluginId/);
    expect(() =>
      createMachineTokenPluginFacade({
        pluginId: "linkbrain",
        grantedRecords: [],
        resolveKeyPem: resolveKeyPemStub(),
      }),
    ).toThrow(/at least one granted binding record/);
  });

  it("ignores smuggled fetchFn/now on public facade acquire", async () => {
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.bindingId}`,
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const granted = record("linkbrain-stage");
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [granted],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    const fetchFn = vi.fn(async () => new Response("bypass"));
    const now = vi.fn(() => 1_700_000_000_000);

    await facade.acquire({
      bindingId: "linkbrain-stage",
      // Runtime smuggle: public types omit these keys; host must still drop them.
      fetchFn,
      now,
    } as Parameters<typeof facade.acquire>[0] & {
      fetchFn: typeof fetchFn;
      now: typeof now;
    });

    expect(resolveAccess).toHaveBeenCalledOnce();
    const forwarded = resolveAccess.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(forwarded).toMatchObject({
      binding: expect.objectContaining({
        bindingId: "linkbrain-stage",
        issuerUrl: granted.issuerUrl,
        clientId: granted.clientId,
        clientAssertionKeyPem: "PEM-linkbrain-stage",
      }),
    });
    expect(forwarded).not.toHaveProperty("fetchFn");
    expect(forwarded).not.toHaveProperty("now");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it("forwards only bindingId-derived binding, signal, and forceRefresh from acquire", async () => {
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.bindingId}`,
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    const signal = new AbortController().signal;

    await facade.acquire({
      bindingId: "linkbrain-stage",
      signal,
      forceRefresh: true,
    });

    expect(resolveAccess).toHaveBeenCalledWith({
      binding: expect.objectContaining({ bindingId: "linkbrain-stage" }),
      signal,
      forceRefresh: true,
    });
  });

  it("unregisterMachineTokenFacadesForPlugin tears down live generation without global clear", async () => {
    const invalidated: string[] = [];
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.bindingId}`,
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const brain = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        invalidated.push(invalidationFingerprint(fingerprint));
      },
    });
    const skills = createMachineTokenPluginFacade({
      pluginId: "linkskills",
      grantedRecords: [record("linkskills-stage", { pluginId: "linkskills" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        invalidated.push(`skills:${invalidationFingerprint(fingerprint)}`);
      },
    });

    await brain.acquire({ bindingId: "linkbrain-stage" });
    await skills.acquire({ bindingId: "linkskills-stage" });

    unregisterMachineTokenFacadesForPlugin("linkbrain");
    expect(invalidated).toEqual(["fp-linkbrain-stage"]);
    expect(brain.health("linkbrain-stage").registered).toBe(false);
    expect(skills.health("linkskills-stage")).toMatchObject({
      registered: true,
      granted: true,
    });
    await expect(skills.acquire({ bindingId: "linkskills-stage" })).resolves.toMatchObject({
      accessToken: "token",
    });
    await expect(brain.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(/unregistered/);
  });

  it("generation publish retires only the prior live generation for the same plugin", async () => {
    const invalidated: string[] = [];
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: binding.keyRefFingerprint ?? `fp-${binding.clientId}`,
      accessToken: `token-${binding.clientId}`,
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const first = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-v1" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        invalidated.push(invalidationFingerprint(fingerprint));
      },
    });
    publishMachineTokenFacadeGeneration(first.handle);
    await first.facade.acquire({ bindingId: "linkbrain-stage" });

    const second = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-v2" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
      invalidateCache: (fingerprint) => {
        invalidated.push(invalidationFingerprint(fingerprint));
      },
    });
    // Candidate must not mint while prior live generation remains published.
    await expect(second.facade.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(
      /unregistered/,
    );
    await expect(first.facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token-client-v1",
    });

    publishMachineTokenFacadeGeneration(second.handle);
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(
      second.handle.generationId,
    );
    await expect(first.facade.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(
      /unregistered/,
    );
    await expect(second.facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token-client-v2",
    });
    expect(invalidated.length).toBeGreaterThanOrEqual(1);
  });

  it("destroying a failed candidate leaves the prior live generation usable", async () => {
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.clientId}`,
      accessToken: `token-${binding.clientId}`,
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const live = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-live" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    publishMachineTokenFacadeGeneration(live.handle);

    const candidate = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-candidate" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    destroyMachineTokenFacadeGeneration(candidate.handle);

    await expect(live.facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token-client-live",
    });
    await expect(candidate.facade.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(
      /unregistered/,
    );
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(
      live.handle.generationId,
    );
  });

  it("stale destroy after a newer publish does not remove the live replacement", async () => {
    const resolveAccess = vi.fn(async ({ binding }) => ({
      bindingId: binding.bindingId,
      bindingFingerprint: `fp-${binding.clientId}`,
      accessToken: `token-${binding.clientId}`,
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer" as const,
    }));
    const first = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-v1" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    publishMachineTokenFacadeGeneration(first.handle);
    const second = createMachineTokenFacadeGeneration({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage", { clientId: "client-v2" })],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess,
    });
    publishMachineTokenFacadeGeneration(second.handle);

    destroyMachineTokenFacadeGeneration(first.handle);
    await expect(second.facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token-client-v2",
    });
    expect(getLiveMachineTokenFacadeGenerationHandle("linkbrain")?.generationId).toBe(
      second.handle.generationId,
    );
  });

  it("createMachineTokenPluginFacade publishes immediately for direct host callers", async () => {
    const facade = createMachineTokenPluginFacade({
      pluginId: "linkbrain",
      grantedRecords: [record("linkbrain-stage")],
      resolveKeyPem: resolveKeyPemStub(),
      resolveAccess: async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: "fp",
        accessToken: "token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer",
      }),
    });
    expect(facade.health("linkbrain-stage").registered).toBe(true);
    await expect(facade.acquire({ bindingId: "linkbrain-stage" })).resolves.toMatchObject({
      accessToken: "token",
    });
    unregisterMachineTokenFacadesForPlugin("linkbrain");
  });

  it("collectGrantedMachineTokenBindingRecords reads plugin and managed MCP bindings", () => {
    const keyRef = {
      source: "env" as const,
      provider: "default",
      id: "BRAIN_KEY",
    };
    const records = collectGrantedMachineTokenBindingRecords({
      pluginId: "linkbrain",
      pluginConfig: {
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://issuer.example.test",
          clientId: "brain-client",
          clientAssertionKeyRef: keyRef,
        },
        mcpServerName: "linkbrain",
        environment: "stage",
      },
      mcpServers: {
        linkbrain: {
          auth: "machine_token",
          machineToken: {
            bindingId: "linkbrain-mcp",
            issuerUrl: "https://issuer.example.test",
            clientId: "brain-mcp-client",
            clientAssertionKeyRef: { ...keyRef, id: "BRAIN_MCP_KEY" },
          },
        },
        foreign: {
          auth: "machine_token",
          machineToken: {
            bindingId: "foreign-must-not-grant",
            issuerUrl: "https://issuer.example.test",
            clientId: "foreign",
            clientAssertionKeyRef: { ...keyRef, id: "FOREIGN" },
          },
        },
      },
    });
    expect(records.map((r) => r.bindingId).toSorted()).toEqual([
      "linkbrain-mcp",
      "linkbrain-stage",
    ]);
    expect(records.every((r) => r.pluginId === "linkbrain")).toBe(true);
    expect(records.find((r) => r.bindingId === "linkbrain-stage")?.environment).toBe("stage");
    expect(
      collectGrantedMachineTokenBindingIds({
        pluginId: "linkbrain",
        pluginConfig: {
          machineToken: {
            bindingId: "linkbrain-stage",
            issuerUrl: "https://issuer.example.test",
            clientId: "brain-client",
            clientAssertionKeyRef: keyRef,
          },
        },
      }),
    ).toEqual(["linkbrain-stage"]);
  });

  it("omits incomplete machineToken blocks that lack issuer/client/keyRef", () => {
    expect(
      collectGrantedMachineTokenBindingRecords({
        pluginId: "linkbrain",
        pluginConfig: {
          machineToken: { bindingId: "linkbrain-stage" },
        },
      }),
    ).toEqual([]);
  });

  it("threads allowPrivateNetwork into host records and fingerprints", () => {
    const keyRef = {
      source: "env" as const,
      provider: "default",
      id: "BRAIN_KEY",
    };
    const denied = collectGrantedMachineTokenBindingRecords({
      pluginId: "linkbrain",
      pluginConfig: {
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
          clientId: "brain-client",
          clientAssertionKeyRef: keyRef,
        },
      },
    });
    const allowed = collectGrantedMachineTokenBindingRecords({
      pluginId: "linkbrain",
      pluginConfig: {
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
          clientId: "brain-client",
          allowPrivateNetwork: true,
          clientAssertionKeyRef: keyRef,
        },
      },
    });
    expect(denied[0]?.allowPrivateNetwork).toBeUndefined();
    expect(allowed[0]?.allowPrivateNetwork).toBe(true);
    expect(allowed[0]?.bindingFingerprint).not.toBe(denied[0]?.bindingFingerprint);
  });

  it("drops conflicting plugin vs MCP bindings when allowPrivateNetwork mismatches", () => {
    const keyRef = {
      source: "env" as const,
      provider: "default",
      id: "BRAIN_KEY",
    };
    const records = collectGrantedMachineTokenBindingRecords({
      pluginId: "linkbrain",
      pluginConfig: {
        mcpServerName: "linkbrain",
        machineToken: {
          bindingId: "linkbrain-stage",
          issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
          clientId: "brain-client",
          allowPrivateNetwork: true,
          clientAssertionKeyRef: keyRef,
        },
      },
      mcpServers: {
        linkbrain: {
          auth: "machine_token",
          machineToken: {
            bindingId: "linkbrain-stage",
            issuerUrl: "https://linktrend-mini.tailf7e13a.ts.net:9443",
            clientId: "brain-client",
            clientAssertionKeyRef: keyRef,
          },
        },
      },
    });
    expect(records).toEqual([]);
  });

  describe("adversarial immutable registry scope", () => {
    const base = record("linkbrain-stage", {
      audience: "https://audience.example.test",
      scope: "brain.read",
      discoveryUrl: "https://issuer.example.test/.well-known/oauth-authorization-server",
      tokenEndpoint: "https://issuer.example.test/token",
      environment: "stage",
      service: "linkbrain",
    });

    function matchingSmuggle(
      granted: HostMachineTokenBindingRecord,
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        bindingId: granted.bindingId,
        issuerUrl: granted.issuerUrl,
        clientId: granted.clientId,
        audience: granted.audience,
        scope: granted.scope,
        discoveryUrl: granted.discoveryUrl,
        tokenEndpoint: granted.tokenEndpoint,
        environment: granted.environment,
        service: granted.service,
        keyRef: granted.keyRef,
        keyRefFingerprint: granted.keyRefFingerprint,
        pluginId: granted.pluginId,
        domain: granted.domain,
        bindingFingerprint: granted.bindingFingerprint,
        ...overrides,
      };
    }

    async function facadeWith(overrides: Partial<HostMachineTokenBindingRecord> = {}) {
      const resolveAccess = vi.fn(async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }));
      const { bindingFingerprint: _ignored, ...baseWithoutFp } = base;
      const granted = record("linkbrain-stage", { ...baseWithoutFp, ...overrides });
      const facade = createMachineTokenPluginFacade({
        pluginId: "linkbrain",
        grantedRecords: [granted],
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess,
      });
      return { facade, resolveAccess, granted };
    }

    it("rejects smuggled binding with different issuer", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            issuerUrl: "https://evil-issuer.example.test",
            clientAssertionKeyPem: "EVIL-PEM",
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/does not match the host registry.*(issuerUrl|clientAssertionKeyPem)/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different clientId", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, { clientId: "evil-client" }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/clientId/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different audience", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            audience: "https://evil-audience.example.test",
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/audience/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different scope", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, { scope: "evil.scope" }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/scope/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different token endpoint", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            tokenEndpoint: "https://evil.example.test/token",
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/tokenEndpoint/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different key ref / fingerprint", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            keyRef: { source: "env", provider: "default", id: "EVIL_KEY" },
            keyRefFingerprint: fingerprintMachineTokenKeyRef({
              source: "env",
              provider: "default",
              id: "EVIL_KEY",
            }),
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/keyRef|keyRefFingerprint/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects smuggled binding with different pluginId / domain", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            pluginId: "linkskills",
            domain: "linkskills",
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/pluginId|domain/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("rejects any smuggled PEM even when other fields match", async () => {
      const { facade, resolveAccess, granted } = await facadeWith();
      await expect(
        facade.acquire({
          bindingId: "linkbrain-stage",
          binding: matchingSmuggle(granted, {
            clientAssertionKeyPem: "PLUGIN-SUPPLIED-PEM",
          }),
        } as Parameters<typeof facade.acquire>[0] & { binding: Record<string, unknown> }),
      ).rejects.toThrow(/clientAssertionKeyPem/);
      expect(resolveAccess).not.toHaveBeenCalled();
    });

    it("uses host registry material and never plugin-supplied PEM on clean acquire", async () => {
      const resolveKeyPem = vi.fn(async () => "HOST-RESOLVED-PEM");
      const resolveAccess = vi.fn(async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.bindingId}`,
        accessToken: "token",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }));
      const facade = createMachineTokenPluginFacade({
        pluginId: "linkbrain",
        grantedRecords: [base],
        resolveKeyPem,
        resolveAccess,
      });
      await facade.acquire({ bindingId: "linkbrain-stage" });
      expect(resolveKeyPem).toHaveBeenCalledWith(
        expect.objectContaining({
          bindingId: "linkbrain-stage",
          keyRef: base.keyRef,
        }),
      );
      expect(resolveAccess.mock.calls[0]?.[0].binding.clientAssertionKeyPem).toBe(
        "HOST-RESOLVED-PEM",
      );
      expect(resolveAccess.mock.calls[0]?.[0].binding.issuerUrl).toBe(base.issuerUrl);
    });

    it("keeps cross-plugin isolation when the same bindingId label is reused", async () => {
      const resolveAccess = vi.fn(async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: `fp-${binding.clientId}`,
        accessToken: `token-${binding.clientId}`,
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }));
      const brain = createMachineTokenPluginFacade({
        pluginId: "linkbrain",
        grantedRecords: [
          record("shared-label", {
            pluginId: "linkbrain",
            clientId: "brain-client",
            issuerUrl: "https://brain-issuer.example.test",
          }),
        ],
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess,
      });
      const skills = createMachineTokenPluginFacade({
        pluginId: "linkskills",
        grantedRecords: [
          record("shared-label", {
            pluginId: "linkskills",
            clientId: "skills-client",
            issuerUrl: "https://skills-issuer.example.test",
          }),
        ],
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess,
      });

      const brainToken = await brain.acquire({ bindingId: "shared-label" });
      const skillsToken = await skills.acquire({ bindingId: "shared-label" });
      expect(brainToken.accessToken).toBe("token-brain-client");
      expect(skillsToken.accessToken).toBe("token-skills-client");
      expect(resolveAccess.mock.calls[0]?.[0].binding.issuerUrl).toBe(
        "https://brain-issuer.example.test",
      );
      expect(resolveAccess.mock.calls[1]?.[0].binding.issuerUrl).toBe(
        "https://skills-issuer.example.test",
      );
    });

    it("atomically replaces registry on generation publish and invalidates prior fingerprints", async () => {
      const invalidated: string[] = [];
      const resolveAccess = vi.fn(async ({ binding }) => ({
        bindingId: binding.bindingId,
        bindingFingerprint: binding.keyRefFingerprint ?? `fp-${binding.clientId}`,
        accessToken: `token-${binding.clientId}`,
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer" as const,
      }));
      const first = createMachineTokenFacadeGeneration({
        pluginId: "linkbrain",
        grantedRecords: [record("linkbrain-stage", { clientId: "client-v1" })],
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess,
        invalidateCache: (fingerprint) => {
          invalidated.push(invalidationFingerprint(fingerprint));
        },
      });
      publishMachineTokenFacadeGeneration(first.handle);
      await first.facade.acquire({ bindingId: "linkbrain-stage" });

      const second = createMachineTokenFacadeGeneration({
        pluginId: "linkbrain",
        grantedRecords: [record("linkbrain-stage", { clientId: "client-v2" })],
        resolveKeyPem: resolveKeyPemStub(),
        resolveAccess,
        invalidateCache: (fingerprint) => {
          invalidated.push(invalidationFingerprint(fingerprint));
        },
      });
      publishMachineTokenFacadeGeneration(second.handle);
      const acquired = await second.facade.acquire({ bindingId: "linkbrain-stage" });
      expect(acquired.accessToken).toBe("token-client-v2");
      expect(invalidated.length).toBeGreaterThanOrEqual(1);
      await expect(first.facade.acquire({ bindingId: "linkbrain-stage" })).rejects.toThrow(
        /unregistered/,
      );
    });
  });
});
