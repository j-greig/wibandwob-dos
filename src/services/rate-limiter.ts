/** Returns a wrapped version of fn that enforces a minimum gap between calls.
 *  If called before the gap expires, returns fallback immediately without
 *  calling fn. */
export function createRateLimiter<T>(
  minGapMs: number,
  fallback: T
): (fn: () => Promise<T>) => Promise<T> {
  let lastCompletedAt = 0;

  return async (fn: () => Promise<T>): Promise<T> => {
    if (Date.now() - lastCompletedAt < minGapMs) {
      return fallback;
    }

    const result = await fn();
    lastCompletedAt = Date.now();
    return result;
  };
}
