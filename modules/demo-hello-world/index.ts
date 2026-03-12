/**
 * Hello World v2 — Layout engine showcase + SDK primitive proving ground.
 *
 * Now uses the canon layout SDK: createGrid, createNodePart, applyRect.
 *
 * Toolbar (visible at L+ sizes):
 *   Compass buttons, regen button, mode indicator.
 *   Responsive: hidden at M/S — the Tailwind "hidden lg:flex" pattern.
 *
 * Layout modes:
 *   XL  (95+ x 26+)  toolbar + 2-col grid (contour span-2, stats, clock) + cats
 *   L   (65+ x 18+)  toolbar + 2-col (contour, clock) + cats
 *   M   (40+ x 12+)  banner + info
 *   S   (< 40)        banner only
 */

import blessed from "blessed";
import type { MicroappHost, Rect } from "../../src/services/microapp-sdk.js";
import {
  responsiveFiglet,
  renderFiglet,
  createTimer,
  clearTimers,
  createGrid,
  createNodePart,
  applyRect,
} from "../../src/services/microapp-sdk.js";

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

// ── responsive (height-aware, module-local) ───────────────────────────────

type LayoutMode = "xl" | "l" | "m" | "s";

function pickMode(w: number, h: number): LayoutMode {
  if (w >= 95 && h >= 26) return "xl";
  if (w >= 65 && h >= 18) return "l";
  if (w >= 40 && h >= 12) return "m";
  return "s";
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
  "",
  "XL: toolbar + 2-col grid",
  "L:  toolbar + 2-col",
  "M:  banner + info",
  "S:  banner only",
].join("\n");

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
        mouse: true, clickable: true,
        style: host.theme().body,
      });

      // ══════════════════════════════════════════════════════════════
      // TOOLBAR — visible at L+ sizes (the "hidden lg:flex" pattern)
      // ══════════════════════════════════════════════════════════════

      const TOOLBAR_H = 1;

      const toolbar = blessed.box({
        parent: root, top: 0, left: 0, width: "100%" as any, height: TOOLBAR_H,
        mouse: true, clickable: true,
        style: { fg: "white", bg: "black", bold: true },
      });
      toolbar.hide();

      // App label
      blessed.box({
        parent: toolbar, top: 0, left: 0, width: 12, height: 1,
        content: " \u25C8 WibWob ",
        style: { fg: "cyan", bg: "black", bold: true },
      });

      // Separator
      blessed.box({
        parent: toolbar, top: 0, left: 12, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });

      // Compass buttons
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

      // Separator
      blessed.box({
        parent: toolbar, top: 0, left: cx, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });
      cx += 1;

      // Regen button
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

      // Separator
      blessed.box({
        parent: toolbar, top: 0, left: cx, width: 1, height: 1,
        content: "\u2502", style: { fg: "gray", bg: "black" },
      });

      // Mode/size label (right-aligned)
      const toolbarMode = blessed.box({
        parent: toolbar, top: 0, right: 0, width: 20, height: 1,
        align: "right" as any,
        style: { fg: "gray", bg: "black" },
      });

      function updateToolbar(mode: LayoutMode, w: number, h: number) {
        const compassStr = compass ? COMPASS_LABELS[compass] : "auto";
        toolbarMode.setContent(`${mode.toUpperCase()} ${w}x${h} ${compassStr} `);
        for (const { key, node } of compassBtns) {
          const isActive = (key === "auto" && compass === null) || (key === compass);
          node.style = isActive
            ? { fg: "black", bg: "cyan", bold: true }
            : { fg: "white", bg: "black" };
        }
      }

      // ══════════════════════════════════════════════════════════════
      // CONTENT PANELS
      // ══════════════════════════════════════════════════════════════

      // Banner area — transparent container, no border
      const bannerBox = blessed.box({
        parent: root, top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
      });
      // Inner text box — tight-fit to figlet, positioned within bannerBox
      const bannerText = blessed.box({
        parent: bannerBox, top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
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

      // Cats — float bottom-right, visible at XL/L only
      const catBox = blessed.box({
        parent: root, width: ART_W, height: ART_H,
        content: WIBWOB_ART.join("\n"),
        style: host.theme().body,
      });
      catBox.hide();

      // ── XL grid — uses SDK createGrid with object-form set ──────
      const xlGrid = createGrid(root, {
        rows: 2, columns: 2,
        templateColumns: ["2fr", "1fr"],
        templateRows: ["1fr", "1fr"],
        gap: { row: 1, column: 1 },
      });
      xlGrid.set({ key: "contour", row: 0, column: 0, rowSpan: 2, part: createNodePart(contourBox) });
      xlGrid.set({ key: "stats",   row: 0, column: 1, part: createNodePart(statsBox) });
      xlGrid.set({ key: "clock",   row: 1, column: 1, part: createNodePart(clockBox) });

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
          `  cats     ${mode === "xl" || mode === "l" ? "YES" : "-"}`,
        ].join("\n"));
      }

      // ══════════════════════════════════════════════════════════════
      // LAYOUT
      // ══════════════════════════════════════════════════════════════

      function doLayout() {
        const w = Math.max(10, Number(root.width) || 60);
        const h = Math.max(5, Number(root.height) || 20);
        const mode = pickMode(w, h);

        // ── Responsive title ──
        const banner = responsiveFiglet("HELLO WORLD", w);
        const bannerH = banner.split("\n").length;

        // ── Toolbar: visible at L+ ──
        const showToolbar = mode === "xl" || mode === "l";
        if (showToolbar) { toolbar.show(); updateToolbar(mode, w, h); }
        else { toolbar.hide(); }
        const contentTop = showToolbar ? TOOLBAR_H : 0;

        // ── Banner: position inner text box within transparent area ──
        bannerBox.show();
        const bannerAllocH = bannerH;
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

        // ── Grid area below banner ──
        const gridTop = contentTop + bannerAllocH;
        const gridH = Math.max(4, h - gridTop - 1);

        // Helper: hide + collapse to zero so blessed clears the old region
        const collapse = (node: blessed.Widgets.BoxElement) => {
          node.hide();
          applyRect(node, { top: 0, left: 0, width: 0, height: 0 });
        };

        if (mode === "xl") {
          contourBox.show(); clockBox.show(); statsBox.show();
          collapse(infoBox);
          xlGrid.layout({ top: gridTop, left: 0, width: w, height: gridH });
          updateContour(); updateClock(); updateStats(mode, w, h);
        } else if (mode === "l") {
          contourBox.show(); clockBox.show();
          collapse(statsBox); collapse(infoBox);
          const half = Math.floor((w - 1) / 2);
          applyRect(contourBox, { top: gridTop, left: 0, width: half, height: gridH });
          applyRect(clockBox,   { top: gridTop, left: half + 1, width: w - half - 1, height: gridH });
          updateContour(); updateClock();
        } else if (mode === "m") {
          collapse(contourBox); collapse(clockBox); collapse(statsBox);
          infoBox.show();
          applyRect(infoBox, { top: gridTop, left: 1, width: Math.min(40, w - 2), height: Math.max(2, gridH) });
        } else {
          collapse(contourBox); collapse(clockBox); collapse(statsBox); collapse(infoBox);
        }

        // Cats: visible at XL/L only
        const showCats = mode === "xl" || mode === "l";
        if (showCats) {
          catBox.show();
          catBox.top = h - ART_H + 1;
          catBox.left = w - ART_W - 1;
        } else {
          catBox.hide();
        }

        // Z-order: toolbar above content, cats above everything
        if (showToolbar) toolbar.setFront();
        if (showCats) catBox.setFront();

        host.screen.render();
      }

      // Click to regen contour
      root.on("click", () => {
        contourSeed = Math.floor(Math.random() * 10000);
        doLayout();
      });

      // ── Lifecycle ───────────────────────────────────────────────
      doLayout();
      win.onResize(doLayout);

      win.describeState(() => {
        const w = Number(root.width) || 0, h = Number(root.height) || 0;
        const mode = pickMode(w, h);
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
        if (catBox.visible) parts.push("", WIBWOB_ART.join("\n"));
        return parts.join("\n");
      });

      win.onRestyle(() => {
        const t = host.theme();
        root.style = t.body;
        bannerBox.style = t.body;
        bannerText.style = t.body;
        contourBox.style = { ...t.body, border: { fg: t.muted.fg } };
        clockBox.style = { ...t.body, border: { fg: t.muted.fg } };
        statsBox.style = { ...t.body, border: { fg: t.muted.fg } };
        infoBox.style = t.body;
        catBox.style = t.body;
      });

      win.onCleanup(() => {
        clearTimers(timers);
        xlGrid.destroy();
        catBox.destroy();
      });

      win.focus();
    },
  });
}
