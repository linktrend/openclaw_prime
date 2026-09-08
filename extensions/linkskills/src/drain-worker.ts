/**
 * Independent, stoppable periodic Skills outbox drain worker with bounded ticks/stop.
 *
 * Ownership of an in-flight raw drain is retained until drainOnce settles, even
 * when a tick wall-clock aborts early.
 */
import { isOperationTimeout, type StalledInfo } from "./bounded.js";

export type SkillsDrainWorker = {
  readonly running: boolean;
  readonly activeTicks: number;
  start(): void;
  stop(): Promise<void>;
};

type CreateSkillsDrainWorkerParams = {
  intervalMs: number;
  tickTimeoutMs?: number;
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
  return name === "AbortError" || name === "LinkskillsOperationTimeoutError";
}

export function createSkillsDrainWorker(params: CreateSkillsDrainWorkerParams): SkillsDrainWorker {
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
      controller.abort(new Error("linkskills: drain-tick deadline"));
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
        controller.abort(new Error("linkskills: drain worker stop"));
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
      }
    },
  };
}

void isOperationTimeout;
