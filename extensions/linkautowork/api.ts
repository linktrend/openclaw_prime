export {
  AUTOWORK_COMMIT,
  AUTOWORK_AUDIENCE,
  AUTOWORK_TREE,
  AUTOWORK_CONTRACT_VERSION,
  AUTOWORK_SCHEMA_VERSION,
  AUTOWORK_PROTOCOL_VERSION,
  AUTOWORK_OPERATIONS,
  AUTOWORK_STATES,
  assertIdempotency,
  autoworkReceiptDigest,
  requestFingerprint,
  validateCallback,
  validateRequestAt,
  sameIdempotencyContent,
  validateReceipt,
  validateRequest,
} from "./src/contract.js";
export type {
  AutoworkReceipt,
  AutoworkRequest,
  AutoworkCallback,
  AutoworkAcceptedCallbackState,
  AuthenticatedAutoworkReceiptEvidence,
  OpaqueReference,
  Operation,
  ReceiptState,
  PlatformRevocationDecision,
} from "./src/contract.js";
export {
  AUTOWORK_DECLARED_CAPABILITIES,
  AUTOWORK_IDENTITY,
  authorizeAutoworkCapability,
  evaluatePlatformEligibilityGate,
  evaluateProfileActivationGate,
  evaluateSkillsQualificationGate,
  prepareProviderRuntimeFacts,
} from "./src/capability-gates.js";
export type {
  CapabilityAuthorization,
  GateDecision,
  PreparedRuntimeFacts,
} from "./src/capability-gates.js";
