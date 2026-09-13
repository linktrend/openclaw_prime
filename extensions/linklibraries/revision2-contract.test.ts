import { describe, expect, it } from "vitest";
import {
  LIBRARIES_COMMIT,
  LIBRARIES_CATALOGUE_SHA256,
  LIBRARIES_TREE,
  canonicalDigest,
  pageCatalogue,
  validateExactRevision2,
  type AuthenticatedRevision2CatalogueEvidence,
  type AuthenticatedRevision2PageEvidence,
  type ExactRevision2Bundle,
  type Revision2Record,
  type VerifiedConsumerMaterializationEvidence,
} from "./api.js";

const d = (letter: string) => `sha256:${letter.repeat(64)}`;
const source = {
  releaseSourceCommitSha: "1234567890abcdef1234567890abcdef12345678",
  releaseSourceRepositoryTreeSha1: "abcdef1234567890abcdef1234567890abcdef12",
};
const manifest = {
  releaseId: "component-echo@1.0.0",
  entryId: "component-echo",
  version: "1.0.0",
  releaseSource: source,
  artifactTreeSha1: "11223344556677889900aabbccddeeff00112233",
  payloadSha256: d("e"),
  inventorySha256: d("b"),
  dependencyLockSha256: d("f"),
};
const record: Revision2Record = {
  schemaVersion: 2,
  schemaRevision: 2,
  recordType: "catalogue_record",
  entryId: "component-echo",
  version: "1.0.0",
  artifactType: "component",
  releaseManifestSha256: canonicalDigest(manifest),
  releaseSource: source,
  artifactTreeSha1: "11223344556677889900aabbccddeeff00112233",
  inventorySha256: d("b"),
  lifecycle: "admitted",
  selectability: "selectable",
  compatibility: "compatible",
  bundlePath: "registry/v2/entries/component-echo/versions/1.0.0",
};
const bundle: ExactRevision2Bundle = {
  source: { commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE },
  catalogue: {
    schemaVersion: 2,
    schemaRevision: 2,
    catalogueType: "catalogue",
    catalogueSha256: LIBRARIES_CATALOGUE_SHA256,
    recordsSha256: canonicalDigest([record]),
    records: [record],
  },
  record,
  manifest,
  inventorySha256: record.inventorySha256,
  dependencyLockSha256: d("f"),
  verifiedCache: {
    sourceEvidence: {
      selectedRepositoryCommitSha: LIBRARIES_COMMIT,
      selectedRepositoryTreeSha1: LIBRARIES_TREE,
      immutable: true,
    },
    releaseSource: source,
    catalogueSha256: LIBRARIES_CATALOGUE_SHA256,
    catalogueRecordsSha256: canonicalDigest([record]),
    entryId: record.entryId,
    version: record.version,
    releaseManifestSha256: record.releaseManifestSha256,
    inventorySha256: record.inventorySha256,
    payloadSha256: d("e"),
    artifactTreeSha1: record.artifactTreeSha1,
  },
  consumption: {
    receiptType: "consumption",
    result: "pass",
    entryId: record.entryId,
    version: record.version,
    releaseManifestSha256: record.releaseManifestSha256,
    releaseSourceCommitSha: source.releaseSourceCommitSha,
    releaseSourceRepositoryTreeSha1: source.releaseSourceRepositoryTreeSha1,
    artifactTreeSha1: record.artifactTreeSha1,
    consumerMaterializedTreeSha1: "99887766554433221100ffeeddccbbaa99887766",
  },
};
const authenticatedCatalogueEvidence = (
  value: ExactRevision2Bundle | AdversarialRevision2Bundle = bundle,
): AuthenticatedRevision2CatalogueEvidence => ({
  source: { commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE },
  catalogueSha256: LIBRARIES_CATALOGUE_SHA256,
  recordsSha256: value.catalogue.recordsSha256,
  selectedRecord: {
    entryId: value.record.entryId,
    version: value.record.version,
    releaseManifestSha256: value.record.releaseManifestSha256,
    releaseSourceCommitSha: value.record.releaseSource.releaseSourceCommitSha,
    releaseSourceRepositoryTreeSha1: value.record.releaseSource.releaseSourceRepositoryTreeSha1,
    artifactTreeSha1: value.record.artifactTreeSha1,
    inventorySha256: value.record.inventorySha256,
  },
  verified: true,
});

/** Mutable adversarial fixtures for fail-closed mutation tests (no `as any`). */
type WithExtra<T> = T & { extra?: unknown };
type AdversarialRevision2Record = WithExtra<
  {
    -readonly [K in keyof Revision2Record]: Revision2Record[K];
  } & {
    releaseManifestSha256: string;
    inventorySha256: string;
  }
>;
type AdversarialRevision2Bundle = {
  source: WithExtra<{ commit: string; tree: string }>;
  catalogue: WithExtra<{
    schemaVersion: number;
    schemaRevision: number;
    catalogueType: string;
    catalogueSha256: string;
    recordsSha256: string;
    records: Array<AdversarialRevision2Record | undefined>;
  }>;
  record: AdversarialRevision2Record;
  manifest: WithExtra<{
    releaseId: string;
    entryId: string;
    version: string;
    releaseSource: Revision2Record["releaseSource"];
    artifactTreeSha1: string;
    payloadSha256: string;
    inventorySha256: string;
    dependencyLockSha256: string;
  }>;
  inventorySha256: string;
  dependencyLockSha256: string;
  verifiedCache: WithExtra<{
    sourceEvidence: WithExtra<{
      selectedRepositoryCommitSha: string;
      selectedRepositoryTreeSha1: string;
      immutable: boolean;
    }>;
    releaseSource: Revision2Record["releaseSource"];
    catalogueSha256: string;
    catalogueRecordsSha256: string;
    entryId: string;
    version: string;
    releaseManifestSha256: string;
    inventorySha256: string;
    payloadSha256: string;
    artifactTreeSha1: string;
  }>;
  consumption: WithExtra<{
    receiptType: string;
    result: string;
    entryId: string;
    version: string;
    releaseManifestSha256: string;
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    consumerMaterializedTreeSha1: string;
  }>;
  extra?: unknown;
};
type AdversarialCatalogueEvidence = {
  source: { commit: string; tree: string };
  catalogueSha256: string;
  recordsSha256: string;
  selectedRecord: {
    entryId: string;
    version: string;
    releaseManifestSha256: string | null;
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    inventorySha256: string | null;
  };
  verified: true;
};

const cloneAdversarialBundle = (value: ExactRevision2Bundle = bundle): AdversarialRevision2Bundle =>
  structuredClone(value) as AdversarialRevision2Bundle;

const cloneAdversarialCatalogueEvidence = (
  value: AuthenticatedRevision2CatalogueEvidence = authenticatedCatalogueEvidence(),
): AdversarialCatalogueEvidence => structuredClone(value) as AdversarialCatalogueEvidence;

const materializationEvidence = (
  value: ExactRevision2Bundle | AdversarialRevision2Bundle = bundle,
): VerifiedConsumerMaterializationEvidence => ({
  entryId: value.record.entryId,
  version: value.record.version,
  releaseManifestSha256: value.record.releaseManifestSha256,
  releaseSourceCommitSha: value.record.releaseSource.releaseSourceCommitSha,
  releaseSourceRepositoryTreeSha1: value.record.releaseSource.releaseSourceRepositoryTreeSha1,
  artifactTreeSha1: value.record.artifactTreeSha1,
  inventorySha256: value.record.inventorySha256,
  payloadSha256: value.manifest.payloadSha256,
  consumerMaterializedTreeSha1: value.consumption.consumerMaterializedTreeSha1,
  verified: true,
});
const validate = (
  value: unknown,
  evidence:
    | AuthenticatedRevision2CatalogueEvidence
    | AdversarialCatalogueEvidence = authenticatedCatalogueEvidence(),
  materialized: VerifiedConsumerMaterializationEvidence = materializationEvidence(),
) =>
  validateExactRevision2(value, evidence as AuthenticatedRevision2CatalogueEvidence, materialized);
const pageEvidence = (
  records: readonly Revision2Record[] = [record],
  snapshot = "catalogue-v2",
): AuthenticatedRevision2PageEvidence => ({
  source: { commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE },
  catalogueSha256: LIBRARIES_CATALOGUE_SHA256,
  recordsSha256: canonicalDigest(records),
  snapshot,
  verified: true,
});

describe("LiNKlibraries Revision 2 consumer", () => {
  it("pages admitted records and validates exact release evidence", () => {
    const page = pageCatalogue(
      [record],
      {
        commit: LIBRARIES_COMMIT,
        tree: LIBRARIES_TREE,
        snapshot: "catalogue-v2",
        limit: 1,
      },
      pageEvidence(),
    );
    expect(page.records).toHaveLength(1);
    expect(validate(bundle)).toMatchObject({ ok: true });
  });
  it("uses canonical object digests and literal snapshot cursor matching", () => {
    expect(canonicalDigest({ a: 1, b: { c: 2 } })).toBe(canonicalDigest({ b: { c: 2 }, a: 1 }));
    expect(
      pageCatalogue(
        [record],
        {
          commit: LIBRARIES_COMMIT,
          tree: LIBRARIES_TREE,
          snapshot: "catalogue.*",
          cursor: "snapshot:catalogue.*:0",
        },
        pageEvidence([record], "catalogue.*"),
      ).records,
    ).toHaveLength(1);
    expect(() =>
      pageCatalogue(
        [record],
        {
          commit: LIBRARIES_COMMIT,
          tree: LIBRARIES_TREE,
          snapshot: "catalogue.*",
          cursor: "snapshot:catalogueX:0",
        },
        pageEvidence([record], "catalogue.*"),
      ),
    ).toThrow("stale catalogue cursor");
  });
  it("filters valid non-selectable records after structural validation", () => {
    expect(
      pageCatalogue(
        [
          record,
          {
            ...record,
            entryId: "draft-entry",
            lifecycle: "draft",
            selectability: "non_selectable",
            compatibility: "unknown",
            bundlePath: "registry/v2/entries/draft-entry/versions/1.0.0",
          },
        ],
        {
          commit: LIBRARIES_COMMIT,
          tree: LIBRARIES_TREE,
          snapshot: "catalogue-v2",
        },
        pageEvidence([
          record,
          {
            ...record,
            entryId: "draft-entry",
            lifecycle: "draft",
            selectability: "non_selectable",
            compatibility: "unknown",
            bundlePath: "registry/v2/entries/draft-entry/versions/1.0.0",
          },
        ]),
      ).records.map((entry) => entry.entryId),
    ).toEqual(["component-echo"]);
  });
  it("rejects progressive catalogue records not bound to authenticated evidence", () => {
    const forged = {
      ...record,
      entryId: "forged-entry",
      bundlePath: "registry/v2/entries/forged-entry/versions/1.0.0",
    };
    expect(() =>
      pageCatalogue(
        [forged],
        { commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE, snapshot: "catalogue-v2" },
        pageEvidence([record]),
      ),
    ).toThrow("invalid authenticated catalogue evidence");
  });
  it("rejects accessor-backed paging input without invoking getters", () => {
    let getterCalls = 0;
    const input: {
      commit: string;
      tree: string;
      snapshot: string;
      limit?: number;
    } = {
      commit: LIBRARIES_COMMIT,
      tree: LIBRARIES_TREE,
      snapshot: "catalogue-v2",
    };
    Object.defineProperty(input, "limit", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? 1 : 100;
      },
    });
    expect(() => pageCatalogue([record], input as never, pageEvidence())).toThrow(
      "invalid authenticated catalogue evidence",
    );
    expect(getterCalls).toBe(0);
  });
  it("accepts authenticated raw records digests for progressive paging", () => {
    expect(
      pageCatalogue(
        [record],
        { commit: LIBRARIES_COMMIT, tree: LIBRARIES_TREE, snapshot: "catalogue-v2" },
        {
          ...pageEvidence(),
          recordsSha256: canonicalDigest([record]).slice("sha256:".length),
        },
      ).records,
    ).toHaveLength(1);
  });
  it("rejects malformed required catalogue record fields", () => {
    expect(validate({ ...bundle, record: { ...record, artifactType: undefined } }).ok).toBe(false);
    expect(validate({ ...bundle, record: { ...record, bundlePath: "" } }).ok).toBe(false);
  });
  it("binds the selected record to the canonical catalogue records digest", () => {
    const tamperedCatalogue = cloneAdversarialBundle();
    const firstRecord = tamperedCatalogue.catalogue.records[0];
    if (!firstRecord) {
      throw new Error("expected catalogue record");
    }
    firstRecord.version = "2.0.0";
    expect(validate(tamperedCatalogue).ok).toBe(false);

    const substitutedRecord = {
      ...record,
      entryId: "substituted-component",
      bundlePath: "registry/v2/entries/substituted-component/versions/1.0.0",
    };
    const substitutedManifest = {
      ...manifest,
      releaseId: "substituted-component@1.0.0",
      entryId: "substituted-component",
    };
    const substitutedBundle = cloneAdversarialBundle();
    substitutedBundle.record = {
      ...substitutedRecord,
      releaseManifestSha256: canonicalDigest(substitutedManifest),
    };
    substitutedBundle.manifest = substitutedManifest;
    expect(validate(substitutedBundle).ok).toBe(false);
  });
  it("rejects a self-consistent catalogue digest that is not the pinned provider digest", () => {
    const value = cloneAdversarialBundle();
    value.catalogue.catalogueSha256 = d("d");
    value.verifiedCache.catalogueSha256 = d("d");
    expect(validate(value)).toMatchObject({
      ok: false,
      reason: "invalid catalogue evidence",
    });
  });
  it("accepts the contract-supported raw manifest digest representation", () => {
    const value = cloneAdversarialBundle();
    const rawManifestDigest = record.releaseManifestSha256.slice("sha256:".length);
    value.record.releaseManifestSha256 = rawManifestDigest;
    const firstRecord = value.catalogue.records[0];
    if (!firstRecord) {
      throw new Error("expected catalogue record");
    }
    firstRecord.releaseManifestSha256 = rawManifestDigest;
    value.catalogue.recordsSha256 = canonicalDigest(value.catalogue.records);
    value.verifiedCache.catalogueRecordsSha256 = value.catalogue.recordsSha256;
    value.verifiedCache.releaseManifestSha256 = rawManifestDigest;
    value.consumption.releaseManifestSha256 = rawManifestDigest;
    expect(
      validate(value, authenticatedCatalogueEvidence(value), materializationEvidence(value)).ok,
    ).toBe(true);
  });
  it("normalizes mixed raw and prefixed digest evidence", () => {
    const value = cloneAdversarialBundle();
    value.inventorySha256 = value.inventorySha256.slice("sha256:".length);
    value.dependencyLockSha256 = value.dependencyLockSha256.slice("sha256:".length);
    value.verifiedCache.catalogueRecordsSha256 = value.verifiedCache.catalogueRecordsSha256.slice(
      "sha256:".length,
    );
    value.verifiedCache.releaseManifestSha256 = value.verifiedCache.releaseManifestSha256.slice(
      "sha256:".length,
    );
    value.verifiedCache.inventorySha256 = value.verifiedCache.inventorySha256.slice(
      "sha256:".length,
    );
    value.verifiedCache.payloadSha256 = value.verifiedCache.payloadSha256.slice("sha256:".length);
    value.consumption.releaseManifestSha256 = value.consumption.releaseManifestSha256.slice(
      "sha256:".length,
    );
    const evidence = authenticatedCatalogueEvidence();
    const materialized = materializationEvidence();
    expect(
      validate(
        value,
        {
          ...evidence,
          recordsSha256: evidence.recordsSha256.slice("sha256:".length),
          selectedRecord: {
            ...evidence.selectedRecord,
            releaseManifestSha256: evidence.selectedRecord.releaseManifestSha256.slice(
              "sha256:".length,
            ),
            inventorySha256: evidence.selectedRecord.inventorySha256.slice("sha256:".length),
          },
        },
        {
          ...materialized,
          releaseManifestSha256: materialized.releaseManifestSha256.slice("sha256:".length),
          inventorySha256: materialized.inventorySha256.slice("sha256:".length),
          payloadSha256: materialized.payloadSha256.slice("sha256:".length),
        },
      ).ok,
    ).toBe(true);
  });
  it.each([
    ["bundle", (value: AdversarialRevision2Bundle): void => void (value.extra = true)],
    ["source", (value: AdversarialRevision2Bundle): void => void (value.source.extra = true)],
    ["catalogue", (value: AdversarialRevision2Bundle): void => void (value.catalogue.extra = true)],
    ["manifest", (value: AdversarialRevision2Bundle): void => void (value.manifest.extra = true)],
    [
      "verified cache",
      (value: AdversarialRevision2Bundle): void => void (value.verifiedCache.extra = true),
    ],
    [
      "cache source evidence",
      (value: AdversarialRevision2Bundle): void =>
        void (value.verifiedCache.sourceEvidence.extra = true),
    ],
    [
      "consumption receipt",
      (value: AdversarialRevision2Bundle): void => void (value.consumption.extra = true),
    ],
  ] as const)("rejects unknown fields in the exact %s envelope", (_name, mutate) => {
    const value = cloneAdversarialBundle();
    mutate(value);
    expect(validate(value).ok).toBe(false);
  });
  it("rejects inherited and accessor-backed catalogue records without invoking getters", () => {
    let getterCalls = 0;
    const accessorRecord: AdversarialRevision2Record = { ...record };
    Object.defineProperty(accessorRecord, "entryId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? record.entryId : "other-entry";
      },
    });
    expect(validate({ ...bundle, record: accessorRecord }).ok).toBe(false);
    expect(getterCalls).toBe(0);
    expect(validate({ ...bundle, record: Object.create(record) }).ok).toBe(false);
  });
  it.each([
    "../../outside",
    "/registry/v2/entries/component-echo/versions/1.0.0",
    "registry\\v2\\entries\\component-echo\\versions\\1.0.0",
    "registry/v2/entries/other/versions/1.0.0",
    "registry/v2/entries/component-echo/versions/2.0.0",
  ])("rejects unsafe or mismatched bundle path %s", (bundlePath) => {
    expect(validate({ ...bundle, record: { ...record, bundlePath } }).ok).toBe(false);
  });
  it.each([
    ["withdrawn lifecycle", { lifecycle: "withdrawn" }],
    ["non-selectable record", { selectability: "non_selectable" }],
    ["incompatible record", { compatibility: "incompatible" }],
  ] as const)("rejects exact release with %s", (_name, changes) => {
    expect(validate({ ...bundle, record: { ...record, ...changes } }).ok).toBe(false);
  });
  it("fails closed when pagination receives a malformed provider record", () => {
    expect(() =>
      pageCatalogue(
        [{ ...record, bundlePath: "" }],
        {
          commit: LIBRARIES_COMMIT,
          tree: LIBRARIES_TREE,
          snapshot: "catalogue-v2",
        },
        pageEvidence([{ ...record, bundlePath: "" }]),
      ),
    ).toThrow("invalid catalogue record");
    expect(
      validate({
        ...bundle,
        record: { ...record, releaseSource: { ...source, extra: "payload" } },
      }).ok,
    ).toBe(false);
  });
  it.each(["wrong source", "wrong manifest", "stale cache", "failed consumption"] as const)(
    "rejects %s",
    (failure) => {
      const value = cloneAdversarialBundle();
      if (failure === "wrong source") {
        value.source.commit = "other";
      }
      if (failure === "wrong manifest") {
        value.manifest.payloadSha256 = d("a");
      }
      if (failure === "stale cache") {
        value.verifiedCache.catalogueSha256 = d("z");
      }
      if (failure === "failed consumption") {
        value.consumption.result = "fail";
      }
      expect(validate(value).ok).toBe(false);
    },
  );
  it("rejects an unrelated consumption receipt", () => {
    const value = cloneAdversarialBundle();
    value.consumption.entryId = "other-entry";
    expect(validate(value).ok).toBe(false);
  });

  it("rejects a forged pass receipt that does not match independent materialization evidence", () => {
    const value = cloneAdversarialBundle();
    value.consumption.consumerMaterializedTreeSha1 = "ffeeddccbbaa0099887766554433221100ffeedd";
    expect(validate(value)).toMatchObject({
      ok: false,
      reason: "consumption receipt is not a pass",
    });
    expect(
      validate(bundle, authenticatedCatalogueEvidence(), {
        ...materializationEvidence(),
        verified: false as true,
      }),
    ).toMatchObject({ ok: false, reason: "invalid materialization verification evidence" });
  });

  it("fails closed for malformed catalogue entries without throwing", () => {
    const value = cloneAdversarialBundle();
    value.catalogue.records = [undefined];
    value.catalogue.recordsSha256 = canonicalDigest(value.catalogue.records);
    expect(() => validate(value)).not.toThrow();
    expect(validate(value)).toMatchObject({ ok: false });
  });

  it("requires the selected record to match independently authenticated catalogue evidence", () => {
    expect(
      validate(bundle, {
        ...authenticatedCatalogueEvidence(),
        selectedRecord: {
          ...authenticatedCatalogueEvidence().selectedRecord,
          artifactTreeSha1: "ffeeddccbbaa0099887766554433221100ffeedd",
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: "selected record does not match authenticated catalogue",
    });
  });

  it("fails closed without throwing for malformed authenticated selected-record digests", () => {
    for (const field of ["releaseManifestSha256", "inventorySha256"] as const) {
      const evidence = cloneAdversarialCatalogueEvidence();
      evidence.selectedRecord[field] = null;
      expect(() => validate(bundle, evidence)).not.toThrow();
      expect(validate(bundle, evidence)).toMatchObject({
        ok: false,
        reason: "invalid authenticated catalogue evidence",
      });
    }
  });
});
