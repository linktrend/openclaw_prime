// Kept local to preserve extension package boundaries; these are facts issued by Platform.
export const PLATFORM_COMMIT = "5452f90a35ed690698a9161117a9d92c69985582" as const;
export const PLATFORM_TREE = "90b51726f7a77e4620151a463a10cfc3d2007c88" as const;
export const PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION = "platform.auth-claims/1.1.0" as const;
export const PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION = "2026.07.28-w4" as const;

export const LINKBRAIN_V2_COMMIT = "7eb19cec8ae3cf61b0369167dd3f699675546b28" as const;
export const LINKBRAIN_V2_TREE = "c489ed4de06790ef1daade75688b818ff62c7a4f" as const;
export const LINKBRAIN_V2_CONTRACT_VERSION = "brain.v2/2.0.0" as const;
export const LINKBRAIN_V2_PIN_CONTRACT_VERSION = "brain.v2/2.0.0" as const;
export const LINKBRAIN_V2_SCHEMA_VERSION = "2.0.0" as const;
export const LINKBRAIN_V2_MCP_PROTOCOL = "2026-07-28" as const;

export const LINKBRAIN_V2_ARTIFACT_DIGESTS = Object.freeze({
  contractsSchema: "sha256:937553789711c1fb58fbd8d2f8ccf90d3554b971da4576c1ec15dbade4fa9a09",
  sessionlessMcp: "sha256:0962edd653da86e25978420b5e59239fe07008ef24aafeb56584220e6a87937c",
  httpRegistry: "sha256:73304a8371dac363c380ad3b869d361354e0c73bd61678fa765aa51fd41c1fd7",
  contractTypes: "sha256:50e9a87eae26c7e90c56913896ce0dac3826b251e3d0b80f05b801b0b07518a8",
  discoveryFixture: "sha256:c45caff2baeba4e47fe108f7ad264efae58373dd57608ffc54485ae2908d00ad",
  projectionFixture: "sha256:4995f99925e9ba2911b24818d0b96550249f11ecdc7f428ca1ae49906d3da36e",
} as const);

export const BRAIN_V2_DISCLOSURE_LEVELS = Object.freeze([
  "guide",
  "index",
  "metadata",
  "record",
  "evidence",
] as const);

export const BRAIN_V2_OPERATIONS = Object.freeze([
  "v2.discovery",
  "v2.capability.status",
  "v2.projection.ingest",
  "v2.projection.list",
  "v2.projection.get",
  "v2.projection.evidence",
  "v2.task.get",
  "v2.task.list",
  "v2.inbox.read",
  "v2.message.send",
  "v2.checkpoint.write",
  "v2.handoff.create",
  "v2.handoff.accept",
  "v2.conflict.report",
  "v2.event.poll",
  "v2.event.ack",
  "v2.finding.submit",
  "v2.knowledge.browse",
  "v2.knowledge.search",
  "v2.knowledge.load",
] as const);

export type BrainV2Disclosure = (typeof BRAIN_V2_DISCLOSURE_LEVELS)[number];
export type BrainV2Operation = (typeof BRAIN_V2_OPERATIONS)[number];
export const BRAIN_V2_EXECUTE_OPERATIONS = new Set<BrainV2Operation>([
  "v2.projection.ingest",
  "v2.message.send",
  "v2.checkpoint.write",
  "v2.handoff.create",
  "v2.handoff.accept",
  "v2.conflict.report",
  "v2.event.ack",
  "v2.finding.submit",
]);
export type BrainV2ProviderStatus =
  | "available"
  | "degraded"
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "stale"
  | "contract_incompatible"
  | "disabled"
  | "unknown";
export type BrainV2FailureStatus = Exclude<BrainV2ProviderStatus, "available">;

export type BrainV2PlatformIdentity = Readonly<{
  providerCandidate: Readonly<{ commit: typeof PLATFORM_COMMIT; tree: typeof PLATFORM_TREE }>;
  claimContractVersion: typeof PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION;
  schemaVersion: typeof PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION;
  actorId: string;
  organizationRef: string;
  runtimeBindingRef: string;
  credentialReference: string;
  issuer: string;
  audience: string;
  serviceScopes: readonly string[];
  capabilities: readonly string[];
  permittedOperations: readonly ("read" | "execute")[];
  issuedAt: string;
  expiresAt: string;
  revocationStatus: "active";
}>;

export type BrainV2PlatformRevocationDecision = Readonly<{
  status: "active" | "revoked";
  observedAt: string;
  actorId: string;
  organizationRef: string;
  runtimeBindingRef: string;
  credentialReference: string;
}>;

export type BrainV2AuthenticatedProviderEvidence = Readonly<{
  providerCandidate: Readonly<{
    commit: typeof LINKBRAIN_V2_COMMIT;
    tree: typeof LINKBRAIN_V2_TREE;
  }>;
  contractVersion: typeof LINKBRAIN_V2_PIN_CONTRACT_VERSION;
  artifactDigests: typeof LINKBRAIN_V2_ARTIFACT_DIGESTS;
}>;

export type BrainV2IdentityExpectation = Readonly<{
  actorId: string;
  organizationRef: string;
  runtimeBindingRef: string;
  issuer: string;
  audience: string;
  requiredScope: string;
  requiredCapability: string;
  now?: Date | string;
}>;

export type BrainV2Negotiation = Readonly<{
  protocolVersion: typeof LINKBRAIN_V2_MCP_PROTOCOL;
  sessionless: true;
  contractVersion: typeof LINKBRAIN_V2_CONTRACT_VERSION;
  authority: "advisory";
  executionAuthority: "none";
  sdkSupportsModernProtocol: true;
}>;

export type BrainV2Page<T> = Readonly<{
  snapshotId: string;
  disclosure: BrainV2Disclosure;
  pagination: Readonly<{
    limit: number;
    cursor?: string;
    nextCursor?: string;
  }>;
  data: T;
}>;

export type BrainV2SafeResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{
      ok: false;
      status: BrainV2FailureStatus;
      reason: string;
    }>;

export type BrainV2TransportFailure = Readonly<{
  status: BrainV2FailureStatus;
  reason: string;
}>;

export type BrainV2TransportRequest = Readonly<{
  protocolVersion: typeof LINKBRAIN_V2_MCP_PROTOCOL;
  method: "discover" | "tools/call";
  actorBindingRef: string;
  organizationRef: string;
  contractVersion: typeof LINKBRAIN_V2_CONTRACT_VERSION;
  params?: Readonly<Record<string, unknown>>;
}>;

export type BrainV2Transport = Readonly<{
  request(input: BrainV2TransportRequest): Promise<unknown>;
}>;
