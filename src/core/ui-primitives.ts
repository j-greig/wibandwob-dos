/**
 * ui-primitives.ts — internal low-level helpers (timers, scrollbars).
 *
 * Module authors: do NOT import from this file directly.
 * Use ../../src/services/microapp-sdk.js instead, which re-exports
 * createTimer and clearTimers under a stable public surface.
 */
import { theme } from "./theme/resolver.js";

/** @primitive */
export function createScrollbar(): { ch: string; style: { bg: string } } {
  return { ch: " ", style: { bg: theme().scrollbar.bg } };
}

/**
 * Returns a style object that includes scrollbar sub-styles.
 * Use this for any widget that has `scrollable: true` / `scrollbar: createScrollbar()`.
 * Without this, blessed crashes on render when style.scrollbar is missing.
 * @primitive
 */
export function scrollableStyle(base: Record<string, any>): Record<string, any> {
  return {
    ...base,
    scrollbar: { fg: theme().scrollbar.fg, bg: theme().scrollbar.bg },
    track: { fg: theme().scrollbar.track, bg: theme().scrollbar.bg },
  };
}

/**
 * Safely set an element's style, preserving sub-styles that blessed expects.
 * Blessed crashes if style.scrollbar is missing on scrollable elements,
 * or if style.item is missing on list elements.
 * Use this instead of `el.style = {...}` when restyling widgets.
 * @primitive
 */
export function safeSetStyle(el: { scrollable?: boolean; type?: string; style: Record<string, any> }, newStyle: Record<string, any>): void {
  const patched = { ...newStyle };

  // Blessed scrollable elements need style.scrollbar + style.track.
  // Check both el.scrollable (set at creation) AND el.style.scrollbar/track
  // (element may not expose scrollable as a JS property but had these styles before).
  const needsScrollbar = el.scrollable || el.style?.scrollbar || el.style?.track;
  if (needsScrollbar) {
    if (!patched.scrollbar) {
      patched.scrollbar = { fg: theme().scrollbar.fg, bg: theme().scrollbar.bg };
    }
    if (!patched.track) {
      patched.track = { fg: theme().scrollbar.track, bg: theme().scrollbar.bg };
    }
  }

  // Blessed list elements need style.item
  if ((el.type === "list" || el.style?.item) && !patched.item) {
    patched.item = { fg: patched.fg, bg: patched.bg };
  }

  el.style = patched;
}

/** @primitive */
export function isRightClick(data?: { button?: string | number; buttons?: string | number } | null): boolean {
  if (!data) {
    return false;
  }
  return data.button === "right" || data.button === 2 || data.buttons === "right" || data.buttons === 2;
}

/**
 * Lifecycle-bound timer. Registers setInterval into a caller-owned Set.
 * Call clearTimers(timers) in window cleanup to prevent leaks.
 * @primitive
 */
export function createTimer(
  fn: () => void,
  ms: number,
  timers: Set<ReturnType<typeof setInterval>>,
): ReturnType<typeof setInterval> {
  const id = setInterval(fn, ms);
  timers.add(id);
  return id;
}

/** Clear and drain all timers in a lifecycle Set. @primitive */
export function clearTimers(timers: Set<ReturnType<typeof setInterval>>): void {
  for (const id of timers) clearInterval(id);
  timers.clear();
}

/**
 * Clamp a width to a safe even cell count for drawille/canvas widgets.
 * Useful for blessed-contrib charts which can throw on odd widths.
 * @primitive
 */
export function toEvenCellWidth(width: number, min = 2): number {
  const clamped = Math.max(min, Math.floor(width));
  return clamped % 2 === 0 ? clamped : clamped - 1;
}

/** Best-effort destroy for widgets/handles with optional destroy(). @primitive */
export function safeDestroy(node: { destroy?: () => void } | null | undefined): void {
  try {
    node?.destroy?.();
  } catch {
    // teardown should be exception-tolerant
  }
}

/** Best-effort destroy for multiple widgets/handles. @primitive */
export function safeDestroyAll(...nodes: Array<{ destroy?: () => void } | null | undefined>): void {
  for (const node of nodes) {
    safeDestroy(node);
  }
}
