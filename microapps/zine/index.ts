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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createBox, createList, type BoxElement, type ListElement, type IKeyEventArg } from "./zine-widgets.js";
import { layoutPanels, layoutColumns, measureViewport, pointerToContent, hitPanel, type PanelNode } from "../../src/core/panel-layout.js";
import type { ZineItem, ZineSourceType } from "../../src/core/canvas-types.js";
import {
  createTimer,
  clearTimers,
  createButtonBar,
  createSidebarPanel,
  createSelectableList,
  createInlineSearch,
} from "../../src/services/microapp-sdk.js";
import { toPanelDef, renderPanel } from "../sy2-chronicles/panel-types.js";
import YAML from "yaml";
import { loadCanvas } from "../sy2-chronicles/content-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Blessed node backing a ZineItem on the canvas. */
interface ZineNode {
  item: ZineItem;
  frame: BoxElement;
  titleBar?: BoxElement;
  content?: BoxElement;
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
  let activePicker:
    | {
        list: ListElement;
        candidates: string[];
      }
    | undefined;

  function closeActivePicker(): boolean {
    if (!activePicker) return false;
    const picker = activePicker.list;
    activePicker = undefined;
    try {
      picker.destroy();
      host.screen.render();
      return true;
    } catch {
      return false;
    }
  }

  function openZine(args?: Record<string, unknown>) {
    let filePath = typeof args?.filePath === "string" ? args.filePath : "";

    // If no path given, find canvas files and show a picker
    if (!filePath) {
      const candidates = [
        ...findCanvasFiles(path.join(REPO_ROOT, "assets")),
        ...findCanvasFiles(path.join(REPO_ROOT, "scratch")).filter(f => f.endsWith(".canvas.yaml")),
      ];
      if (candidates.length === 0) return;
      if (candidates.length === 1) {
        filePath = candidates[0]!;
      } else {
        closeActivePicker();
        const picker = createList({
          parent: host.screen,
          top: "center", left: "center",
          width: "60%", height: Math.min(candidates.length + 2, 20),
          border: "line",
          label: " Open Zine — select canvas ",
          keys: true, mouse: true, vi: true,
          items: candidates.map(c => path.relative(REPO_ROOT, c)),
          style: {
            ...host.theme().body,
            border: { fg: host.theme().highlight.fg },
            selected: host.theme().selected,
            item: host.theme().body,
          },
        });
        activePicker = { list: picker, candidates };
        picker.focus();
        picker.on("select", (_item: any, index: number) => {
          const selected = activePicker?.candidates[index];
          closeActivePicker();
          if (selected) {
            openZine({ filePath: selected });
          }
        });
        picker.key(["escape", "q"], () => {
          closeActivePicker();
        });
        host.screen.render();
        return;
      }
    }

    if (!fs.existsSync(filePath)) return;

    const canvas_doc = loadCanvas(filePath);
    if (!canvas_doc) return;

    const { title, panels: initialPanels, columnHeaders: showHeaders, columns: columnDefs } = canvas_doc;

    // Mutable panel list — hot reload swaps this in place
    let cePanelDefs = initialPanels;

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
    let dragging: { id: string; offsetX: number; offsetY: number; moved: boolean } | undefined;
    const panelPositionOverrides = new Map<string, { x: number; y: number }>();
    const contentOverrides = new Map<string, string>();
    const timers = new Set<ReturnType<typeof setInterval>>();

    // ── Sidebar state ───────────────────────────────────────────────
    const SIDEBAR_WIDTH = 26;
    let activeFilePath = filePath;
    const contentDir = path.join(REPO_ROOT, "assets");
    // Declared here so loadFile (defined below) can reassign it before watcher init
    let watcher!: ReturnType<typeof fs.watch>;

    function discoverFiles(): string[] {
      const found = findCanvasFiles(contentDir);
      // Validate: must parse + have correct format field
      return found.filter(f => {
        try {
          const doc = loadCanvas(f);
          return !!doc;
        } catch { return false; }
      });
    }

    let discoveredFiles = discoverFiles();

    function sidebarEntryLabel(fp: string, maxW: number): string {
      const rel = path.relative(contentDir, fp);
      const display = rel.replace(/\.canvas\.yaml$/, "");
      const prefix = fp === activeFilePath ? "▶ " : "  ";
      const available = maxW - prefix.length;
      const truncated = display.length > available
        ? "…" + display.slice(-(available - 1))
        : display;
      return prefix + truncated;
    }

    // ── Root container ──────────────────────────────────────────────
    const root = createBox({
      parent: win.body,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true, mouse: true, clickable: true,
      style: host.theme().body,
    });

    // ── Body area (between header row and toolbar row) ──────────────
    const bodyArea = createBox({
      parent: root,
      top: 1, left: 0, right: 0, bottom: 1,
      style: host.theme().body,
    });

    // ── Sidebar panel (createSidebarPanel handles width + toggle) ───
    const sidePanel = createSidebarPanel({
      parent: bodyArea,
      side: "left",
      width: { fixed: SIDEBAR_WIDTH },
      mainMinWidth: 12,
    });
    // Start with sidebar closed — open with [ key or toolbar button
    sidePanel.setOpen(false);

    // ── Sidebar ─────────────────────────────────────────────────────
    const sidebarListHandle = createSelectableList({
      parent: sidePanel.sidebar,
      top: 0, left: 0, right: 0, bottom: 0,
      style: { ...host.theme().body, selected: host.theme().selected, item: host.theme().body },
    });
    const sidebarList = sidebarListHandle.node;

    function refreshSidebarList() {
      const labels = discoveredFiles.map(f =>
        sidebarEntryLabel(f, SIDEBAR_WIDTH - 1)
      );
      sidebarListHandle.setItems(labels);
      const activeIdx = discoveredFiles.indexOf(activeFilePath);
      if (activeIdx >= 0) sidebarList.select(activeIdx);
    }

    function toggleSidebar() {
      sidePanel.toggle();
      renderLayoutAndContent();
      updateStatus();
      host.screen.render();
    }

    function loadFile(fp: string) {
      if (fp === activeFilePath) return;
      try {
        const fresh = loadCanvas(fp);
        if (!fresh) return;
        // Hand off watcher
        watcher.close();
        activeFilePath = fp;
        cePanelDefs = fresh.panels;
        columnHeaderMap.clear();
        if (fresh.columnHeaders) {
          for (const [idx, def] of fresh.columns) {
            if (def.header) columnHeaderMap.set(idx, def.header);
          }
        }
        contentOverrides.clear();
        panelPositionOverrides.clear();
        seedPositionsFromYaml();
        activePanelId = cePanelDefs[0]?.id ?? "";
        watcher = fs.watch(activeFilePath, onFileChange);
        // Update window chrome title bar
        const chromeTitleBar = (win.body.parent as any)?.children?.find(
          (c: any) => c._isTitleBar
        );
        if (chromeTitleBar?.setContent) {
          chromeTitleBar.setContent(` ZINE: ${fresh.title}`);
        }
        refreshSidebarList();
        rebuild();
        updateStatus();
        host.screen.render();
      } catch { /* ignore */ }
    }

    sidebarList.on("select", (_, idx) => {
      const fp = discoveredFiles[idx];
      if (fp) { loadFile(fp); canvas.focus(); }
    });

    // ── Scrollable canvas ───────────────────────────────────────────
    const canvas = createBox({
      parent: sidePanel.main,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true, mouse: true, clickable: true,
      scrollable: false,
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

    // ── Toolbar (bottom nav bar) ────────────────────────────────────
    let paused = false;
    type ToolbarAction = "sidebar" | "search" | "pause";
    const toolbar = createButtonBar(
      root,
      {
        buttons: [
          { label: "[ ] Files", action: () => toggleSidebar() },
          { label: "/ Search",  action: () => inlineSearch.open() },
          { label: "⏸ Pause",   action: () => { paused = !paused; updateStatus(); host.screen.render(); } },
        ],
      },
    );
    // Position the bar at the bottom of root
    function layoutToolbar() {
      const w = Math.max(20, Number(root.width) || 80);
      const h = Number(root.height) || 24;
      const el = toolbar.element;
      el.top = h - 1;
      el.left = 0;
      el.width = w;
      el.height = 1;
    }
    layoutToolbar();

    // ── Status bar (top) ────────────────────────────────────────────
    const statusBar = createBox({
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
      const sidebarLabel = sidePanel.isOpen() ? "[▶] Files" : "[ ] Files";
      const panelCount = [...zineNodes.values()].filter(n => n.item.type === "panel").length;
      toolbar.update({
        buttons: [
          { label: ` ${sidebarLabel} `, action: () => toggleSidebar() },
          { label: "/ Search",  action: () => inlineSearch.open() },
          { label: ` ${pauseLabel} `, action: () => { paused = !paused; updateStatus(); host.screen.render(); } },
        ],
      });
      statusBar.setContent(` Zine  ${panelCount} panels  ${scroll}%${q}`);
    }

    // ── Build ZineNodes from items ──────────────────────────────────
    function buildItems(items: ZineItem[]) {
      for (const node of zineNodes.values()) node.frame.destroy();
      zineNodes.clear();
      panelNodes.clear();

      for (const item of items) {
        if (item.type === "panel") {
          const frame = createBox({
            parent: canvas,
            top: 0, left: 0,
            width: item.w, height: item.h,
            border: "line",
            style: {
              ...host.theme().body,
              border: { fg: host.theme().muted.fg },
            },
          });

          const titleBar = createBox({
            parent: frame,
            top: 0, left: 1, right: 1, height: 1,
            tags: false,
            fixed: true,
            style: host.theme().header,
            content: item.title ?? "",
          });

          const iw = Math.max(1, item.w - 2);
          const ih = Math.max(1, item.h - 2);
          const contentBox = createBox({
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
          const frame = createBox({
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
    // ── Search (createInlineSearch) ─────────────────────────────────
    const inlineSearch = createInlineSearch({
      parent: root,
      initialValue: searchQuery,
      onSubmit: (val) => {
        searchQuery = val;
        rebuild();
        canvas.focus();
        host.screen.render();
      },
      onCancel: () => {
        canvas.focus();
        host.screen.render();
      },
      afterClose: () => {
        host.screen.render();
      },
    });

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
        buildArgs: (id, content, panelTitle) => ({
          title: panelTitle,
          initial: content,
          onSave: (newContent: string) => {
            contentOverrides.set(id, newContent);
            saveContentToYaml(id, newContent);
            renderLayoutAndContent();
            host.screen.render();
          },
        }),
      },
      markdown: {
        command: "editor.open",
        buildArgs: (id, content, panelTitle) => ({
          title: panelTitle,
          initial: content,
          onSave: (newContent: string) => {
            contentOverrides.set(id, newContent);
            saveContentToYaml(id, newContent);
            renderLayoutAndContent();
            host.screen.render();
          },
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

    /** Write edited content back to the .canvas.yaml file. */
    function saveContentToYaml(panelId: string, newContent: string) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const doc = YAML.parseDocument(raw);
        const panels = doc.get("panels");
        if (!panels || !panels.items) return;
        for (const item of panels.items) {
          const id = item.get("id");
          if (id === panelId) {
            item.set("text", newContent);
            break;
          }
        }
        selfWriteFlag = true;
        fs.writeFileSync(filePath, doc.toString(), "utf8");
      } catch { /* silent — editor still has the content */ }
    }

    /** Load saved x/y positions from YAML to seed drag overrides on startup. */
    function seedPositionsFromYaml() {
      try {
        const raw = fs.readFileSync(activeFilePath, "utf8");
        const doc = YAML.parse(raw);
        if (!doc?.panels) return;
        for (const p of doc.panels) {
          if (p.id && typeof p.x === "number" && typeof p.y === "number") {
            panelPositionOverrides.set(p.id, { x: p.x, y: p.y });
          }
        }
      } catch { /* silent */ }
    }
    // Seed on initial load
    seedPositionsFromYaml();

    /** Write panel position back to the .canvas.yaml file after drag/nudge. */
    function savePanelPosition(panelId: string) {
      const pos = panelPositionOverrides.get(panelId);
      if (!pos) return;
      try {
        const raw = fs.readFileSync(activeFilePath, "utf8");
        const doc = YAML.parseDocument(raw);
        const panels = doc.get("panels") as any;
        if (!panels || !panels.items) return;
        for (const item of panels.items) {
          const id = item.get("id");
          if (id === panelId) {
            item.set("x", pos.x);
            item.set("y", pos.y);
            break;
          }
        }
        selfWriteFlag = true;
        fs.writeFileSync(activeFilePath, doc.toString(), "utf8");
      } catch { /* silent */ }
    }

    /** Track which panels have an open editor — prevents duplicate windows. */
    const openEditors = new Set<string>();

    function openInEditor(panelId: string) {
      if (openEditors.has(panelId)) return; // already open — don't spawn another

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

      openEditors.add(panelId);

      // Wrap onSave to clear editor tracking when user saves
      const origArgs = dispatch.buildArgs(panelId, content, panelTitle);
      if (typeof origArgs.onSave === "function") {
        const origOnSave = origArgs.onSave as (s: string) => void;
        origArgs.onSave = (newContent: string) => {
          origOnSave(newContent);
          openEditors.delete(panelId);
        };
      }

      host.runGlobalCommand(dispatch.command, origArgs);

      // Safety valve: poll to detect editor window closed (no onClose callback available).
      // Check every 2s, give up after 60s so re-open is always possible.
      let checks = 0;
      const pollClose = setInterval(() => {
        checks++;
        if (checks > 30) { openEditors.delete(panelId); clearInterval(pollClose); return; }
        // If no text-editor window with our title exists, clear the lock
        try {
          const wins = host.windows.getWindows();
          const stillOpen = wins.some((w: any) =>
            w.appType === "text-editor" && w.title?.includes(panelTitle)
          );
          if (!stillOpen) { openEditors.delete(panelId); clearInterval(pollClose); }
        } catch { /* ignore */ }
      }, 2000);
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

    // ── Mouse: click-to-select, drag-to-move, wheel-to-scroll ─────
    // Use screen-level mouse for drag (canvas swallows mousemove for scroll).
    // Track drag state at screen coordinates to avoid coordinate transform issues.
    let dragScreenStart: { sx: number; sy: number; origX: number; origY: number } | undefined;

    const zineMouse = (data: any) => {
      if (!canvas.parent) return;

      // Wheel scroll disabled — use j/k keys. Mouse reserved for drag.

      // Mouseup: finish drag, save position
      if (data.action === "mouseup") {
        if (dragging && dragging.moved) {
          savePanelPosition(dragging.id);
        }
        dragging = undefined;
        dragScreenStart = undefined;
        return;
      }

      // Mousedown inside canvas: start drag
      if (data.action === "mousedown" && isInsideCanvas(data.x, data.y)) {
        const pt = safePointerToContent(data.x, data.y);
        if (!pt) return;
        const node = hitPanel(panelNodes, pt.x, pt.y);
        if (node) {
          dragging = {
            id: node.def.id,
            offsetX: pt.x - node.x,
            offsetY: pt.y - node.y,
            moved: false,
          };
          dragScreenStart = { sx: data.x, sy: data.y, origX: node.x, origY: node.y };
          activePanelId = node.def.id;
          applyStyles();
          host.screen.render();
        }
        return;
      }

      // Mousemove handled on program level below (screen level misses motion events)
    };
    host.screen.on("mouse", zineMouse);

    // ── Program-level mousemove for drag (bypasses blessed element routing) ──
    const zineDragMove = (data: any) => {
      // Terminal sends repeated mousedown (not mousemove) during drag — handle both
      if ((data.action !== "mousedown" && data.action !== "mousemove") || !dragging || !dragScreenStart) return;
      const dx = data.x - dragScreenStart.sx;
      const dy = data.y - dragScreenStart.sy;
      if (dx === 0 && dy === 0) return;
      dragging.moved = true;
      const node = panelNodes.get(dragging.id);
      if (!node) return;
      const newX = Math.max(0, dragScreenStart.origX + dx);
      const newY = Math.max(0, dragScreenStart.origY + dy);
      panelPositionOverrides.set(dragging.id, { x: newX, y: newY });
      node.x = newX;
      node.y = newY;
      node.frame.left = newX;
      node.frame.top = newY;
      host.screen.render();
    };
    host.screen.program.on("mouse", zineDragMove);

    // ── Build + first render ────────────────────────────────────────
    refreshSidebarList();
    rebuild();
    canvas.focus();

    // ── Hot reload — watch canvas file for changes ───────────────────
    let reloadDebounce: ReturnType<typeof setTimeout> | undefined;
    /** Set to true when we write to the YAML ourselves — skip the next file-change reload. */
    let selfWriteFlag = false;
    function onFileChange() {
      if (selfWriteFlag) { selfWriteFlag = false; return; }
      clearTimeout(reloadDebounce);
      reloadDebounce = setTimeout(() => {
        try {
          const fresh = loadCanvas(activeFilePath);
          if (!fresh) return;
          cePanelDefs = fresh.panels;
          columnHeaderMap.clear();
          if (fresh.columnHeaders) {
            for (const [idx, def] of fresh.columns) {
              if (def.header) columnHeaderMap.set(idx, def.header);
            }
          }
          contentOverrides.clear();
          panelPositionOverrides.clear();
          seedPositionsFromYaml();
          rebuild();
          updateStatus();
        } catch { /* ignore transient write races */ }
      }, 80);
    }
    watcher = fs.watch(activeFilePath, onFileChange);
    // Watcher cleaned up in onCleanup below alongside timers

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

    // ── Keyboard: canvas receives blessed key events directly ─────
    canvas.on("keypress", (_ch: string, key: any) => {
      if (!key) return;
      const shift = !!key.shift;
      const ctrl = !!key.ctrl;

      // Tab / Shift-Tab: cycle panel selection
      if (key.name === "tab" && !shift) { cyclePanelSelection(true); return; }
      if (key.name === "tab" && shift)  { cyclePanelSelection(false); return; }

      // Arrow keys: move selected panel (shift=10, ctrl=10)
      if (activePanelId && (key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right")) {
        const step = shift ? 10 : 1;
        if (key.name === "up")    { nudgePanel(0, -step); return; }
        if (key.name === "down")  { nudgePanel(0, step); return; }
        if (key.name === "left")  { nudgePanel(-step, 0); return; }
        if (key.name === "right") { nudgePanel(step, 0); return; }
      }

      // j/k: scroll canvas
      const scrollSpeed = shift ? 5 : ctrl ? 10 : 1;
      if (key.name === "j" || (_ch === "j")) { scrollBy(1 * scrollSpeed); return; }
      if (key.name === "k" || (_ch === "k")) { scrollBy(-1 * scrollSpeed); return; }
      if (key.name === "pagedown") { scrollBy(20); return; }
      if (key.name === "pageup")   { scrollBy(-20); return; }
      if (key.name === "home" || _ch === "g") { canvas.scrollTo(0); renderLayoutAndContent(); host.screen.render(); return; }
      if (key.name === "end"  || _ch === "G") { canvas.scrollTo(99999); renderLayoutAndContent(); host.screen.render(); return; }

      // Enter: edit selected panel
      if (key.name === "return" || key.name === "enter") {
        if (activePanelId) openInEditor(activePanelId);
        return;
      }

      if (_ch === "/") { inlineSearch.open(); return; }
      if (_ch === "r") { rebuild(); return; }
      if (_ch === "[") { toggleSidebar(); return; }
      if (key.name === "escape") { activePanelId = ""; applyStyles(); host.screen.render(); return; }
    });

    /** Move the active panel by dx/dy, update overrides, re-render, save. */
    function nudgePanel(dx: number, dy: number) {
      if (!activePanelId) return;
      const node = panelNodes.get(activePanelId);
      if (!node) return;
      const cur = panelPositionOverrides.get(activePanelId) ?? { x: node.x, y: node.y };
      const nx = Math.max(0, cur.x + dx);
      const ny = Math.max(0, cur.y + dy);
      panelPositionOverrides.set(activePanelId, { x: nx, y: ny });
      renderLayoutAndContent();
      host.screen.render();
      savePanelPosition(activePanelId);
    }

    /** Cycle active panel selection. */
    function cyclePanelSelection(forward: boolean) {
      const ids = [...panelNodes.keys()].filter(id => {
        const n = panelNodes.get(id);
        return n && n.item.type === "panel";
      });
      if (ids.length === 0) return;
      const idx = ids.indexOf(activePanelId);
      const next = forward
        ? (idx + 1) % ids.length
        : (idx - 1 + ids.length) % ids.length;
      activePanelId = ids[next]!;
      applyStyles();
      host.screen.render();
    }

    // win.onInput is for API/plumb write-in, not keyboard — keyboard handled by canvas.on("keypress") above

    // ── Resize reflow ───────────────────────────────────────────────
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    win.onResize(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        layoutToolbar();
        renderLayoutAndContent();
        host.screen.render();
      }, 100);
    });

    // ── Describe state ──────────────────────────────────────────────
    win.describeState(() => {
      const panelCount = [...zineNodes.values()].filter(n => n.item.type === "panel").length;
      const freshTitle = loadCanvas(activeFilePath)?.title ?? title;
      return {
        appType: "wibwob.zine",
        summary: `ZINE: ${freshTitle} — ${panelCount} panels`,
        panelCount,
        filePath: activeFilePath,
        title: freshTitle,
        sidebarOpen: sidePanel.isOpen(),
        availableFiles: discoveredFiles,
        activeFile: activeFilePath,
        items: [...zineNodes.values()].map(n => ({
          id: n.item.id, type: n.item.type, title: n.item.title,
          x: n.item.x, y: n.item.y, w: n.item.w, h: n.item.h,
        })),
      };
    });

    // ── captureText ────────────────────────────────────────────────
    win.captureText(() => {
      const snippets: string[] = [`ZINE: ${title}`, `panels=${[...zineNodes.values()].filter(n => n.item.type === "panel").length}`];
      for (const [, node] of [...zineNodes.entries()].slice(0, 10)) {
        if (node.item.title) snippets.push(`\n[${node.item.title}]`);
        if (node.content) {
          const firstLine = (node.content.getContent?.() ?? "").split("\n")[0] ?? "";
          if (firstLine) snippets.push(firstLine);
        }
      }
      return snippets.join("\n");
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
      clearTimeout(reloadDebounce);
      watcher.close();
      host.screen.off("mouse", zineMouse);
      host.screen.program.off("mouse", zineDragMove);
    });

    return win.record;
  }

  host.registerCommand({
    id: "list-canvases",
    label: "List Zine Canvases",
    description: "List discoverable .canvas.yaml files for Zine picker automation.",
    action: () => {
      const contentDir = path.join(REPO_ROOT, "assets");
      const files = findCanvasFiles(contentDir).filter((fp) => {
        try {
          return !!loadCanvas(fp);
        } catch {
          return false;
        }
      });
      return {
        count: files.length,
        root: contentDir,
        files: files.map((fp, index) => ({
          index,
          filePath: fp,
          relativePath: path.relative(REPO_ROOT, fp),
        })),
      };
    },
    direct: true,
  });

  host.registerCommand({
    id: "picker.info",
    label: "Zine Picker Info",
    description: "Return current state of the Open Zine canvas picker.",
    action: () => {
      if (!activePicker) {
        return { active: false };
      }
      const listAny = activePicker.list as any;
      const selectedIndex = Number(listAny?.selected ?? 0);
      return {
        active: true,
        count: activePicker.candidates.length,
        selectedIndex,
        selectedPath: activePicker.candidates[selectedIndex] ?? null,
      };
    },
    direct: true,
  });

  host.registerCommand({
    id: "picker.select",
    label: "Zine Picker Select",
    description: "Set selected index in Open Zine picker. Args: index (number).",
    action: (args?: Record<string, unknown>) => {
      if (!activePicker) {
        return { ok: false, error: "No active zine picker" };
      }
      const requested = Number(args?.index);
      if (!Number.isFinite(requested)) {
        return { ok: false, error: "index must be a number" };
      }
      const index = Math.max(0, Math.min(Math.trunc(requested), activePicker.candidates.length - 1));
      activePicker.list.select(index);
      host.screen.render();
      return {
        ok: true,
        index,
        path: activePicker.candidates[index] ?? null,
      };
    },
    direct: true,
  });

  host.registerCommand({
    id: "picker.confirm",
    label: "Zine Picker Confirm",
    description: "Confirm current selection in Open Zine picker and open selected canvas.",
    action: () => {
      if (!activePicker) {
        return { ok: false, error: "No active zine picker" };
      }
      const listAny = activePicker.list as any;
      const selectedIndex = Number(listAny?.selected ?? 0);
      const selectedPath = activePicker.candidates[selectedIndex];
      closeActivePicker();
      if (!selectedPath) {
        return { ok: false, error: "No selectable canvas at current index" };
      }
      openZine({ filePath: selectedPath });
      return { ok: true, index: selectedIndex, filePath: selectedPath };
    },
    direct: true,
  });

  host.registerCommand({
    id: "picker.cancel",
    label: "Zine Picker Cancel",
    description: "Cancel and close Open Zine picker.",
    action: () => ({ ok: closeActivePicker() }),
    direct: true,
  });

  host.registerCommand({
    id: "open",
    label: "Open Zine",
    description: "Open a ZINE canvas — panels from .canvas.yaml rendered as §y²-style sub-windows. Args: filePath (string).",
    action: openZine,
    multiInstance: true,
    direct: true,
    menu: [{ category: "applications", order: 40, label: "Zine" }],
    palette: { order: 60, label: "Open Zine" },
  });
}
