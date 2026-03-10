/**
 * ZINE — Zone of Interstitial Narrative Emergence
 *
 * A canvas of arranged panels loaded entirely from a .canvas.yaml file.
 * No hardcoded content. One file = one composition.
 * Renders identically to §y² Chronicles — same panel chrome, title bars,
 * scrollable canvas, toolbar, keyboard navigation.
 *
 * Uses ZineItem as the unified layout primitive — every positioned rectangle
 * (panel, header, divider) is a ZineItem, positioned by the layout engine,
 * rendered and clipped uniformly.
 *
 * Reuses: content-loader (YAML parsing), panel-types (CEPanelDef, toPanelDef,
 * renderPanel), panel-layout (column layout engine), canvas-types (ZineItem).
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  layoutColumns,
  measureViewport,
  pointerToContent,
  hitPanel,
  type PanelNode,
} from "../../src/core/panel-layout.js";
import type { ZineItem, ZineSourceType } from "../../src/core/canvas-types.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { createButtonBar } from "../../src/core/ui-parts.js";
import { toPanelDef, renderPanel } from "../sy2-chronicles/panel-types.js";
import { loadCanvas } from "../sy2-chronicles/content-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Blessed node backing a ZineItem on the canvas. */
interface ZineNode {
  item: ZineItem;
  frame: blessed.Widgets.BoxElement;
  titleBar?: blessed.Widgets.BoxElement;
  content?: blessed.Widgets.BoxElement;
}

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

    const { title, panels: cePanelDefs, columnHeaders: showHeaders, columns: columnDefs } = canvas_doc;

    // Build column header map for layout engine
    const columnHeaderMap = new Map<number, string>();
    if (showHeaders) {
      for (const [idx, def] of columnDefs) {
        if (def.header) columnHeaderMap.set(idx, def.header);
      }
    }

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

    // ── Scrollable canvas ───────────────────────────────────────────
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

    // ── Toolbar (bottom bar) ────────────────────────────────────────
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
    toolbar.node.bottom = 0;
    toolbar.node.left = 0;
    toolbar.node.right = 0;
    toolbar.node.top = undefined as any;
    toolbar.node.height = 1;

    // ── Status bar (top) ────────────────────────────────────────────
    const statusBar = blessed.box({
      parent: root,
      top: 0, left: 0, right: 0, height: 1,
      tags: false,
      style: host.theme().body,
    });

    // ── ZineItem nodes (unified: panels + headers) ──────────────────
    const zineNodes = new Map<string, ZineNode>();
    // Legacy panelNodes view for hitPanel() compatibility
    const panelNodes = new Map<string, PanelNode>();

    function getFilteredDefs() {
      if (!searchQuery) return cePanelDefs;
      return cePanelDefs.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // ── Styles ──────────────────────────────────────────────────────
    function applyStyles() {
      for (const node of zineNodes.values()) {
        if (node.item.type === "panel") {
          const active = node.item.id === activePanelId;
          const borderColor = active
            ? host.theme().highlight.fg
            : host.theme().muted.fg;
          node.frame.style = {
            ...host.theme().body,
            border: { fg: borderColor },
          };
          if (node.titleBar) {
            node.titleBar.style = active
              ? { ...host.theme().titleBarFocused, bold: true }
              : host.theme().header;
            node.titleBar.setContent(node.item.title ?? "");
          }
          if (node.content) node.content.style = host.theme().body;
        } else if (node.item.type === "header") {
          node.frame.style = { fg: host.theme().highlight.fg, bg: host.theme().body.bg };
        }
      }
    }

    function updateStatus() {
      const scroll = (canvas as any).getScrollPerc?.() ?? 0;
      const q = searchQuery ? `  search:${searchQuery}` : "";
      const pauseLabel = paused ? "▶ Play" : "⏸ Pause";
      const panelCount = [...zineNodes.values()].filter(n => n.item.type === "panel").length;
      toolbar.update({
        leftText: ` ZINE  ${panelCount} panels  scroll:${scroll}%${q}`,
        activeId: paused ? "pause" : "search",
      });
      const pauseNode = (toolbar.node.children as any)?.[3];
      if (pauseNode?.setContent) pauseNode.setContent(` ${pauseLabel} `);
      statusBar.setContent("");
    }

    // ── Build ZineNodes from items ──────────────────────────────────
    function buildItems(items: ZineItem[]) {
      for (const node of zineNodes.values()) node.frame.destroy();
      zineNodes.clear();
      panelNodes.clear();

      for (const item of items) {
        if (item.type === "panel") {
          const frame = blessed.box({
            parent: canvas,
            top: 0, left: 0,
            width: item.w, height: item.h,
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
            content: item.title ?? "",
          });

          const iw = Math.max(1, item.w - 2);
          const ih = Math.max(1, item.h - 2);
          const contentBox = blessed.box({
            parent: frame,
            top: 1, left: 1,
            width: iw, height: ih,
            tags: false,
            fixed: true,
            style: host.theme().body,
          });

          const zNode: ZineNode = { item, frame, titleBar, content: contentBox };
          zineNodes.set(item.id, zNode);

          // Populate legacy panelNodes for hitPanel()
          if (item.content) {
            panelNodes.set(item.id, {
              def: {
                id: item.id, title: item.title ?? "",
                w: item.w, h: item.h,
                col: (item.col ?? 0) as 0|1|2,
                live: item.live,
                content: item.content,
              },
              frame, titleBar, content: contentBox,
              x: 0, y: 0,
            });
          }

          if (!activePanelId) activePanelId = item.id;

        } else if (item.type === "header") {
          const rule = "─".repeat(item.w);
          const frame = blessed.box({
            parent: canvas,
            top: item.y, left: item.x,
            width: item.w, height: 2,
            tags: false,
            style: { fg: host.theme().highlight.fg, bg: host.theme().body.bg },
            content: `${item.headerText ?? item.title ?? ""}\n${rule}`,
          });
          zineNodes.set(item.id, { item, frame });
        }
      }
    }

    /** Tear down all nodes and re-render from scratch. */
    function rebuild() {
      for (const n of zineNodes.values()) n.frame.destroy();
      zineNodes.clear();
      panelNodes.clear();
      renderLayoutAndContent();
      host.screen.render();
    }

    // ── Layout + render ─────────────────────────────────────────────
    function renderLayoutAndContent() {
      const measured = measureViewport(canvas);
      const vw = measured.width > 20 ? measured.width : Math.max(80, (Number(win.body.width) || 80) - 2);
      const vh = measured.height;
      const defs = getFilteredDefs();
      const layoutDefs = defs.map(toPanelDef);

      // Column or flow layout → unified ZineItem[]
      const hasColumns = defs.some(d => (d.col ?? 0) > 0);
      let items: ZineItem[];
      if (hasColumns) {
        const result = layoutColumns(layoutDefs, Math.max(20, vw), {
          columnHeaders: columnHeaderMap.size > 0 ? columnHeaderMap : undefined,
        });
        items = result.items;
      } else {
        const result = layoutPanels(layoutDefs, Math.max(20, vw));
        items = result.placements.map(p => {
          const def = layoutDefs.find(d => d.id === p.id);
          return {
            id: p.id, type: "panel" as const,
            x: p.x, y: p.y,
            w: def?.w ?? 40, h: def?.h ?? 10,
            title: def?.title, content: def?.content, live: def?.live,
          };
        });
      }

      // Build nodes on first render (or after rebuild/search)
      if (zineNodes.size === 0) buildItems(items);

      // Apply drag overrides
      for (const item of items) {
        const override = panelPositionOverrides.get(item.id);
        if (override) { item.x = override.x; item.y = override.y; }
      }

      const scrollY = (canvas as any).childBase ?? 0;
      const viewTop = scrollY;
      const viewBot = scrollY + vh;

      // Position and clip all ZineNodes uniformly
      for (const item of items) {
        const node = zineNodes.get(item.id);
        if (!node) continue;

        const effectiveW = Math.max(3, Math.min(item.w, vw));
        node.frame.left = item.x;
        node.frame.top = item.y;
        node.frame.width = effectiveW;

        const top = item.y;
        const bot = item.y + item.h;

        if (bot <= viewTop || top >= viewBot) {
          node.frame.hidden = true;
        } else {
          node.frame.hidden = false;
          if (item.type === "panel") {
            const visibleH = Math.min(item.h, viewBot - top);
            node.frame.height = Math.max(3, visibleH);
            if (node.content) {
              node.content.height = Math.max(1, visibleH - 2);
              node.content.width = Math.max(1, effectiveW - 2);
            }
          }
        }

        // Sync panelNodes position for hitPanel
        const pNode = panelNodes.get(item.id);
        if (pNode) { pNode.x = item.x; pNode.y = item.y; }
      }

      // Render panel content (respect overrides and editing)
      for (const node of zineNodes.values()) {
        if (node.item.type !== "panel" || !node.content || !node.item.content) continue;
        const iw = Math.max(1, node.item.w - 2);
        const ih = Math.max(1, node.item.h - 2);
        const override = contentOverrides.get(node.item.id);
        node.content.setContent(override ?? node.item.content(tick, iw, ih));
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
        rebuild();
        canvas.focus();
      });
      host.screen.render();
    }

    // ── Double-click → open in native editor ──────────────────────
    //
    // Dispatch map: sourceType → global command + args builder.
    // Each entry says "for this kind of panel content, open THIS editor".
    // Add new entries as editor apps get SDK-ised.
    //
    type EditorDispatch = {
      command: string;
      buildArgs: (panelId: string, content: string, panelTitle: string) => Record<string, unknown>;
    };

    const EDITOR_DISPATCH: Record<string, EditorDispatch> = {
      text: {
        command: "editor.open",
        buildArgs: (_id, content, panelTitle) => ({
          title: panelTitle,
          initial: content,
        }),
      },
      markdown: {
        command: "editor.open",
        buildArgs: (_id, content, panelTitle) => ({
          title: panelTitle,
          initial: content,
        }),
      },
      // figlet: { command: "figlet.open", buildArgs: ... }  ← scaffold slot
      // "ascii-art": { command: "primer.open", buildArgs: ... }  ← scaffold slot
    };

    // Build sourceType lookup from the original CEPanelDefs
    const panelSourceTypes = new Map<string, ZineSourceType>();
    for (const def of cePanelDefs) {
      // CEPanelDef.type maps directly to ZineSourceType for supported types
      panelSourceTypes.set(def.id, def.type as ZineSourceType);
    }

    function openInEditor(panelId: string) {
      const zNode = zineNodes.get(panelId);
      if (!zNode || zNode.item.type !== "panel") return;

      const sourceType = panelSourceTypes.get(panelId) ?? "text";
      const dispatch = EDITOR_DISPATCH[sourceType];
      if (!dispatch) return; // no editor registered for this type yet

      // Get current content (override or rendered)
      const iw = Math.max(1, zNode.item.w - 2);
      const ih = Math.max(1, zNode.item.h - 2);
      const content = contentOverrides.get(panelId)
        ?? (zNode.item.content ? zNode.item.content(0, iw, ih) : "");
      const panelTitle = zNode.item.title ?? panelId;

      host.runGlobalCommand(dispatch.command, dispatch.buildArgs(panelId, content, panelTitle));
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
          const now = Date.now();
          if (now - lastClickTime < DBLCLICK_MS && lastClickId === node.def.id) {
            openInEditor(node.def.id);
            lastClickTime = 0;
            return;
          }
          lastClickTime = now;
          lastClickId = node.def.id;

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
    rebuild();
    canvas.focus();

    // ── Tick (live panels) ──────────────────────────────────────────
    createTimer(() => {
      if (paused) return;
      tick++;
      let dirty = false;
      for (const node of zineNodes.values()) {
        if (node.item.type !== "panel" || !node.item.live || !node.content || !node.item.content) continue;
        if (contentOverrides.has(node.item.id)) continue;
        const iw = Math.max(1, node.item.w - 2);
        const ih = Math.max(1, node.item.h - 2);
        node.content.setContent(node.item.content(tick, iw, ih));
        dirty = true;
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
    canvas.key(["r"], () => rebuild());

    win.onInput((ch: string, key?: blessed.Widgets.Events.IKeyEventArg) => {
      const speed = key?.shift ? 5 : key?.ctrl ? 10 : 1;
      if (key?.name === "up"   || ch === "k") { scrollBy(-1 * speed); return; }
      if (key?.name === "down" || ch === "j") { scrollBy(1 * speed);  return; }
      if (key?.name === "pageup")   { scrollBy(-20 * speed); return; }
      if (key?.name === "pagedown") { scrollBy(20 * speed);  return; }
      if (ch === "/") { openSearchPrompt(); return; }
      if (ch === "r") { rebuild(); return; }
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
    win.describeState(() => {
      const panelCount = [...zineNodes.values()].filter(n => n.item.type === "panel").length;
      return {
        appType: "zine",
        summary: `ZINE: ${title} — ${panelCount} panels`,
        panelCount, filePath, title,
        items: [...zineNodes.values()].map(n => ({
          id: n.item.id, type: n.item.type, title: n.item.title,
          x: n.item.x, y: n.item.y, w: n.item.w, h: n.item.h,
        })),
      };
    });

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
