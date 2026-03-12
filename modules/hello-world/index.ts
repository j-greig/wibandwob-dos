/**
 * Hello World v2 — Layout engine showcase + SDK primitive proving ground.
 *
 * Inlines candidate layout primitives (createGrid, dockTo, responsive,
 * compass alignment, toolbar) that are NOT yet in the SDK.
 *
 * Controls:
 *   Click        — regenerate contour art
 *   1-9 (numpad) — position banner at compass point
 *   0            — reset to auto alignment
 *
 * Toolbar (visible at L+ sizes):
 *   Compass buttons, seed display, regen button, mode indicator.
 *   Responsive: hidden at M/S. That IS the Tailwind "hidden lg:flex" pattern.
 *
 * Layout modes:
 *   XL  (95+ x 26+)  toolbar + 2-col grid (contour span-2, stats, clock) + art
 *   L   (65+ x 18+)  toolbar + 2-col (contour, clock) + art
 *   M   (40+ x 12+)  banner + info + art
 *   S   (< 40)        banner only
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  responsiveFiglet,
  renderFiglet,
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════════════════
// INLINED LAYOUT ENGINE — candidates for SDK extraction
// ═══════════════════════════════════════════════════════════════════════════

type Rect = { top: number; left: number; width: number; height: number };

function clampSize(n: number): number { return Math.max(0, Math.floor(n)); }

function applyRect(node: blessed.Widgets.BoxElement, r: Rect): void {
  node.top = r.top; node.left = r.left;
  node.width = clampSize(r.width); node.height = clampSize(r.height);
}

// ── createGrid ────────────────────────────────────────────────────────────

type TrackSize = number | `${number}fr`;

interface GridOptions {
  rows: number; cols: number;
  rowSizes?: TrackSize[]; colSizes?: TrackSize[];
  gap?: number | [number, number];
}

interface GridCell {
  row: number; col: number;
  rowSpan: number; colSpan: number;
  node: blessed.Widgets.BoxElement;
}

interface Grid {
  set(row: number, col: number, rowSpan: number, colSpan: number,
      node: blessed.Widgets.BoxElement): void;
  layout(rect: Rect): void;
  destroy(): void;
}

function resolveTrackSizes(sizes: TrackSize[], count: number, available: number, gap: number): number[] {
  const expanded: TrackSize[] = [];
  for (let i = 0; i < count; i++) expanded.push(sizes[i % sizes.length] ?? "1fr");
  const totalGap = Math.max(0, count - 1) * gap;
  const space = Math.max(0, available - totalGap);
  let fixedTotal = 0, frTotal = 0;
  for (const s of expanded) {
    if (typeof s === "number") fixedTotal += s;
    else frTotal += parseFloat(s) || 1;
  }
  const remaining = Math.max(0, space - fixedTotal);
  const result: number[] = [];
  let frRemaining = frTotal, spaceRemaining = remaining;
  for (const s of expanded) {
    if (typeof s === "number") {
      result.push(clampSize(s));
    } else {
      const fr = parseFloat(s) || 1;
      const alloc = frRemaining > 0
        ? (fr === frRemaining ? spaceRemaining : Math.floor((spaceRemaining * fr) / frRemaining))
        : 0;
      result.push(clampSize(alloc));
      spaceRemaining -= alloc;
      frRemaining -= fr;
    }
  }
  return result;
}

function createGrid(_parent: blessed.Widgets.Node, opts: GridOptions): Grid {
  const cells: GridCell[] = [];
  const [rowGap, colGap] = Array.isArray(opts.gap) ? opts.gap : [opts.gap ?? 0, opts.gap ?? 0];
  return {
    set(row, col, rowSpan, colSpan, node) {
      cells.push({ row, col, rowSpan, colSpan, node });
    },
    layout(rect) {
      const colWidths = resolveTrackSizes(opts.colSizes ?? ["1fr"], opts.cols, rect.width, colGap);
      const rowHeights = resolveTrackSizes(opts.rowSizes ?? ["1fr"], opts.rows, rect.height, rowGap);
      for (const cell of cells) {
        let x = rect.left;
        for (let c = 0; c < cell.col; c++) x += (colWidths[c] ?? 0) + colGap;
        let y = rect.top;
        for (let r = 0; r < cell.row; r++) y += (rowHeights[r] ?? 0) + rowGap;
        let w = 0;
        for (let c = cell.col; c < cell.col + cell.colSpan && c < opts.cols; c++) {
          w += colWidths[c] ?? 0; if (c > cell.col) w += colGap;
        }
        let h = 0;
        for (let r = cell.row; r < cell.row + cell.rowSpan && r < opts.rows; r++) {
          h += rowHeights[r] ?? 0; if (r > cell.row) h += rowGap;
        }
        applyRect(cell.node, { top: y, left: x, width: w, height: h });
      }
    },
    destroy() { for (const c of cells) c.node.destroy(); },
  };
}

// ── dockTo ────────────────────────────────────────────────────────────────

interface DockOptions {
  anchor: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  width: number; height: number;
  minParentWidth?: number; minParentHeight?: number;
  margin?: number;
}

interface DockedWidget {
  node: blessed.Widgets.BoxElement;
  layout(pw: number, ph: number): void;
  visible: boolean;
  destroy(): void;
}

function dockTo(parent: blessed.Widgets.BoxElement, content: string, opts: DockOptions, style: Record<string, any>): DockedWidget {
  const node = blessed.box({ parent, width: opts.width, height: opts.height, content, style });
  node.hide();
  const m = opts.margin ?? 1;
  const minW = opts.minParentWidth ?? (opts.width + m * 2);
  const minH = opts.minParentHeight ?? (opts.height + m * 2);
  const result: DockedWidget = {
    node, visible: false,
    layout(pw, ph) {
      result.visible = pw >= minW && ph >= minH;
      if (!result.visible) { node.hide(); return; }
      node.show();
      node.top  = opts.anchor.startsWith("top")  ? m : ph - opts.height - m;
      node.left = opts.anchor.endsWith("left")   ? m : pw - opts.width - m;
    },
    destroy() { node.destroy(); },
  };
  return result;
}

// ── compass alignment ─────────────────────────────────────────────────────

type Compass = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

const COMPASS_ALIGN: Record<Compass, { align: string; valign: string }> = {
  nw: { align: "left",   valign: "top"    },
  n:  { align: "center", valign: "top"    },
  ne: { align: "right",  valign: "top"    },
  w:  { align: "left",   valign: "middle" },
  c:  { align: "center", valign: "middle" },
  e:  { align: "right",  valign: "middle" },
  sw: { align: "left",   valign: "bottom" },
  s:  { align: "center", valign: "bottom" },
  se: { align: "right",  valign: "bottom" },
};

const COMPASS_LABELS: Record<Compass, string> = {
  nw: "NW", n: "N", ne: "NE", w: "W", c: "C", e: "E", sw: "SW", s: "S", se: "SE",
};

const KEY_TO_COMPASS: Record<string, Compass> = {
  "7": "nw", "8": "n", "9": "ne",
  "4": "w",  "5": "c", "6": "e",
  "1": "sw", "2": "s", "3": "se",
};

// padCompass removed — we position the inner box instead of padding content

// ── responsive ────────────────────────────────────────────────────────────

interface Breakpoint<T> { minWidth?: number; minHeight?: number; value: T; }

function pickBreakpoint<T>(bps: Breakpoint<T>[], w: number, h: number): T | undefined {
  for (const bp of bps) {
    if ((bp.minWidth === undefined || w >= bp.minWidth) &&
        (bp.minHeight === undefined || h >= bp.minHeight)) return bp.value;
  }
  return undefined;
}

// ── contour art generator ─────────────────────────────────────────────────

function generateContourArt(w: number, h: number, seed: number): string {
  const lines: string[] = [];
  const chars = " .:-=+*#%@";
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const v = Math.sin(x * 0.15 + seed) * Math.cos(y * 0.2 + seed * 0.7)
              + Math.sin((x + y) * 0.1 + seed * 1.3) * 0.5
              + Math.cos(x * 0.05 - y * 0.08 + seed * 0.3) * 0.3;
      const idx = Math.floor((v + 1.5) / 3 * (chars.length - 1));
      line += chars[Math.max(0, Math.min(chars.length - 1, idx))];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT
// ═══════════════════════════════════════════════════════════════════════════

const WIBWOB_ART = [
  "    /\\_____/\\   /\\_____/\\",
  "   /  o   o  \\ /  o   o  \\",
  "  ( ==  ^  == \u2573 ==  ^  == )",
  "   )                     (",
  "  (                       )",
  " ( (  ) (  )  ( (  ) (  )  )",
  "(__(_W)I(B_)__(__(_W)O(B_)__)",
];
const ART_W = Math.max(...WIBWOB_ART.map(l => l.length));
const ART_H = WIBWOB_ART.length;

const INFO_TEXT = [
  "WibWob-DOS Hello World v2",
  "",
  "Layout engine test suite.",
  "Resize to see responsive layout.",
  "Click to regenerate contour.",
  "Keys 1-9: compass alignment.",
  "Key 0: reset to auto.",
  "",
  "XL: toolbar + 2-col grid",
  "L:  toolbar + 2-col",
  "M:  banner + info + art",
  "S:  banner only",
].join("\n");

type LayoutMode = "xl" | "l" | "m" | "s";

const LAYOUT_BREAKPOINTS: Breakpoint<LayoutMode>[] = [
  { minWidth: 95,  minHeight: 26, value: "xl" },
  { minWidth: 65,  minHeight: 18, value: "l"  },
  { minWidth: 40,  minHeight: 12, value: "m"  },
  { value: "s" },
];

// ═══════════════════════════════════════════════════════════════════════════
// MODULE
// ═══════════════════════════════════════════════════════════════════════════

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Hello World Example",
    menu: [{ category: "demos", order: 40, label: "Hello World" }],
    palette: { order: 210, label: "Hello World" },
    action: () => {
      const win = host.createWindow({ title: "Hello World", width: 100, height: 35 });
      const timers = new Set<ReturnType<typeof setInterval>>();
      let contourSeed = Math.floor(Math.random() * 10000);
      let compass: Compass | null = null;

      const root = blessed.box({
        parent: win.body, top: 0, left: 0, right: 0, bottom: 0,
        mouse: true, clickable: true, keys: true, inputOnFocus: true,
        style: host.theme().body,
      });

      // ══════════════════════════════════════════════════════════════
      // TOOLBAR — visible at L+ sizes (the "hidden lg:flex" pattern)
      // ══════════════════════════════════════════════════════════════
      // ╭─ ◈ WibWob ─┬─ NW  N  NE  W  ●  E  SW  S  SE ─┬─ ↻ regen ─┬─ XL 130x38 ─╮

      const TOOLBAR_H = 1;

      const toolbar = blessed.box({
        parent: root, top: 0, left: 0, width: "100%" as any, height: TOOLBAR_H,
        mouse: true, clickable: true,
        style: { fg: "white", bg: "black", bold: true },
      });
      toolbar.hide();

      // Toolbar: app label (left)
      const toolbarLabel = blessed.box({
        parent: toolbar, top: 0, left: 0, width: 12, height: 1,
        content: " \u25C8 WibWob ",
        style: { fg: "cyan", bg: "black", bold: true },
      });

      // Toolbar: separator
      blessed.box({
        parent: toolbar, top: 0, left: 12, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });

      // Toolbar: compass buttons
      const COMPASS_ORDER: (Compass | "auto")[] = ["nw","n","ne","w","c","e","sw","s","se","auto"];
      const COMPASS_BTN_LABELS: Record<string, string> = {
        nw: "NW", n: "N", ne: "NE", w: "W", c: "\u25CF", e: "E",
        sw: "SW", s: "S", se: "SE", auto: "\u229A",
      };
      const compassBtns: { key: string; node: blessed.Widgets.BoxElement }[] = [];
      let cx = 14;
      for (const key of COMPASS_ORDER) {
        const label = COMPASS_BTN_LABELS[key] ?? key;
        const w = label.length + 2;
        const btn = blessed.box({
          parent: toolbar, top: 0, left: cx, width: w, height: 1,
          content: ` ${label} `, mouse: true, clickable: true,
          style: { fg: "white", bg: "black" },
        });
        btn.on("click", () => {
          compass = key === "auto" ? null : key as Compass;
          doLayout();
        });
        compassBtns.push({ key, node: btn });
        cx += w;
      }

      // Toolbar: separator
      blessed.box({
        parent: toolbar, top: 0, left: cx, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });
      cx += 1;

      // Toolbar: regen button
      const regenBtn = blessed.box({
        parent: toolbar, top: 0, left: cx, width: 10, height: 1,
        content: " \u21BB regen ", mouse: true, clickable: true,
        style: { fg: "yellow", bg: "black" },
      });
      regenBtn.on("click", () => {
        contourSeed = Math.floor(Math.random() * 10000);
        doLayout();
      });
      cx += 10;

      // Toolbar: separator
      blessed.box({
        parent: toolbar, top: 0, left: cx, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });

      // Toolbar: mode/size label (right-aligned)
      const toolbarMode = blessed.box({
        parent: toolbar, top: 0, right: 0, width: 20, height: 1,
        align: "right" as any,
        style: { fg: "gray", bg: "black" },
      });

      function updateToolbar(mode: LayoutMode, w: number, h: number) {
        const compassStr = compass ? COMPASS_LABELS[compass] : "auto";
        toolbarMode.setContent(`${mode.toUpperCase()} ${w}x${h} ${compassStr} `);
        // Highlight active compass button
        for (const { key, node } of compassBtns) {
          const isActive = (key === "auto" && compass === null) ||
                           (key === compass);
          node.style = isActive
            ? { fg: "black", bg: "cyan", bold: true }
            : { fg: "white", bg: "black" };
        }
      }

      // ══════════════════════════════════════════════════════════════
      // CONTENT PANELS
      // ══════════════════════════════════════════════════════════════

      // Banner area — transparent div, no border/chrome
      const bannerBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
      });
      // Inner text box — tight-fit to figlet, positioned within bannerBox
      const bannerText = blessed.box({
        parent: bannerBox, top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
      });

      // Status bar (always visible, bottom row)
      const statusBar = blessed.box({
        parent: root, bottom: 0, left: 0, width: "100%" as any, height: 1,
        style: host.theme().muted,
      });

      const contourBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        border: "line", label: " contour ",
        style: { ...host.theme().body, border: { fg: host.theme().muted.fg } },
      });
      contourBox.hide();

      const clockBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        border: "line", label: " clock ",
        style: { ...host.theme().body, border: { fg: host.theme().muted.fg } },
      });
      clockBox.hide();

      function updateClock() {
        if (!clockBox.visible) return;
        const time = new Date().toTimeString().slice(0, 8);
        const cw = Math.max(1, (Number(clockBox.width) || 20) - 2);
        clockBox.setContent(renderFiglet(time, "digital", cw));
      }
      createTimer(updateClock, 1000, timers);

      const statsBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        border: "line", label: " stats ",
        style: { ...host.theme().body, border: { fg: host.theme().muted.fg } },
      });
      statsBox.hide();

      const infoBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        content: INFO_TEXT,
        style: host.theme().body,
      });
      infoBox.hide();

      // Cats — docked bottom-right, float above everything
      const art = dockTo(root, WIBWOB_ART.join("\n"), {
        anchor: "bottom-right",
        width: ART_W, height: ART_H,
        minParentWidth: ART_W + 6, minParentHeight: ART_H + 10,
        margin: 2,
      }, host.theme().body);

      // ── XL grid ─────────────────────────────────────────────────
      const xlGrid = createGrid(root, {
        rows: 2, cols: 2, colSizes: ["2fr", "1fr"], rowSizes: ["1fr", "1fr"], gap: [1, 1],
      });
      xlGrid.set(0, 0, 2, 1, contourBox);
      xlGrid.set(0, 1, 1, 1, statsBox);
      xlGrid.set(1, 1, 1, 1, clockBox);

      function updateContour() {
        if (!contourBox.visible) return;
        const cw = Math.max(1, (Number(contourBox.width) || 20) - 2);
        const ch = Math.max(1, (Number(contourBox.height) || 10) - 2);
        contourBox.setContent(generateContourArt(cw, ch, contourSeed));
      }

      function updateStats(mode: LayoutMode, w: number, h: number) {
        const compassStr = compass ? `align: ${COMPASS_LABELS[compass]}` : "align: auto";
        statsBox.setContent([
          ` Mode: ${mode.toUpperCase()}`,
          ` Size: ${w}x${h}`,
          ` Seed: ${contourSeed}`,
          ` ${compassStr}`,
          "",
          ` Panels:`,
          `  toolbar  ${mode === "xl" || mode === "l" ? "YES" : "-"}`,
          `  banner   always`,
          `  contour  ${mode === "xl" || mode === "l" ? "YES" : "-"}`,
          `  clock    ${mode === "xl" || mode === "l" ? "YES" : "-"}`,
          `  stats    ${mode === "xl" ? "YES" : "-"}`,
          `  art      ${mode !== "s" ? "YES" : "-"}`,
        ].join("\n"));
      }

      // ══════════════════════════════════════════════════════════════
      // LAYOUT
      // ══════════════════════════════════════════════════════════════

      function doLayout() {
        const w = Math.max(10, Number(root.width) || 60);
        const h = Math.max(5, Number(root.height) || 20);
        const mode = pickBreakpoint(LAYOUT_BREAKPOINTS, w, h) ?? "s";

        // ── Responsive title ──────────────────────────────────────
        const banner = responsiveFiglet("HELLO WORLD", w);
        const bannerH = banner.split("\n").length;

        // ── Toolbar: visible at L+ (the "hidden lg:flex" pattern) ──
        const showToolbar = mode === "xl" || mode === "l";
        if (showToolbar) {
          toolbar.show();
          updateToolbar(mode, w, h);
        } else {
          toolbar.hide();
        }
        const contentTop = showToolbar ? TOOLBAR_H : 0;

        // ── Status bar (always) ────────────────────────────────────
        const compassStr = compass ? COMPASS_LABELS[compass] : "auto";
        const statusHint = showToolbar ? "" : "  1-9:align 0:auto click:regen";
        statusBar.setContent(` ${mode.toUpperCase()} ${w}x${h} ${compassStr} tb=${showToolbar} cTop=${contentTop}${statusHint}`);

        // ── Banner: position inner text box within transparent area ──
        bannerBox.show();
        const bannerAllocH = Math.max(bannerH, Math.min(bannerH + 6, Math.floor(h * 0.4)));
        applyRect(bannerBox, { top: contentTop, left: 0, width: w, height: bannerAllocH });

        const trimmedBanner = banner.split("\n").map(l => l.trimEnd()).join("\n");
        const textW = Math.max(...trimmedBanner.split("\n").map(l => l.length));
        const textH = bannerH;
        bannerText.setContent(trimmedBanner);
        bannerText.width = textW;
        bannerText.height = textH;

        // Position inner box within outer area based on compass
        const cp = compass !== null ? COMPASS_ALIGN[compass] : { align: "left", valign: "top" };
        const hPad = Math.max(0, w - textW);
        const vPad = Math.max(0, bannerAllocH - textH);
        bannerText.left = cp.align === "right" ? hPad
                        : cp.align === "center" ? Math.floor(hPad / 2)
                        : 0;
        bannerText.top = cp.valign === "bottom" ? vPad
                       : cp.valign === "middle" ? Math.floor(vPad / 2)
                       : 0;

        // ── Grid area below banner ────────────────────────────────
        const gridTop = contentTop + bannerAllocH;
        const gridH = Math.max(4, h - gridTop - 2); // -2 for status bar + breathing room

        if (mode === "xl") {
          contourBox.show(); clockBox.show(); statsBox.show(); infoBox.hide();
          xlGrid.layout({ top: gridTop, left: 0, width: w, height: gridH });
          updateContour(); updateClock(); updateStats(mode, w, h);

        } else if (mode === "l") {
          contourBox.show(); clockBox.show(); statsBox.hide(); infoBox.hide();
          const half = Math.floor((w - 1) / 2);
          applyRect(contourBox, { top: gridTop, left: 0, width: half, height: gridH });
          applyRect(clockBox,   { top: gridTop, left: half + 1, width: w - half - 1, height: gridH });
          updateContour(); updateClock();

        } else if (mode === "m") {
          contourBox.hide(); clockBox.hide(); statsBox.hide();
          infoBox.show();
          applyRect(infoBox, { top: gridTop, left: 1, width: Math.min(40, w - 2), height: Math.max(2, gridH) });

        } else {
          contourBox.hide(); clockBox.hide(); statsBox.hide(); infoBox.hide();
        }

        // Z-order: toolbar above content, cats above everything
        if (showToolbar) toolbar.setFront();
        statusBar.setFront();
        art.layout(w, h - 2);  // -2 for status bar
        if (art.visible) art.node.setFront();

        host.screen.render();
      }

      // ── Keyboard ────────────────────────────────────────────────
      // Compass keys (1-9, 0) — listen on screen, guard with focus check
      const handleKeypress = (_ch: string, key: any) => {
        if (!win.isFocused()) return;
        const name = key?.name ?? key?.ch ?? "";
        if (name === "0") { compass = null; doLayout(); return; }
        if (KEY_TO_COMPASS[name]) { compass = KEY_TO_COMPASS[name]; doLayout(); return; }
      };
      host.screen.on("keypress", handleKeypress);

      // Click to regen (only if not on a toolbar button)
      root.on("click", () => {
        contourSeed = Math.floor(Math.random() * 10000);
        doLayout();
      });

      // ── Lifecycle ───────────────────────────────────────────────
      doLayout();
      win.onResize(doLayout);

      win.describeState(() => {
        const w = Number(root.width) || 0, h = Number(root.height) || 0;
        const mode = pickBreakpoint(LAYOUT_BREAKPOINTS, w, h) ?? "s";
        return {
          summary: `Hello World v2 — ${mode.toUpperCase()} ${w}x${h}` +
                   (compass ? ` compass:${compass}` : ""),
          mode, width: w, height: h, seed: contourSeed,
          compass: compass ?? "auto",
        };
      });

      win.captureText(() => {
        const w = Number(root.width) || 60;
        const title = responsiveFiglet("HELLO WORLD", w);
        const parts = [title];
        if (art.visible) parts.push("", WIBWOB_ART.join("\n"));
        return parts.join("\n");
      });

      win.onRestyle(() => {
        const t = host.theme();
        root.style = t.body;
        bannerBox.style = t.body;
        bannerText.style = t.body;
        statusBar.style = t.muted;
        contourBox.style = { ...t.body, border: { fg: t.muted.fg } };
        clockBox.style = { ...t.body, border: { fg: t.muted.fg } };
        statsBox.style = { ...t.body, border: { fg: t.muted.fg } };
        infoBox.style = t.body;
        art.node.style = t.body;
      });

      win.onCleanup(() => {
        host.screen.off("keypress", handleKeypress);
        clearTimers(timers);
        art.destroy();
      });

      win.focus();
    },
  });
}
