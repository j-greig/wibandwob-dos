import blessed from "blessed";

import { theme } from "../core/theme/resolver.js";
import type { StateService } from "../services/state-service.js";
import type { WorkspaceService } from "../services/workspace-service.js";
import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
import { createLivePlayer, type LiveFrameGenerator } from "../services/animation-service.js";
import { animationAppType } from "../core/types.js";
import type { DesktopState, List, LogBox, MenuItem, WindowKind, WindowRecord } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";

export interface BaseWindowDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
}

/** AnimationKind — the subset of WindowKind valid for the animated window factory. */
export type AnimationKind = "pattern";

export function openAnimatedWindow(
  deps: BaseWindowDeps,
  title: string,
  kind: AnimationKind,
  generator: LiveFrameGenerator,
  fps = 8
): void {
  const frame = deps.windowManager.createFrame(title, kind);
  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: theme().body
  });
  const player = createLivePlayer({
    generator,
    fps,
    getViewport: () => ({
      width: Math.max(12, Number(canvas.width)),
      height: Math.max(6, Number(canvas.height)),
    }),
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
  });
  player.play();
  frame.kind = kind;
  frame.describeState = () => ({
    appType: animationAppType[kind],
    summary: `Animated ${kind} window.`,
    contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n")
  });
  frame.cleanup = () => player.destroy();
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    canvas.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
  };
  deps.windowManager.registerWindow(frame);
  frame.focus();
}

export function openPatternWindow(deps: BaseWindowDeps): void {
  openAnimatedWindow(deps, "Pattern Field", "pattern", (tick, width, height) => {
    const glyphs = ["░", "▒", "▓", "█"];
    const rows: string[] = [];
    for (let y = 0; y < height; y += 1) {
      let row = "";
      for (let x = 0; x < width; x += 1) {
        row += glyphs[Math.abs((x + y + tick) % glyphs.length)];
      }
      rows.push(row);
    }
    return rows.join("\n");
  }, 8);
}

export function openCompanionWindow(
  deps: BaseWindowDeps,
  restore?: { tick?: number }
): void {
  const frame = deps.windowManager.createFrame("Scramble", "companion");
  frame.frame.width = 30;
  frame.frame.height = 10;
  const bubble = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: theme().body
  });
  const moods = [
    " /\\\\_/\\\\\n( o.o )\n > ^ <\n\nScramble: lurking",
    " /\\\\_/\\\\\n( -.- )\n > ^ <\n\nScramble: judging layout",
    " /\\\\_/\\\\\n( 0.0 )\n > ^ <\n\nScramble: cat online",
    " /\\\\_/\\\\\n( ^.^ )\n > ^ <\n\nScramble: purring in ANSI"
  ];
  let tick = restore?.tick ?? 0;
  const renderCompanion = () => {
    bubble.setContent(moods[tick % moods.length]);
    deps.screen.render();
    tick += 1;
  };
  renderCompanion();
  const timer = setInterval(renderCompanion, 2400);
  frame.kind = "companion";
  frame.describeState = () => ({
    appType: "companion-widget",
    summary: "Animated scramble companion.",
    contentPreview: bubble.getContent(),
    tick
  });
  frame.cleanup = () => clearInterval(timer);
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    bubble.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(bubble, theme().body);
  };
  deps.windowManager.registerWindow(frame);
  frame.focus();
}

export function openArtWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Generative Art", "art");
  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: theme().body
  });
  const player = createLivePlayer({
    generator: (tick, width, height) => {
      const palette = " .:-=+*#%@";
      const rows: string[] = [];
      for (let y = 0; y < height; y += 1) {
        let row = "";
        for (let x = 0; x < width; x += 1) {
          const waveA = Math.sin((x + tick) / 5);
          const waveB = Math.cos((y - tick) / 4);
          const orbit = Math.sin((x + y + tick) / 7);
          const value = (waveA + waveB + orbit + 3) / 6;
          row += palette[Math.min(palette.length - 1, Math.max(0, Math.floor(value * palette.length)))];
        }
        rows.push(row);
      }
      return rows.join("\n");
    },
    fps: 10,
    getViewport: () => ({
      width: Math.max(12, Number(canvas.width)),
      height: Math.max(6, Number(canvas.height)),
    }),
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
  });
  player.play();
  frame.kind = "art";
  frame.describeState = () => ({
    appType: "generative-art",
    summary: "Animated procedural art field.",
    contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
    tick: player.currentFrame
  });
  frame.cleanup = () => player.destroy();
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    canvas.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
  };
  deps.windowManager.registerWindow(frame);
  frame.focus();
}

export function openWorkspaceManagerWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  workspace: WorkspaceService;
  saveWorkspace: () => void;
  promptForWorkspaceSave: () => void;
  promptForWorkspaceLoad: () => void;
  openCommandPaletteWindow: () => void;
}): void {
  const frame = params.windowManager.createFrame("Workspace Manager", "workspace");
  const footer = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    style: theme().header
  });
  const list = blessed.list({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 3,
    keys: true,
    vi: true,
    mouse: true,
    items: [
      "Save Current Workspace",
      "Save As Workspace...",
      "Load Workspace...",
      "Cascade Windows",
      "Tile Windows",
      "Open Command Palette"
    ],
    style: { ...theme().body, selected: theme().selected }
  });
  const refreshFooter = () => {
    const names = params.workspace.list();
    footer.setContent(
      ` Current: ${params.workspace.currentName}\n File: ${params.workspace.path}\n Known: ${names.length > 0 ? names.join(", ") : "none"}`
    );
  };
  const actions = [
    params.saveWorkspace,
    params.promptForWorkspaceSave,
    params.promptForWorkspaceLoad,
    () => params.windowManager.cascadeWindows(),
    () => params.windowManager.tileWindows(),
    params.openCommandPaletteWindow
  ];
  list.on("select", (_, index) => actions[index]?.());
  refreshFooter();
  frame.kind = "workspace";
  frame.describeState = () => ({
    appType: "workspace-manager",
    summary: "Workspace save/load command window.",
    selectedAction: list.getItem((list as List & { selected: number }).selected ?? 0)?.getText().trim(),
    workspaceName: params.workspace.currentName,
    workspacePath: params.workspace.path,
    knownWorkspaces: params.workspace.list()
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    list.focus();
  };
  frame.onRestyle = () => {
    footer.style = theme().header;
    safeSetStyle(list, { ...theme().body, selected: theme().selected });
  };
  params.windowManager.registerWindow(frame);
  frame.focus();
}

export function openCommandPaletteWindow(params: {
  windowManager: WindowManager;
  commands: MenuItem[];
}): void {
  const frame = params.windowManager.createFrame("Command Palette", "palette");
  const list = blessed.list({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    items: params.commands.map((command) => command.label),
    style: { ...theme().body, selected: theme().selected }
  });
  list.on("select", (_, index) => params.commands[index]?.action());
  frame.kind = "palette";
  frame.describeState = () => ({
    appType: "command-palette",
    summary: `Command palette with ${params.commands.length} actions.`,
    selectedCommand: params.commands[(list as List & { selected: number }).selected ?? 0]?.label,
    commandCount: params.commands.length
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    list.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(list, { ...theme().body, selected: theme().selected });
  };
  params.windowManager.registerWindow(frame);
  frame.focus();
}

export function openStateInspectorWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  state: StateService;
  statePath: string;
}): void {
  const frame = params.windowManager.createFrame("State Inspector", "inspector");
  const viewer = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body
  });
  const renderState = (state: DesktopState) => {
    viewer.setContent(JSON.stringify(state, null, 2));
    params.screen.render();
  };
  const unsubscribe = params.state.subscribe(renderState);
  frame.kind = "inspector";
  frame.describeState = () => ({
    appType: "state-inspector",
    summary: "Live JSON desktop state inspector.",
    contentPreview: viewer.getContent().split("\n").slice(0, 12).join("\n"),
    statePath: params.statePath
  });
  frame.cleanup = () => unsubscribe();
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    viewer.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(viewer, theme().body);
  };
  params.windowManager.registerWindow(frame);
  frame.focus();
}
