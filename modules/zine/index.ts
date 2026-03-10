/**
 * ZINE — Zone of Interstitial Narrative Emergence
 *
 * A canvas of arranged panels loaded entirely from a .canvas.yaml file.
 * No hardcoded content. One file = one composition.
 * Reuses panel-layout engine and panel-types renderers from §y² Chronicles.
 */

import blessed from "blessed";
import fs from "node:fs";
import YAML from "yaml";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  measureViewport,
  type PanelDef,
  type PanelNode,
} from "../../src/core/panel-layout.js";
import {
  blankGrid,
  paintLines,
  gridToText,
} from "../../src/core/grid-canvas.js";
import { renderFiglet } from "../../src/services/figlet-service.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { createScrollbar, scrollableStyle } from "../../src/core/ui-primitives.js";

// ── Panel types (subset of CEPanelDef, YAML-serialisable) ─────────────────

interface ZinePanelDef {
  id: string;
  type: "text" | "figlet" | "ascii-art" | "pixel" | "infographic";
  title: string;
  w: number;
  h: number;
  col?: number;
  live?: boolean;
  text?: string;
  figletText?: string;
  figletFont?: string;
  asciiArt?: string;
  asciiFile?: string;
}

interface ZineDocument {
  meta: { title: string; format?: string };
  panels: ZinePanelDef[];
}

// ── Panel type prefixes ───────────────────────────────────────────────────

const TYPE_PREFIX: Record<string, string> = {
  text: "¶",
  figlet: "▌",
  "ascii-art": "◈",
  pixel: "▒",
  infographic: "◊",
};

// ── Renderers ─────────────────────────────────────────────────────────────

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length <= width) { lines.push(para); continue; }
    let rem = para;
    while (rem.length > width) {
      let b = rem.lastIndexOf(" ", width);
      if (b <= 0) b = width;
      lines.push(rem.slice(0, b));
      rem = rem.slice(b).trimStart();
    }
    if (rem) lines.push(rem);
  }
  return lines;
}

function renderPanel(def: ZinePanelDef, w: number, h: number, _tick: number): string {
  const iw = Math.max(1, w - 2);
  const ih = Math.max(1, h - 2);

  switch (def.type) {
    case "text": {
      const text = def.text ?? def.title;
      return paintLines(iw, ih, wrapText(text, iw), { centerX: false, centerY: false });
    }
    case "figlet": {
      const text = def.figletText ?? def.title;
      const font = def.figletFont ?? "small";
      try {
        const rendered = renderFiglet(text, font, iw);
        if (!rendered || rendered.includes("(figlet")) {
          return paintLines(iw, ih, [text], { centerX: true, centerY: true });
        }
        return paintLines(iw, ih, rendered.split("\n"), { centerX: true, centerY: true });
      } catch {
        return paintLines(iw, ih, [text], { centerX: true, centerY: true });
      }
    }
    case "ascii-art": {
      let lines: string[] = [];
      if (def.asciiFile) {
        try { lines = fs.readFileSync(def.asciiFile, "utf8").split("\n"); }
        catch { lines = [`[${def.asciiFile}]`, "(not found)"]; }
      } else if (def.asciiArt) {
        lines = def.asciiArt.split("\n");
      } else {
        lines = [def.title];
      }
      return paintLines(iw, ih, lines.slice(0, ih).map(l => l.slice(0, iw)), { centerX: true, centerY: true });
    }
    case "pixel": {
      const chars = ["▓", "▒", "░", " "];
      const lines: string[] = [];
      for (let y = 0; y < ih; y++) {
        let row = "";
        for (let x = 0; x < iw; x++) row += chars[(x + y) % chars.length];
        lines.push(row);
      }
      return paintLines(iw, ih, lines, { centerX: false, centerY: true });
    }
    case "infographic": {
      const lines = [
        def.title,
        "",
        `${"█".repeat(8)}  80%`,
        `${"█".repeat(5)}  50%`,
        `${"█".repeat(3)}  30%`,
      ];
      return lines.slice(0, ih).join("\n");
    }
    default:
      return def.text ?? def.title;
  }
}

// ── Module ────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  function openZine(args?: Record<string, unknown>) {
    const filePath = typeof args?.filePath === "string" ? args.filePath : "";
    if (!filePath || !fs.existsSync(filePath)) {
      host.screen.render();
      return;
    }

    // Parse the YAML
    let doc: ZineDocument;
    try {
      const raw = YAML.parse(fs.readFileSync(filePath, "utf8"));
      doc = raw as ZineDocument;
      if (!Array.isArray(doc.panels) || doc.panels.length === 0) return;
    } catch {
      return;
    }

    const title = doc.meta?.title ?? "ZINE";
    const sw = Math.max(80, Number(host.screen.width));
    const sh = Math.max(24, Number(host.screen.height));
    const win = host.createWindow({
      title: `ZINE: ${title}`,
      width: sw - 2,
      height: sh - 3,
      left: 0,
      top: 0,
    });

    let tick = 0;
    const timers = new Set<ReturnType<typeof setInterval>>();

    // Root container
    const root = blessed.box({
      parent: win.body,
      top: 0, left: 0, right: 0, bottom: 0,
      style: host.theme().body,
    });

    // Scrollable canvas (matches §y² pattern)
    const canvas = blessed.box({
      parent: root,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true,
      mouse: true,
      clickable: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "│",
        track: { ch: "░" },
        style: { fg: host.theme().muted.fg, bg: host.theme().body.bg },
      },
      style: host.theme().body,
    });

    // Prevent blessed scroll-jump on child focus
    (canvas as any)._scrollIntoView = () => {};

    // Convert YAML panels to PanelDefs
    const panelDefs: PanelDef[] = doc.panels.map(p => ({
      id: p.id,
      title: `${TYPE_PREFIX[p.type] ?? "·"} ${p.title}`,
      w: p.w,
      h: p.h,
      col: (p.col ?? 0) as 0 | 1 | 2,
      live: p.live,
      content: (t: number, w: number, h: number) => renderPanel(p, w, h, t),
    }));

    // Layout + render
    const panelNodes = new Map<string, PanelNode>();

    function renderLayout() {
      const vp = measureViewport(canvas);
      const result = layoutPanels(panelDefs, vp.width);

      // Total content height
      let maxY = result.contentHeight;

      // Create or update panel blessed nodes
      // Join placements with defs by id
      for (const placement of result.placements) {
        const def = panelDefs.find(d => d.id === placement.id);
        if (!def) continue;
        const p = { ...placement, def };
        let node = panelNodes.get(p.id);
        if (!node) {
          const frame = blessed.box({
            parent: canvas,
            left: p.x,
            top: p.y,
            width: p.def.w,
            height: p.def.h,
            border: "line",
            style: {
              ...host.theme().body,
              border: { fg: host.theme().muted.fg },
            },
          });

          // Title bar
          const titleBar = blessed.box({
            parent: frame,
            top: 0,
            left: 1,
            right: 1,
            height: 1,
            tags: false,
            style: { fg: host.theme().body.fg, bg: host.theme().body.bg },
          });
          titleBar.setContent(p.def.title);

          const content = blessed.box({
            parent: frame,
            top: 1, left: 1, right: 1, bottom: 0,
            tags: false,
            style: host.theme().body,
          });

          node = { id: p.id, x: p.x, y: p.y, def: p.def, frame, content };
          panelNodes.set(p.id, node);
        } else {
          node.frame.left = p.x;
          node.frame.top = p.y;
          node.x = p.x;
          node.y = p.y;
        }

        // Render content
        const text = p.def.content?.(tick, p.def.w, p.def.h) ?? "";
        node.content.setContent(text);
      }

      host.screen.render();
    }

    renderLayout();

    // Tick for live panels
    createTimer(() => {
      tick++;
      for (const [, node] of panelNodes) {
        if (node.def.live) {
          const text = node.def.content?.(tick, node.def.w, node.def.h) ?? "";
          node.content.setContent(text);
        }
      }
      host.screen.render();
    }, 1000, timers);

    // Keyboard scroll
    canvas.key(["j", "down"], () => { canvas.scroll(1); host.screen.render(); });
    canvas.key(["k", "up"], () => { canvas.scroll(-1); host.screen.render(); });
    canvas.key(["S-j", "S-down"], () => { canvas.scroll(5); host.screen.render(); });
    canvas.key(["S-k", "S-up"], () => { canvas.scroll(-5); host.screen.render(); });
    canvas.key(["pagedown"], () => { canvas.scroll(20); host.screen.render(); });
    canvas.key(["pageup"], () => { canvas.scroll(-20); host.screen.render(); });
    canvas.key(["home"], () => { canvas.scrollTo(0); host.screen.render(); });

    // Focus canvas
    canvas.focus();

    // Describe state
    win.describeState(() => ({
      appType: "zine",
      summary: `ZINE: ${title} — ${panelNodes.size} panels`,
      panelCount: panelNodes.size,
      filePath,
      title,
      panels: [...panelNodes.entries()].map(([id, n]) => ({
        id,
        title: n.def.title,
        x: n.x,
        y: n.y,
        w: n.def.w,
        h: n.def.h,
      })),
    }));

    // Restyle
    win.onRestyle(() => {
      root.style = host.theme().body;
      canvas.style = scrollableStyle(host.theme().body);
      for (const [, node] of panelNodes) {
        node.frame.style = {
          border: { fg: host.theme().muted.fg },
          label: { fg: host.theme().body.fg },
          ...host.theme().body,
        };
        node.content.style = host.theme().body;
      }
      host.screen.render();
    });

    // Cleanup
    win.onCleanup(() => {
      clearTimers(timers);
    });

    return win.record;
  }

  host.registerCommand({
    id: "open",
    label: "Open ZINE",
    description: "Open a ZINE canvas. Args: filePath (string, path to .canvas.yaml).",
    action: openZine,
    multiInstance: true,
    direct: true,
  });
}
