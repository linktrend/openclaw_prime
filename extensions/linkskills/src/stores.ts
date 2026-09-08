/**
 * Keyed-store open helpers for linkskills namespaces.
 * Always uses overflowPolicy: "reject-new".
 */
import type { OpenClawPluginApi } from "../runtime-api.js";
import type { CursorRecord, DeadLetterRecord, HealthRecord, OutboxRecord } from "./envelopes.js";
import {
  LINKSKILLS_NAMESPACES,
  LINKSKILLS_NAMESPACE_LIST,
  type LinkskillsNamespace,
} from "./namespaces.js";

export type LinkskillsKeyedStore<T> = {
  register(key: string, value: T, opts?: { ttlMs?: number }): Promise<void>;
  registerIfAbsent(key: string, value: T, opts?: { ttlMs?: number }): Promise<boolean>;
  update?: (
    key: string,
    updateValue: (current: T | undefined) => T | undefined,
    opts?: { ttlMs?: number },
  ) => Promise<boolean>;
  deleteIf?: (key: string, predicate: (current: T) => boolean) => Promise<boolean>;
  lookup(key: string): Promise<T | undefined>;
  consume(key: string): Promise<T | undefined>;
  delete(key: string): Promise<boolean>;
  entries(): Promise<Array<{ key: string; value: T; createdAt: number; expiresAt?: number }>>;
  clear(): Promise<void>;
};

export type LinkskillsStores = {
  outbox: LinkskillsKeyedStore<OutboxRecord>;
  deadletter: LinkskillsKeyedStore<DeadLetterRecord>;
  cursor: LinkskillsKeyedStore<CursorRecord>;
  health: LinkskillsKeyedStore<HealthRecord>;
  openedNamespaces: readonly LinkskillsNamespace[];
};

export type OpenLinkskillsStoresOptions = {
  maxEntries: number;
  openKeyedStore: <T>(options: {
    namespace: string;
    maxEntries: number;
    overflowPolicy: "reject-new";
  }) => LinkskillsKeyedStore<T>;
};

/** Open only the plan §11 linkskills namespaces with reject-new overflow. */
export function openLinkskillsStores(options: OpenLinkskillsStoresOptions): LinkskillsStores {
  const open = <T>(namespace: LinkskillsNamespace): LinkskillsKeyedStore<T> =>
    options.openKeyedStore<T>({
      namespace,
      maxEntries: options.maxEntries,
      overflowPolicy: "reject-new",
    });

  return {
    outbox: open(LINKSKILLS_NAMESPACES.outbox),
    deadletter: open(LINKSKILLS_NAMESPACES.deadletter),
    cursor: open(LINKSKILLS_NAMESPACES.cursor),
    health: open(LINKSKILLS_NAMESPACES.health),
    openedNamespaces: LINKSKILLS_NAMESPACE_LIST,
  };
}

export function openLinkskillsStoresFromApi(
  api: OpenClawPluginApi,
  maxEntries: number,
): LinkskillsStores {
  return openLinkskillsStores({
    maxEntries,
    openKeyedStore: (options) => api.runtime.state.openKeyedStore(options),
  });
}
