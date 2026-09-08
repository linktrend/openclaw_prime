/**
 * Linkbrain local outbox runtime: enqueue / lease / drain / retry / dead-letter /
 * health / shutdown against an injectable Brain transport (fake in Phase 2).
 */
import { randomUUID } from "node:crypto";
import type { StalledInfo } from "./bounded.js";
import { isOperationTimeout, runBounded, throwIfAborted } from "./bounded.js";
import type { LinkbrainConfig } from "./config.js";
import {
  deadLetterMetaFromEnvelope,
  redactBrainEnvelope,
  type BrainInternalEnvelope,
  type BrainWriteKind,
  type CursorRecord,
  type DeadLetterRecord,
  type HealthRecord,
  type OutboxRecord,
} from "./envelopes.js";
import { LINKBRAIN_NAMESPACES } from "./namespaces.js";
import type { LinkbrainStores } from "./stores.js";
import { isAllowedBrainWriteTool } from "./tools.js";

export type LinkbrainTransportResult = {
  ok: boolean;
  replayed?: boolean;
  retryable?: boolean;
  terminal?: boolean;
  errorCode?: string;
  safeMessage?: string;
  result?: Record<string, unknown>;
};

export type LinkbrainTransport = {
  write(params: {
    toolName: string;
    idempotencyKey: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<LinkbrainTransportResult>;
};

export type LinkbrainDiagnostics = {
  outboxCount: number;
  deadLetterCount: number;
  captureBufferCount: number;
  oldestOutboxAgeMs: number | null;
  oldestOutboxKey: string | null;
  lastDrainStatus: string | null;
  healthStatus: HealthRecord["status"] | null;
  /** Count of deadline races that returned while work may still be retained. */
  stalledCount: number;
  /** Honest stalled/degraded marker; never claims cancel or flushed delivery. */
  lastStalledStatus: string | null;
  /** Never includes payloads. */
  capacity: {
    outboxMaxEntries: number;
    outboxRemaining: number;
  };
};

export type LinkbrainLeaseRunner = <T>(
  options: {
    namespace: string;
    key: string;
    database: { scope: "shared" };
    leaseMs: number;
    waitMs: number;
  },
  run: (lease: { signal: AbortSignal; assertOwned: () => void }) => Promise<T>,
) => Promise<T>;

type CreateLinkbrainRuntimeParams = {
  config: LinkbrainConfig;
  stores: LinkbrainStores;
  transport: LinkbrainTransport;
  withLease?: LinkbrainLeaseRunner;
  now?: () => number;
  maxAttempts?: number;
};

type EnqueueWriteParams = {
  kind: BrainWriteKind;
  toolName: string;
  idempotencyKey: string;
  body: unknown;
  signal?: AbortSignal;
};

export type LinkbrainRuntime = {
  readonly opened: boolean;
  open(): Promise<void>;
  shutdown(): Promise<void>;
  enqueueWrite(params: EnqueueWriteParams): Promise<{ key: string }>;
  drainOnce(options?: { signal?: AbortSignal }): Promise<{
    drained: number;
    retried: number;
    deadLettered: number;
    skipped: number;
  }>;
  noteStalled(info: StalledInfo): void;
  diagnostics(): Promise<LinkbrainDiagnostics>;
};

const DRAIN_LEASE_KEY = "drain";
const HEALTH_KEY = "current";
const CURSOR_KEY = "drain";
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 250;

function isLimitExceeded(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "PLUGIN_STATE_LIMIT_EXCEEDED";
}

function buildOutboxKey(params: {
  kind: BrainWriteKind;
  createdAtMs: number;
  idempotencyKey: string;
}): string {
  // Sortable monotonic key: domain + kind + event time + collision-resistant suffix.
  const suffix = params.idempotencyKey.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 64);
  return `brain:${params.kind}:${String(params.createdAtMs).padStart(13, "0")}:${suffix}:${randomUUID().slice(0, 8)}`;
}

function computeBackoffMs(attemptCount: number): number {
  const exp = Math.min(8, Math.max(0, attemptCount - 1));
  const base = BASE_BACKOFF_MS * 2 ** exp;
  const jitter = Math.floor(Math.random() * Math.min(250, base / 2));
  return base + jitter;
}

function transportArgsFromEnvelope(envelope: BrainInternalEnvelope): Record<string, unknown> {
  if (envelope.kind === "capture_batch") {
    // Live MCP schema is additionalProperties:false and has no top-level
    // idempotencyKey; durable idempotency stays on the envelope and at
    // batch.idempotencyKey. Emitting a top-level key causes pre-dispatch rejection.
    return {
      batch: envelope.body,
    };
  }
  return {
    idempotencyKey: envelope.idempotencyKey,
    ...envelope.body,
  };
}

async function sortedOutbox(
  stores: LinkbrainStores,
): Promise<Array<{ key: string; value: OutboxRecord; createdAt: number }>> {
  const entries = await stores.outbox.entries();
  return entries
    .map((entry) => ({
      key: entry.key,
      value: entry.value,
      // Prefer domain record time so age survives store/host clock differences.
      createdAt: entry.value.createdAtMs || entry.createdAt,
    }))
    .toSorted((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.key.localeCompare(b.key);
    });
}

export function createLinkbrainRuntime(params: CreateLinkbrainRuntimeParams): LinkbrainRuntime {
  const now = params.now ?? (() => Date.now());
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let opened = false;
  let shuttingDown = false;
  let lastDrainStatus: string | null = null;
  let drainTail: Promise<void> = Promise.resolve();
  let stalledCount = 0;
  let lastStalledStatus: string | null = null;

  const runExclusive = async <T>(work: () => Promise<T>): Promise<T> => {
    const run = drainTail.then(work, work);
    drainTail = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  };

  const writeHealth = async (patch: Partial<HealthRecord>): Promise<void> => {
    const existing = (await params.stores.health.lookup(HEALTH_KEY)) ?? {
      version: 1 as const,
      status: "idle" as const,
      updatedAtMs: now(),
    };
    const next: HealthRecord = {
      ...existing,
      ...patch,
      version: 1,
      updatedAtMs: now(),
    };
    await params.stores.health.register(HEALTH_KEY, next);
  };

  const writeCursor = async (patch: Partial<CursorRecord>): Promise<void> => {
    const existing = (await params.stores.cursor.lookup(CURSOR_KEY)) ?? {
      version: 1 as const,
      updatedAtMs: now(),
    };
    await params.stores.cursor.register(CURSOR_KEY, {
      ...existing,
      ...patch,
      version: 1,
      updatedAtMs: now(),
    });
  };

  const moveToDeadLetter = async (
    record: OutboxRecord,
    terminalCode: string,
    safeMessage: string,
  ): Promise<void> => {
    const dead: DeadLetterRecord = {
      version: 1,
      domain: "brain",
      key: record.key,
      createdAtMs: record.createdAtMs,
      movedAtMs: now(),
      toolName: record.toolName,
      idempotencyKey: record.idempotencyKey,
      kind: record.kind,
      attemptCount: record.attemptCount,
      terminalCode,
      safeMessage,
      redactedMeta: deadLetterMetaFromEnvelope(record.envelope),
    };
    await params.stores.deadletter.register(record.key, dead);
    await params.stores.outbox.delete(record.key);
  };

  const scheduleRetry = async (record: OutboxRecord, errorCode: string, safeMessage: string) => {
    const attemptCount = record.attemptCount + 1;
    if (attemptCount >= maxAttempts) {
      await moveToDeadLetter(record, errorCode || "max_attempts", safeMessage || "max attempts");
      return "deadletter" as const;
    }
    const next: OutboxRecord = {
      ...record,
      attemptCount,
      nextAttemptAtMs: now() + computeBackoffMs(attemptCount),
      lastErrorCode: errorCode,
      lastErrorSafeMessage: safeMessage,
    };
    if (params.stores.outbox.update) {
      await params.stores.outbox.update(record.key, () => next);
    } else {
      await params.stores.outbox.register(record.key, next);
    }
    return "retry" as const;
  };

  const processRecord = async (
    record: OutboxRecord,
    signal?: AbortSignal,
  ): Promise<"drained" | "retry" | "deadletter" | "skipped"> => {
    if (shuttingDown || signal?.aborted) {
      return "skipped";
    }
    if (record.nextAttemptAtMs > now()) {
      return "skipped";
    }

    const outcome = await params.transport.write({
      toolName: record.toolName,
      idempotencyKey: record.idempotencyKey,
      arguments: transportArgsFromEnvelope(record.envelope),
      signal,
    });

    if (outcome.ok) {
      // Delete outbox only after Gateway confirms the idempotent write (incl. replay).
      await params.stores.outbox.delete(record.key);
      await writeCursor({ lastDrainedKey: record.key });
      return "drained";
    }

    if (outcome.terminal) {
      await moveToDeadLetter(
        record,
        outcome.errorCode ?? "terminal",
        outcome.safeMessage ?? "terminal failure",
      );
      return "deadletter";
    }

    return await scheduleRetry(
      record,
      outcome.errorCode ?? "retryable",
      outcome.safeMessage ?? "retryable failure",
    );
  };

  const drainBody = async (signal?: AbortSignal) => {
    let drained = 0;
    let retried = 0;
    let deadLettered = 0;
    let skipped = 0;

    if (!params.config.captureDrain && !params.config.coordinationWrites) {
      lastDrainStatus = "drain-flags-disabled";
      return { drained, retried, deadLettered, skipped };
    }

    const entries = await sortedOutbox(params.stores);
    for (const entry of entries) {
      if (shuttingDown || signal?.aborted) {
        skipped += 1;
        break;
      }
      const record = entry.value;
      const allowed =
        (record.kind === "capture_batch" && params.config.captureDrain) ||
        (record.kind === "coordination" && params.config.coordinationWrites);
      if (!allowed) {
        skipped += 1;
        continue;
      }
      const result = await processRecord(record, signal);
      switch (result) {
        case "drained":
          drained += 1;
          break;
        case "retry":
          retried += 1;
          break;
        case "deadletter":
          deadLettered += 1;
          break;
        case "skipped":
          skipped += 1;
          break;
        default: {
          const exhaustive: never = result;
          void exhaustive;
          break;
        }
      }
    }

    lastDrainStatus = `drained=${drained};retried=${retried};dead=${deadLettered};skipped=${skipped}`;
    const outboxCount = (await params.stores.outbox.entries()).length;
    const deadLetterCount = (await params.stores.deadletter.entries()).length;
    await writeHealth({
      status: deadLettered > 0 ? "degraded" : drained > 0 ? "ok" : "idle",
      ...(drained > 0 ? { lastSuccessAtMs: now() } : {}),
      ...(deadLettered > 0 || retried > 0 ? { lastFailureAtMs: now() } : {}),
      lastDrainStatus,
      outboxCount,
      deadLetterCount,
    });
    return { drained, retried, deadLettered, skipped };
  };

  return {
    get opened() {
      return opened;
    },

    async open() {
      if (opened) {
        return;
      }
      // Touch each namespace so capacity/health diagnostics have durable slots.
      await writeHealth({ status: "idle" });
      await writeCursor({});
      opened = true;
      shuttingDown = false;
    },

    async shutdown() {
      shuttingDown = true;
      try {
        await runBounded(
          async () => {
            await drainTail;
          },
          {
            timeoutMs: 2_000,
            label: "runtime-shutdown",
            onStalled: (info) => {
              stalledCount += 1;
              lastStalledStatus = `label=${info.label};reason=${info.reason};atMs=${now()}`;
            },
          },
        );
      } catch (error) {
        if (!isOperationTimeout(error)) {
          throw error;
        }
        // Do not await drainTail after timeout — abandoned work may retain ownership.
        lastDrainStatus = lastDrainStatus
          ? `${lastDrainStatus};shutdown_timeout`
          : "shutdown_timeout";
      }
      lastDrainStatus = lastDrainStatus ? `${lastDrainStatus};shutdown` : "shutdown";
      await writeHealth({
        status: "idle",
        lastDrainStatus,
      });
      opened = false;
    },

    async enqueueWrite(input) {
      if (shuttingDown) {
        throw new Error("linkbrain: runtime is shutting down");
      }
      throwIfAborted(input.signal, "enqueueWrite");
      if (input.kind === "capture_batch" && !params.config.captureEnqueue) {
        throw new Error("linkbrain: captureEnqueue is disabled");
      }
      if (input.kind === "coordination" && !params.config.coordinationWrites) {
        throw new Error("linkbrain: coordinationWrites is disabled");
      }

      const createdAtMs = now();
      const envelope = redactBrainEnvelope({
        kind: input.kind,
        toolName: input.toolName,
        idempotencyKey: input.idempotencyKey,
        redactionPolicyVersion: params.config.redactionPolicyVersion,
        createdAtMs,
        body: input.body,
      });
      const key = buildOutboxKey({
        kind: input.kind,
        createdAtMs,
        idempotencyKey: input.idempotencyKey,
      });
      const record: OutboxRecord = {
        version: 1,
        domain: "brain",
        key,
        createdAtMs,
        toolName: input.toolName,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        envelope,
        attemptCount: 0,
        nextAttemptAtMs: createdAtMs,
      };

      try {
        throwIfAborted(input.signal, "enqueueWrite");
        // Public keyed-store register has no cancel seam; abort is checked around it.
        const claimed = await params.stores.outbox.registerIfAbsent(key, record);
        throwIfAborted(input.signal, "enqueueWrite");
        if (!claimed) {
          // Same sortable key collision is extremely unlikely; treat as duplicate claim.
          return { key };
        }
      } catch (error) {
        if (isLimitExceeded(error)) {
          throw new Error("linkbrain: outbox overflow (reject-new)", { cause: error });
        }
        throw error;
      }
      return { key };
    },

    async drainOnce(options) {
      return await runExclusive(async () => {
        const signal = options?.signal;
        throwIfAborted(signal, "drainOnce");
        const generation = randomUUID();
        await writeCursor({ drainGeneration: generation });

        if (params.withLease) {
          return await params.withLease(
            {
              namespace: LINKBRAIN_NAMESPACES.cursor,
              key: DRAIN_LEASE_KEY,
              database: { scope: "shared" },
              leaseMs: 30_000,
              waitMs: 5_000,
            },
            async ({ signal: leaseSignal, assertOwned }) => {
              assertOwned();
              const merged = signal ? AbortSignal.any([signal, leaseSignal]) : leaseSignal;
              const result = await drainBody(merged);
              assertOwned();
              return result;
            },
          );
        }
        return await drainBody(signal);
      });
    },

    noteStalled(info) {
      stalledCount += 1;
      lastStalledStatus = `label=${info.label};reason=${info.reason};atMs=${now()}`;
    },

    async diagnostics() {
      const outbox = await sortedOutbox(params.stores);
      const dead = await params.stores.deadletter.entries();
      const captureBuffer = await params.stores.captureBuffer.entries();
      const health = await params.stores.health.lookup(HEALTH_KEY);
      const oldest = outbox[0];
      const oldestOutboxAgeMs = oldest ? Math.max(0, now() - oldest.createdAt) : null;
      return {
        outboxCount: outbox.length,
        deadLetterCount: dead.length,
        captureBufferCount: captureBuffer.length,
        oldestOutboxAgeMs,
        oldestOutboxKey: oldest?.key ?? null,
        lastDrainStatus,
        healthStatus: health?.status ?? null,
        stalledCount,
        lastStalledStatus,
        capacity: {
          outboxMaxEntries: params.config.outboxMaxEntries,
          outboxRemaining: Math.max(0, params.config.outboxMaxEntries - outbox.length),
        },
      };
    },
  };
}

/** In-process Brain fake adapter used by Phase 2 tests. */
export function createBrainFakeTransport(fake: {
  callTool: (
    toolName: string,
    args?: Record<string, unknown>,
    meta?: { authToken?: string; requestId?: string },
  ) => Record<string, unknown> & {
    ok: boolean;
    replayed?: boolean;
    result?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
  setForceFailure?: (kind: string | null) => void;
}): LinkbrainTransport {
  return {
    async write(params) {
      if (params.signal?.aborted) {
        return {
          ok: false,
          retryable: true,
          errorCode: "aborted",
          safeMessage: "aborted",
        };
      }
      if (!isAllowedBrainWriteTool(params.toolName)) {
        return {
          ok: false,
          terminal: true,
          errorCode: "tool_not_allowlisted",
          safeMessage: `tool "${params.toolName}" is not on the Brain write allowlist`,
        };
      }
      const outcome = fake.callTool(params.toolName, params.arguments, {
        authToken: "fake-valid-token",
        requestId: params.idempotencyKey,
      });
      if (outcome.ok) {
        return {
          ok: true,
          replayed: outcome.replayed === true,
          result: outcome.result,
        };
      }
      const code = typeof outcome.error?.code === "string" ? outcome.error.code : "brain_error";
      const terminal =
        code === "validation_error" ||
        code === "unauthorized" ||
        code === "forbidden" ||
        code === "not_found" ||
        code === "conflict" ||
        code === "payload_too_large" ||
        code === "terminal" ||
        code === "authentication" ||
        code === "prohibited_field" ||
        code === "cross_domain_field";
      const retryable =
        code === "internal_error" ||
        code === "rate_limited" ||
        code === "retryable" ||
        code === "throttled";
      return {
        ok: false,
        terminal,
        retryable,
        errorCode: code,
        safeMessage:
          typeof outcome.error?.safeMessage === "string"
            ? outcome.error.safeMessage
            : "brain write failed",
      };
    },
  };
}
