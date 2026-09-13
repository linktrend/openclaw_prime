export {
  PLATFORM_COMMIT,
  PLATFORM_TREE,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
  PLATFORM_PROVIDER_TRUST_CONTRACT_VERSION,
  PROVIDER_STATUSES,
  validateProviderClaim,
  validatePlatformTrustFacts,
} from "./src/claims.js";
export type {
  ExpectedProviderClaim,
  ProviderCandidate,
  ProviderClaim,
  ProviderClaimValidation,
  ProviderStatus,
  PlatformTrustFacts,
  PlatformTrustValidation,
} from "./src/claims.js";
export {
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATES,
  normalizeIntegrationStatus,
} from "./src/integration-status.js";
export type {
  IntegrationProvider,
  IntegrationState,
  IntegrationStatus,
  IntegrationStatusError,
  IntegrationStatusInput,
  IntegrationStatusResult,
} from "./src/integration-status.js";
export {
  PLATFORM_DECLARED_CAPABILITIES,
  PLATFORM_IDENTITY,
  authorizePlatformCapability,
  evaluatePlatformEligibilityGate,
  evaluateProfileActivationGate,
  evaluateSkillsQualificationGate,
  prepareProviderRuntimeFacts,
} from "./src/capability-gates.js";
export type {
  CapabilityAuthorization,
  GateDecision,
  PreparedRuntimeFacts,
  ProfileActivationSnapshot,
} from "./src/capability-gates.js";
