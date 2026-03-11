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
  type ZineItem,
  type ZineSourceType,
  createTimer,
  clearTimers,
  createButtonBar,
  createSidebarPanel,
  createSelectableList,
  createInlineSearch,
  clamp,
} from "../../src/services/microapp-sdk.js";
import { toPanelDef, renderPanel } from "./panel-types.js";
import YAML from "yaml";
import { loadCanvas } from "./content-loader.js";

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

    const { title, panels: initialPanels, columnHeaders: showHeaders, columns: columnDefs, format: canvasFormat } = canvas_doc;

    // Mutable panel list — hot reload swaps this in place
    let cePanelDefs = initialPanels;
    let isFreeform = canvasFormat === "zine-freeform-v1";

    // Build column header map for layout engine
    const columnHeaderMap = new Map<number, string>();
    if (showHeaders && !isFreeform) {
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

    // ── Sidebar state ───────────────────────────────────────────────
    const SIDEBAR_WIDTH = 26;
    let activeFilePath = filePath;
    const contentDir = path.join(REPO_ROOT, "content");
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
    const root = blessed.box({
      parent: win.body,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true, mouse: true, clickable: true,
      style: host.theme().body,
    });

    // ── Body area (between header row and toolbar row) ──────────────
    const bodyArea = blessed.box({
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
        isFreeform = fresh.format === "zine-freeform-v1";
        columnHeaderMap.clear();
        if (fresh.columnHeaders) {
          for (const [idx, def] of fresh.columns) {
            if (def.header) columnHeaderMap.set(idx, def.header);
          }
        }
        contentOverrides.clear();
        panelPositionOverrides.clear();
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
    const canvas = blessed.box({
      parent: sidePanel.main,
      top: 0, left: 0, right: 0, bottom: 0,
      keys: true, clickable: true,
      // NOTE: mouse intentionally OFF on canvas. Blessed's scrollable box
      // with mouse:true consumes drag events for its own scroll handling,
      // which prevents panel drag-to-move. All mouse interaction (click,
      // drag, scroll) is handled at screen level via handleMouse/handleWheel.
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

    // ── Toolbar (bottom nav bar) ────────────────────────────────────
    let paused = false;
    type ToolbarAction = "sidebar" | "search" | "pause";
    const toolbar = createButtonBar<ToolbarAction>(
      root,
      [
        { id: "sidebar", label: "[ ] Files" },
        { id: "search",  label: "/ Search"  },
        { id: "pause",   label: "⏸ Pause"   },
      ],
      (id) => {
        if (id === "sidebar") toggleSidebar();
        else if (id === "search") inlineSearch.open();
        else if (id === "pause") {
          paused = !paused;
          updateStatus();
          host.screen.render();
        }
      },
    );
    // Position the bar at the bottom of root and call layout() to place buttons
    function layoutToolbar() {
      const w = Math.max(20, Number(root.width) || 80);
      const h = Number(root.height) || 24;
      toolbar.layout({ top: h - 1, left: 0, width: w, height: 1 });
    }
    layoutToolbar();

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
      const sidebarLabel = sidePanel.isOpen() ? "[▶] Files" : "[ ] Files";
      const panelCount = [...zineNodes.values()].filter(n => n.item.type === "panel").length;
      toolbar.update({
        leftText: ` Zine  ${panelCount} panels  ${scroll}%${q}`,
        activeId: paused ? "pause" : undefined,
        buttonLabels: { sidebar: ` ${sidebarLabel} `, pause: ` ${pauseLabel} ` },
      });
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
            mouse: true,
            // clickable intentionally OFF — prevents blessed from stealing
            // focus away from the canvas when panels are clicked.
            style: {
              ...host.theme().body,
              border: { fg: host.theme().muted.fg },
            },
          });
          // Prevent blessed auto-focus on click
          (frame as any).focusable = false;

          const titleBar = blessed.box({
            parent: frame,
            top: 0, left: 1, right: 1, height: 1,
            tags: false,
            fixed: true,
            mouse: true,
            style: host.theme().header,
            content: item.title ?? "",
          });
          (titleBar as any).focusable = false;

          // ── Element-level drag start (same pattern as window-manager) ──
          // Blessed delivers element mousedown reliably even inside scrollable
          // parents. Screen-level mousemove/mouseup handle the rest.
          const startPanelDrag = (data: any) => {
            const panelId = item.id;
            const node = panelNodes.get(panelId);
            if (!node) return;
            activePanelId = panelId;
            dragging = {
              id: panelId,
              offsetX: data.x - ((frame as any).aleft ?? 0),
              offsetY: data.y - ((frame as any).atop ?? 0),
            };
            dragMoved = false;
            applyStyles();
            // Keep focus on canvas so arrow keys keep working
            canvas.focus();
            host.screen.render();
          };
          titleBar.on("mousedown", startPanelDrag);
          frame.on("mousedown", startPanelDrag);

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
                col: item.col ?? 0,
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
      const sidebarAwareWidth = Math.max(20, sidePanel.mainWidth());
      const vw = measured.width > 20 ? measured.width : sidebarAwareWidth;
      const vh = measured.height;
      const defs = getFilteredDefs();
      const layoutDefs = defs.map(toPanelDef);

      // Layout dispatch: freeform, column, or flow
      let items: ZineItem[];
      if (isFreeform) {
        // Freeform: use panel x/y directly from YAML, no layout engine
        items = defs.map(d => {
          const def = layoutDefs.find(ld => ld.id === d.id);
          return {
            id: d.id, type: "panel" as const,
            x: d.x ?? 0, y: d.y ?? 0,
            w: Math.min(d.w, vw), h: d.h,
            title: def?.title ?? d.title, content: def?.content, live: def?.live,
          };
        });
      } else {
        const hasColumns = defs.some(d => (d.col ?? 0) > 0);
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

        const maxLeft = Math.max(0, vw - (item.type === "panel" ? 3 : 1));
        const effectiveX = clamp(item.x, 0, maxLeft);
        const maxWAtX = Math.max(1, vw - effectiveX);
        const minW = item.type === "panel" ? 3 : 1;
        const effectiveW = Math.max(minW, Math.min(item.w, maxWAtX));
        node.frame.left = effectiveX;
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
          } else if (item.type === "header") {
            const rule = "─".repeat(Math.max(1, effectiveW));
            node.frame.setContent(`${item.headerText ?? item.title ?? ""}\n${rule}`);
          }
        }

        // Sync panelNodes position for hitPanel
        const pNode = panelNodes.get(item.id);
        if (pNode) { pNode.x = effectiveX; pNode.y = item.y; }
      }

      // Render panel content (respect overrides and editing)
      for (const node of zineNodes.values()) {
        if (node.item.type !== "panel" || !node.content || !node.item.content) continue;
        const frameW = Math.max(3, Number(node.frame.width) || node.item.w);
        const frameH = Math.max(3, Number(node.frame.height) || node.item.h);
        const iw = Math.max(1, frameW - 2);
        const ih = Math.max(1, frameH - 2);
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
            openEditors.delete(id);
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
            openEditors.delete(id);
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
        fs.writeFileSync(filePath, doc.toString(), "utf8");
      } catch { /* silent — editor still has the content */ }
    }

    /** Write freeform drag position back to the .canvas.yaml file. */
    let savePositionDebounce: ReturnType<typeof setTimeout> | undefined;
    function savePositionToYaml(panelId: string, x: number, y: number) {
      clearTimeout(savePositionDebounce);
      savePositionDebounce = setTimeout(() => {
        try {
          const raw = fs.readFileSync(activeFilePath, "utf8");
          const doc = YAML.parseDocument(raw);
          const panels = doc.get("panels");
          if (!panels || !(panels as any).items) return;
          for (const item of (panels as any).items) {
            const id = item.get("id");
            if (id === panelId) {
              item.set("x", x);
              item.set("y", y);
              break;
            }
          }
          fs.writeFileSync(activeFilePath, doc.toString(), "utf8");
        } catch { /* silent */ }
      }, 500);
    }

    function openInEditor(panelId: string) {
      const zNode = zineNodes.get(panelId);
      if (!zNode || zNode.item.type !== "panel") return;

      const sourceType = panelSourceTypes.get(panelId) ?? "text";
      const dispatch = EDITOR_DISPATCH[sourceType];
      if (!dispatch) return; // no editor registered for this type yet

      // Get current content (override or rendered)
      const frameW = Math.max(3, Number(zNode.frame.width) || zNode.item.w);
      const frameH = Math.max(3, Number(zNode.frame.height) || zNode.item.h);
      const iw = Math.max(1, frameW - 2);
      const ih = Math.max(1, frameH - 2);
      const content = contentOverrides.get(panelId)
        ?? (zNode.item.content ? zNode.item.content(0, iw, ih) : "");
      const panelTitle = zNode.item.title ?? panelId;

      openEditors.add(panelId);
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
    const openEditors = new Set<string>(); // panels with an editor open
    const DBLCLICK_MS = 300;
    let dragMoved = false;

    const handleMouse = (data: any) => {
      if (!canvas.parent) return;
      if (data.action === "wheeldown" || data.action === "wheelup") return;
      if (data.action === "mousedown" && !isInsideCanvas(data.x, data.y)) return;

      if (data.action === "mouseup") {
        if (!dragging) return;
        const finishedId = dragging.id;
        if (dragMoved && isFreeform) {
          const pos = panelPositionOverrides.get(finishedId);
          if (pos) savePositionToYaml(finishedId, pos.x, pos.y);
        } else if (!dragMoved) {
          const now = Date.now();
          if (now - lastClickTime < DBLCLICK_MS && lastClickId === finishedId) {
            // Double-click: open editor if not already open
            if (!openEditors.has(finishedId)) {
              openInEditor(finishedId);
            }
            lastClickTime = 0;
            lastClickId = "";
          } else {
            lastClickTime = now;
            lastClickId = finishedId;
          }
        } else {
          // Never interpret a drag-release as a click sequence.
          lastClickTime = 0;
          lastClickId = "";
        }

        dragging = undefined;
        dragMoved = false;
        return;
      }

      // Click on canvas background (not on a panel) → deselect
      if (data.action === "mousedown" && !dragging) {
        const pt = safePointerToContent(data.x, data.y);
        if (pt && !hitPanel(panelNodes, pt.x, pt.y)) {
          activePanelId = "";
          applyStyles();
          host.screen.render();
        }
        return;
      }

      // blessed sends mousedown (not mousemove) during drag — handle move BEFORE new-drag
      if ((data.action === "mousemove" || data.action === "mousedown") && dragging) {
        const node = panelNodes.get(dragging.id);
        if (!node) return;
        // Screen-space drag: offset was captured as screen coords in element mousedown
        const canvasLeft = (canvas as any).aleft ?? 0;
        const canvasTop = (canvas as any).atop ?? 0;
        const scrollY = (canvas as any).childBase ?? 0;
        const newX = Math.max(0, data.x - dragging.offsetX - canvasLeft);
        const newY = Math.max(0, data.y - dragging.offsetY - canvasTop + scrollY);
        if (newX === node.x && newY === node.y) return;
        dragMoved = true;
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
    refreshSidebarList();
    sidePanel.layout();
    rebuild();
    canvas.focus();

    // ── Hot reload — watch canvas file for changes ───────────────────
    let reloadDebounce: ReturnType<typeof setTimeout> | undefined;
    function onFileChange() {
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
        const frameW = Math.max(3, Number(node.frame.width) || node.item.w);
        const frameH = Math.max(3, Number(node.frame.height) || node.item.h);
        const iw = Math.max(1, frameW - 2);
        const ih = Math.max(1, frameH - 2);
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

    /** Nudge the active panel by dx/dy chars. Freeform only. */
    function nudgeActivePanel(dx: number, dy: number) {
      if (!isFreeform || !activePanelId) return false;
      const node = panelNodes.get(activePanelId);
      if (!node) return false;
      const newX = Math.max(0, node.x + dx);
      const newY = Math.max(0, node.y + dy);
      panelPositionOverrides.set(activePanelId, { x: newX, y: newY });
      node.x = newX;
      node.y = newY;
      node.frame.left = newX;
      node.frame.top = newY;
      savePositionToYaml(activePanelId, newX, newY);
      host.screen.render();
      return true;
    }

    canvas.key(["j", "down"], () => { if (!nudgeActivePanel(0, 1)) scrollBy(1); });
    canvas.key(["k", "up"], () => { if (!nudgeActivePanel(0, -1)) scrollBy(-1); });
    canvas.key(["h", "left"], () => { if (!nudgeActivePanel(-1, 0)) {} });
    canvas.key(["l", "right"], () => { if (!nudgeActivePanel(1, 0)) {} });
    canvas.key(["S-j", "S-down"], () => { if (!nudgeActivePanel(0, 5)) scrollBy(5); });
    canvas.key(["S-k", "S-up"], () => { if (!nudgeActivePanel(0, -5)) scrollBy(-5); });
    canvas.key(["S-h", "S-left"], () => nudgeActivePanel(-5, 0));
    canvas.key(["S-l", "S-right"], () => nudgeActivePanel(5, 0));
    canvas.key(["C-j", "C-down"], () => scrollBy(10));
    canvas.key(["C-k", "C-up"], () => scrollBy(-10));
    canvas.key(["pagedown"], () => scrollBy(20));
    canvas.key(["pageup"], () => scrollBy(-20));
    canvas.key(["home", "g"], () => { canvas.scrollTo(0); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["end", "G"], () => { canvas.scrollTo(99999); renderLayoutAndContent(); host.screen.render(); });
    canvas.key(["/"], () => inlineSearch.open());
    canvas.key(["r"], () => rebuild());
    canvas.key(["["], () => toggleSidebar());
    canvas.key(["escape", "tab"], () => {
      activePanelId = "";
      applyStyles();
      host.screen.render();
    });

    // Screen-level keypress handler — win.onInput only receives text, not key events.
    // Gated by focus: only act when a child of our window body is focused.
    const zineKeyHandler = (_ch: any, key: any) => {
      const focused = (host.screen as any).focused;
      if (!focused) return;
      // Walk up from focused element to see if it's inside our window body
      let el = focused;
      let isOurs = false;
      while (el) {
        if (el === win.body || el === canvas || el === root) { isOurs = true; break; }
        el = el.parent;
      }
      if (!isOurs) return;

      const ch = typeof _ch === "string" ? _ch : "";
      const speed = key?.shift ? 5 : key?.ctrl ? 10 : 1;
      if (key?.name === "up"   || ch === "k") { if (!nudgeActivePanel(0, -speed)) scrollBy(-1 * speed); return; }
      if (key?.name === "down" || ch === "j") { if (!nudgeActivePanel(0, speed)) scrollBy(1 * speed); return; }
      if (key?.name === "left"  || ch === "h") { nudgeActivePanel(-speed, 0); return; }
      if (key?.name === "right" || ch === "l") { nudgeActivePanel(speed, 0); return; }
      if (key?.name === "pageup")   { scrollBy(-20 * speed); return; }
      if (key?.name === "pagedown") { scrollBy(20 * speed);  return; }
      if (key?.name === "escape" || key?.name === "tab") {
        activePanelId = "";
        applyStyles();
        host.screen.render();
        return;
      }
      if (ch === "/") { inlineSearch.open(); return; }
      if (ch === "r") { rebuild(); return; }
      if (ch === "[") { toggleSidebar(); return; }
    };
    host.screen.on("keypress", zineKeyHandler);

    // ── Resize reflow ───────────────────────────────────────────────
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    win.onResize(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sidePanel.layout();
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
      host.screen.off("mouse", handleMouse);
      host.screen.off("mouse", handleWheel);
      host.screen.removeListener("keypress", zineKeyHandler);
    });

    return win.record;
  }

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
