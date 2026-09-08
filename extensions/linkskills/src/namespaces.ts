/** Plan §11 keyed-store namespaces owned exclusively by linkskills. */
export const LINKSKILLS_PLUGIN_ID = "linkskills" as const;

export const LINKSKILLS_NAMESPACES = Object.freeze({
  outbox: "outbox",
  deadletter: "deadletter",
  cursor: "cursor",
  health: "health",
} as const);

export type LinkskillsNamespace =
  (typeof LINKSKILLS_NAMESPACES)[keyof typeof LINKSKILLS_NAMESPACES];

export const LINKSKILLS_NAMESPACE_LIST = Object.freeze(
  Object.values(LINKSKILLS_NAMESPACES) as LinkskillsNamespace[],
);

/**
 * Skills never registers conversation/prompt/message-bearing hooks.
 * This constant documents the permanent privacy invariant for tests and reviews.
 */
export const LINKSKILLS_CONVERSATION_HOOK_POLICY =
  "linkskills never registers conversation hooks; omit plugins.entries.linkskills.hooks.allowConversationAccess";
