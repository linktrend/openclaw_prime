/**
 * Shared bounded-operation primitives for capture and lifecycle.
 *
 * Guarantees for callers:
 * - Return/reject within `timeoutMs` even when underlying work stalls.
 * - AbortSignal is cooperatively propagated; uncancellable public SDK ops may
 *   continue after the caller returns.
 * - Exclusive keyed work retains the lock until scheduled work settles, so a
 *   timed-out caller never releases serialization while abandoned mutations run.
 * - Queued work that acquires the lock after its own deadline does not start.
 */

class LinkbrainOperationTimeoutError extends Error {
  readonly code = "LINKBRAIN_OPERATION_TIMEOUT" as const;
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`linkbrain: ${label} exceeded ${timeoutMs}ms`);
    this.name = "LinkbrainOperationTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

export function isOperationTimeout(error: unknown): boolean {
  return (
    error instanceof LinkbrainOperationTimeoutError ||
    (error instanceof Error && error.name === "LinkbrainOperationTimeoutError")
  );
}

export function throwIfAborted(signal: AbortSignal | undefined, label = "operation"): void {
  if (!signal?.aborted) {
    return;
  }
  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }
  throw new Error(`linkbrain: ${label} aborted`);
}

type BoundedRaceOptions = {
  timeoutMs: number;
  label: string;
};

export type StalledInfo = {
  label: string;
  reason: "deadline_exceeded_work_retained" | "deadline_exceeded_before_start";
};

/**
 * Race an already-started promise against a deadline.
 * Does not cancel `work` — callers must abort cooperatively and/or retain locks.
 */
async function raceDeadline<T>(work: Promise<T>, options: BoundedRaceOptions): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LinkbrainOperationTimeoutError(options.label, options.timeoutMs));
    }, options.timeoutMs);
  });
  // Losing branch must not become an unhandledRejection after the race settles.
  void timeoutPromise.catch(() => undefined);
  void work.catch(() => undefined);
  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Run work with a deadline AbortSignal. Caller returns within the bound even if
 * work ignores abort. Attach settlement handling so late rejections are not unhandled.
 */
export async function runBounded<T>(
  work: (signal: AbortSignal) => Promise<T>,
  options: BoundedRaceOptions & {
    signal?: AbortSignal;
    onTimeout?: (error: Error) => void;
    onStalled?: (info: StalledInfo) => void;
  },
): Promise<T> {
  const controller = new AbortController();
  let externalAbort: (() => void) | undefined;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      externalAbort = () => {
        controller.abort(options.signal!.reason);
      };
      options.signal.addEventListener("abort", externalAbort, { once: true });
    }
  }

  const started = work(controller.signal);
  // Observe settlement so a timed-out race cannot leave an unhandledRejection.
  const observed = started.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  try {
    return await raceDeadline(started, {
      timeoutMs: options.timeoutMs,
      label: options.label,
    });
  } catch (error) {
    if (isOperationTimeout(error)) {
      controller.abort(error);
      options.onTimeout?.(error instanceof Error ? error : new Error(String(error)));
      options.onStalled?.({
        label: options.label,
        reason: "deadline_exceeded_work_retained",
      });
      void observed;
      throw error;
    }
    throw error;
  } finally {
    if (options.signal && externalAbort) {
      options.signal.removeEventListener("abort", externalAbort);
    }
  }
}

/**
 * Bounded per-key promise chain. Failures settle without poisoning the tail;
 * idle keys are deleted so the map cannot grow without bound.
 */
export function createKeyedPromiseChain() {
  const tails = new Map<string, Promise<unknown>>();

  return async function withKey<T>(key: string, work: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(() => work());
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, settled);
    try {
      return await run;
    } finally {
      if (tails.get(key) === settled) {
        tails.delete(key);
      }
    }
  };
}

type KeyedLock = <T>(key: string, work: () => Promise<T>) => Promise<T>;

/**
 * Schedule exclusive keyed work under a caller deadline.
 *
 * - Caller returns/rejects within `timeoutMs`.
 * - Lock is released only when scheduled work settles (including after caller timeout).
 * - If the deadline already passed when the lock is acquired, work does not start.
 */
export async function runExclusiveBounded<T>(
  withKey: KeyedLock,
  key: string,
  options: BoundedRaceOptions & {
    onTimeout?: (error: Error) => void;
    onStalled?: (info: StalledInfo) => void;
  },
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadlineAtMs = Date.now() + options.timeoutMs;
  const controller = new AbortController();
  let workStarted = false;

  const scheduled = withKey(key, async () => {
    if (Date.now() >= deadlineAtMs || controller.signal.aborted) {
      throw new LinkbrainOperationTimeoutError(options.label, options.timeoutMs);
    }
    workStarted = true;
    return await work(controller.signal);
  });

  // Always observe so late rejection after caller timeout is not unhandled,
  // and so the keyed chain can settle independently of the caller race.
  const observed = scheduled.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  try {
    return await raceDeadline(scheduled, {
      timeoutMs: options.timeoutMs,
      label: options.label,
    });
  } catch (error) {
    if (isOperationTimeout(error)) {
      controller.abort(error);
      options.onTimeout?.(error instanceof Error ? error : new Error(String(error)));
      options.onStalled?.({
        label: options.label,
        reason: workStarted ? "deadline_exceeded_work_retained" : "deadline_exceeded_before_start",
      });
      void observed;
      throw error;
    }
    throw error;
  }
}
