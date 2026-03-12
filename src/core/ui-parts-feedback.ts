/**
 * ui-parts-feedback.ts — Feedback component primitives.
 *
 * Module authors: import from ../../src/services/microapp-sdk.js
 * All components follow the component contract (.agents/module-dev/component-contract.md)
 * All return LayoutPart for composition with createStack/createRow/createGrid.
 */
import blessed from "blessed";
import { theme } from "./theme/resolver.js";
import type { Rect, LayoutPart } from "./ui-parts.js";

// ═══════════════════════════════════════════════════════════════════════════
// createProgressBar
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgressBarOptions {
  value?: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
}

export type ProgressBarHandle = LayoutPart<Partial<ProgressBarOptions>>;

/**
 * A horizontal progress bar. Single row.
 * Update value with `.update({ value })`.
 *
 * @example
 * const bar = createProgressBar({ value: 0, max: 100, label: "Loading" });
 * bar.update({ value: 50 });  // 50%
 */
export function createProgressBar(opts: ProgressBarOptions = {}): ProgressBarHandle {
  let { value = 0, max = 100, label = "", showPercent = true } = opts;
  let lastWidth = 0;

  const node = blessed.box({
    width: 0,
    height: 1,
    content: "",
    style: getStyle(),
  });

  function getStyle() {
    const t = theme();
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function renderBar() {
    const w = Math.max(1, lastWidth);
    const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    const pctStr = showPercent ? ` ${Math.round(pct * 100)}%` : "";
    const prefix = label ? ` ${label} ` : " ";
    const suffix = pctStr + " ";
    const barSpace = Math.max(0, w - prefix.length - suffix.length);
    const filled = Math.round(barSpace * pct);
    const empty = barSpace - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    node.setContent(prefix + bar + suffix);
  }

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = 1;
      lastWidth = rect.width;
      renderBar();
    },
    restyle() {
      node.style = getStyle();
      renderBar();
    },
    destroy() {
      node.destroy();
    },
    update(props: Partial<ProgressBarOptions>) {
      if (props.value !== undefined) value = props.value;
      if (props.max !== undefined) max = props.max;
      if (props.label !== undefined) label = props.label;
      if (props.showPercent !== undefined) showPercent = props.showPercent;
      renderBar();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createSpinner
// ═══════════════════════════════════════════════════════════════════════════

export interface SpinnerOptions {
  label?: string;
  frames?: string[];
  interval?: number;
}

export type SpinnerHandle = LayoutPart<Partial<SpinnerOptions>> & {
  start(): void;
  stop(): void;
  running(): boolean;
};

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * An animated spinner with optional label. Single row.
 * Starts automatically. Call `.stop()` to pause, `.start()` to resume.
 *
 * @example
 * const spinner = createSpinner({ label: "Processing" });
 * // later:
 * spinner.stop();
 * spinner.update({ label: "Done!" });
 */
export function createSpinner(opts: SpinnerOptions = {}): SpinnerHandle {
  let { label = "", interval = 80 } = opts;
  let frames = opts.frames ?? DEFAULT_FRAMES;
  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  const node = blessed.box({
    width: 0,
    height: 1,
    content: renderContent(),
    style: getStyle(),
  });

  function getStyle() {
    const t = theme();
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function renderContent(): string {
    const frame = frames[frameIndex % frames.length] ?? "·";
    return label ? ` ${frame} ${label}` : ` ${frame}`;
  }

  function tick() {
    frameIndex = (frameIndex + 1) % frames.length;
    node.setContent(renderContent());
    node.screen?.render();
  }

  function start() {
    if (timer) return;
    isRunning = true;
    timer = setInterval(tick, interval);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isRunning = false;
  }

  // Auto-start
  start();

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = 1;
    },
    restyle() {
      node.style = getStyle();
    },
    destroy() {
      stop();
      node.destroy();
    },
    update(props: Partial<SpinnerOptions>) {
      if (props.label !== undefined) label = props.label;
      if (props.frames !== undefined) frames = props.frames;
      if (props.interval !== undefined) {
        interval = props.interval;
        if (isRunning) { stop(); start(); }
      }
      node.setContent(renderContent());
    },
    start,
    stop,
    running() { return isRunning; },
  };
}
