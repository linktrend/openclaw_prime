// Public linkbrain surfaces for tests and future callers.
export { definePluginEntry } from "./runtime-api.js";
export type { OpenClawPluginApi, OpenClawPluginService } from "./runtime-api.js";
export {
  LINKBRAIN_NAMESPACES,
  LINKBRAIN_PLUGIN_ID,
  type LinkbrainNamespace,
} from "./src/namespaces.js";
export {
  DEFAULT_LINKBRAIN_CONFIG,
  parseLinkbrainConfig,
  type LinkbrainConfig,
  type LinkbrainSecretInput,
  type LinkbrainTransportMode,
} from "./src/config.js";
export {
  LINKBRAIN_REDACTION_POLICY_VERSION,
  redactBrainEnvelope,
  type BrainInternalEnvelope,
} from "./src/envelopes.js";
export {
  createLinkbrainRuntime,
  createBrainFakeTransport,
  type LinkbrainDiagnostics,
  type LinkbrainLeaseRunner,
  type LinkbrainRuntime,
  type LinkbrainTransport,
} from "./src/runtime.js";
export {
  resolveLinkbrainTransport,
  type ResolveLinkbrainTransportParams,
} from "./src/transport.js";
export { createLinkbrainCapture, type LinkbrainCapture } from "./src/capture.js";
export { createLinkbrainLifecycle, type LinkbrainLifecycle } from "./src/lifecycle.js";
export { LINKBRAIN_ALLOWED_WRITE_TOOLS, isAllowedBrainWriteTool } from "./src/tools.js";
export {
  openLinkbrainStores,
  openLinkbrainStoresFromApi,
  type LinkbrainKeyedStore,
  type LinkbrainStores,
  type OpenLinkbrainStoresOptions,
} from "./src/stores.js";
export {
  LINKBRAIN_MCP_TOOL_ALLOWLIST,
  LINKBRAIN_MCP_V2_TOOLS,
  LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST,
  buildLinkbrainV2McpToolFilter,
  LINKBRAIN_LEGACY_MCP_COMPATIBILITY_CONTRACT,
  buildLinkbrainMcpToolFilter,
  isAllowedLinkbrainMcpTool,
  assertAllowedLinkbrainMcpTool,
} from "./mcp-tool-filter.js";
export { opaqueId, contentHash } from "./src/opaque.js";
export { sanitizeCaptureText, stripUnsafeFields, containsUnsafeField } from "./src/sanitize.js";
export { LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT } from "./src/namespaces.js";
export {
  BRAIN_V2_DISCLOSURE_LEVELS,
  BRAIN_V2_OPERATIONS,
  LINKBRAIN_V2_ARTIFACT_DIGESTS,
  LINKBRAIN_V2_COMMIT,
  LINKBRAIN_V2_CONTRACT_VERSION,
  LINKBRAIN_V2_MCP_PROTOCOL,
  LINKBRAIN_V2_PIN_CONTRACT_VERSION,
  LINKBRAIN_V2_SCHEMA_VERSION,
  LINKBRAIN_V2_TREE,
  assertBrainV2Negotiation,
  assertBrainV2Page,
  assertBrainV2PlatformIdentity,
  assertBrainV2SafePayload,
  createBrainV2Client,
  preparePrivateCapture,
  preparePrivateCheckpoint,
  type BrainV2Disclosure,
  type BrainV2AuthenticatedProviderEvidence,
  type BrainV2IdentityExpectation,
  type BrainV2Negotiation,
  type BrainV2Operation,
  type BrainV2Page,
  type BrainV2PlatformIdentity,
  type BrainV2PlatformRevocationDecision,
  type BrainV2PrivateCheckpoint,
  type BrainV2PrivateCapture,
  type BrainV2FailureStatus,
  type BrainV2ProviderStatus,
  type BrainV2SafeResult,
  type BrainV2Transport,
  type BrainV2TransportFailure,
  type BrainV2TransportRequest,
} from "./src/v2.js";
