/**
 * Reusable modal positioning and creation primitive.
 *
 * Every dialog, notification, overlay, and prompt should use createModal()
 * to get consistent positioning, theming, and teardown behaviour.
 *
 * Positions are compass points relative to the screen:
 *
 *     nw    n    ne
 *      w    c    e
 *     sw    s    se
 *
 * Default is "s" (bottom-center), which feels natural for transient
 * notifications — like a toast bar. Prompts typically use "c" (center).
 */

import blessed from "blessed";
import stringWidth from "string-width";
import { theme } from "./theme/resolver.js";
import type { Box } from "./types.js";

// ── Public types ─────────────────────────────────────────

/** Compass-point position on screen. */
export type ModalPosition = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

export interface ModalOptions {
  /** Parent screen to attach to. */
  screen: blessed.Widgets.Screen;
  /** Width — number (cols), percentage string ("50%"), or "shrink". */
  width: number | string;
  /** Height — number (rows), percentage string ("30%"), or "shrink". */
  height: number | string;
  /** Where to anchor the modal. Default "s". */
  position?: ModalPosition;
  /** Optional border label. */
  label?: string;
  /** Draw a line border. Default true. */
  border?: boolean;
  /** Extra padding inside the border. */
  padding?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Margin from screen edge in cells (applies to edge-aligned positions). Default 1. */
  margin?: number;
  /** Override theme styles — otherwise uses theme().body + theme().windowBorderFocused. */
  style?: Record<string, unknown>;
  /** If true, the modal captures all key input (grabKeys). Default false. */
  grabKeys?: boolean;
  /** If true, enable mouse events on the modal. Default true. */
  mouse?: boolean;
  /** If true, enable key events on the modal. Default true. */
  keys?: boolean;
  /** Optional tags support (blessed {bold} etc). Default false. */
  tags?: boolean;
}

export interface Modal {
  /** The outer box element. Attach children to this. */
  box: Box;
  /** Move to a different compass point without recreating. */
  reposition: (position: ModalPosition) => void;
  /** Destroy the modal and clean up. Returns previous grabKeys state. */
  destroy: () => void;
}

// ── Positioning math ─────────────────────────────────────

function resolvePosition(
  position: ModalPosition,
  screenWidth: number,
  screenHeight: number,
  boxWidth: number,
  boxHeight: number,
  margin: number
): { top: number; left: number } {
  const centerX = Math.max(0, Math.floor((screenWidth - boxWidth) / 2));
  const centerY = Math.max(0, Math.floor((screenHeight - boxHeight) / 2));
  const right = Math.max(0, screenWidth - boxWidth - margin);
  const bottom = Math.max(0, screenHeight - boxHeight - margin);

  switch (position) {
    case "nw": return { top: margin, left: margin };
    case "n":  return { top: margin, left: centerX };
    case "ne": return { top: margin, left: right };
    case "w":  return { top: centerY, left: margin };
    case "c":  return { top: centerY, left: centerX };
    case "e":  return { top: centerY, left: right };
    case "sw": return { top: bottom, left: margin };
    case "s":  return { top: bottom, left: centerX };
    case "se": return { top: bottom, left: right };
  }
}

function resolveSize(value: number | string, screenDimension: number): number {
  if (typeof value === "number") return value;
  if (value === "shrink") return 0; // blessed handles shrink internally
  if (value.endsWith("%")) {
    const pct = parseFloat(value) / 100;
    return Math.floor(screenDimension * pct);
  }
  return parseInt(value, 10) || 0;
}

// ── Factory ──────────────────────────────────────────────

export function createModal(options: ModalOptions): Modal {
  const {
    screen,
    width,
    height,
    position = "s",
    label,
    border = true,
    padding,
    margin = 1,
    style: styleOverride,
    grabKeys = false,
    mouse = true,
    keys = true,
    tags = false
  } = options;

  const t = theme();
  const resolvedStyle = styleOverride ?? {
    ...t.body,
    border: t.windowBorderFocused
  };

  const screenW = Number(screen.width) || 80;
  const screenH = Number(screen.height) || 24;
  const boxW = resolveSize(width, screenW);
  const boxH = resolveSize(height, screenH);

  // For "shrink" we still need initial placement — recalc after content set
  const useShrink = width === "shrink" || height === "shrink";
  const initialPos = resolvePosition(position, screenW, screenH, boxW, boxH, margin);

  const box = blessed.box({
    parent: screen,
    top: useShrink ? position.includes("s") ? "100%-5" : position.includes("n") ? margin : "center" : initialPos.top,
    left: useShrink ? position.includes("w") ? margin : position.includes("e") ? "100%-20" : "center" : initialPos.left,
    width: width === "shrink" ? "shrink" : boxW,
    height: height === "shrink" ? "shrink" : boxH,
    border: border ? "line" : undefined,
    label: label ? ` ${label} ` : undefined,
    padding: padding ?? (border ? undefined : { left: 1, right: 1 }),
    mouse,
    keys,
    tags,
    style: resolvedStyle
  }) as Box;

  const savedGrabKeys = (screen as any).grabKeys;
  if (grabKeys) {
    (screen as any).grabKeys = true;
  }

  const reposition = (newPos: ModalPosition) => {
    const sw = Number(screen.width) || 80;
    const sh = Number(screen.height) || 24;
    const bw = Number(box.width) || boxW;
    const bh = Number(box.height) || boxH;
    const pos = resolvePosition(newPos, sw, sh, bw, bh, margin);
    box.top = pos.top;
    box.left = pos.left;
    screen.render();
  };

  const destroy = () => {
    if (grabKeys) {
      (screen as any).grabKeys = savedGrabKeys;
    }
    box.destroy();
  };

  return { box, reposition, destroy };
}

// ── Button primitive ─────────────────────────────────────

export interface ButtonDef {
  /** Button label text (e.g. "OK", "Cancel"). */
  label: string;
  /** Called when the button is clicked or activated via keyboard. */
  action: () => void;
  /** Visual style: "primary" gets selected/highlighted, "default" gets footer. */
  variant?: "primary" | "default";
}

export interface ButtonBarOptions {
  /** Parent element to attach to. */
  parent: Box;
  /** Vertical position within parent. Usually bottom: 1 or a fixed top. */
  bottom?: number;
  top?: number;
  /** Button definitions, left-to-right. */
  buttons: ButtonDef[];
  /** Screen ref for render calls. */
  screen: blessed.Widgets.Screen;
  /** Gap between buttons in cols. Default 2. */
  gap?: number;
  /** Align buttons: "right" (default), "left", or "center". */
  align?: "right" | "left" | "center";
}

export interface ButtonBar {
  /** All button box elements. */
  elements: Box[];
  /** Focus a specific button by index. */
  focus: (index: number) => void;
  /** Destroy all button elements. */
  destroy: () => void;
}

/**
 * Create a row of clickable buttons inside a parent box.
 * Buttons are mouse-clickable and keyboard-navigable (Left/Right to move, Enter to activate).
 */
export function createButtonBar(options: ButtonBarOptions): ButtonBar {
  const {
    parent,
    bottom,
    top,
    buttons,
    screen,
    gap = 2,
    align = "right"
  } = options;

  const t = theme();
  const elements: Box[] = [];
  let focusedIndex = -1;

  // Calculate total width needed
  const btnWidths = buttons.map((b) => stringWidth(b.label) + 4); // padding + border chars
  const totalWidth = btnWidths.reduce((a, b) => a + b, 0) + (buttons.length - 1) * gap;

  // Compute starting left position based on alignment
  const computeStartLeft = (): number | string => {
    const parentWidth = Number(parent.width) || 60;
    const innerWidth = parentWidth - 2; // account for parent border
    switch (align) {
      case "left": return 1;
      case "center": return Math.max(1, Math.floor((innerWidth - totalWidth) / 2));
      case "right": return Math.max(1, innerWidth - totalWidth);
    }
  };

  let currentLeft = computeStartLeft();

  for (let i = 0; i < buttons.length; i++) {
    const def = buttons[i];
    const w = btnWidths[i];
    const isPrimary = def.variant === "primary";

    const btn = blessed.box({
      parent,
      bottom: bottom ?? undefined,
      top: top ?? undefined,
      left: typeof currentLeft === "string" ? currentLeft : currentLeft,
      width: w,
      height: 1,
      content: ` ${def.label} `,
      mouse: true,
      keys: true,
      clickable: true,
      style: isPrimary ? t.selected : t.footer
    }) as Box;

    btn.on("click", () => {
      def.action();
    });

    btn.on("focus", () => {
      btn.style = t.selected;
      focusedIndex = i;
      screen.render();
    });

    btn.on("blur", () => {
      btn.style = isPrimary ? t.selected : t.footer;
      screen.render();
    });

    btn.on("keypress", (_, key) => {
      if (key.name === "enter" || key.name === "return") {
        def.action();
        return;
      }
      if (key.name === "right" || key.name === "tab") {
        const next = (focusedIndex + 1) % elements.length;
        elements[next].focus();
        return;
      }
      if (key.name === "left" || (key.shift && key.name === "tab")) {
        const prev = (focusedIndex - 1 + elements.length) % elements.length;
        elements[prev].focus();
        return;
      }
      if (key.name === "escape") {
        // Escape on buttons triggers the last button (assumed Cancel)
        buttons[buttons.length - 1].action();
      }
    });

    elements.push(btn);
    currentLeft = (typeof currentLeft === "number" ? currentLeft : 0) + w + gap;
  }

  return {
    elements,
    focus: (index: number) => {
      if (index >= 0 && index < elements.length) {
        elements[index].focus();
      }
    },
    destroy: () => {
      for (const el of elements) {
        el.destroy();
      }
    }
  };
}

// ── Convenience: toast notification ──────────────────────

export interface ToastOptions {
  screen: blessed.Widgets.Screen;
  message: string;
  /** Compass position. Default "s". */
  position?: ModalPosition;
  /** Auto-dismiss after ms. Default 2200. */
  duration?: number;
  /** Override style. */
  style?: Record<string, unknown>;
}

/**
 * Show a transient toast message at the given position.
 * Returns a handle to dismiss early if needed.
 */
export function showToast(options: ToastOptions): { dismiss: () => void } {
  const {
    screen,
    message,
    position = "s",
    duration = 2200,
    style
  } = options;

  const contentWidth = stringWidth(message) + 4; // padding + border
  const modal = createModal({
    screen,
    width: Math.min(contentWidth, Math.floor(Number(screen.width) * 0.8)),
    height: 3,
    position,
    border: true,
    style: style ?? {
      fg: "white",
      bg: "black",
      border: { fg: "yellow" }
    }
  });

  modal.box.setContent(` ${message} `);
  screen.render();

  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timer = null;
    modal.destroy();
    screen.render();
  }, duration);

  return {
    dismiss: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      modal.destroy();
      screen.render();
    }
  };
}
