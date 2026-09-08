/**
 * Independent, stoppable periodic outbox drain worker with bounded ticks/stop.
 *
 * Guarantees:
 * - at most one raw drain in flight (tickInFlight held until drainOnce settles);
 * - a tick wall-clock may abort and return interest early, but must not clear
 *   ownership while cancellation-ignoring work is still active;
 * - active AbortControllers are retained and aborted on stop / tick deadline;
 * - stop may return within its deadline while late raw drain retains ownership.
 */
import { isOperationTimeout, type StalledInfo } from "./bounded.js";

export type BrainDrainWorker = {
  readonly running: boolean;
  readonly activeTicks: number;
  start(): void;
  stop(): Promise<void>;
};

type CreateBrainDrainWorkerParams = {
  intervalMs: number;
  /** Per-tick wall clock. Default 2_000. Aborts signal; does not clear ownership. */
  tickTimeoutMs?: number;
  /** Overall stop wall clock. Default 2_000. */
  stopTimeoutMs?: number;
  shouldDrain: () => boolean;
  drainOnce: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  onError?: (error: unknown) => void;
  onStalled?: (info: StalledInfo) => void;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === "AbortError" || name === "LinkbrainOperationTimeoutError";
}

export function createBrainDrainWorker(params: CreateBrainDrainWorkerParams): BrainDrainWorker {
  const setIntervalFn = params.setIntervalFn ?? setInterval;
  const clearIntervalFn = params.clearIntervalFn ?? clearInterval;
  const setTimeoutFn = params.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = params.clearTimeoutFn ?? clearTimeout;
  const tickTimeoutMs = params.tickTimeoutMs ?? 2_000;
  const stopTimeoutMs = params.stopTimeoutMs ?? 2_000;
  let timer: ReturnType<typeof setInterval> | null = null;
  let tickTail: Promise<void> = Promise.resolve();
  let stopped = true;
  let generation = 0;
  let tickInFlight = false;
  let activeTicks = 0;
  const activeControllers = new Set<AbortController>();

  const runTick = (gen: number) => {
    if (stopped || gen !== generation || tickInFlight) {
      return;
    }
    if (!params.shouldDrain()) {
      return;
    }
    tickInFlight = true;
    activeTicks += 1;
    const controller = new AbortController();
    activeControllers.add(controller);

    let deadlineNotified = false;
    const deadlineTimer = setTimeoutFn(() => {
      if (!activeControllers.has(controller)) {
        return;
      }
      deadlineNotified = true;
      controller.abort(new Error("linkbrain: drain-tick deadline"));
      params.onStalled?.({
        label: "drain-tick",
        reason: "deadline_exceeded_work_retained",
      });
    }, tickTimeoutMs);

    const rawDrain = Promise.resolve()
      .then(() => params.drainOnce({ signal: controller.signal }))
      .then(
        () => undefined,
        (error: unknown) => {
          if (!isAbortLike(error) && !deadlineNotified) {
            params.onError?.(error);
          }
        },
      );

    // Ownership clears only when the underlying raw drain settles.
    const ownershipReleased = rawDrain.finally(() => {
      clearTimeoutFn(deadlineTimer);
      activeControllers.delete(controller);
      tickInFlight = false;
      activeTicks = Math.max(0, activeTicks - 1);
    });

    tickTail = tickTail.then(
      () => ownershipReleased,
      () => ownershipReleased,
    );
  };

  return {
    get running() {
      return !stopped && timer !== null;
    },
    get activeTicks() {
      return activeTicks;
    },

    start() {
      if (!stopped && timer !== null) {
        return;
      }
      stopped = false;
      generation += 1;
      const gen = generation;
      timer = setIntervalFn(() => {
        runTick(gen);
      }, params.intervalMs);
      runTick(gen);
    },

    async stop() {
      stopped = true;
      generation += 1;
      if (timer !== null) {
        clearIntervalFn(timer);
        timer = null;
      }
      for (const controller of activeControllers) {
        controller.abort(new Error("linkbrain: drain worker stop"));
      }

      let timerHandle: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<"timeout">((resolve) => {
        timerHandle = setTimeoutFn(() => resolve("timeout"), stopTimeoutMs);
      });
      const finished = tickTail.then(
        () => "settled" as const,
        () => "settled" as const,
      );
      const outcome = await Promise.race([finished, deadline]);
      if (timerHandle !== undefined) {
        clearTimeoutFn(timerHandle);
      }
      if (outcome === "timeout") {
        params.onStalled?.({
          label: "drain-stop",
          reason: "deadline_exceeded_work_retained",
        });
        // Late raw drain may still hold exclusive ownership via tickInFlight.
      }
    },
  };
}

// Re-export for tests that import isOperationTimeout via this module historically.
void isOperationTimeout;
