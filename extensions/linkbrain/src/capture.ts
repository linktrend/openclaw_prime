/**
 * Bounded local capture buffer: durable pending events → outbox batches.
 * Flush on size limits and compaction/reset/end boundaries.
 *
 * Local buffer keeps sequence/role/text; flush adapts to Brain wire shape via
 * capture-batch-adapter (sessionId + ConversationEvent fields). Actor ids are
 * never forwarded on the remote batch body.
 */
import { randomUUID } from "node:crypto";
import {
  createKeyedPromiseChain,
  isOperationTimeout,
  runExclusiveBounded,
  throwIfAborted,
  type StalledInfo,
} from "./bounded.js";
import {
  buildBrainWireCaptureBatch,
  type CaptureBufferEvent,
  type CaptureInputRole,
} from "./capture-batch-adapter.js";
import type { LinkbrainConfig } from "./config.js";
import { opaqueId } from "./opaque.js";
import type { LinkbrainRuntime } from "./runtime.js";
import { sanitizeCaptureText } from "./sanitize.js";
import type { LinkbrainStores } from "./stores.js";
import { LINKBRAIN_CAPTURE_TOOL } from "./tools.js";

type CaptureBufferRecord = {
  version: 1;
  streamId: string;
  /** Opaque session id for Brain wire batches (distinct kind from stream). */
  sessionId: string;
  events: CaptureBufferEvent[];
  nextSequence: number;
  updatedAtMs: number;
  /** Dedupe fingerprints already accepted into this buffer. */
  seenFingerprints: string[];
};

type CaptureEnqueueInput = {
  streamKey: string;
  actorKey?: string;
  role: CaptureInputRole;
  text: string;
  /** Optional stable fingerprint to drop duplicate callbacks. */
  fingerprint?: string;
};

type CaptureFlushReason =
  | "batch_limit"
  | "before_compaction"
  | "before_reset"
  | "session_end"
  | "gateway_stop"
  | "manual";

export type LinkbrainCapture = {
  enqueue(input: CaptureEnqueueInput): Promise<{ accepted: boolean; flushed: boolean }>;
  flush(streamKey: string, reason: CaptureFlushReason): Promise<{ batches: number }>;
  flushAll(
    reason: CaptureFlushReason,
    options?: { signal?: AbortSignal },
  ): Promise<{ batches: number }>;
  getBuffer(streamKey: string): Promise<CaptureBufferRecord | undefined>;
};

function bufferKey(streamId: string): string {
  return `stream:${streamId}`;
}

function estimateBytes(events: CaptureBufferEvent[]): number {
  return Buffer.byteLength(JSON.stringify(events), "utf8");
}

/** True when a keyed-store insert was rejected by reject-new overflow. */
function isLimitExceeded(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: unknown }).code === "PLUGIN_STATE_LIMIT_EXCEEDED";
}

type CreateLinkbrainCaptureParams = {
  config: LinkbrainConfig;
  stores: LinkbrainStores;
  runtime: LinkbrainRuntime;
  now?: () => number;
  /** Per-operation bound independent of host hook timeouts. */
  operationTimeoutMs?: number;
  onStalled?: (info: StalledInfo) => void;
};

export function createLinkbrainCapture(params: CreateLinkbrainCaptureParams): LinkbrainCapture {
  const now = params.now ?? (() => Date.now());
  const operationTimeoutMs = params.operationTimeoutMs ?? 2_000;
  /** Serialize enqueue/flush/clear for one opaque stream id. */
  const withStreamLock = createKeyedPromiseChain();
  const noteStalled = (info: StalledInfo) => {
    params.onStalled?.(info);
    params.runtime.noteStalled?.(info);
  };

  const load = async (streamId: string, signal?: AbortSignal): Promise<CaptureBufferRecord> => {
    throwIfAborted(signal, "capture-load");
    const existing = await params.stores.captureBuffer.lookup(bufferKey(streamId));
    throwIfAborted(signal, "capture-load");
    if (
      existing &&
      typeof existing === "object" &&
      (existing as CaptureBufferRecord).version === 1
    ) {
      const record = existing as CaptureBufferRecord;
      return {
        ...record,
        // Pre-contract buffers may omit sessionId; derive a stable opaque fallback.
        sessionId:
          typeof record.sessionId === "string" && record.sessionId.length > 0
            ? record.sessionId
            : opaqueId("session", record.streamId),
        events: Array.isArray(record.events)
          ? record.events.map((event) => ({
              sequence: event.sequence,
              role: event.role,
              text: event.text,
              acceptedAtMs:
                typeof event.acceptedAtMs === "number" && Number.isFinite(event.acceptedAtMs)
                  ? event.acceptedAtMs
                  : record.updatedAtMs,
            }))
          : [],
      };
    }
    return {
      version: 1,
      streamId,
      sessionId: opaqueId("session", streamId),
      events: [],
      nextSequence: 1,
      updatedAtMs: now(),
      seenFingerprints: [],
    };
  };

  const save = async (record: CaptureBufferRecord, signal?: AbortSignal): Promise<void> => {
    throwIfAborted(signal, "capture-save");
    // Public keyed-store register has no cancel seam; check before and after.
    await params.stores.captureBuffer.register(bufferKey(record.streamId), {
      ...record,
      updatedAtMs: now(),
    });
    throwIfAborted(signal, "capture-save");
  };

  const clear = async (streamId: string, signal?: AbortSignal): Promise<void> => {
    throwIfAborted(signal, "capture-clear");
    await params.stores.captureBuffer.delete(bufferKey(streamId));
    throwIfAborted(signal, "capture-clear");
  };

  const flushRecord = async (
    record: CaptureBufferRecord,
    reason: CaptureFlushReason,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (record.events.length === 0) {
      return false;
    }
    if (!params.config.captureEnqueue) {
      // Keep durable buffer; do not assemble remote-bound batches.
      return false;
    }

    throwIfAborted(signal, `capture-flush:${reason}`);
    // Adapt durable buffer → Brain PrivateCaptureBatch wire shape (no actor overrides).
    const body = buildBrainWireCaptureBatch({
      sessionId: record.sessionId,
      events: record.events,
    });
    const idempotencyKey = body.idempotencyKey;
    await params.runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: LINKBRAIN_CAPTURE_TOOL,
      idempotencyKey,
      body,
      signal,
    });
    // Enqueue already durable in outbox; still clear buffer to avoid double-batch.
    await clear(record.streamId, signal);
    return true;
  };

  return {
    async enqueue(input) {
      if (!params.config.captureEnqueue) {
        return { accepted: false, flushed: false };
      }
      const streamId = opaqueId("stream", input.streamKey);
      // Opaque session for Brain wire. actorKey is accepted for API compat but never
      // forwarded — Brain binds actor from auth, not capture content.
      const sessionId = opaqueId("session", input.streamKey);
      const fingerprint = input.fingerprint ? opaqueId("message", input.fingerprint) : undefined;

      let durableAccepted = false;

      try {
        return await runExclusiveBounded(
          withStreamLock,
          streamId,
          {
            timeoutMs: operationTimeoutMs,
            label: "capture-enqueue",
            onStalled: noteStalled,
          },
          async (signal) => {
            const record = await load(streamId, signal);
            if (fingerprint && record.seenFingerprints.includes(fingerprint)) {
              return { accepted: false, flushed: false };
            }
            const acceptedAtMs = now();
            const event: CaptureBufferEvent = {
              sequence: record.nextSequence,
              role: input.role,
              text: sanitizeCaptureText(input.text),
              acceptedAtMs,
            };
            const nextEvents = [...record.events, event];
            const nextFingerprints = fingerprint
              ? [...record.seenFingerprints, fingerprint].slice(-256)
              : record.seenFingerprints;
            const next: CaptureBufferRecord = {
              version: 1,
              streamId,
              sessionId,
              events: nextEvents,
              nextSequence: record.nextSequence + 1,
              updatedAtMs: acceptedAtMs,
              seenFingerprints: nextFingerprints,
            };

            // Durable accept first. Flush/outbox failures must not lose this event.
            try {
              await save(next, signal);
            } catch (error) {
              // reject-new on capture-buffer: leave prior streams/events untouched.
              if (isLimitExceeded(error)) {
                return { accepted: false, flushed: false };
              }
              throw error;
            }
            durableAccepted = true;

            const overEvents = nextEvents.length >= params.config.batchMaxEvents;
            const overBytes = estimateBytes(nextEvents) >= params.config.batchMaxBytes;
            if (!(overEvents || overBytes)) {
              return { accepted: true, flushed: false };
            }

            try {
              const flushed = await flushRecord(next, "batch_limit", signal);
              // flushed=true only after outbox enqueue + buffer clear inside flushRecord.
              return { accepted: true, flushed };
            } catch (error) {
              if (isOperationTimeout(error)) {
                throw error;
              }
              // Outbox overflow / shutdown / disabled / transport enqueue error:
              // event remains in durable buffer for later flush/drain. Never claim flushed.
              return { accepted: true, flushed: false };
            }
          },
        );
      } catch (error) {
        // Timed-out after durable save: event remains buffered/outboxed; never claim flushed.
        if (isOperationTimeout(error) && durableAccepted) {
          return { accepted: true, flushed: false };
        }
        throw error;
      }
    },

    async flush(streamKey, reason) {
      const streamId = opaqueId("stream", streamKey);
      try {
        return await runExclusiveBounded(
          withStreamLock,
          streamId,
          {
            timeoutMs: operationTimeoutMs,
            label: `capture-flush:${reason}`,
            onStalled: noteStalled,
          },
          async (signal) => {
            // Re-load under the stream lock so we never clear a newer concurrent accept.
            const record = await load(streamId, signal);
            try {
              const flushed = await flushRecord(record, reason, signal);
              return { batches: flushed ? 1 : 0 };
            } catch (error) {
              if (isOperationTimeout(error)) {
                throw error;
              }
              // Outbox/shutdown failure: buffer retained; never claim a flushed batch.
              return { batches: 0 };
            }
          },
        );
      } catch (error) {
        if (isOperationTimeout(error)) {
          return { batches: 0 };
        }
        throw error;
      }
    },

    async flushAll(reason, options) {
      const entries = await params.stores.captureBuffer.entries();
      let batches = 0;
      for (const entry of entries) {
        throwIfAborted(options?.signal, `capture-flushAll:${reason}`);
        const snapshot = entry.value as CaptureBufferRecord;
        if (!snapshot || snapshot.version !== 1 || typeof snapshot.streamId !== "string") {
          continue;
        }
        try {
          const flushed = await runExclusiveBounded(
            withStreamLock,
            snapshot.streamId,
            {
              timeoutMs: operationTimeoutMs,
              label: `capture-flushAll:${reason}`,
              onStalled: noteStalled,
            },
            async (signal) => {
              const merged =
                options?.signal && !options.signal.aborted
                  ? AbortSignal.any([signal, options.signal])
                  : signal;
              throwIfAborted(merged, `capture-flushAll:${reason}`);
              const record = await load(snapshot.streamId, merged);
              try {
                return await flushRecord(record, reason, merged);
              } catch (error) {
                if (isOperationTimeout(error)) {
                  throw error;
                }
                return false;
              }
            },
          );
          if (flushed) {
            batches += 1;
          }
        } catch (error) {
          if (isOperationTimeout(error)) {
            continue;
          }
          if (options?.signal?.aborted) {
            break;
          }
          throw error;
        }
      }
      return { batches };
    },

    async getBuffer(streamKey) {
      return await load(opaqueId("stream", streamKey));
    },
  };
}

/** Build a unique-but-stable test fingerprint helper. */
export function captureFingerprint(parts: Array<string | undefined>): string {
  return (
    parts.filter((part): part is string => typeof part === "string" && part.length > 0).join("|") ||
    randomUUID()
  );
}
