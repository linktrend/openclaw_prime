/**
 * Hard-reject conversation/content-bearing and Brain-shaped fields.
 * Skills fake must never accept these on any operation payload.
 */

/** Exact keys that are always prohibited (case-sensitive). */
export const PROHIBITED_EXACT_KEYS = Object.freeze([
  "conversation",
  "conversations",
  "message",
  "messages",
  "message_body",
  "message_bodies",
  "prompt",
  "prompts",
  "prompt_fragment",
  "prompt_fragments",
  "reasoning",
  "reasoning_trace",
  "reasoning_traces",
  "chain_of_thought",
  "transcript",
  "transcripts",
  "content",
  "brain_findings",
  "brain_finding",
  "brain_search_results",
  "brain_search",
  "brain_load",
  "brain_capture",
  "private_episode",
  "private_episodes",
  "handoff",
  "handoffs",
  "tool_args",
  "tool_arguments",
  "raw_tool_parameters",
  "raw_tool_args",
  "tool_result",
  "tool_results",
  "raw_tool_result",
  "raw_tool_results",
]);

/** Prefixes that mark Brain or conversation leakage. */
export const PROHIBITED_KEY_PREFIXES = Object.freeze([
  "brain_",
  "conversation_",
  "prompt_",
  "reasoning_",
  "message_",
]);

/**
 * @param {unknown} value
 * @param {string} [path]
 * @returns {{ path: string, key: string } | null}
 */
export function findProhibitedField(value, path = "") {
  if (value == null || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findProhibitedField(value[i], path ? `${path}[${i}]` : `[${i}]`);
      if (hit) {
        return hit;
      }
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isProhibitedKey(key)) {
      return { path: childPath, key };
    }
    const hit = findProhibitedField(child, childPath);
    if (hit) {
      return hit;
    }
  }
  return null;
}

/**
 * @param {string} key
 */
export function isProhibitedKey(key) {
  if (PROHIBITED_EXACT_KEYS.includes(key)) {
    return true;
  }
  return PROHIBITED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
