export const AUTOWORK_COMMIT = "4eb29203766b1ccf200a2dc10b39cc58d175c90c" as const;
export const AUTOWORK_TREE = "5f306d674780a5a26048017f916da6048d71e7a5" as const;
export const AUTOWORK_CONTRACT_VERSION = "2026-08-13.v1" as const;
export const AUTOWORK_SCHEMA_VERSION = "provider-contract-v1" as const;
export const AUTOWORK_PROTOCOL_VERSION = "2026-07-28" as const;
export const AUTOWORK_AUDIENCE = "autowork" as const;
export const AUTOWORK_OPERATIONS = Object.freeze([
  "status_collection",
  "precheck",
  "evidence_collection",
  "notification_delivery",
  "external_assistance",
  "artifact_transform",
  "media_package",
  "outreach_adapter",
] as const);
export const AUTOWORK_STATES = Object.freeze([
  "accepted",
  "queued",
  "running",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
  "timed_out",
  "rejected",
  "blocked",
  "quarantined",
  "unavailable",
  "contract_incompatible",
] as const);
export type Operation = (typeof AUTOWORK_OPERATIONS)[number];
export type ReceiptState = (typeof AUTOWORK_STATES)[number];
export type OpaqueReference = Readonly<{ ref: string; digest: string; observedAt: string }>;
export type AutoworkRequest = Readonly<{
  providerCandidate: { commit: typeof AUTOWORK_COMMIT; tree: typeof AUTOWORK_TREE };
  contractVersion: typeof AUTOWORK_CONTRACT_VERSION;
  protocolVersion: string;
  requestId: string;
  platform: Readonly<{
    orgId: string;
    actorId: string;
    audience: string;
    capability: string;
    credentialId: string;
    bindingId: string;
    issuedAt: string;
    expiresAt: string;
    revocationRef: string;
  }>;
  automation: Readonly<{
    automationId: string;
    version: string;
    definitionDigest: string;
    configurationRef: OpaqueReference;
  }>;
  operationKind: Operation;
  inputRef: OpaqueReference;
  artifactRefs: readonly OpaqueReference[];
  resultDestinationRef: string;
  correlationRefs: readonly OpaqueReference[];
  brainHandoffRef?: OpaqueReference;
  idempotencyKey: string;
  expiresAt: string;
  cancellationRequestedAt?: string;
}>;
export type AutoworkReceipt = Readonly<{
  providerCandidate: { commit: typeof AUTOWORK_COMMIT; tree: typeof AUTOWORK_TREE };
  contractVersion: typeof AUTOWORK_CONTRACT_VERSION;
  requestId: string;
  receiptId: string;
  state: ReceiptState;
  acceptedAt: string;
  updatedAt: string;
  attemptCount: number;
  requestFingerprint: string;
  automation: AutoworkRequest["automation"];
  resultRefs: readonly OpaqueReference[];
  evidenceRefs: readonly OpaqueReference[];
  uncertainOutcome: boolean;
}>;
export type AuthenticatedAutoworkReceiptEvidence = Readonly<{
  providerCandidate: { commit: typeof AUTOWORK_COMMIT; tree: typeof AUTOWORK_TREE };
  contractVersion: typeof AUTOWORK_CONTRACT_VERSION;
  requestId: string;
  receiptId: string;
  receiptDigest: string;
  verified: true;
}>;
export type AutoworkCallback = Readonly<{
  requestId: string;
  receiptId: string;
  orgId: string;
  callbackBindingRef: string;
  sourceTimestamp: string;
  receipt: AutoworkReceipt;
}>;
export type AutoworkAcceptedCallbackState = Readonly<{
  latestSourceTimestamp: string | null;
  acceptedReceiptIds: readonly string[];
  latestReceiptState: ReceiptState | null;
  latestAttemptCount: number | null;
}>;
export type PlatformRevocationDecision = Readonly<{
  status: "active" | "revoked";
  observedAt: string;
  credentialId: string;
  bindingId: string;
  orgId: string;
  actorId: string;
  audience: string;
  capability: string;
  revocationRef: string;
  authorizedOperation: Operation;
}>;
