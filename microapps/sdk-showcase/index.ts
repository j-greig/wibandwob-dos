import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  createListPanel,
  createSplitView,
  createButtonBar,
  createScrollView,
  createTabs,
  createRule,
  createInputLine,
} from "../../src/services/microapp-sdk.js";

/**
 * SDK Showcase — Live terminal design kit.
 *
 * Programmatically renders every SDK Handle component with live examples.
 * When new Handle components are added to composition-helpers.ts,
 * add a ComponentDemo entry to the DEMOS array and the showcase auto-updates.
 *
 * Zero blessed imports — pure SDK.
 */

import type blessed from "blessed";

interface ComponentDemo {
  name: string;
  layer: "molecule" | "organism";
  description: string;
  build: (parent: blessed.Widgets.BoxElement) => () => void;
}

const DEMOS: ComponentDemo[] = [
  {
    name: "createHeaderBar",
    layer: "molecule",
    description: "Top-pinned bar with left/right text. Uses theme().header.",
    build: (parent) => {
      const h = createHeaderBar(parent, {
        left: " {bold}My App{/bold}  v2.1",
        right: "connected ●  ",
      });
      return () => h.destroy();
    },
  },
  {
    name: "createStatusBar",
    layer: "molecule",
    description: "Bottom-pinned bar with left/right text. Uses theme().footer.",
    build: (parent) => {
      const s = createStatusBar(parent, {
        left: " Ready │ 42 items",
        right: "UTF-8  LF  ",
      });
      return () => s.destroy();
    },
  },
  {
    name: "createTextViewer",
    layer: "molecule",
    description: "Scrollable text with vi keys, mouse, themed scrollbar. Wrap optional.",
    build: (parent) => {
      const lines = Array.from({ length: 20 }, (_, i) =>
        `  Line ${(i + 1).toString().padStart(2)}  │  ${["The quick brown fox", "jumps over the lazy dog", "Pack my box with five dozen liquor jugs", "How vexingly quick daft zebras jump"][i % 4]}`
      );
      const v = createTextViewer(parent, { content: lines.join("\n"), wrap: false, bottomOffset: 1 });
      return () => v.destroy();
    },
  },
  {
    name: "createScrollView",
    layer: "molecule",
    description: "Scrollable area with topOffset/bottomOffset and scrollTo().",
    build: (parent) => {
      const content = Array.from({ length: 30 }, (_, i) =>
        `  ${(i + 1).toString().padStart(3)}. Scrollable row — use j/k or mouse wheel`
      ).join("\n");
      const sv = createScrollView(parent, { content, topOffset: 1, bottomOffset: 1 });
      return () => sv.destroy();
    },
  },
  {
    name: "createListPanel",
    layer: "molecule",
    description: "Selectable list with vi keys, theme-aware selection highlight.",
    build: (parent) => {
      const list = createListPanel(parent, {
        items: ["◆ Dashboard", "◆ Settings", "◆ Logs", "◆ Users", "◆ Metrics", "◆ Events"],
        bottomOffset: 1,
      });
      return () => list.destroy();
    },
  },
  {
    name: "createInputLine",
    layer: "molecule",
    description: "Single-line text input. theme().input. Fires onSubmit on Enter.",
    build: (parent) => {
      const input = createInputLine(parent, { placeholder: "  Type here and press Enter..." });
      return () => input.destroy();
    },
  },
  {
    name: "createRule",
    layer: "molecule",
    description: "Horizontal divider line. Uses theme().muted.",
    build: (parent) => {
      const r = createRule(parent, { char: "─", top: 2 });
      return () => r.destroy();
    },
  },
  {
    name: "createButtonBar",
    layer: "molecule",
    description: "Bottom toolbar with labelled buttons and optional key hints.",
    build: (parent) => {
      const bar = createButtonBar(parent, {
        buttons: [
          { label: "Save", key: "C-s", action: () => {} },
          { label: "Find", key: "/", action: () => {} },
          { label: "Help", key: "?", action: () => {} },
          { label: "Quit", key: "q", action: () => {} },
        ],
      });
      return () => bar.destroy();
    },
  },
  {
    name: "createSplitView",
    layer: "organism",
    description: "Two-pane layout — horizontal or vertical with adjustable ratio.",
    build: (parent) => {
      const split = createSplitView(parent, { direction: "horizontal", ratio: 0.35, bottomOffset: 1 });
      const left = createListPanel(split.first, { items: ["sidebar-a", "sidebar-b", "sidebar-c"] });
      const right = createTextViewer(split.second, {
        content: "  Content pane — right side of a 35/65 horizontal split.",
      });
      return () => { left.destroy(); right.destroy(); split.destroy(); };
    },
  },
  {
    name: "createTabs",
    layer: "organism",
    description: "Tabbed container. Switch with ←/→ arrows or number keys.",
    build: (parent) => {
      const t = createTabs(parent, {
        tabs: [
          { label: "Overview", content: "  Tab 1: Overview content.\n  Switch with arrow keys or 1/2/3." },
          { label: "Details", content: "  Tab 2: Detail view.\n  Each tab has independent content." },
          { label: "Logs", content: "  Tab 3: Log output.\n  Tabs support any number of entries." },
        ],
        active: 0,
        bottomOffset: 1,
      });
      return () => t.destroy();
    },
  },
];

// ── Showcase app ──────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open SDK Showcase",
    description: "Interactive reference for all SDK composition helpers.",
    action: () => {
      openShowcase(host);
      return { ok: true };
    },
  });
}

function openShowcase(host: MicroappHost) {
  const win = host.createWindow({
    title: "SDK Showcase — Terminal Design Kit",
    width: 90,
    height: 32,
  });

  const molecules = DEMOS.filter(d => d.layer === "molecule");
  const organisms = DEMOS.filter(d => d.layer === "organism");

  const split = createSplitView(win.body, {
    direction: "horizontal",
    ratio: 0.3,
    bottomOffset: 1,
  });

  const componentNames = DEMOS.map((d) => {
    const icon = d.layer === "organism" ? "◈" : "◆";
    return `${icon} ${d.name}`;
  });
  const list = createListPanel(split.first, { items: componentNames });

  const infoBar = createHeaderBar(split.second, {
    left: ` ${DEMOS[0]!.name}`,
    right: `${DEMOS[0]!.layer} `,
  });

  const demoArea = createScrollView(split.second, {
    topOffset: 1,
    content: `  ${DEMOS[0]!.description}`,
  });

  const status = createStatusBar(win.body, {
    left: ` ${DEMOS.length} components │ ${molecules.length} molecules │ ${organisms.length} organisms`,
    right: "↑/↓ browse  Enter preview  q close ",
  });

  let activeDestroy: (() => void) | null = null;
  let activeIndex = 0;

  function showDemo(index: number) {
    if (activeDestroy) { activeDestroy(); activeDestroy = null; }
    activeIndex = index;
    const demo = DEMOS[index];
    if (!demo) return;

    infoBar.update({ left: ` ${demo.name}`, right: `${demo.layer} ` });
    demoArea.update({ content: `  ${demo.description}\n\n  ── Live Preview ──\n` });
    activeDestroy = demo.build(demoArea.element);
    host.screen.render();
  }

  list.onSelect((index) => showDemo(index));
  showDemo(0);

  win.setFocusTarget(list.element);

  win.describeState(() => ({
    appType: "wibwob.sdk-showcase",
    componentCount: DEMOS.length,
    activeComponent: DEMOS[activeIndex]?.name,
    activeLayer: DEMOS[activeIndex]?.layer,
    molecules: molecules.length,
    organisms: organisms.length,
  }));

  win.captureText(() => [
    `SDK Showcase — ${DEMOS.length} components`,
    "",
    `Active: ${DEMOS[activeIndex]?.name ?? "none"} (${DEMOS[activeIndex]?.layer})`,
    DEMOS[activeIndex]?.description ?? "",
    "",
    "Components:",
    ...DEMOS.map((d, i) => `  ${i === activeIndex ? "▸" : " "} ${d.name} (${d.layer})`),
  ].join("\n"));

  win.onRestyle(() => {
    list.update({ items: componentNames });
    status.update({});
    infoBar.update({});
    showDemo(activeIndex);
  });

  win.onCleanup(() => {
    if (activeDestroy) activeDestroy();
    list.destroy();
    split.destroy();
    infoBar.destroy();
    demoArea.destroy();
    status.destroy();
  });
}
