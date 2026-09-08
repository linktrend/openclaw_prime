/**
 * Shared body-stream cleanup for guarded fetch consumers (`fetchWithSsrFGuard`
 * callers that re-wrap streaming responses).
 */

// Catches wrapper bodies abandoned without cancel/consume so guarded dispatchers
// (and caller resources hooked into `cleanup`) do not leak with the stream.
const guardedBodyCleanupRegistry = new FinalizationRegistry<{ finalize: () => Promise<void> }>(
  (held) => {
    void held.finalize();
  },
);

/**
 * Wraps a guarded response body so caller cleanup runs exactly once when the
 * stream completes, errors, is cancelled, or is garbage-collected unconsumed.
 * Cleanup failures are swallowed: releasing guard resources must never break
 * response consumption.
 * When maxBytes is set, cumulative enqueued bytes are capped.
 */
export function wrapGuardedBodyStream(params: {
  body: ReadableStream<Uint8Array>;
  cleanup: () => Promise<void> | void;
  refreshTimeout?: () => void;
  maxBytes?: number;
}): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let finalized = false;
  let totalBytes = 0;
  const maxBytes =
    typeof params.maxBytes === "number" && Number.isFinite(params.maxBytes) && params.maxBytes >= 0
      ? Math.floor(params.maxBytes)
      : undefined;
  const cleanupRegistrationToken = {};
  const finalize = async (
    cancelReader: () => Promise<void> = async () => {
      await reader?.cancel().catch(() => undefined);
    },
  ) => {
    if (finalized) {
      return;
    }
    finalized = true;
    guardedBodyCleanupRegistry.unregister(cleanupRegistrationToken);
    // Start cancellation before cleanup so its reason reaches the reader, but
    // let request cleanup abort a retained capture tee before awaiting settlement.
    const [cancellation, release] = await Promise.allSettled([
      cancelReader(),
      (async () => {
        try {
          reader?.releaseLock();
        } finally {
          try {
            await params.cleanup();
          } catch {
            // Best effort: guard cleanup must not surface into stream consumers.
          }
        }
      })(),
    ]);
    if (release.status === "rejected") {
      throw release.reason;
    }
    if (cancellation.status === "rejected") {
      throw cancellation.reason;
    }
  };
  const wrappedBody = new ReadableStream<Uint8Array>({
    start() {
      reader = params.body.getReader();
    },
    async pull(controller) {
      try {
        const chunk = await reader?.read();
        if (!chunk || chunk.done) {
          controller.close();
          await finalize();
          return;
        }
        if (maxBytes !== undefined) {
          const nextTotal = totalBytes + chunk.value.byteLength;
          if (nextTotal > maxBytes) {
            const overflowError = new Error(`Guarded response body exceeds ${maxBytes} bytes`);
            await finalize();
            controller.error(overflowError);
            return;
          }
          totalBytes = nextTotal;
        }
        params.refreshTimeout?.();
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
        await finalize();
      }
    },
    async cancel(reason) {
      await finalize(async () => await reader?.cancel(reason));
    },
  });
  guardedBodyCleanupRegistry.register(wrappedBody, { finalize }, cleanupRegistrationToken);
  return wrappedBody;
}
