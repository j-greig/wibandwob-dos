/**
 * error-buffer.ts — Ring buffer for runtime microapp errors.
 *
 * Captures errors from microapp lifecycle hooks (setup, onRestyle, onResize)
 * and exposes them via GET /errors/recent so agents can diagnose crashes
 * without tmux access.
 *
 * Holds last 20 errors. Thread-safe for single-threaded Bun runtime.
 */

export interface CapturedError {
  timestamp: string;        // ISO 8601
  microappId: string | null; // null for uncaught / non-microapp errors
  hook: string | null;       // "setup" | "onRestyle" | "onResize" | "uncaught" | null
  message: string;
  stack: string | null;
}

const MAX_ERRORS = 20;
const _errors: CapturedError[] = [];

/**
 * Push an error into the ring buffer.
 * Oldest entry is evicted when the buffer is full.
 */
export function captureError(
  error: unknown,
  microappId: string | null = null,
  hook: string | null = null,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (_errors.length >= MAX_ERRORS) {
    _errors.shift();
  }
  _errors.push({
    timestamp: new Date().toISOString(),
    microappId,
    hook,
    message: err.message,
    stack: err.stack ?? null,
  });
}

/**
 * Return a snapshot of captured errors (most recent last).
 * Returns a copy — safe to mutate.
 */
export function getRecentErrors(): CapturedError[] {
  return [..._errors];
}

/**
 * Clear the error buffer. Primarily for testing.
 */
export function clearErrors(): void {
  _errors.length = 0;
}
