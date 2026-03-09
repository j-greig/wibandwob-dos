/**
 * Calculating Empires — Dense scrollable panel visualization.
 *
 * Inspired by Crawford & Joler's Calculating Empires poster:
 * black background, white elements, hundreds of panels arrayed across axes.
 *
 * Features:
 * - Full-screen window with scrollable canvas
 * - Magazine-style panel layout using layoutPanels
 * - 6 panel types: text, figlet, ascii-art, pixel, infographic, mixed
 * - Hot-reload from content/calculating-empires/panels/*.json
 * - j/k scroll, / search cycle, z zoom toggle, q close
 * - Panel drag-to-move (S07 pattern)
 * - Double-click inline edit (S08 pattern)
 * - Agent panel manipulation commands (S09 pattern)
 */

import blessed from "blessed";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  measureViewport,
  pointerToContent,
  hitPanel,
  type PanelDef,
  type PanelNode,
} from "../../src/core/panel-layout.js";
import { SAMPLE_PANELS } from "./sample-panels.js";
import { loadPanelsFromDir, watchPanelDir } from "./content-loader.js";
import { toPanelDef } from "./panel-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../../content/calculating-empires/panels");

export default function setup(host: MicroappHost) {
  let snapshotRegistered = false;
  let commandsRegistered = false;

  // S07: Panel drag-to-move state (module-level for persistence across opens)
  let dragging: { id: string; offsetX: number; offsetY: number } | undefined;
  const panelPositionOverrides = new Map<string, { x: number; y: number }>();

  // S08: Double-click edit state (module-level)
  const contentOverrides = new Map<string, string>();
  let editingPanelId: string | undefined;

  // S09: Module-level references for command handlers
  let activePanelNodes: Map<string, PanelNode> | undefined;
  let activeApplyStyles: (() => void) | undefined;
  let activeRenderLayoutAndContent: (() => void) | undefined;
  let activeCanvas: any;
  let activeSetPanelId: ((id: string) => void) | undefined;

  function openCE(args?: Record<string, unknown>) {
    const sw = Math.max(80, Number(host.screen.width));
    const sh = Math.max(24, Number(host.screen.height));
    const win = host.createWindow({
      title: "Calculating Empires",
      width: sw - 2,
      height: sh - 3,
      left: 1,
      top: 1,
    });

    let tick = 0;
    const scrollOffset = typeof args?._scrollY === "number" ? Math.max(0, Math.floor(args._scrollY)) : 0;
    let activePanelId = "";
    let totalContentHeight = 1;
    let panelPlacements: Array<{ id: string; x: number; y: number }> = [];
    let zoom: "normal" | "compact" = "normal";
    let searchQuery = "";
    let stopWatcher = () => {};

    const root = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      keys: true,
      mouse: true,
      clickable: true,
      style: host.theme().body,
    });

    const canvas = blessed.box({
      parent: root,
      top: 0,
      left: 0,
      right: 0,
      bottom: 1,
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

    // Status bar
    const statusBar = blessed.box({
      parent: root,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      tags: false,
      style: host.theme().header,
    });

    const panelNodes = new Map<string, PanelNode>();

    // Load panels — prefer JSON files, fall back to samples
    function getPanelDefs(): PanelDef[] {
      const fromFiles = loadPanelsFromDir(CONTENT_DIR);
      const base = fromFiles.length > 0 ? fromFiles : SAMPLE_PANELS;
      const filtered = searchQuery
        ? base.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : base;
      const scaled = zoom === "compact"
        ? filtered.map(p => ({ ...p, w: Math.floor(p.w * 0.7), h: Math.floor(p.h * 0.7) }))
        : filtered;
      return scaled.map(toPanelDef);
    }

    function focusPanel(id: string) {
      activePanelId = id;
      applyStyles();
      host.screen.render();
    }

    function applyStyles() {
      for (const node of panelNodes.values()) {
        const active = node.def.id === activePanelId;
        node.frame.style = {
          ...host.theme().body,
          border: { fg: active ? host.theme().highlight.fg : host.theme().muted.fg },
        };
        node.titleBar.style = active
          ? { ...host.theme().titleBarFocused, bold: true }
          : host.theme().header;
        node.titleBar.setContent(node.def.title);
        node.content.style = host.theme().body;
      }
    }

    function updateStatus() {
      const scroll = (canvas as any).getScroll?.() ?? 0;
      const q = searchQuery ? `  /${searchQuery}` : "";
      statusBar.setContent(
        ` ${panelNodes.size} panels  scroll:${scroll}  zoom:${zoom}${q}  j/k scroll  / search  z zoom  q close`
      );
    }

    function renderLayoutAndContent() {
      const { width: vw, height: vh } = measureViewport(canvas);
      const panelDefs = getPanelDefs();
      const layout = layoutPanels(panelDefs, Math.max(20, vw));
      panelPlacements = layout.placements;
      totalContentHeight = Math.max(layout.contentHeight, vh);

      // S07: Apply position overrides from user drags
      for (const placement of panelPlacements) {
        const override = panelPositionOverrides.get(placement.id);
        if (override) {
          placement.x = override.x;
          placement.y = override.y;
        }
      }

      // Position frames at natural content positions
      for (const placement of panelPlacements) {
        const node = panelNodes.get(placement.id);
        if (!node) continue;
        node.x = placement.x;
        node.y = placement.y;
        node.frame.left = node.x;
        node.frame.top = node.y;
        node.frame.width = node.def.w;
        node.frame.height = node.def.h;
        // Keep content box dims in sync with frame
        node.content.width = Math.max(1, node.def.w - 2);
        node.content.height = Math.max(1, node.def.h - 2);
      }

      // Update content
      for (const node of panelNodes.values()) {
        const iw = Math.max(1, node.def.w - 2);
        const ih = Math.max(1, node.def.h - 2);
        // S08: skip content update if editing this panel
        if (editingPanelId === node.def.id) continue;
        // Use override text if panel was edited
        const override = contentOverrides.get(node.def.id);
        node.content.setContent(override ?? node.def.content(tick, iw, ih));
      }

      applyStyles();
      updateStatus();
    }

    // Build / rebuild all panel nodes
    function buildPanels() {
      // Destroy existing panels
      for (const node of panelNodes.values()) {
        node.frame.destroy();
      }
      panelNodes.clear();

      const panelDefs = getPanelDefs();
      // Set initial activePanelId
      if (!activePanelId && panelDefs.length > 0) {
        activePanelId = panelDefs[0]!.id;
      }

      for (const def of panelDefs) {
        // Three nodes per panel: frame (border), titleBar, content
        // Using blessed native border: "line" (NOT createBorderedPanel)
        const frame = blessed.box({
          parent: canvas,
          top: 0,
          left: 0,
          width: def.w,
          height: def.h,
          mouse: true,
          clickable: true,
          border: "line",
          style: {
            ...host.theme().body,
            border: { fg: host.theme().muted.fg },
          },
        });

        const titleBar = blessed.box({
          parent: frame,
          top: 0,
          left: 1,
          right: 1,
          height: 1,
          mouse: true,
          clickable: true,
          tags: false,
          style: host.theme().header,
          content: def.title,
        });

        const iw = Math.max(1, def.w - 2);
        const ih = Math.max(1, def.h - 2);
        const content = blessed.box({
          parent: frame,
          top: 1,
          left: 1,
          width: iw,
          height: ih,
          mouse: true,
          clickable: true,
          tags: false,
          style: host.theme().body,
        });

        frame.on("click", () => focusPanel(def.id));
        titleBar.on("click", () => focusPanel(def.id));
        content.on("click", () => focusPanel(def.id));

        // S08: Double-click → inline edit mode (text/mixed panels only)
        let lastClickTime = 0;
        const DBLCLICK_MS = 350;
        const enterEditMode = () => {
          if (editingPanelId) return; // already editing another
          // Allow edit on any panel since we use content callback
          editingPanelId = def.id;
          const currentText = contentOverrides.get(def.id) ?? def.content(0, iw, ih);
          const editor = blessed.textarea({
            parent: frame,
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            keys: true,
            mouse: true,
            inputOnFocus: true,
            style: { ...host.theme().body, border: { fg: host.theme().selected.bg } },
            scrollable: true,
          });
          editor.setValue(currentText);
          editor.focus();
          host.screen.render();
          const exitEdit = () => {
            const saved = editor.getValue();
            contentOverrides.set(def.id, saved);
            editor.destroy();
            editingPanelId = undefined;
            renderLayoutAndContent();
            host.screen.render();
          };
          editor.key(["escape"], exitEdit);
          editor.key(["C-s"], exitEdit);
          editor.on("blur", exitEdit);
        };
        content.on("click", () => {
          const now = Date.now();
          if (now - lastClickTime < DBLCLICK_MS) enterEditMode();
          lastClickTime = now;
        });

        panelNodes.set(def.id, {
          def,
          frame,
          titleBar,
          content,
          x: 0,
          y: 0,
        });
      }

      renderLayoutAndContent();
      host.screen.render();
    }

    function scrollBy(delta: number) {
      (canvas as any).scroll(delta);
      updateStatus();
      host.screen.render();
    }

    // Mouse wheel routing
    const handleWheel = (data: any) => {
      if (data.action === "wheeldown") {
        (canvas as any).scroll(3);
        updateStatus();
        host.screen.render();
      } else if (data.action === "wheelup") {
        (canvas as any).scroll(-3);
        updateStatus();
        host.screen.render();
      }
    };
    host.screen.on("mouse", handleWheel);
    win.onCleanup(() => host.screen.off("mouse", handleWheel));

    // Also bind wheel events directly on canvas
    canvas.on("wheeldown", () => { (canvas as any).scroll(3); updateStatus(); host.screen.render(); });
    canvas.on("wheelup", () => { (canvas as any).scroll(-3); updateStatus(); host.screen.render(); });

    // S07: Screen-level handler for drag
    const handleDragMouse = (data: any) => {
      if (data.action === "wheeldown" || data.action === "wheelup") return;

      if (data.action === "mouseup") {
        dragging = undefined;
        return;
      }

      if (data.action === "mousedown") {
        const pt = pointerToContent(canvas, data.x, data.y);
        const node = hitPanel(panelNodes, pt.x, pt.y);
        if (node) {
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
        const pt = pointerToContent(canvas, data.x, data.y);
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
    host.screen.on("mouse", handleDragMouse);
    win.onCleanup(() => host.screen.off("mouse", handleDragMouse));

    // Key handlers with shift=5x ctrl=10x speed
    win.onInput((ch: string, key?: blessed.Widgets.Events.IKeyEventArg) => {
      const speed = key?.shift ? 5 : key?.ctrl ? 10 : 1;

      if (key?.name === "up" || ch === "k") { scrollBy(-1 * speed); return; }
      if (key?.name === "down" || ch === "j") { scrollBy(1 * speed); return; }
      if (key?.name === "pageup") { scrollBy(-Math.floor(host.geometry.height * speed)); return; }
      if (key?.name === "pagedown") { scrollBy(Math.floor(host.geometry.height * speed)); return; }
      if (key?.name === "home") { (canvas as any).scrollTo(0); updateStatus(); host.screen.render(); return; }
      if (key?.name === "end") { (canvas as any).scrollTo(totalContentHeight); updateStatus(); host.screen.render(); return; }

      if (ch === "z") {
        zoom = zoom === "normal" ? "compact" : "normal";
        buildPanels();
        return;
      }
      if (ch === "r") {
        buildPanels();
        return;
      }
      if (ch === "q" || key?.name === "escape") {
        win.close();
        return;
      }
      if (ch === "/") {
        // Simple search cycle
        const queries = ["", "2024", "2025", "2026", "canon", "wib"];
        const idx = queries.indexOf(searchQuery);
        searchQuery = queries[(idx + 1) % queries.length] ?? "";
        buildPanels();
        return;
      }
    });

    // Tick loop — update live panels
    const timer = setInterval(() => {
      tick += 1;
      for (const node of panelNodes.values()) {
        if (!node.def.live) continue;
        if (editingPanelId === node.def.id) continue; // don't clobber editor
        if (contentOverrides.has(node.def.id)) continue; // static override wins
        const iw = Math.max(1, node.def.w - 2);
        const ih = Math.max(1, node.def.h - 2);
        node.content.setContent(node.def.content(tick, iw, ih));
      }
      applyStyles();
      host.screen.render();
    }, 120);

    win.onCleanup(() => clearInterval(timer));

    // File watcher for hot-reload
    stopWatcher = watchPanelDir(CONTENT_DIR, () => {
      setTimeout(() => buildPanels(), 100);
    });
    win.onCleanup(() => stopWatcher());

    // Handle window resize
    win.onResize(() => {
      renderLayoutAndContent();
      host.screen.render();
    });

    // describeState — semantic metadata for agents (with scrollY)
    win.describeState(() => ({
      appType: "calculating-empires",
      panelCount: panelNodes.size,
      scrollY: (canvas as any).getScroll?.() ?? 0,
      zoom,
      search: searchQuery,
      activePanelId,
      contentHeight: totalContentHeight,
      summary: `Calculating Empires — ${panelNodes.size} panels  zoom:${zoom}`,
      panels: [...panelNodes.entries()].map(([id, node]) => ({
        id,
        title: node.def.title,
        x: node.x,
        y: node.y,
        w: node.def.w,
        h: node.def.h,
      })),
    }));

    // captureText — plain text summary
    win.captureText(() => {
      const snippets: string[] = ["Calculating Empires", `scroll=${scrollOffset}`];
      for (const [id, node] of panelNodes) {
        snippets.push(`\n[${node.def.title}]`);
        snippets.push(node.content.getContent());
      }
      return snippets.join("\n");
    });

    // Restyle on theme change
    win.onRestyle(() => {
      root.style = host.theme().body;
      canvas.style = host.theme().body;
      (canvas as any).scrollbar.style = { fg: host.theme().muted.fg, bg: host.theme().body.bg };
      statusBar.style = host.theme().header;
      renderLayoutAndContent();
      host.screen.render();
    });

    // Cleanup
    win.onCleanup(() => {
      for (const node of panelNodes.values()) {
        node.frame.destroy();
      }
      panelNodes.clear();
    });

    // Snapshot registration (once)
    if (!snapshotRegistered) {
      host.registerSnapshot({
        canRestore: (snap) => snap.appType === "calculating-empires",
        restore: (snap) => {
          openCE({ _scrollY: snap._scrollY });
        },
      });
      snapshotRegistered = true;
    }

    // S09: Set module-level references for command handlers
    activePanelNodes = panelNodes;
    activeApplyStyles = applyStyles;
    activeRenderLayoutAndContent = renderLayoutAndContent;
    activeCanvas = canvas;
    activeSetPanelId = (id: string) => { activePanelId = id; };

    // S09: Register agent panel manipulation commands (once)
    if (!commandsRegistered) {
      host.registerCommand({
        id: "panel.move",
        label: "Move Panel",
        description: "Move a Calculating Empires panel to a new position",
        action: (cmdArgs: Record<string, unknown>) => {
          const id = String(cmdArgs.id ?? "");
          const x = Number(cmdArgs.x ?? 0);
          const y = Number(cmdArgs.y ?? 0);
          if (!activePanelNodes) return { ok: false, error: "No active window" };
          const node = activePanelNodes.get(id);
          if (!node) return { ok: false, error: `Panel not found: ${id}` };
          panelPositionOverrides.set(id, { x, y });
          node.x = x;
          node.y = y;
          node.frame.left = x;
          node.frame.top = y;
          host.screen.render();
          return { ok: true, id, x, y };
        },
      });

      host.registerCommand({
        id: "panel.focus",
        label: "Focus Panel",
        description: "Focus and highlight a Calculating Empires panel",
        action: (cmdArgs: Record<string, unknown>) => {
          const id = String(cmdArgs.id ?? "");
          if (!activePanelNodes) return { ok: false, error: "No active window" };
          if (!activePanelNodes.has(id)) return { ok: false, error: `Panel not found: ${id}` };
          activeSetPanelId?.(id);
          activeApplyStyles?.();
          host.screen.render();
          // Scroll to make it visible
          const node = activePanelNodes.get(id)!;
          activeCanvas?.scrollTo?.(Math.max(0, node.y - 5));
          host.screen.render();
          return { ok: true, id };
        },
      });

      host.registerCommand({
        id: "panel.reset",
        label: "Reset Panel Layout",
        description: "Reset all panels to their computed layout positions",
        action: () => {
          panelPositionOverrides.clear();
          activeRenderLayoutAndContent?.();
          host.screen.render();
          return { ok: true };
        },
      });

      host.registerCommand({
        id: "panel.write",
        label: "Write Panel Content",
        description: "Set the text content of a Calculating Empires panel",
        action: (cmdArgs: Record<string, unknown>) => {
          const id = String(cmdArgs.id ?? "");
          const text = String(cmdArgs.text ?? "");
          if (!activePanelNodes?.has(id)) return { ok: false, error: `Panel not found: ${id}` };
          contentOverrides.set(id, text);
          activeRenderLayoutAndContent?.();
          host.screen.render();
          return { ok: true, id, written: text.length };
        },
      });

      host.registerCommand({
        id: "panel.append",
        label: "Append Panel Content",
        description: "Append text to a Calculating Empires panel",
        action: (cmdArgs: Record<string, unknown>) => {
          const id = String(cmdArgs.id ?? "");
          const text = String(cmdArgs.text ?? "");
          if (!activePanelNodes?.has(id)) return { ok: false, error: `Panel not found: ${id}` };
          const node = activePanelNodes.get(id)!;
          const current = contentOverrides.get(id) ?? node.def.content(0, Math.max(1, node.def.w - 2), Math.max(1, node.def.h - 2));
          contentOverrides.set(id, current + "\n" + text);
          activeRenderLayoutAndContent?.();
          host.screen.render();
          return { ok: true, id };
        },
      });

      host.registerCommand({
        id: "panel.clear",
        label: "Clear Panel Override",
        description: "Clear edited content of a Calculating Empires panel, restoring original",
        action: (cmdArgs: Record<string, unknown>) => {
          const id = String(cmdArgs.id ?? "");
          contentOverrides.delete(id);
          activeRenderLayoutAndContent?.();
          host.screen.render();
          return { ok: true, id };
        },
      });

      host.registerCommand({
        id: "panel.list",
        label: "List Panels",
        description: "List all Calculating Empires panel IDs and titles",
        action: () => {
          const panels = [...(activePanelNodes?.entries() ?? [])].map(([id, n]) => ({
            id,
            title: n.def.title,
            x: n.x,
            y: n.y,
          }));
          return { ok: true, panels };
        },
      });

      commandsRegistered = true;
    }

    // S09: Clear references on cleanup
    win.onCleanup(() => {
      activePanelNodes = undefined;
      activeApplyStyles = undefined;
      activeRenderLayoutAndContent = undefined;
      activeCanvas = undefined;
      activeSetPanelId = undefined;
    });

    // Initial build
    buildPanels();

    // Restore scroll position
    if (scrollOffset > 0) {
      (canvas as any).scrollTo(scrollOffset);
    }

    root.focus();
    win.focus();

    // Deferred re-render: blessed needs one tick to compute canvas.lpos
    setTimeout(() => {
      renderLayoutAndContent();
      host.screen.render();
    }, 80);

    return {
      snapshot: () => ({
        appType: "calculating-empires",
        _scrollY: (canvas as any).getScroll?.() ?? 0,
      }),
    };
  }

  host.registerCommand({
    id: "open",
    label: "Calculating Empires",
    description: "Open a dense multi-panel visualization.",
    menu: [{ category: "applications", order: 80, label: "Calculating Empires" }],
    palette: { order: 230, label: "Calculating Empires" },
    action: (args) => {
      openCE(args as Record<string, unknown> | undefined);
    },
  });
}
