export const LIBRARIES_COMMIT = "0efa68b19686e976ecee93c6a962e81d2a0265f5" as const;
export const LIBRARIES_TREE = "c42d20b3119ca4bfdd24d4c6b06d6bc7a7f50d4a" as const;
export const LIBRARIES_SCHEMA_VERSION = 2 as const;
export const LIBRARIES_SCHEMA_REVISION = 2 as const;
export const LIBRARIES_SCHEMA_VERSION_LABEL = "2.2" as const;
export const LIBRARIES_CONTRACT_VERSION = "libraries.v2/revision-2" as const;
export const LIBRARIES_CATALOGUE_SHA256 =
  "sha256:a6af16532f82169094fd1766c3d46a435c9e7ac8d47fb57d5fab3adf6bf210d7" as const;

export type Digest = string;
export type Revision2Record = Readonly<{
  schemaVersion: 2;
  schemaRevision: 2;
  recordType: "catalogue_record";
  entryId: string;
  version: string;
  artifactType: "component" | "starter_kit" | "website_template";
  releaseManifestSha256: Digest;
  releaseSource: { releaseSourceCommitSha: string; releaseSourceRepositoryTreeSha1: string };
  artifactTreeSha1: string;
  inventorySha256: Digest;
  lifecycle: string;
  selectability: string;
  compatibility: string;
  bundlePath: string;
}>;
export type Revision2Page = Readonly<{
  snapshot: string;
  records: readonly Revision2Record[];
  nextCursor: string | null;
}>;
export type AuthenticatedRevision2PageEvidence = Readonly<{
  source: Readonly<{ commit: typeof LIBRARIES_COMMIT; tree: typeof LIBRARIES_TREE }>;
  catalogueSha256: typeof LIBRARIES_CATALOGUE_SHA256;
  recordsSha256: Digest;
  snapshot: string;
  verified: true;
}>;
export type Revision2Validation = Readonly<
  { ok: true; record: Revision2Record } | { ok: false; reason: string }
>;
export type ExactRevision2Bundle = Readonly<{
  source: { commit: typeof LIBRARIES_COMMIT; tree: typeof LIBRARIES_TREE };
  catalogue: {
    schemaVersion: 2;
    schemaRevision: 2;
    catalogueType: "catalogue";
    catalogueSha256: Digest;
    recordsSha256: Digest;
    records: readonly Revision2Record[];
  };
  record: Revision2Record;
  manifest: {
    releaseId: string;
    entryId: string;
    version: string;
    releaseSource: Revision2Record["releaseSource"];
    artifactTreeSha1: string;
    payloadSha256: Digest;
    inventorySha256: Digest;
    dependencyLockSha256: Digest;
  };
  inventorySha256: Digest;
  dependencyLockSha256: Digest;
  verifiedCache: {
    sourceEvidence: {
      selectedRepositoryCommitSha: typeof LIBRARIES_COMMIT;
      selectedRepositoryTreeSha1: typeof LIBRARIES_TREE;
      immutable: true;
    };
    releaseSource: Revision2Record["releaseSource"];
    catalogueSha256: Digest;
    catalogueRecordsSha256: Digest;
    entryId: string;
    version: string;
    releaseManifestSha256: Digest;
    inventorySha256: Digest;
    payloadSha256: Digest;
    artifactTreeSha1: string;
  };
  consumption: {
    receiptType: "consumption";
    result: "pass";
    entryId: string;
    version: string;
    releaseManifestSha256: Digest;
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    consumerMaterializedTreeSha1: string;
  };
}>;

export type AuthenticatedRevision2CatalogueEvidence = Readonly<{
  source: Readonly<{ commit: typeof LIBRARIES_COMMIT; tree: typeof LIBRARIES_TREE }>;
  catalogueSha256: typeof LIBRARIES_CATALOGUE_SHA256;
  recordsSha256: Digest;
  selectedRecord: Readonly<{
    entryId: string;
    version: string;
    releaseManifestSha256: Digest;
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    inventorySha256: Digest;
  }>;
  verified: true;
}>;

export type VerifiedConsumerMaterializationEvidence = Readonly<{
  entryId: string;
  version: string;
  releaseManifestSha256: Digest;
  releaseSourceCommitSha: string;
  releaseSourceRepositoryTreeSha1: string;
  artifactTreeSha1: string;
  inventorySha256: Digest;
  payloadSha256: Digest;
  consumerMaterializedTreeSha1: string;
  verified: true;
}>;
