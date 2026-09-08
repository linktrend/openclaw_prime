import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  exactReleaseTelemetry,
  SKILLS_COMMIT,
  SKILLS_TREE,
  validateExactRelease,
  validateProgressiveReleaseTransition,
  type ExactRelease,
} from "./src/exact-release.js";

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonical(child)]),
        )
      : value;

const digest = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")}`;

const expectedPackageDigest = (release: { release_id: string; manifest_digest: string }): string =>
  digest({
    release_id: release.release_id,
    files_digest: release.manifest_digest,
    contract_version: "skills-release/0.2",
  });

const expectedEligibilityDigest = (release: ExactRelease): string =>
  digest({
    release_id: release.release_id,
    version: release.version,
    provider_candidate: release.providerCandidate,
    manifest_digest: release.manifest_digest,
    package_digest: release.package_digest,
    lifecycle: release.lifecycle,
    state: release.state,
    compatible_profiles: release.compatible_profiles,
    attestation: release.attestation,
    issued_at: release.issued_at,
    expires_at: release.expires_at,
  });

const now = "2026-08-13T00:00:00.000Z";
const releaseId = "skill.echo@2026.08.12";
const version = "2026.08.12";
const manifestDigest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const validRelease: ExactRelease = {
  release_id: releaseId,
  version,
  providerCandidate: { commit: SKILLS_COMMIT, tree: SKILLS_TREE },
  manifest_digest: manifestDigest,
  package_digest: expectedPackageDigest({ release_id: releaseId, manifest_digest: manifestDigest }),
  lifecycle: "qualified",
  state: "available",
  compatible_profiles: ["runtime:fixture-openclaw-01"],
  attestation: {
    issuer: "librarian",
    digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    evaluated_at: "2026-08-12T12:00:00.000Z",
    valid_until: "2026-08-14T00:00:00.000Z",
  },
  issued_at: "2026-08-12T12:00:00.000Z",
  expires_at: "2026-08-14T00:00:00.000Z",
};
const authenticatedProviderEvidence = {
  providerCandidate: { commit: SKILLS_COMMIT, tree: SKILLS_TREE },
  contractVersion: "skills-release/0.2",
  releaseId,
  version,
  manifestDigest,
  packageDigest: validRelease.package_digest,
  eligibilityDigest: expectedEligibilityDigest(validRelease),
  attestationVerified: true,
  algorithm: "ES256",
  keyId: "skills-release-key-1",
  organization: "org:linktrend",
  audience: "lskills-api",
  capability: "skills.publish",
} as const;
const validationOptions = {
  profile: "runtime:fixture-openclaw-01",
  expectedSkillId: "skill.echo",
  expectedVersion: version,
  expectedOrganization: "org:linktrend",
  expectedAudience: "lskills-api",
  expectedCapability: "skills.publish",
  authenticatedProviderEvidence,
  now,
} as const;

const check = (changes: Record<string, unknown>, code: string) => {
  const result = validateExactRelease({ ...validRelease, ...changes }, validationOptions);
  expect(result).toMatchObject({ ok: false, code });
  expect(exactReleaseTelemetry(result)).not.toHaveProperty("conversation");
  return result;
};

describe("exact provider Skills releases", () => {
  it("accepts an immutable, qualified, available, attested exact release", () => {
    const result = validateExactRelease(validRelease, validationOptions);
    expect(result).toMatchObject({
      ok: true,
      release: validRelease,
      telemetry: { outcome: "accepted", release_id: validRelease.release_id },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.release)).toBe(true);
      expect(() => {
        (result.release as { release_id: string }).release_id = "skill.changed@1.0.0";
      }).toThrow();
      expect(result.release.release_id).toBe(validRelease.release_id);
    }
  });

  it("rejects a valid release that does not match the requested identity", () => {
    expect(
      validateExactRelease(validRelease, {
        ...validationOptions,
        expectedSkillId: "skill.other",
      }),
    ).toMatchObject({ ok: false, code: "invalid_immutability" });
    expect(
      validateExactRelease(validRelease, {
        ...validationOptions,
        expectedVersion: "2026.08.11",
      }),
    ).toMatchObject({ ok: false, code: "invalid_immutability" });
  });

  it("rejects self-attested release claims without matching authenticated provider evidence", () => {
    const forgedManifest =
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const forged = {
      ...validRelease,
      manifest_digest: forgedManifest,
      package_digest: expectedPackageDigest({
        release_id: releaseId,
        manifest_digest: forgedManifest,
      }),
      attestation: { ...validRelease.attestation, digest: forgedManifest },
    };
    expect(validateExactRelease(forged, validationOptions)).toMatchObject({
      ok: false,
      code: "invalid_provider_evidence",
    });
    expect(
      validateExactRelease(validRelease, {
        ...validationOptions,
        authenticatedProviderEvidence: {
          ...authenticatedProviderEvidence,
          attestationVerified: false as true,
        },
      }),
    ).toMatchObject({ ok: false, code: "invalid_provider_evidence" });
  });

  it("rejects replayed evidence when any provider eligibility claim changes", () => {
    for (const changes of [
      { compatible_profiles: [...validRelease.compatible_profiles, "runtime:other"] },
      { issued_at: "2026-08-12T13:00:00.000Z" },
      { expires_at: "2026-08-14T01:00:00.000Z" },
      {
        attestation: {
          ...validRelease.attestation,
          valid_until: "2026-08-14T01:00:00.000Z",
        },
      },
    ]) {
      expect(
        validateExactRelease({ ...validRelease, ...changes }, validationOptions),
      ).toMatchObject({ ok: false, code: "invalid_provider_evidence" });
    }
  });

  it("fails closed when authorization expectations or evidence fields are absent", () => {
    for (const key of ["expectedOrganization", "expectedAudience", "expectedCapability"] as const) {
      const options = { ...validationOptions } as Record<string, unknown>;
      delete options[key];
      expect(validateExactRelease(validRelease, options as never)).toMatchObject({
        ok: false,
        code: "invalid_provider_evidence",
      });
    }
    for (const key of ["organization", "audience", "capability", "eligibilityDigest"] as const) {
      const evidence = { ...authenticatedProviderEvidence } as Record<string, unknown>;
      delete evidence[key];
      expect(
        validateExactRelease(validRelease, {
          ...validationOptions,
          authenticatedProviderEvidence: evidence as never,
        }),
      ).toMatchObject({ ok: false, code: "invalid_provider_evidence" });
    }
  });

  it.each([
    [{ release_id: "latest" }, "latest_alias"],
    [{ version: "latest" }, "latest_alias"],
    [{ version: "2026.08.13" }, "invalid_immutability"],
    [{ release_id: "skill.echo" }, "invalid_immutability"],
    [{ providerCandidate: undefined }, "invalid_provider_candidate"],
    [{ providerCandidate: { commit: "other", tree: SKILLS_TREE } }, "invalid_provider_candidate"],
    [{ providerCandidate: { commit: SKILLS_COMMIT, tree: "other" } }, "invalid_provider_candidate"],
    [
      { providerCandidate: { commit: SKILLS_COMMIT, tree: SKILLS_TREE, extra: true } },
      "invalid_provider_candidate",
    ],
    [{ manifest_digest: "latest" }, "invalid_digest"],
    [{ manifest_digest: "unpinned" }, "invalid_digest"],
    [{ package_digest: "corrupt" }, "invalid_digest"],
    [
      { package_digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      "invalid_digest",
    ],
    [
      { package_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      "invalid_immutability",
    ],
    [{ lifecycle: "published" }, "invalid_lifecycle"],
    [{ state: "revoked" }, "invalid_state"],
    [{ state: "quarantined" }, "invalid_state"],
    [{ compatible_profiles: ["runtime:other"] }, "incompatible_profile"],
    [{ attestation: undefined }, "missing_attestation"],
    [{ issued_at: "not-a-time" }, "invalid_timestamp"],
    [{ issued_at: "2026-08-12" }, "invalid_timestamp"],
    [{ issued_at: "2026-02-30T12:00:00.000Z" }, "invalid_timestamp"],
    [{ issued_at: "2026-08-12T12:00:00+00:00" }, "invalid_timestamp"],
    [{ issued_at: "2026-08-13T00:00:00.0009Z" }, "invalid_timestamp"],
    [
      { attestation: { ...validRelease.attestation, evaluated_at: "2026-08-12" } },
      "invalid_timestamp",
    ],
    [{ expires_at: "2026-08-12T23:59:59.000Z" }, "stale_timestamp"],
    [{ issued_at: "2026-08-01T00:00:00.000Z" }, "stale_timestamp"],
  ] as const)("rejects %j", (changes, code) => {
    check(changes, code);
  });

  it("rejects invalid clock and max-age inputs", () => {
    expect(
      validateExactRelease(validRelease, {
        ...validationOptions,
        now: new Date("invalid"),
      }),
    ).toMatchObject({ ok: false, code: "invalid_timestamp" });
    expect(
      validateExactRelease(validRelease, {
        ...validationOptions,
        maxAgeMs: Number.NaN,
      }),
    ).toMatchObject({ ok: false, code: "invalid_timestamp" });
    const counterfeit = Object.create(Date.prototype) as Date;
    expect(() =>
      validateExactRelease(validRelease, { ...validationOptions, now: counterfeit }),
    ).not.toThrow();
    expect(
      validateExactRelease(validRelease, { ...validationOptions, now: counterfeit }),
    ).toMatchObject({ ok: false, code: "invalid_timestamp" });
  });

  it("rejects raw conversation, prompt, reasoning, Brain, and raw-tool telemetry fields", () => {
    for (const field of [
      "conversation",
      "prompt",
      "reasoning",
      "brain_findings",
      "raw_tool_args",
      "raw_tool_result",
    ]) {
      const result = validateExactRelease(
        { ...validRelease, [field]: "must not be accepted" },
        validationOptions,
      );
      expect(result).toMatchObject({ ok: false, code: "invalid_shape" });
      expect(exactReleaseTelemetry(result)).not.toHaveProperty(field);
    }
  });

  it("rejects malformed identity and digest objects without leaking or throwing", () => {
    const malformedIdentity = validateExactRelease(
      { ...validRelease, release_id: { secret: "blocked" }, version: { private: "blocked" } },
      validationOptions,
    );
    expect(malformedIdentity).toMatchObject({ ok: false, code: "invalid_shape" });
    expect(exactReleaseTelemetry(malformedIdentity)).toEqual({
      outcome: "rejected",
      reason: "invalid_shape",
    });
    for (const changes of [
      { manifest_digest: { toString: null } },
      { package_digest: { toString: null } },
      { attestation: { ...validRelease.attestation, digest: { toString: null } } },
    ]) {
      expect(() =>
        validateExactRelease({ ...validRelease, ...changes }, validationOptions),
      ).not.toThrow();
    }
  });

  it("rejects inherited and accessor-backed releases without invoking getters", () => {
    let getterCalls = 0;
    const accessorRelease = { ...validRelease } as Record<string, unknown>;
    Object.defineProperty(accessorRelease, "release_id", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? validRelease.release_id : "skill.other@2026.08.12";
      },
    });
    expect(validateExactRelease(accessorRelease, validationOptions)).toMatchObject({
      ok: false,
      code: "invalid_shape",
    });
    expect(getterCalls).toBe(0);
    expect(
      validateExactRelease(Object.create(validRelease), {
        ...validationOptions,
      }),
    ).toMatchObject({ ok: false, code: "invalid_shape" });
  });

  it("requires progressive index -> description -> fragments -> exact release", () => {
    const index = {
      stage: "index" as const,
      release_id: validRelease.release_id,
      version: validRelease.version,
    };
    const description = { ...index, stage: "description" as const };
    const fragments = {
      ...description,
      stage: "fragments" as const,
      manifest_digest: validRelease.manifest_digest,
    };
    const exact = {
      ...fragments,
      stage: "exact_release" as const,
      package_digest: validRelease.package_digest,
    };
    expect(validateProgressiveReleaseTransition(undefined, index)).toBe(true);
    expect(validateProgressiveReleaseTransition(undefined, { stage: "index" })).toBe(false);
    expect(validateProgressiveReleaseTransition(undefined, description)).toBe(false);
    expect(
      validateProgressiveReleaseTransition(undefined, {
        stage: "index",
        release_id: "latest",
        version: "latest",
      }),
    ).toBe(false);
    expect(
      validateProgressiveReleaseTransition(undefined, {
        stage: "index",
        release_id: "skill.echo@1.0.0",
        version: "2.0.0",
      }),
    ).toBe(false);
    expect(validateProgressiveReleaseTransition(index, description)).toBe(true);
    expect(validateProgressiveReleaseTransition(description, fragments)).toBe(true);
    expect(validateProgressiveReleaseTransition(fragments, exact)).toBe(true);
    expect(validateProgressiveReleaseTransition(index, fragments)).toBe(false);
    expect(validateProgressiveReleaseTransition(fragments, { ...exact, version: "other" })).toBe(
      false,
    );
    expect(
      validateProgressiveReleaseTransition(undefined, {
        stage: "index",
        release_id: { nested: true } as unknown as string,
        version: validRelease.version,
      }),
    ).toBe(false);
    expect(
      validateProgressiveReleaseTransition(description, {
        ...fragments,
        manifest_digest: "sha256:not-a-digest",
      }),
    ).toBe(false);
    expect(
      validateProgressiveReleaseTransition(description, {
        ...fragments,
        manifest_digest: { toString: () => validRelease.manifest_digest } as unknown as string,
      }),
    ).toBe(false);
    expect(() =>
      validateProgressiveReleaseTransition(description, {
        ...fragments,
        manifest_digest: { toString: null } as unknown as string,
      }),
    ).not.toThrow();
    expect(
      validateProgressiveReleaseTransition({ ...fragments, stage: "unknown" as never }, exact),
    ).toBe(false);
    expect(
      validateProgressiveReleaseTransition(
        { ...description, stage: "fragments", manifest_digest: undefined },
        exact,
      ),
    ).toBe(false);
    expect(
      validateProgressiveReleaseTransition(
        { ...index, stage: "description", release_id: undefined },
        fragments,
      ),
    ).toBe(false);
  });

  it("rejects inherited and accessor-backed progressive states without invoking getters", () => {
    const inherited = Object.create({
      stage: "index",
      release_id: validRelease.release_id,
      version: validRelease.version,
    });
    expect(validateProgressiveReleaseTransition(undefined, inherited)).toBe(false);
    let getterCalls = 0;
    const accessorState = {
      release_id: validRelease.release_id,
      version: validRelease.version,
    } as Record<string, unknown>;
    Object.defineProperty(accessorState, "stage", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "index";
      },
    });
    expect(validateProgressiveReleaseTransition(undefined, accessorState as never)).toBe(false);
    expect(getterCalls).toBe(0);
  });

  it("matches the provider package digest construction", () => {
    expect(
      expectedPackageDigest({
        release_id: validRelease.release_id,
        manifest_digest: validRelease.manifest_digest,
      }),
    ).toBe(validRelease.package_digest);
  });
});
