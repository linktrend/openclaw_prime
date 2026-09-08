// Public linkskills surfaces for tests and future callers.
export { definePluginEntry } from "./runtime-api.js";
export type { OpenClawPluginApi, OpenClawPluginService } from "./runtime-api.js";
export {
  LINKSKILLS_CONVERSATION_HOOK_POLICY,
  LINKSKILLS_NAMESPACES,
  LINKSKILLS_PLUGIN_ID,
  type LinkskillsNamespace,
} from "./src/namespaces.js";
export {
  DEFAULT_LINKSKILLS_CONFIG,
  parseLinkskillsConfig,
  type LinkskillsConfig,
  type LinkskillsSecretInput,
  type LinkskillsTransportMode,
} from "./src/config.js";
export {
  LINKSKILLS_REDACTION_POLICY_VERSION,
  buildSkillsTelemetryEnvelope,
  findProhibitedSkillsField,
  skillsTransportArgsFromEnvelope,
  type SkillsInternalEnvelope,
  type SkillsTelemetryBody,
} from "./src/envelopes.js";
export {
  createLinkskillsRuntime,
  createSkillsFakeTransport,
  type LinkskillsDiagnostics,
  type LinkskillsLeaseRunner,
  type LinkskillsRuntime,
  type LinkskillsTransport,
} from "./src/runtime.js";
export {
  resolveLinkskillsTransport,
  type ResolveLinkskillsTransportParams,
} from "./src/transport.js";
export {
  LINKSKILLS_DEFAULT_TELEMETRY_TOOL,
  LINKSKILLS_DRAIN_TOOLS,
  mapSkillsEventTypeToToolName,
  resolveSkillsDrainToolName,
} from "./src/tools.js";
export {
  openLinkskillsStores,
  openLinkskillsStoresFromApi,
  type LinkskillsKeyedStore,
  type LinkskillsStores,
  type OpenLinkskillsStoresOptions,
} from "./src/stores.js";
export {
  LINKSKILLS_MCP_TOOL_ALLOWLIST,
  LINKSKILLS_MCP_V2_TOOLS,
  LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST,
  buildLinkskillsV2McpToolFilter,
  LINKSKILLS_LEGACY_MCP_COMPATIBILITY_CONTRACT,
  buildLinkskillsMcpToolFilter,
  isAllowedLinkskillsMcpTool,
  assertAllowedLinkskillsMcpTool,
} from "./mcp-tool-filter.js";
export {
  SKILLS_COMMIT,
  SKILLS_TREE,
  SKILLS_MCP_PROTOCOL_VERSION,
  SKILLS_CONTRACT_VERSION,
  SKILLS_RELEASE_CONTRACT_VERSION,
  exactReleaseTelemetry,
  validateExactRelease,
  validateProgressiveReleaseTransition,
  type ExactRelease,
  type AuthenticatedSkillsReleaseEvidence,
  type ExactReleaseLifecycle,
  type ExactReleaseRejectionCode,
  type ExactReleaseStage,
  type ExactReleaseState,
  type ExactReleaseTelemetry,
  type ExactReleaseValidation,
  type ExactReleaseValidationOptions,
  type ProgressiveReleaseState,
  type ReleaseAttestation,
} from "./src/exact-release.js";
export {
  SKILLS_V2_RESOURCE_OPERATIONS,
  SKILLS_V2_TOOL_OPERATIONS,
  SKILLS_V2_OPERATIONS,
  SKILLS_V2_AUDIENCE,
  SKILLS_V2_REQUIRED_CAPABILITY,
  SKILLS_V2_REQUIRED_SCOPE,
  SKILLS_V2_READ_PERMISSION,
  SKILLS_V2_WRITE_PERMISSION,
  skillsSnapshotCursor,
  isModernSkillsOperation,
  validateSkillsQualificationIdentity,
  validateSkillsV2Request,
} from "./src/v2.js";
export type { SkillsV2Operation, SkillsV2Request, SkillsV2TrustedAuthorization } from "./src/v2.js";
