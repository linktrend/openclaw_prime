/**
 * Linkskills local outbox runtime: enqueue / lease / drain / retry / dead-letter /
 * health / shutdown against an injectable Skills transport (fake in Phase 4).
 */
import { randomUUID } from "node:crypto";
import {
  createKeyedPromiseChain,
  isOperationTimeout,
  runBounded,
  runExclusiveBounded,
  throwIfAborted,
  type StalledInfo,
} from "./bounded.js";
import type { LinkskillsConfig } from "./config.js";
import {
  buildSkillsTelemetryEnvelope,
  deadLetterMetaFromEnvelope,
  skillsTransportArgsFromEnvelope,
  type CursorRecord,
  type DeadLetterRecord,
  type HealthRecord,
  type OutboxRecord,
  type SkillsInternalEnvelope,
} from "./envelopes.js";
import { LINKSKILLS_NAMESPACES } from "./namespaces.js";
import type { LinkskillsStores } from "./stores.js";
import { resolveSkillsDrainToolName } from "./tools.js";

export type LinkskillsTransportResult = {
  ok: boolean;
  replayed?: boolean;
  retryable?: boolean;
  terminal?: boolean;
  errorCode?: string;
  safeMessage?: string;
  result?: Record<string, unknown>;
};

export type LinkskillsTransport = {
  write(params: {
    toolName: string;
    idempotencyKey: string;
    arguments: Record<string, unknown>;
    envelope: SkillsInternalEnvelope;
    signal?: AbortSignal;
  }): Promise<LinkskillsTransportResult>;
};

export type LinkskillsDiagnostics = {
  outboxCount: number;
  deadLetterCount: number;
  oldestOutboxAgeMs: number | null;
  oldestOutboxKey: string | null;
  lastDrainStatus: string | null;
  healthStatus: HealthRecord["status"] | null;
  stalledCount: number;
  lastStalledStatus: string | null;
  /** Never includes payloads. */
  capacity: {
    outboxMaxEntries: number;
    outboxRemaining: number;
  };
};

export type LinkskillsLeaseRunner = <T>(
  options: {
    namespace: string;
    key: string;
    database: { scope: "shared" };
    leaseMs: number;
    waitMs: number;
  },
  run: (lease: { signal: AbortSignal; assertOwned: () => void }) => Promise<T>,
) => Promise<T>;

type CreateLinkskillsRuntimeParams = {
  config: LinkskillsConfig;
  stores: LinkskillsStores;
  transport: LinkskillsTransport;
  withLease?: LinkskillsLeaseRunner;
  now?: () => number;
  maxAttempts?: number;
};

type EnqueueTelemetryParams = {
  toolName?: string;
  idempotencyKey: string;
  body: unknown;
  signal?: AbortSignal;
};

export type LinkskillsRuntime = {
  readonly opened: boolean;
  open(): Promise<void>;
  shutdown(): Promise<void>;
  enqueueTelemetry(params: EnqueueTelemetryParams): Promise<{ key: string }>;
  drainOnce(options?: { signal?: AbortSignal }): Promise<{
    drained: number;
    retried: number;
    deadLettered: number;
    skipped: number;
  }>;
  noteStalled(info: StalledInfo): void;
  diagnostics(): Promise<LinkskillsDiagnostics>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildOutboxKey(params: { createdAtMs: number; idempotencyKey: string }): string {
  const suffix = params.idempotencyKey.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 64);
  return `skills:structured_event:${String(params.createdAtMs).padStart(13, "0")}:${suffix}:${randomUUID().slice(0, 8)}`;
}

function computeBackoffMs(attemptCount: number): number {
  const exp = Math.min(8, Math.max(0, attemptCount - 1));
  const base = BASE_BACKOFF_MS * 2 ** exp;
  const jitter = Math.floor(Math.random() * Math.min(250, base / 2));
  return base + jitter;
}

async function sortedOutbox(
  stores: LinkskillsStores,
): Promise<Array<{ key: string; value: OutboxRecord; createdAt: number }>> {
  const entries = await stores.outbox.entries();
  return entries
    .map((entry) => ({
      key: entry.key,
      value: entry.value,
      createdAt: entry.value.createdAtMs || entry.createdAt,
    }))
    .toSorted((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.key.localeCompare(b.key);
    });
}

export function createLinkskillsRuntime(params: CreateLinkskillsRuntimeParams): LinkskillsRuntime {
  const now = params.now ?? (() => Date.now());
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let opened = false;
  let shuttingDown = false;
  let lastDrainStatus: string | null = null;
  let drainTail: Promise<void> = Promise.resolve();
  let stalledCount = 0;
  let lastStalledStatus: string | null = null;
  const withEnqueueLock = createKeyedPromiseChain();
  const enqueueTimeoutMs = 2_000;

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
      domain: "skills",
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
      arguments: skillsTransportArgsFromEnvelope(record.envelope, record.toolName),
      envelope: record.envelope,
      signal,
    });

    if (outcome.ok) {
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

    if (!params.config.telemetryDrain) {
      lastDrainStatus = "drain-flags-disabled";
      return { drained, retried, deadLettered, skipped };
    }

    const entries = await sortedOutbox(params.stores);
    for (const entry of entries) {
      if (shuttingDown || signal?.aborted) {
        skipped += 1;
        break;
      }
      const result = await processRecord(entry.value, signal);
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
    const oldestAge =
      outboxCount > 0
        ? Math.max(
            0,
            now() -
              Math.min(
                ...((await sortedOutbox(params.stores)).map(
                  (entry) => entry.createdAt,
                ) as number[]),
              ),
          )
        : null;
    const ageAlarm =
      oldestAge !== null && oldestAge > params.config.outboxAgeAlarmMs
        ? ("degraded" as const)
        : null;
    await writeHealth({
      status: ageAlarm ?? (deadLettered > 0 ? "degraded" : drained > 0 ? "ok" : "idle"),
      ...(drained > 0 ? { lastSuccessAtMs: now() } : {}),
      ...(deadLettered > 0 || retried > 0 || ageAlarm ? { lastFailureAtMs: now() } : {}),
      ...(ageAlarm ? { lastErrorCode: "outbox_age_alarm" } : {}),
      lastDrainStatus,
      outboxCount,
      deadLetterCount,
      oldestOutboxAgeMs: oldestAge,
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
            onStalled: () => {
              lastDrainStatus = lastDrainStatus
                ? `${lastDrainStatus};shutdown_stalled`
                : "shutdown_stalled";
            },
          },
        );
      } catch (error) {
        if (!isOperationTimeout(error)) {
          throw error;
        }
        // Drain ownership may still be held by abandoned work; do not claim clean idle.
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

    async enqueueTelemetry(input) {
      if (shuttingDown) {
        throw new Error("linkskills: runtime is shutting down");
      }
      if (!params.config.telemetryEnqueue) {
        throw new Error("linkskills: telemetryEnqueue is disabled");
      }

      return await runExclusiveBounded(
        withEnqueueLock,
        "telemetry-enqueue",
        {
          timeoutMs: enqueueTimeoutMs,
          signal: input.signal,
          label: "telemetry-enqueue",
          onStalled: (info) => {
            stalledCount += 1;
            lastStalledStatus = `label=${info.label};reason=${info.reason};atMs=${now()}`;
          },
        },
        async (signal) => {
          throwIfAborted(signal, "enqueueTelemetry");
          if (shuttingDown) {
            throw new Error("linkskills: runtime is shutting down");
          }

          const createdAtMs = now();
          const eventType =
            isRecord(input.body) && typeof input.body.event_type === "string"
              ? input.body.event_type
              : undefined;
          const toolName = resolveSkillsDrainToolName({
            toolName: input.toolName,
            eventType,
          });
          const envelope = buildSkillsTelemetryEnvelope({
            toolName,
            idempotencyKey: input.idempotencyKey,
            redactionPolicyVersion: params.config.redactionPolicyVersion,
            createdAtMs,
            body: input.body,
          });
          const key = buildOutboxKey({
            createdAtMs,
            idempotencyKey: input.idempotencyKey,
          });
          const record: OutboxRecord = {
            version: 1,
            domain: "skills",
            key,
            createdAtMs,
            toolName,
            idempotencyKey: input.idempotencyKey,
            kind: "structured_event",
            envelope,
            attemptCount: 0,
            nextAttemptAtMs: createdAtMs,
          };

          try {
            throwIfAborted(signal, "enqueueTelemetry");
            const claimed = await params.stores.outbox.registerIfAbsent(key, record);
            throwIfAborted(signal, "enqueueTelemetry");
            if (!claimed) {
              return { key };
            }
          } catch (error) {
            if (isLimitExceeded(error)) {
              throw new Error("linkskills: outbox overflow (reject-new)", { cause: error });
            }
            throw error;
          }
          return { key };
        },
      );
    },

    async drainOnce(options) {
      return await runExclusive(async () => {
        const signal = options?.signal;
        const generation = randomUUID();
        await writeCursor({ drainGeneration: generation });

        if (params.withLease) {
          return await params.withLease(
            {
              namespace: LINKSKILLS_NAMESPACES.cursor,
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
      const health = await params.stores.health.lookup(HEALTH_KEY);
      const oldest = outbox[0];
      const oldestOutboxAgeMs = oldest ? Math.max(0, now() - oldest.createdAt) : null;
      return {
        outboxCount: outbox.length,
        deadLetterCount: dead.length,
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

export type SkillsFakeDispatch = {
  dispatch: (
    operation: string,
    args?: Record<string, unknown>,
    meta?: { authorization?: string },
  ) => Record<string, unknown>;
  toErrorEnvelope?: (err: unknown) => Record<string, unknown> & {
    code?: string;
    message?: string;
    retryable?: boolean;
    httpStatus?: number;
  };
  idempotency?: { size: () => number } | Map<string, unknown>;
};

/** In-process Skills fake adapter used by Phase 4 tests. */
export function createSkillsFakeTransport(options: {
  fake: SkillsFakeDispatch;
  authorization: string;
}): LinkskillsTransport {
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
      try {
        const outcome = options.fake.dispatch(
          params.toolName,
          {
            params: params.arguments,
            idempotency_key: params.idempotencyKey,
            request_id: params.idempotencyKey,
            authorization: options.authorization,
          },
          { authorization: options.authorization },
        );
        const data = outcome.data;
        const replayed =
          data !== null &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          (data as Record<string, unknown>).replayed === true;
        return {
          ok: true,
          replayed,
          result: outcome as Record<string, unknown>,
        };
      } catch (error) {
        const mapped = options.fake.toErrorEnvelope?.(error) ?? {
          code: "skills_error",
          message: error instanceof Error ? error.message : "skills write failed",
          retryable: false,
        };
        const code = typeof mapped.code === "string" ? mapped.code : "skills_error";
        const retryable =
          mapped.retryable === true || code === "rate_limited" || code === "retryable";
        const terminal =
          !retryable &&
          (code === "validation_failed" ||
            code === "unauthorized" ||
            code === "forbidden" ||
            code === "terminal" ||
            code === "authentication" ||
            code === "incompatible_profile" ||
            (typeof mapped.httpStatus === "number" &&
              mapped.httpStatus >= 400 &&
              mapped.httpStatus < 500 &&
              mapped.httpStatus !== 429));
        return {
          ok: false,
          terminal,
          retryable,
          errorCode: code,
          safeMessage: typeof mapped.message === "string" ? mapped.message : "skills write failed",
        };
      }
    },
  };
}
