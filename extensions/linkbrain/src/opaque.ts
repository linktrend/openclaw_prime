/**
 * Opaque correlation IDs for actor/binding/session/task/run/subagent joins.
 * Raw OpenClaw identifiers are never forwarded as-is.
 */
import { createHash } from "node:crypto";

type OpaqueKind =
  | "actor"
  | "binding"
  | "session"
  | "task"
  | "run"
  | "subagent"
  | "stream"
  | "message"
  | "batch"
  | "event";

function digest(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 16);
}

/** Stable opaque id: `<kind>_<sha256[:16]>`. Empty raw → kind-scoped sentinel. */
export function opaqueId(kind: OpaqueKind, raw: string | undefined | null): string {
  const material = typeof raw === "string" && raw.length > 0 ? raw : `empty:${kind}`;
  return `${kind}_${digest(material)}`;
}

/** Content hash for capture batches (sha256 of canonical JSON). */
export function contentHash(value: unknown): string {
  const canonical = JSON.stringify(value);
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}
