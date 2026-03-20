import type blessed from "blessed";
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
  createTimer,
  clearTimers,
  tweenPingPong,
  tweenSequence,
} from "../../src/services/microapp-sdk.js";

export interface ComponentDemo {
  name: string;
  layer: "molecule" | "organism";
  description: string;
  build: (parent: blessed.Widgets.BoxElement) => () => void;
}

export const DEMOS: ComponentDemo[] = [
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
        `  Line ${(i + 1).toString().padStart(2)}  │  ${["The quick brown fox", "jumps over the lazy dog", "Pack my box with five dozen liquor jugs", "How vexingly quick daft zebras jump"][i % 4]}`,
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
        `  ${(i + 1).toString().padStart(3)}. Scrollable row — use j/k or mouse wheel`,
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
    name: "tweenPingPong + tweenSequence",
    layer: "organism",
    description: "Reusable motion helpers for pulse and staged choreography loops.",
    build: (parent) => {
      const view = createTextViewer(parent, { content: "", wrap: false, bottomOffset: 1 });
      const timers = new Set<ReturnType<typeof setInterval>>();
      let pulse = 0;
      let sequence = 0;
      let pulseRun: { cancel: () => void } | null = null;
      let sequenceRun: { cancel: () => void } | null = null;

      const renderBars = () => {
        const pulseBar = "█".repeat(Math.max(1, Math.round(pulse * 20))).padEnd(20, "·");
        const sequenceBar = "█".repeat(Math.max(1, Math.round((sequence / 12) * 20))).padEnd(20, "·");
        view.update({
          content: [
            "  Motion helpers demo",
            "",
            `  pulse    │${pulseBar}│  ${pulse.toFixed(2)}`,
            `  sequence │${sequenceBar}│  ${sequence.toFixed(1)}`,
            "",
            "  Uses tweenPingPong for pulse/breathe effects.",
            "  Uses tweenSequence for deterministic staged moves.",
          ].join("\n"),
        });
      };

      const startPulse = () => {
        pulseRun?.cancel();
        pulseRun = tweenPingPong({
          from: 0,
          to: 1,
          duration: 240,
          cycles: 2,
          easing: "easeInOutCubic",
          onUpdate: (value) => {
            pulse = value;
            renderBars();
          },
        });
      };

      const startSequence = () => {
        sequenceRun?.cancel();
        sequenceRun = tweenSequence({
          from: 0,
          steps: [
            { to: 12, duration: 280, easing: "easeOut" },
            { to: 4, duration: 180, easing: "easeInOut" },
            { to: 9, duration: 150, easing: "easeOut" },
          ],
          onUpdate: (value) => {
            sequence = value;
            renderBars();
          },
        });
      };

      renderBars();
      startPulse();
      startSequence();
      createTimer(startPulse, 1200, timers);
      createTimer(startSequence, 1100, timers);

      return () => {
        clearTimers(timers);
        pulseRun?.cancel();
        sequenceRun?.cancel();
        view.destroy();
      };
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
      return () => {
        left.destroy();
        right.destroy();
        split.destroy();
      };
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
