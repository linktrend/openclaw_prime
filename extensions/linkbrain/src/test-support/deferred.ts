/**
 * Deferred / never-resolving promise helpers for deterministic timeout tests.
 */
export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A promise that never settles (for timeout / retain-lock tests). */
export function neverResolving<T = never>(): Promise<T> {
  return new Promise<T>(() => {
    // Intentionally never settles.
  });
}
