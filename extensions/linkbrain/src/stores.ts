/**
 * Keyed-store open helpers for linkbrain namespaces.
 * Always uses overflowPolicy: "reject-new".
 */
import type { OpenClawPluginApi } from "../runtime-api.js";
import type { CursorRecord, DeadLetterRecord, HealthRecord, OutboxRecord } from "./envelopes.js";
import {
  LINKBRAIN_NAMESPACES,
  LINKBRAIN_NAMESPACE_LIST,
  type LinkbrainNamespace,
} from "./namespaces.js";

export type LinkbrainKeyedStore<T> = {
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

export type LinkbrainStores = {
  outbox: LinkbrainKeyedStore<OutboxRecord>;
  deadletter: LinkbrainKeyedStore<DeadLetterRecord>;
  cursor: LinkbrainKeyedStore<CursorRecord>;
  health: LinkbrainKeyedStore<HealthRecord>;
  captureBuffer: LinkbrainKeyedStore<Record<string, unknown>>;
  openedNamespaces: readonly LinkbrainNamespace[];
};

export type OpenLinkbrainStoresOptions = {
  maxEntries: number;
  openKeyedStore: <T>(options: {
    namespace: string;
    maxEntries: number;
    overflowPolicy: "reject-new";
  }) => LinkbrainKeyedStore<T>;
};

/** Open only the plan §11 linkbrain namespaces with reject-new overflow. */
export function openLinkbrainStores(options: OpenLinkbrainStoresOptions): LinkbrainStores {
  const open = <T>(namespace: LinkbrainNamespace): LinkbrainKeyedStore<T> =>
    options.openKeyedStore<T>({
      namespace,
      maxEntries: options.maxEntries,
      overflowPolicy: "reject-new",
    });

  return {
    outbox: open(LINKBRAIN_NAMESPACES.outbox),
    deadletter: open(LINKBRAIN_NAMESPACES.deadletter),
    cursor: open(LINKBRAIN_NAMESPACES.cursor),
    health: open(LINKBRAIN_NAMESPACES.health),
    captureBuffer: open(LINKBRAIN_NAMESPACES.captureBuffer),
    openedNamespaces: LINKBRAIN_NAMESPACE_LIST,
  };
}

export function openLinkbrainStoresFromApi(
  api: OpenClawPluginApi,
  maxEntries: number,
): LinkbrainStores {
  return openLinkbrainStores({
    maxEntries,
    openKeyedStore: (options) => api.runtime.state.openKeyedStore(options),
  });
}
