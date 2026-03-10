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
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  measureViewport,
  pointerToContent,
  hitPanel,
  type PanelNode,
} from "../../src/core/panel-layout.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { createButtonBar } from "../../src/core/ui-parts.js";
import { toPanelDef, renderPanel } from "../sy2-chronicles/panel-types.js";
import { loadCanvas } from "../sy2-chronicles/content-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Recursively find all .canvas.yaml files under a directory. */
function findCanvasFiles(dir: string, maxDepth = 3, depth = 0): string[] {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".canvas.yaml")) {
      results.push(full);
    } else if (entry.isDirectory()) {
      results.push(...findCanvasFiles(full, maxDepth, depth + 1));
    }
  }
  return results;
}

// ── Module ────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  function openZine(args?: Record<string, unknown>) {
    let filePath = typeof args?.filePath === "string" ? args.filePath : "";

    // If no path given, find canvas files and show a picker
    if (!filePath) {
      const candidates = findCanvasFiles(path.join(REPO_ROOT, "content"));
      if (candidates.length === 0) return;
      if (candidates.length === 1) {
        filePath = candidates[0]!;
      } else {
        // Show list picker
        const picker = blessed.list({
          parent: host.screen,
          top: "center", left: "center",
          width: "60%", height: Math.min(candidates.length + 2, 20),
          border: "line",
          label: " Open ZINE — select canvas ",
          keys: true, mouse: true, vi: true,
          items: candidates.map(c => path.relative(REPO_ROOT, c)),
          style: {
            ...host.theme().body,
            border: { fg: host.theme().highlight.fg },
            selected: host.theme().selected,
            item: host.theme().body,
          },
        });
        picker.focus();
        picker.on("select", (_item: any, index: number) => {
          picker.destroy();
          host.screen.render();
          openZine({ filePath: candidates[index] });
        });
        picker.key(["escape", "q"], () => {
          picker.destroy();
          host.screen.render();
        });
        host.screen.render();
        return;
      }
    }

    if (!fs.existsSync(filePath)) return;

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
    let editingPanelId: string | undefined;
    let dragging: { id: string; offsetX: number; offsetY: number } | undefined;
    const panelPositionOverrides = new Map<string, { x: number; y: number }>();
    const contentOverrides = new Map<string, string>();
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

    // ── Column separator overlay ──────────────────────────────────
    const colSepOverlay = blessed.box({
      parent: canvas,
      top: 0, left: 0, right: 0, height: 1,
      tags: false,
      fixed: true,
      style: { fg: host.theme().muted.fg, bg: "default", transparent: true },
    });

    function renderLayoutAndContent() {
      const { width: vw, height: vh } = measureViewport(canvas);
      const defs = getFilteredDefs();
      const layoutDefs = defs.map(toPanelDef);
      const layout = layoutPanels(layoutDefs, Math.max(20, vw));
      const totalContentHeight = Math.max(layout.contentHeight, vh);

      // Apply position overrides from drags
      for (const placement of layout.placements) {
        const override = panelPositionOverrides.get(placement.id);
        if (override) {
          placement.x = override.x;
          placement.y = override.y;
        }
      }

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

      // Render content (respect overrides and editing)
      for (const node of panelNodes.values()) {
        if (editingPanelId === node.def.id) continue;
        const iw = Math.max(1, node.def.w - 2);
        const ih = Math.max(1, node.def.h - 2);
        const override = contentOverrides.get(node.def.id);
        node.content.setContent(override ?? node.def.content(tick, iw, ih));
      }

      // Column separators disabled — the panel arrangement itself
      // provides sufficient visual grouping.
      colSepOverlay.setContent("");
      colSepOverlay.hidden = true;

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

    // ── Double-click → inline edit ──────────────────────────────────
    function enterEditMode(panelId: string) {
      const node = panelNodes.get(panelId);
      if (!node || editingPanelId) return;
      editingPanelId = panelId;
      const iw = Math.max(1, node.def.w - 2);
      const ih = Math.max(1, node.def.h - 2);
      const currentText = contentOverrides.get(panelId) ?? node.def.content(0, iw, ih);
      const editor = blessed.textarea({
        parent: node.frame,
        top: 1, left: 1, right: 1, bottom: 1,
        keys: true, mouse: true, clickable: true,
        inputOnFocus: true,
        fixed: true,
        style: { ...host.theme().body, border: { fg: host.theme().selected.bg } },
        scrollable: true,
      });
      editor.setValue(currentText);
      editor.focus();
      host.screen.render();
      const exitEdit = () => {
        const saved = editor.getValue();
        contentOverrides.set(panelId, saved);
        editor.destroy();
        editingPanelId = undefined;
        renderLayoutAndContent();
        canvas.focus();
        host.screen.render();
      };
      editor.key(["escape"], exitEdit);
      editor.key(["C-s"], exitEdit);
    }

    // ── Mouse: click-to-focus, double-click-to-edit, drag-to-move ──
    function isInsideCanvas(sx: number, sy: number): boolean {
      try {
        const ct = (canvas as any).atop ?? 0;
        const cl = (canvas as any).aleft ?? 0;
        const cw = Number(canvas.width) || 0;
        const ch = Number(canvas.height) || 0;
        return sx >= cl && sx < cl + cw && sy >= ct && sy < ct + ch;
      } catch { return false; }
    }

    function safePointerToContent(x: number, y: number): { x: number; y: number } | undefined {
      try { return pointerToContent(canvas, x, y); }
      catch { return undefined; }
    }

    let lastClickTime = 0;
    let lastClickId = "";
    const DBLCLICK_MS = 350;

    const handleMouse = (data: any) => {
      if (!canvas.parent) return;
      if (data.action === "wheeldown" || data.action === "wheelup") return;
      if (data.action === "mousedown" && !isInsideCanvas(data.x, data.y)) return;

      if (data.action === "mouseup") {
        dragging = undefined;
        return;
      }

      if (data.action === "mousedown") {
        const pt = safePointerToContent(data.x, data.y);
        if (!pt) return;
        const node = hitPanel(panelNodes, pt.x, pt.y);
        if (node) {
          // Double-click detection
          const now = Date.now();
          if (now - lastClickTime < DBLCLICK_MS && lastClickId === node.def.id) {
            enterEditMode(node.def.id);
            lastClickTime = 0;
            return;
          }
          lastClickTime = now;
          lastClickId = node.def.id;

          // Focus + drag start
          dragging = {
            id: node.def.id,
            offsetX: pt.x - node.x,
            offsetY: pt.y - node.y,
          };
          activePanelId = node.def.id;
          applyStyles();
          host.screen.render();
        }
        return;
      }

      if (data.action === "mousemove" && dragging) {
        const pt = safePointerToContent(data.x, data.y);
        if (!pt) return;
        const node = panelNodes.get(dragging.id);
        if (!node) return;
        const newX = Math.max(0, pt.x - dragging.offsetX);
        const newY = Math.max(0, pt.y - dragging.offsetY);
        panelPositionOverrides.set(dragging.id, { x: newX, y: newY });
        node.x = newX;
        node.y = newY;
        node.frame.left = newX;
        node.frame.top = newY;
        host.screen.render();
      }
    };
    host.screen.on("mouse", handleMouse);

    // Mouse wheel
    const handleWheel = (data: any) => {
      if (!canvas.parent) return;
      if (!isInsideCanvas(data.x, data.y)) return;
      if (data.action === "wheeldown") {
        canvas.scroll(3); renderLayoutAndContent(); host.screen.render();
      } else if (data.action === "wheelup") {
        canvas.scroll(-3); renderLayoutAndContent(); host.screen.render();
      }
    };
    host.screen.on("mouse", handleWheel);

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
        if (node.def.live && !editingPanelId) {
          const iw = Math.max(1, node.def.w - 2);
          const ih = Math.max(1, node.def.h - 2);
          if (!contentOverrides.has(node.def.id)) {
            node.content.setContent(node.def.content(tick, iw, ih));
            dirty = true;
          }
        }
      }
      if (dirty) { updateStatus(); host.screen.render(); }
    }, 1000, timers);

    // ── Keyboard ────────────────────────────────────────────────────
    function scrollBy(delta: number) {
      canvas.scroll(delta);
      renderLayoutAndContent();
      host.screen.render();
    }

    canvas.key(["j", "down"], () => scrollBy(1));
    canvas.key(["k", "up"], () => scrollBy(-1));
    canvas.key(["S-j", "S-down"], () => scrollBy(5));
    canvas.key(["S-k", "S-up"], () => scrollBy(-5));
    canvas.key(["C-j", "C-down"], () => scrollBy(10));
    canvas.key(["C-k", "C-up"], () => scrollBy(-10));
    canvas.key(["pagedown"], () => scrollBy(20));
    canvas.key(["pageup"], () => scrollBy(-20));
    canvas.key(["home", "g"], () => { canvas.scrollTo(0); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["end", "G"], () => { canvas.scrollTo(99999); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["/"], () => openSearchPrompt());
    canvas.key(["r"], () => { buildPanels(); });

    // Also handle keys via win.onInput for when blessed focus is on the frame
    win.onInput((ch: string, key?: blessed.Widgets.Events.IKeyEventArg) => {
      const speed = key?.shift ? 5 : key?.ctrl ? 10 : 1;
      if (key?.name === "up"   || ch === "k") { scrollBy(-1 * speed); return; }
      if (key?.name === "down" || ch === "j") { scrollBy(1 * speed);  return; }
      if (key?.name === "pageup")   { scrollBy(-20 * speed); return; }
      if (key?.name === "pagedown") { scrollBy(20 * speed);  return; }
      if (editingPanelId) return;
      if (ch === "/") { openSearchPrompt(); return; }
      if (ch === "r") { buildPanels(); return; }
    });

    // ── Resize reflow ───────────────────────────────────────────────
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    win.onResize(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        toolbar.layout({ top: 0, left: 0, width: Number(root.width) || 80, height: 1 });
        renderLayoutAndContent();
        host.screen.render();
      }, 100);
    });

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
      colSepOverlay.style = { fg: host.theme().muted.fg, bg: "default", transparent: true };
      applyStyles();
      updateStatus();
      host.screen.render();
    });

    // ── Cleanup ─────────────────────────────────────────────────────
    win.onCleanup(() => {
      clearTimers(timers);
      host.screen.off("mouse", handleMouse);
      host.screen.off("mouse", handleWheel);
    });

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
