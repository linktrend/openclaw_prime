import {
  LINKBRAIN_V2_COMMIT,
  LINKBRAIN_V2_CONTRACT_VERSION,
  LINKBRAIN_V2_MCP_PROTOCOL,
  LINKBRAIN_V2_TREE,
  createBrainV2Client as createBrainV2ClientRaw,
  type BrainV2AuthenticatedProviderEvidence,
  type BrainV2PlatformIdentity,
  type BrainV2PlatformRevocationDecision,
} from "./src/v2.js";

export const NOW = "2026-08-14T12:00:00.000Z";
export const identity = (): BrainV2PlatformIdentity => ({
  providerCandidate: {
    commit: "5452f90a35ed690698a9161117a9d92c69985582",
    tree: "90b51726f7a77e4620151a463a10cfc3d2007c88",
  },
  claimContractVersion: "platform.auth-claims/1.1.0",
  schemaVersion: "2026.07.28-w4",
  actorId: "actor:ocp",
  organizationRef: "org:linktrend",
  runtimeBindingRef: "binding:ocp-brain",
  credentialReference: "credential-ref:platform-brain",
  issuer: "issuer:platform",
  audience: "audience:brain",
  serviceScopes: ["brain.v2"],
  capabilities: ["brain.knowledge"],
  permittedOperations: ["read", "execute"],
  issuedAt: "2026-08-14T11:00:00.000Z",
  expiresAt: "2026-08-14T13:00:00.000Z",
  revocationStatus: "active",
});

export const expected = {
  actorId: "actor:ocp",
  organizationRef: "org:linktrend",
  runtimeBindingRef: "binding:ocp-brain",
  issuer: "issuer:platform",
  audience: "audience:brain",
  requiredScope: "brain.v2",
  requiredCapability: "brain.knowledge",
  now: NOW,
};
export const identityExpectation = {
  actorId: expected.actorId,
  organizationRef: expected.organizationRef,
  runtimeBindingRef: expected.runtimeBindingRef,
  issuer: expected.issuer,
  audience: expected.audience,
  requiredScope: expected.requiredScope,
  requiredCapability: expected.requiredCapability,
};

export const authenticatedProviderEvidence: BrainV2AuthenticatedProviderEvidence = {
  providerCandidate: { commit: LINKBRAIN_V2_COMMIT, tree: LINKBRAIN_V2_TREE },
  contractVersion: LINKBRAIN_V2_CONTRACT_VERSION,
  artifactDigests: {
    contractsSchema: "sha256:937553789711c1fb58fbd8d2f8ccf90d3554b971da4576c1ec15dbade4fa9a09",
    sessionlessMcp: "sha256:0962edd653da86e25978420b5e59239fe07008ef24aafeb56584220e6a87937c",
    httpRegistry: "sha256:73304a8371dac363c380ad3b869d361354e0c73bd61678fa765aa51fd41c1fd7",
    contractTypes: "sha256:50e9a87eae26c7e90c56913896ce0dac3826b251e3d0b80f05b801b0b07518a8",
    discoveryFixture: "sha256:c45caff2baeba4e47fe108f7ad264efae58373dd57608ffc54485ae2908d00ad",
    projectionFixture: "sha256:4995f99925e9ba2911b24818d0b96550249f11ecdc7f428ca1ae49906d3da36e",
  },
};

export const activeRevocationDecision = (): BrainV2PlatformRevocationDecision => ({
  status: "active",
  observedAt: NOW,
  actorId: identity().actorId,
  organizationRef: identity().organizationRef,
  runtimeBindingRef: identity().runtimeBindingRef,
  credentialReference: identity().credentialReference,
});

type BrainV2ClientInput = Parameters<typeof createBrainV2ClientRaw>[0];
export const createBrainV2Client = (
  input: Omit<BrainV2ClientInput, "authenticatedProviderEvidence" | "resolveRevocationDecision"> &
    Partial<
      Pick<BrainV2ClientInput, "authenticatedProviderEvidence" | "resolveRevocationDecision">
    >,
) =>
  createBrainV2ClientRaw({
    authenticatedProviderEvidence,
    resolveRevocationDecision: activeRevocationDecision,
    ...input,
  });

export const negotiation = {
  protocolVersion: LINKBRAIN_V2_MCP_PROTOCOL,
  sessionless: true,
  contractVersion: LINKBRAIN_V2_CONTRACT_VERSION,
  authority: "advisory",
  executionAuthority: "none",
  sdkSupportsModernProtocol: true,
} as const;

export const page = (disclosure: "guide" | "index" | "metadata" | "record") => ({
  snapshotId: "snapshot:brain-1",
  disclosure,
  pagination: { limit: 25, nextCursor: "v2:25" },
  data: { reference: "knowledge:1", title: "bounded metadata" },
});
