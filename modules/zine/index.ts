/**
 * ZINE — Zone of Interstitial Narrative Emergence
 *
 * A canvas of arranged panels loaded entirely from a .canvas.yaml file.
 * No hardcoded content. One file = one composition.
 * Renders identically to §y² Chronicles — same panel chrome, title bars,
 * scrollable canvas, toolbar, keyboard navigation.
 *
 * Reuses: content-loader (YAML parsing), panel-types (CEPanelDef, toPanelDef,
 * renderPanel), panel-layout (column layout engine).
 */

import blessed from "blessed";
import fs from "node:fs";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  measureViewport,
  type PanelNode,
} from "../../src/core/panel-layout.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { createButtonBar } from "../../src/core/ui-parts.js";
import { toPanelDef, renderPanel } from "../sy2-chronicles/panel-types.js";
import { loadCanvas } from "../sy2-chronicles/content-loader.js";

// ── Module ────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  function openZine(args?: Record<string, unknown>) {
    const filePath = typeof args?.filePath === "string" ? args.filePath : "";
    if (!filePath || !fs.existsSync(filePath)) return;

    const canvas_doc = loadCanvas(filePath);
    if (!canvas_doc) return;

    const { title, panels: cePanelDefs } = canvas_doc;

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
    let activePanelId = cePanelDefs[0]?.id ?? "";
    let searchQuery = "";
    const timers = new Set<ReturnType<typeof setInterval>>();

    // ── Root container ──────────────────────────────────────────────
    const root = blessed.box({
      parent: win.body,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true, mouse: true, clickable: true,
      style: host.theme().body,
    });

    // ── Scrollable canvas (identical to §y²) ────────────────────────
    const canvas = blessed.box({
      parent: root,
      top: 1, left: 0, right: 0, bottom: 1,
      keys: true, mouse: true, clickable: true,
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

    // Preserve scroll position across focus changes
    const _originalFocus = canvas.focus.bind(canvas);
    (canvas as any).focus = () => {
      const saved = (canvas as any).childBase ?? 0;
      _originalFocus();
      if (saved > 0) {
        (canvas as any).childBase = saved;
        (canvas as any).childOffset = saved;
      }
    };

    // ── Toolbar (bottom bar, identical to §y²) ─────────────────────
    let paused = false;
    type ToolbarAction = "search" | "pause";
    const toolbar = createButtonBar<ToolbarAction>(
      root,
      [
        { id: "search", label: "/ Search" },
        { id: "pause",  label: "⏸ Pause" },
      ],
      (id) => {
        if (id === "search") openSearchPrompt();
        else if (id === "pause") {
          paused = !paused;
          updateStatus();
          host.screen.render();
        }
      },
    );
    toolbar.layout({ top: 0, left: 0, width: Number(root.width) || 80, height: 1 });
    toolbar.node.bottom = 0;
    toolbar.node.top = undefined as any;

    // ── Status bar (top) ────────────────────────────────────────────
    const statusBar = blessed.box({
      parent: root,
      top: 0, left: 0, right: 0, height: 1,
      tags: false,
      style: host.theme().body,
    });

    // ── Panel nodes ─────────────────────────────────────────────────
    const panelNodes = new Map<string, PanelNode>();

    function getFilteredDefs() {
      if (!searchQuery) return cePanelDefs;
      return cePanelDefs.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    function applyStyles() {
      for (const node of panelNodes.values()) {
        const active = node.def.id === activePanelId;
        const borderColor = active
          ? host.theme().highlight.fg
          : host.theme().muted.fg;

        node.frame.style = {
          ...host.theme().body,
          border: { fg: borderColor },
        };
        node.titleBar.style = active
          ? { ...host.theme().titleBarFocused, bold: true }
          : host.theme().header;
        node.content.style = host.theme().body;
        node.titleBar.setContent(node.def.title);
      }
    }

    function updateStatus() {
      const scroll = (canvas as any).getScrollPerc?.() ?? 0;
      const q = searchQuery ? `  search:${searchQuery}` : "";
      const pauseLabel = paused ? "▶ Play" : "⏸ Pause";
      toolbar.update({
        leftText: ` ZINE  ${panelNodes.size} panels  scroll:${scroll}%${q}`,
        activeId: paused ? "pause" : "search",
      });
      const pauseNode = (toolbar.node.children as any)?.[3];
      if (pauseNode?.setContent) pauseNode.setContent(` ${pauseLabel} `);
      statusBar.setContent(` ${title}`);
    }

    function buildPanels() {
      for (const node of panelNodes.values()) node.frame.destroy();
      panelNodes.clear();

      const defs = getFilteredDefs();
      if (!activePanelId && defs.length > 0) activePanelId = defs[0]!.id;

      for (const ceDef of defs) {
        const def = toPanelDef(ceDef);

        const frame = blessed.box({
          parent: canvas,
          top: 0, left: 0,
          width: def.w, height: def.h,
          border: "line",
          style: {
            ...host.theme().body,
            border: { fg: host.theme().muted.fg },
          },
        });

        const titleBar = blessed.box({
          parent: frame,
          top: 0, left: 1, right: 1, height: 1,
          tags: false,
          fixed: true,
          style: host.theme().header,
          content: def.title,
        });

        const iw = Math.max(1, def.w - 2);
        const ih = Math.max(1, def.h - 2);
        const content = blessed.box({
          parent: frame,
          top: 1, left: 1,
          width: iw, height: ih,
          tags: false,
          fixed: true,
          style: host.theme().body,
        });

        panelNodes.set(def.id, {
          def, frame, titleBar, content,
          x: 0, y: 0,
        });
      }
    }

    function renderLayoutAndContent() {
      const { width: vw, height: vh } = measureViewport(canvas);
      const defs = getFilteredDefs();
      const layoutDefs = defs.map(toPanelDef);
      const layout = layoutPanels(layoutDefs, Math.max(20, vw));

      const scrollY = (canvas as any).childBase ?? 0;
      const viewTop = scrollY;
      const viewBot = scrollY + vh;

      for (const placement of layout.placements) {
        const node = panelNodes.get(placement.id);
        if (!node) continue;
        const effectiveW = Math.max(3, Math.min(node.def.w, vw));
        node.x = placement.x;
        node.y = placement.y;
        node.frame.left = node.x;
        node.frame.top = node.y;
        node.frame.width = effectiveW;

        const panelTop = node.y;
        const panelBot = node.y + node.def.h;

        if (panelBot <= viewTop || panelTop >= viewBot) {
          node.frame.hidden = true;
        } else {
          node.frame.hidden = false;
          const visibleH = Math.min(node.def.h, viewBot - panelTop);
          node.frame.height = Math.max(3, visibleH);
          node.content.height = Math.max(1, visibleH - 2);
        }

        node.content.width = Math.max(1, effectiveW - 2);
      }

      for (const node of panelNodes.values()) {
        const iw = Math.max(1, node.def.w - 2);
        const ih = Math.max(1, node.def.h - 2);
        node.content.setContent(node.def.content(tick, iw, ih));
      }

      applyStyles();
      updateStatus();
    }

    // ── Search ──────────────────────────────────────────────────────
    function openSearchPrompt() {
      const prompt = blessed.textbox({
        parent: root,
        bottom: 1, left: 0, right: 0, height: 1,
        style: { fg: host.theme().body.fg, bg: host.theme().selected.bg },
        inputOnFocus: true,
      });
      prompt.focus();
      prompt.readInput((_err, value) => {
        searchQuery = (value ?? "").trim();
        prompt.destroy();
        buildPanels();
        renderLayoutAndContent();
        canvas.focus();
        host.screen.render();
      });
      host.screen.render();
    }

    // ── Build + first render ────────────────────────────────────────
    buildPanels();
    renderLayoutAndContent();
    canvas.focus();

    // ── Tick (live panels) ──────────────────────────────────────────
    createTimer(() => {
      if (paused) return;
      tick++;
      let dirty = false;
      for (const node of panelNodes.values()) {
        if (node.def.live) {
          const iw = Math.max(1, node.def.w - 2);
          const ih = Math.max(1, node.def.h - 2);
          node.content.setContent(node.def.content(tick, iw, ih));
          dirty = true;
        }
      }
      if (dirty) { updateStatus(); host.screen.render(); }
    }, 1000, timers);

    // ── Keyboard ────────────────────────────────────────────────────
    const scrollAndRender = (amount: number) => {
      canvas.scroll(amount);
      renderLayoutAndContent();
      host.screen.render();
    };

    canvas.key(["j", "down"], () => scrollAndRender(1));
    canvas.key(["k", "up"], () => scrollAndRender(-1));
    canvas.key(["S-j", "S-down"], () => scrollAndRender(5));
    canvas.key(["S-k", "S-up"], () => scrollAndRender(-5));
    canvas.key(["C-j", "C-down"], () => scrollAndRender(10));
    canvas.key(["C-k", "C-up"], () => scrollAndRender(-10));
    canvas.key(["pagedown"], () => scrollAndRender(20));
    canvas.key(["pageup"], () => scrollAndRender(-20));
    canvas.key(["home", "g"], () => { canvas.scrollTo(0); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["end", "G"], () => { canvas.scrollTo(99999); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["/"], () => openSearchPrompt());

    canvas.on("wheeldown", () => scrollAndRender(3));
    canvas.on("wheelup", () => scrollAndRender(-3));

    // ── Describe state ──────────────────────────────────────────────
    win.describeState(() => ({
      appType: "zine",
      summary: `ZINE: ${title} — ${panelNodes.size} panels`,
      panelCount: panelNodes.size,
      filePath, title,
      panels: [...panelNodes.entries()].map(([id, n]) => ({
        id, title: n.def.title,
        x: n.x, y: n.y, w: n.def.w, h: n.def.h,
      })),
    }));

    // ── Restyle ─────────────────────────────────────────────────────
    win.onRestyle(() => {
      root.style = host.theme().body;
      canvas.style = host.theme().body;
      (canvas as any).scrollbar.style = { fg: host.theme().muted.fg, bg: host.theme().body.bg };
      statusBar.style = host.theme().body;
      applyStyles();
      updateStatus();
      host.screen.render();
    });

    // ── Cleanup ─────────────────────────────────────────────────────
    win.onCleanup(() => clearTimers(timers));

    return win.record;
  }

  host.registerCommand({
    id: "open",
    label: "Open ZINE",
    description: "Open a ZINE canvas — panels from .canvas.yaml rendered as §y²-style sub-windows. Args: filePath (string).",
    action: openZine,
    multiInstance: true,
    direct: true,
    menu: [{ category: "applications", order: 40, label: "ZINE" }],
    palette: { order: 60, label: "Open ZINE" },
  });
}
