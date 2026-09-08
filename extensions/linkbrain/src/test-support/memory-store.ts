/**
 * In-memory keyed store for linkbrain unit tests.
 * Honors maxEntries + overflowPolicy: "reject-new".
 */
import type { LinkbrainKeyedStore } from "../stores.js";

type Entry<T> = {
  key: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
};

type MemoryStoreOptions = {
  maxEntries: number;
  overflowPolicy?: "reject-new" | "evict-oldest";
  now?: () => number;
};

class MemoryStoreLimitError extends Error {
  readonly code = "PLUGIN_STATE_LIMIT_EXCEEDED" as const;
  readonly operation = "register" as const;

  constructor(message: string) {
    super(message);
    this.name = "MemoryStoreLimitError";
  }
}

export function createMemoryKeyedStore<T>(
  options: MemoryStoreOptions,
): LinkbrainKeyedStore<T> & { size(): number } {
  const entries = new Map<string, Entry<T>>();
  const overflowPolicy = options.overflowPolicy ?? "reject-new";
  const now = options.now ?? (() => Date.now());

  const liveCount = () => entries.size;

  const assertCanInsert = (key: string) => {
    if (entries.has(key)) {
      return;
    }
    if (liveCount() < options.maxEntries) {
      return;
    }
    if (overflowPolicy === "reject-new") {
      throw new MemoryStoreLimitError(
        `Plugin state namespace reached its ${options.maxEntries}-row limit.`,
      );
    }
    // evict-oldest: drop one oldest entry
    let oldestKey: string | null = null;
    let oldestCreated = Number.POSITIVE_INFINITY;
    for (const entry of entries.values()) {
      if (entry.createdAt < oldestCreated) {
        oldestCreated = entry.createdAt;
        oldestKey = entry.key;
      }
    }
    if (oldestKey) {
      entries.delete(oldestKey);
    }
  };

  return {
    size() {
      return entries.size;
    },
    async register(key, value, opts) {
      assertCanInsert(key);
      const createdAt = entries.get(key)?.createdAt ?? now();
      entries.set(key, {
        key,
        value,
        createdAt,
        ...(opts?.ttlMs ? { expiresAt: now() + opts.ttlMs } : {}),
      });
    },
    async registerIfAbsent(key, value, opts) {
      if (entries.has(key)) {
        return false;
      }
      assertCanInsert(key);
      entries.set(key, {
        key,
        value,
        createdAt: now(),
        ...(opts?.ttlMs ? { expiresAt: now() + opts.ttlMs } : {}),
      });
      return true;
    },
    async update(key, updateValue, opts) {
      const current = entries.get(key)?.value;
      const next = updateValue(current);
      if (next === undefined) {
        return false;
      }
      assertCanInsert(key);
      entries.set(key, {
        key,
        value: next,
        createdAt: entries.get(key)?.createdAt ?? now(),
        ...(opts?.ttlMs ? { expiresAt: now() + opts.ttlMs } : {}),
      });
      return true;
    },
    async deleteIf(key, predicate) {
      const current = entries.get(key);
      if (!current || !predicate(current.value)) {
        return false;
      }
      entries.delete(key);
      return true;
    },
    async lookup(key) {
      return entries.get(key)?.value;
    },
    async consume(key) {
      const value = entries.get(key)?.value;
      entries.delete(key);
      return value;
    },
    async delete(key) {
      return entries.delete(key);
    },
    async entries() {
      return Array.from(entries.values(), (entry) => ({
        key: entry.key,
        value: entry.value,
        createdAt: entry.createdAt,
      }));
    },
    async clear() {
      entries.clear();
    },
  };
}
