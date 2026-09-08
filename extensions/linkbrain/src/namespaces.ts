/** Plan §11 keyed-store namespaces owned exclusively by linkbrain. */
export const LINKBRAIN_PLUGIN_ID = "linkbrain" as const;

export const LINKBRAIN_NAMESPACES = Object.freeze({
  outbox: "outbox",
  deadletter: "deadletter",
  cursor: "cursor",
  health: "health",
  captureBuffer: "capture-buffer",
} as const);

export type LinkbrainNamespace = (typeof LINKBRAIN_NAMESPACES)[keyof typeof LINKBRAIN_NAMESPACES];

export const LINKBRAIN_NAMESPACE_LIST = Object.freeze(
  Object.values(LINKBRAIN_NAMESPACES) as LinkbrainNamespace[],
);

/** Conversation-bearing hooks (Phase 3) require this operator policy when enabled. */
export const LINKBRAIN_CONVERSATION_HOOK_REQUIREMENT =
  "plugins.entries.linkbrain.hooks.allowConversationAccess=true";
