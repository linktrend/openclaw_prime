import { describe, expect, it } from "vitest";
import {
  FROZEN_CANDIDATE_SHA,
  FROZEN_TREE_SHA,
  candidateDependencyClosureDigest,
  candidateEligibilityDigest,
  validateExactRelease,
  type AuthenticatedLibraryAssetEvidence,
  type Candidate,
} from "./exact-release.js";

const digest = (letter: string) => `sha256:${letter.repeat(64)}`;

function validCandidate(): Candidate {
  return {
    gitSha: "0efa68b19686e976ecee93c6a962e81d2a0265f5",
    treeSha: "c42d20b3119ca4bfdd24d4c6b06d6bc7a7f50d4a",
    asset: {
      releaseSourceCommitSha: "1234567890abcdef1234567890abcdef12345678",
      releaseSourceRepositoryTreeSha1: "abcdef1234567890abcdef1234567890abcdef12",
      artifactTreeSha1: "11223344556677889900aabbccddeeff00112233",
      payloadSha256: digest("d"),
    },
    catalogue: { inventoryDigest: digest("b"), current: true, authorized: true },
    manifest: {
      inventoryDigest: digest("b"),
      current: true,
      authorized: true,
      lifecycle: { admitted: true, selectable: true, state: "selectable" },
      supportedConsumerProfiles: ["consumer-v1"],
    },
    consumerProfile: { id: "consumer-v1", compatible: true },
    dependencies: {
      complete: true,
      closureDigest: candidateDependencyClosureDigest([
        { name: "demo", version: "1.0.0", resolved: true, provenanceRef: "dep:demo@1.0.0" },
      ]),
      entries: [
        { name: "demo", version: "1.0.0", resolved: true, provenanceRef: "dep:demo@1.0.0" },
      ],
    },
    provenance: { complete: true, ref: "prov:candidate" },
    receipt: { complete: true, ref: "receipt:candidate" },
  };
}

function authenticatedEvidence(candidate = validCandidate()): AuthenticatedLibraryAssetEvidence {
  return {
    providerCandidate: { commit: FROZEN_CANDIDATE_SHA, tree: FROZEN_TREE_SHA },
    catalogueSha256: "sha256:a6af16532f82169094fd1766c3d46a435c9e7ac8d47fb57d5fab3adf6bf210d7",
    inventoryDigest: candidate.catalogue.inventoryDigest as `sha256:${string}`,
    releaseSourceCommitSha: candidate.asset.releaseSourceCommitSha,
    releaseSourceRepositoryTreeSha1: candidate.asset.releaseSourceRepositoryTreeSha1,
    artifactTreeSha1: candidate.asset.artifactTreeSha1,
    payloadSha256: candidate.asset.payloadSha256 as `sha256:${string}`,
    eligibilityDigest: candidateEligibilityDigest(candidate),
    verified: true,
  };
}

const validate = (candidate: unknown, evidence = authenticatedEvidence()) =>
  validateExactRelease(candidate, evidence);

describe("validateExactRelease", () => {
  it("returns progressive evidence views for the frozen candidate", () => {
    const result = validate(validCandidate());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evidence.catalogue.inventoryDigest).toBe(digest("b"));
      expect(result.evidence.shortlistedManifest.consumerProfile).toBe("consumer-v1");
      expect(result.evidence.selectedAsset).toEqual({
        releaseSourceCommitSha: "1234567890abcdef1234567890abcdef12345678",
        releaseSourceRepositoryTreeSha1: "abcdef1234567890abcdef1234567890abcdef12",
        artifactTreeSha1: "11223344556677889900aabbccddeeff00112233",
        payloadSha256: digest("d"),
        provenanceRef: "prov:candidate",
        receiptRef: "receipt:candidate",
      });
    }
  });

  it("accepts a complete dependency-free release closure", () => {
    const value = validCandidate() as unknown as Record<string, unknown>;
    value.dependencies = {
      complete: true,
      closureDigest: candidateDependencyClosureDigest([]),
      entries: [],
    };
    expect(validate(value, authenticatedEvidence(value as unknown as Candidate))).toMatchObject({
      ok: true,
    });
  });

  it("rejects a manifest inventory not authorized by the catalogue", () => {
    const candidate = validCandidate() as unknown as Record<string, any>;
    candidate.catalogue.inventoryDigest = digest("a");
    expect(validate(candidate).ok).toBe(false);
  });

  it.each([
    ["bad git SHA", (candidate: Candidate) => ((candidate as { gitSha: string }).gitSha = "short")],
    [
      "stale catalogue",
      (candidate: Candidate) => ((candidate.catalogue as { current: boolean }).current = false),
    ],
    [
      "unauthorized manifest",
      (candidate: Candidate) =>
        ((candidate.manifest as { authorized: boolean }).authorized = false),
    ],
    [
      "incompatible profile",
      (candidate: Candidate) =>
        ((candidate.consumerProfile as { compatible: boolean }).compatible = false),
    ],
    [
      "incomplete closure",
      (candidate: Candidate) =>
        ((candidate.dependencies as { complete: boolean }).complete = false),
    ],
    [
      "missing receipt",
      (candidate: Candidate) => ((candidate.receipt as { ref: string }).ref = ""),
    ],
  ])("fails closed for %s", (_name, mutate) => {
    const candidate = validCandidate();
    mutate(candidate);
    expect(validate(candidate).ok).toBe(false);
  });

  it("fails closed without throwing when evidence is missing", () => {
    const result = validate({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("candidate.gitSha is missing");
    }
  });

  it.each([
    ["candidate", (candidate: Record<string, unknown>) => (candidate.extra = true)],
    ["asset", (candidate: Record<string, any>) => (candidate.asset.extra = true)],
    ["catalogue", (candidate: Record<string, any>) => (candidate.catalogue.extra = true)],
    ["manifest", (candidate: Record<string, any>) => (candidate.manifest.extra = true)],
    ["lifecycle", (candidate: Record<string, any>) => (candidate.manifest.lifecycle.extra = true)],
    [
      "consumer profile",
      (candidate: Record<string, any>) => (candidate.consumerProfile.extra = true),
    ],
    ["dependencies", (candidate: Record<string, any>) => (candidate.dependencies.extra = true)],
    [
      "dependency entry",
      (candidate: Record<string, any>) => (candidate.dependencies.entries[0].extra = true),
    ],
    ["provenance", (candidate: Record<string, any>) => (candidate.provenance.extra = true)],
    ["receipt", (candidate: Record<string, any>) => (candidate.receipt.extra = true)],
  ])("rejects unknown keys in %s", (_name, mutate) => {
    const candidate = validCandidate() as unknown as Record<string, unknown>;
    mutate(candidate as never);
    expect(validate(candidate).ok).toBe(false);
  });

  it.each(["prompt", "reasoning", "transcript", "secret", "raw_tool"])(
    "rejects forbidden key %s at every evidence object",
    (key) => {
      const candidate = validCandidate() as unknown as Record<string, any>;
      candidate.manifest.lifecycle[key] = "blocked";
      const result = validate(candidate);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(`manifest.lifecycle.${key} is forbidden`);
      }
    },
  );

  it("rejects non-string profile entries before checking support", () => {
    const candidate = validCandidate() as unknown as Record<string, any>;
    candidate.manifest.supportedConsumerProfiles = ["consumer-v1", { prompt: "do not read" }];
    expect(validate(candidate).ok).toBe(false);
  });

  it("rejects malformed dependency names without coercing or throwing", () => {
    const candidate = validCandidate() as unknown as Record<string, any>;
    candidate.dependencies.entries[0].name = { toString: null };
    candidate.dependencies.entries[0].resolved = false;
    expect(() => validate(candidate)).not.toThrow();
    expect(validate(candidate).ok).toBe(false);
  });

  it("requires dependency resolution evidence to be the literal boolean true", () => {
    for (const malformed of [false, "false", "yes", {}, 1]) {
      const candidate = validCandidate() as unknown as Record<string, any>;
      candidate.dependencies.entries[0].resolved = malformed;
      expect(validate(candidate).ok).toBe(false);
    }
  });

  it("binds the dependency closure digest to canonical exact entries", () => {
    const candidate = validCandidate() as unknown as Record<string, any>;
    candidate.dependencies.entries[0].version = "2.0.0";
    expect(validate(candidate).ok).toBe(false);
    candidate.dependencies.closureDigest = candidateDependencyClosureDigest(
      candidate.dependencies.entries,
    );
    expect(validate(candidate, authenticatedEvidence(candidate as unknown as Candidate)).ok).toBe(
      true,
    );
  });

  it("rejects self-consistent eligibility and dependency substitutions against prior evidence", () => {
    const original = validCandidate();
    const forged = structuredClone(original) as Candidate;
    (forged.dependencies as { entries: Candidate["dependencies"]["entries"] }).entries = [];
    (forged.dependencies as { closureDigest: string }).closureDigest =
      candidateDependencyClosureDigest([]);
    (forged.manifest.supportedConsumerProfiles as string[]).push("consumer-other");
    expect(validate(forged, authenticatedEvidence(original))).toMatchObject({ ok: false });
  });

  it("rejects inherited and accessor-backed evidence without invoking getters", () => {
    let getterCalls = 0;
    const accessorCandidate = validCandidate() as unknown as Record<string, unknown>;
    Object.defineProperty(accessorCandidate, "gitSha", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1
          ? "0efa68b19686e976ecee93c6a962e81d2a0265f5"
          : "ffffffffffffffffffffffffffffffffffffffff";
      },
    });
    expect(validate(accessorCandidate).ok).toBe(false);
    expect(getterCalls).toBe(0);
    expect(validate(Object.create(validCandidate())).ok).toBe(false);
  });

  it.each([
    ["missing asset identity", (candidate: Record<string, any>) => delete candidate.asset],
    [
      "provider commit substituted for release source",
      (candidate: Record<string, any>) => delete candidate.asset.releaseSourceCommitSha,
    ],
    [
      "missing artifact tree",
      (candidate: Record<string, any>) => delete candidate.asset.artifactTreeSha1,
    ],
    [
      "malformed payload digest",
      (candidate: Record<string, any>) => (candidate.asset.payloadSha256 = "sha256:short"),
    ],
  ])("rejects %s", (_name, mutate) => {
    const candidate = validCandidate() as unknown as Record<string, unknown>;
    mutate(candidate as never);
    expect(validate(candidate).ok).toBe(false);
  });

  it("rejects a selected asset that does not match authenticated catalogue evidence", () => {
    const candidate = validCandidate();
    const forged = structuredClone(candidate) as Candidate;
    (forged.asset as { artifactTreeSha1: string }).artifactTreeSha1 =
      "ffeeddccbbaa0099887766554433221100ffeedd";
    expect(validate(forged)).toMatchObject({ ok: false });
    expect(
      validate(candidate, {
        ...authenticatedEvidence(candidate),
        verified: false as true,
      }),
    ).toMatchObject({ ok: false });
  });
});
