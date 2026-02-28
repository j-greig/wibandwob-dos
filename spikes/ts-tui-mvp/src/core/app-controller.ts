import blessed from "blessed";
import { spawn as spawnProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn as spawnPty, type IPty as BunPtyTerminal, type IExitEvent as BunPtyExitEvent } from "@skitee3000/bun-pty/dist/index.js";

import { CONTROL_API_PORT, MASTER_PHILOSOPHY_PATH, README_PATH, REPO_ROOT, SPIKE_NOTES_PATH, SPIKE_ROOT, STATE_PATH, WORKSPACES_DIR } from "./config.js";
import { DesktopGeometryService } from "./desktop-geometry.js";
import { OverlayManager } from "./overlay-manager.js";
import type {
  BackroomsChannel,
  Box,
  BrowserEntry,
  DesktopState,
  GalleryTab,
  List,
  LogBox,
  MenuConfig,
  Textbox,
  WindowKind,
  WindowRecord,
  WindowSnapshot
} from "./types.js";
import { contentToWindowSize, getChromeModeForWindow } from "./window-chrome.js";
import { WindowManager } from "./window-manager.js";
import { BackroomsService } from "../services/backrooms-service.js";
import { makeWibReply, makeWobReply } from "../services/chat-service.js";
import { measurePlainTextContent, measurePrimerContent } from "../services/content-measurement.js";
import { ControlApiService } from "../services/control-api.js";
import { ContentService } from "../services/content-service.js";
import { getDefaultFigletFont, getFigletCatalogue, getFigletFontChoices, measureFiglet, renderFiglet } from "../services/figlet-service.js";
import { PiService } from "../services/pi-service.js";
import { createPtySession, type PtySession } from "../services/pty-session.js";
import { StateService } from "../services/state-service.js";
import { TerminalBuffer } from "../services/terminal-buffer.js";
import { renderTerminalBuffer } from "../services/terminal-renderer.js";
import { WorkspaceService } from "../services/workspace-service.js";

export class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private menuList?: List;
  private popupMenu?: List;
  private openMenuLabel?: string;
  private readonly menus: MenuConfig[];
  private readonly windowManager: WindowManager;
  private readonly overlays: OverlayManager;
  private readonly backrooms = new BackroomsService();
  private readonly content = new ContentService();
  private readonly pi = new PiService();
  private readonly workspace = new WorkspaceService(WORKSPACES_DIR);
  private readonly geometry: DesktopGeometryService;
  private readonly state: StateService;
  private readonly controlApi: ControlApiService;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      title: "WibWob-DOS TS MVP",
      mouse: true,
      autoPadding: false
    });

    this.menuBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      height: 1,
      width: "100%",
      tags: true,
      style: { fg: "black", bg: "white" }
    });
    this.desktop = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      bottom: 1,
      width: "100%",
      style: { fg: "blue", bg: "blue" }
    });
    this.statusLine = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      height: 1,
      width: "100%",
      tags: true,
      style: { fg: "black", bg: "white" }
    });

    this.windowManager = new WindowManager(
      this.screen,
      this.desktop,
      () => {
        this.syncState();
        this.refreshTerminalWindows();
      },
      (window, x, y) => this.openWindowContextMenu(window, x, y)
    );
    this.geometry = new DesktopGeometryService(this.screen);
    this.overlays = new OverlayManager(this.screen, () => this.windowManager.restoreWindowFocus());
    this.controlApi = new ControlApiService(CONTROL_API_PORT, {
      getState: () => this.getDesktopState(),
      getPrimerInfo: (pathOrName) => this.getPrimerInfo(pathOrName),
      focusWindowById: (id) => this.focusWindowById(id),
      moveWindowById: (id, left, top) => this.moveWindowById(id, left, top),
      resizeWindowById: (id, width, height) => this.resizeWindowById(id, width, height),
      closeWindowById: (id) => this.closeWindowById(id),
      openBackroomsTv: (channel) => this.openBackroomsTv(channel),
      saveWorkspaceNamed: (name) => this.saveWorkspaceNamed(name),
      loadWorkspaceNamed: (name) => this.loadWorkspaceNamed(name)
    });
    this.state = new StateService(
      {
        appName: "WibWob-DOS TS MVP",
        appMode: "terminal-native",
        cwd: REPO_ROOT,
        statePath: STATE_PATH,
        getControlApiStatus: () => this.controlApi.getStatus()
      },
      {
        getScreenSize: () => this.geometry.getGeometry(),
        getWindows: () => this.windowManager.getWindows(),
        getFocusedWindow: () => this.windowManager.getFocusedWindow(),
        getOpenMenuLabel: () => this.openMenuLabel
      }
    );

    this.menus = [
      {
        label: "File",
        key: "f",
        left: 1,
        items: [
          { label: "Browse Primers", action: () => this.openPrimerBrowserWindow() },
          { label: "Open Primer...", action: () => this.promptForPrimer() },
          { label: "Open Text File...", action: () => this.promptForEditorPath() },
          { label: "New Text Buffer", action: () => this.openEditorWindow() },
          { label: "Save Workspace...", action: () => this.promptForWorkspaceSave() },
          { label: "Load Workspace...", action: () => this.promptForWorkspaceLoad() },
          { label: "Open Art Window", action: () => this.openArtWindow() },
          { label: "Open Terminal", action: () => void this.openTerminalWindow() },
          { label: "Open XTerm Shell", action: () => void this.openXTermShellWindow() },
          { label: "Open Pi Chat", action: () => void this.openPiChatWindow() },
          { label: "Quit", action: () => this.destroy() }
        ]
      },
      {
        label: "Edit",
        key: "e",
        left: 8,
        items: [
          { label: "Focus Next Window", action: () => this.windowManager.focusNextWindow(1) },
          { label: "Focus Previous Window", action: () => this.windowManager.focusNextWindow(-1) },
          { label: "Close Focused Window", action: () => this.windowManager.closeFocusedWindow() }
        ]
      },
      {
        label: "View",
        key: "v",
        left: 15,
        items: [{ label: "Backrooms TV...", action: () => this.promptForBackroomsTv() }]
      },
      {
        label: "Window",
        key: "w",
        left: 22,
        items: [
          { label: "Tile Windows", action: () => this.windowManager.tileWindows() },
          { label: "Cascade Windows", action: () => this.windowManager.cascadeWindows() },
          { label: "Open Gallery", action: () => this.openPrimerGalleryWindow() },
          { label: "Open Browser", action: () => this.openBrowserReaderWindow() },
          { label: "Open Art", action: () => this.openArtWindow() }
        ]
      },
      {
        label: "Tools",
        key: "t",
        left: 31,
        items: [
          { label: "Backrooms TV", action: () => this.promptForBackroomsTv() },
          { label: "Primer Gallery", action: () => this.openPrimerGalleryWindow() },
          { label: "Browser Reader", action: () => this.openBrowserReaderWindow() },
          { label: "Figlet Banner", action: () => this.promptForFigletText() },
          { label: "Pattern Window", action: () => this.openPatternWindow() },
          { label: "Orbit Window", action: () => this.openOrbitWindow() },
          { label: "Glitch FX", action: () => this.openGlitchWindow() },
          { label: "Chat Transcript", action: () => this.openChatWindow() },
          { label: "Companion", action: () => this.openCompanionWindow() },
          { label: "Workspace Manager", action: () => this.openWorkspaceManagerWindow() },
          { label: "XTerm Shell", action: () => void this.openXTermShellWindow() },
          { label: "Pi Chat", action: () => void this.openPiChatWindow() },
          { label: "Command Palette", action: () => this.openCommandPaletteWindow() },
          { label: "State Inspector", action: () => this.openStateInspectorWindow() }
        ]
      }
    ];
  }

  run(): void {
    this.renderChrome();
    this.bindGlobalKeys();
    this.bindMenuClicks();
    this.openCompanionWindow();
    this.controlApi.start();
    this.syncState();
    this.screen.render();
  }

  private renderChrome(): void {
    this.updateStatusLine();
    this.repaintDesktop();
    this.screen.on("resize", () => {
      this.repaintDesktop();
      this.syncState();
      this.screen.render();
    });
  }

  private refreshTerminalWindows(): void {
    for (const window of this.windowManager.getWindows()) {
      if (window.kind === "terminal" && window.terminal?.mode === "xterm-bridge") {
        window.refresh?.();
      }
    }
  }

  private updateStatusLine(): void {
    const current = this.state.sync();
    const focus = current.windows.find((window) => window.focused);
    const focusSummary = focus
      ? ` Focus ${focus.id}:${focus.kind} ${focus.width}x${focus.height}@${focus.left},${focus.top}`
      : " Focus none";
    this.statusLine.setContent(
      ` Alt-F File  Alt-E Edit  Alt-V View  Alt-W Window  Alt-T Tools  Tab Next  Shift-Tab Prev  Alt-Shift-Arrows Resize  Ctrl-S Save  Ctrl-Q Quit  |  Term ${current.screen.width}x${current.screen.height}  Aspect ${current.screen.cellAspect.toFixed(2)}  Windows ${current.screen.openWindowCount}${focusSummary} `
    );
  }

  private repaintDesktop(): void {
    this.desktop.setContent("");
  }

  private bindGlobalKeys(): void {
    this.screen.key(["C-q"], () => this.destroy());
    this.screen.key(["M-f"], () => this.openMenu("File"));
    this.screen.key(["M-e"], () => this.openMenu("Edit"));
    this.screen.key(["M-v"], () => this.openMenu("View"));
    this.screen.key(["M-w"], () => this.openMenu("Window"));
    this.screen.key(["M-t"], () => this.openMenu("Tools"));
    this.screen.key(["M-S-left"], () => this.windowManager.resizeFocusedWindow(-2, 0));
    this.screen.key(["M-S-right"], () => this.windowManager.resizeFocusedWindow(2, 0));
    this.screen.key(["M-S-up"], () => this.windowManager.resizeFocusedWindow(0, -1));
    this.screen.key(["M-S-down"], () => this.windowManager.resizeFocusedWindow(0, 1));
    this.screen.key(["escape"], () => this.closeMenu());
    this.screen.key(["tab"], () => {
      const focused = this.windowManager.getFocusedWindow();
      if (focused?.kind === "editor") {
        this.insertEditorText(focused, "  ");
        return;
      }
      if (focused?.kind === "terminal" && focused.terminal?.mode === "xterm-bridge") {
        focused.writeInput?.("\t");
        return;
      }
      this.windowManager.focusNextWindow(1);
    });
    this.screen.key(["S-tab"], () => this.windowManager.focusNextWindow(-1));
    this.screen.key(["C-s"], () => this.saveFocusedEditor());
    this.screen.on("keypress", (ch, key) => {
      this.handleFocusedEditorKeypress(ch, key);
      this.handleFocusedTerminalKeypress(ch, key);
    });
    this.screen.on("mouse", (data) => this.windowManager.handleMouse(data));
    this.desktop.on("mousedown", (data) => {
      if (this.isRightClick(data) && !this.windowManager.getWindowAtPosition(data.x, data.y)) {
        this.openSystemContextMenu(data.x, data.y);
      }
    });
  }

  private bindMenuClicks(): void {
    for (const menu of this.menus) {
      const target = blessed.box({
        parent: this.menuBar,
        top: 0,
        left: menu.left,
        width: menu.label.length,
        height: 1,
        mouse: true,
        clickable: true,
        content: menu.label,
        style: {
          fg: "black",
          bg: "white",
          hover: { fg: "white", bg: "blue" }
        }
      });
      target.on("click", () => this.openMenu(menu.label));
    }
  }

  private openMenu(label: string): void {
    this.closeMenus();
    const menu = this.menus.find((entry) => entry.label === label);
    if (!menu) {
      return;
    }
    this.menuList = blessed.list({
      parent: this.screen,
      top: 1,
      left: menu.left,
      width: Math.max(...menu.items.map((item) => item.label.length)) + 4,
      height: menu.items.length + 2,
      border: "line",
      keys: true,
      vi: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "white" },
        selected: { fg: "black", bg: "cyan" }
      },
      items: menu.items.map((item) => item.label)
    });
    this.openMenuLabel = label;
    this.menuList.focus();
    this.menuList.select(0);
    this.menuList.on("select", (_, index) => {
      this.closeMenu();
      menu.items[index].action();
    });
    this.syncState();
    this.screen.render();
  }

  private closeMenu(): void {
    if (!this.menuList) {
      return;
    }
    this.menuList.destroy();
    this.menuList = undefined;
    this.openMenuLabel = undefined;
    this.windowManager.restoreWindowFocus();
    this.syncState();
    this.screen.render();
  }

  private closePopupMenu(): void {
    if (!this.popupMenu) {
      return;
    }
    this.popupMenu.destroy();
    this.popupMenu = undefined;
    this.windowManager.restoreWindowFocus();
    this.screen.render();
  }

  private closeMenus(): void {
    this.closeMenu();
    this.closePopupMenu();
  }

  private openPopupMenu(items: Array<{ label: string; action: () => void }>, x?: number, y?: number): void {
    this.closeMenus();
    if (items.length === 0) {
      return;
    }
    const width = Math.max(...items.map((item) => item.label.length)) + 4;
    const left = Math.max(0, Math.min((x ?? 2) - 1, Math.max(0, Number(this.screen.width) - width - 1)));
    const top = Math.max(1, Math.min(y ?? 2, Math.max(1, Number(this.screen.height) - items.length - 3)));
    this.popupMenu = blessed.list({
      parent: this.screen,
      top,
      left,
      width,
      height: items.length + 2,
      border: "line",
      keys: true,
      vi: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "white" },
        selected: { fg: "black", bg: "cyan" }
      },
      items: items.map((item) => item.label)
    });
    this.popupMenu.focus();
    this.popupMenu.select(0);
    this.popupMenu.on("select", (_, index) => {
      const item = items[index];
      this.closePopupMenu();
      item?.action();
    });
    this.popupMenu.on("keypress", (_, key) => {
      if (key.name === "escape") {
        this.closePopupMenu();
      }
    });
    this.screen.render();
  }

  private openWindowContextMenu(window: WindowRecord, x?: number, y?: number): void {
    this.openPopupMenu([
      { label: `Focus ${window.title}`, action: () => window.focus() },
      { label: "Tile Windows", action: () => this.windowManager.tileWindows() },
      { label: "Cascade Windows", action: () => this.windowManager.cascadeWindows() },
      { label: "Close Window", action: () => window.close() }
    ], x, y);
  }

  private openSystemContextMenu(x?: number, y?: number): void {
    this.openPopupMenu([
      { label: "Open Primer Browser", action: () => this.openPrimerBrowserWindow() },
      { label: "Open Text File", action: () => this.promptForEditorPath() },
      { label: "Open Backrooms TV", action: () => this.promptForBackroomsTv() },
      { label: "Open XTerm Shell", action: () => void this.openXTermShellWindow() },
      { label: "Open Pi Chat", action: () => void this.openPiChatWindow() },
      { label: "Open Workspace Manager", action: () => this.openWorkspaceManagerWindow() },
      { label: "Tile Windows", action: () => this.windowManager.tileWindows() },
      { label: "Cascade Windows", action: () => this.windowManager.cascadeWindows() }
    ], x, y);
  }

  private isRightClick(data?: blessed.Widgets.Events.IMouseEventArg): boolean {
    if (!data) {
      return false;
    }
    const mouseData = data as blessed.Widgets.Events.IMouseEventArg & { button?: string | number; buttons?: string | number };
    return mouseData.button === "right" || mouseData.button === 2 || mouseData.buttons === "right" || mouseData.buttons === 2;
  }

  private async openTerminalWindow(): Promise<void> {
    await this.openPtyWindow({
      title: "Terminal",
      appType: "terminal-shell",
      command: this.resolveShellPath(),
      args: ["-i"],
      cwd: REPO_ROOT,
      env: this.getPtyEnv(),
      intro: "Interactive shell window. Good for shell commands; full-screen TUIs are not expected to render cleanly yet.",
      shellPath: this.resolveShellPath()
    });
  }

  private async openXTermShellWindow(): Promise<void> {
    await this.openBufferedTerminalWindow({
      title: "XTerm Shell",
      appType: "xterm-shell",
      command: this.resolveShellPath(),
      args: ["-i"],
      cwd: REPO_ROOT,
      env: this.getPtyEnv(),
      summary: "Buffered PTY shell window with a local blessed terminal bridge."
    });
  }

  private async openPiChatWindow(): Promise<void> {
    if (!this.pi.isAvailable()) {
      this.overlays.flash("Pi is not installed in the spike. Run bun install first.");
      return;
    }

    const launch = this.pi.createLaunchConfig(REPO_ROOT, this.getPtyEnv());
    await this.openPtyWindow({
      title: "Pi Chat",
      appType: "pi-chat",
      command: launch.command,
      args: launch.args,
      cwd: launch.cwd,
      env: launch.env,
      intro: "Pi coding agent running inside a terminal window. This is the first reusable chat slice, not yet a fully integrated typed agent surface.",
      shellPath: launch.command
    });
  }

  private async openBufferedTerminalWindow(options: {
    title: string;
    appType: string;
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    summary: string;
  }): Promise<void> {
    const frame = this.windowManager.createFrame(options.title, "terminal");
    const viewport = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: true,
      mouse: true,
      style: { fg: "white", bg: "black" }
    });

    const getTerminalSize = () => ({
      cols: Math.max(20, Number(frame.body.width)),
      rows: Math.max(8, Number(frame.body.height))
    });

    const buffer = new TerminalBuffer(getTerminalSize().cols, getTerminalSize().rows);
    let session: PtySession;
    try {
      session = createPtySession({
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        env: options.env,
        ...getTerminalSize()
      });
    } catch (error) {
      frame.close();
      this.overlays.flash(`${options.title} launch failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    let running = true;
    let exitCode: number | undefined;
    let exitSignal: number | undefined;

    const render = () => {
      const showCursor = this.windowManager.getFocusedWindow()?.id === frame.id && !this.menuList && !this.popupMenu;
      viewport.setContent(renderTerminalBuffer(buffer, showCursor));
      this.syncState();
      this.screen.render();
    };

    const syncSize = () => {
      const size = getTerminalSize();
      buffer.resize(size.cols, size.rows);
      session.resize(size.cols, size.rows);
      render();
    };

    const handleScreenResize = () => syncSize();

    session.onData((chunk) => {
      buffer.write(chunk);
      render();
    });
    session.onExit((event) => {
      running = false;
      exitCode = event.exitCode;
      exitSignal = event.signal;
      buffer.write(`\r\n[process exited ${event.exitCode} signal ${event.signal ?? "none"}]\r\n`);
      render();
    });

    frame.kind = "terminal";
    frame.terminal = {
      mode: "xterm-bridge",
      viewport,
      scrollViewport: (delta) => {
        buffer.scrollViewport(delta);
        render();
      }
    };
    frame.cleanup = () => {
      this.screen.off("resize", handleScreenResize);
      session.kill();
    };
    frame.writeInput = (input) => {
      session.write(input);
    };
    frame.refresh = render;
    frame.describeState = () => {
      const cursor = buffer.getCursor();
      return {
        appType: options.appType,
        summary: options.summary,
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        cols: buffer.getCols(),
        rows: buffer.getRows(),
        cursorX: cursor.x,
        cursorY: cursor.y,
        viewportTop: buffer.getViewportTop(),
        scrollbackLines: buffer.getScrollbackLineCount(),
        running,
        exitCode,
        exitSignal,
        pid: session.pid,
        contentPreview: buffer.getPreviewText()
      };
    };
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      render();
    };

    viewport.on("click", () => {
      this.windowManager.focusWindow(frame);
      render();
    });
    viewport.on("wheelup", () => {
      buffer.scrollViewport(-3);
      render();
    });
    viewport.on("wheeldown", () => {
      buffer.scrollViewport(3);
      render();
    });

    this.windowManager.registerWindow(frame);
    frame.frame.on("resize", syncSize);
    this.screen.on("resize", handleScreenResize);
    frame.focus();
    render();
  }

  private async openPtyWindow(options: {
    title: string;
    appType: string;
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    intro: string;
    shellPath: string;
  }): Promise<void> {
    const frame = this.windowManager.createFrame(options.title, "terminal");
    const transcript = blessed.log({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 1,
      tags: false,
      keys: false,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    }) as LogBox;
    const inputLine = blessed.textbox({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "white", bg: "blue" }
    });

    let pty: BunPtyTerminal;
    try {
      pty = spawnPty(options.command, options.args, {
        name: "xterm-256color",
        cols: Math.max(20, Number(frame.body.width)),
        rows: Math.max(8, Number(frame.body.height) - 1),
        cwd: options.cwd,
        env: options.env
      });
    } catch (error) {
      frame.close();
      this.overlays.flash(`${options.title} launch failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const syncPtySize = () => pty.resize(Math.max(20, Number(frame.body.width)), Math.max(8, Number(frame.body.height) - 1));
    const handleScreenResize = () => syncPtySize();
    const armTerminalInput = () => {
      inputLine.focus();
      inputLine.readInput();
      this.screen.render();
    };

    let terminalPartialLine = "";
    pty.onData((chunk: string) => {
      const clean = chunk.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\r/g, "").replace(/\x07/g, "");
      const combined = terminalPartialLine + clean;
      const lines = combined.split("\n");
      terminalPartialLine = lines.pop() ?? "";
      for (const line of lines) {
        transcript.log(line);
      }
      this.syncState();
      this.screen.render();
    });
    pty.onExit(({ exitCode, signal }: BunPtyExitEvent) => {
      if (terminalPartialLine.length > 0) {
        transcript.log(terminalPartialLine);
        terminalPartialLine = "";
      }
      transcript.log(`[process exited ${exitCode} signal ${signal ?? "none"}]`);
      this.syncState();
      this.screen.render();
    });
    inputLine.on("submit", (value) => {
      const command = value ?? "";
      transcript.log(`$ ${command}`);
      pty.write(`${command}\r`);
      inputLine.clearValue();
      this.syncState();
      this.screen.render();
      armTerminalInput();
    });

    frame.kind = "terminal";
    frame.terminal = { mode: "legacy", transcript, input: inputLine };
    frame.cleanup = () => {
      this.screen.off("resize", handleScreenResize);
      pty.kill();
    };
    frame.writeInput = (input) => pty.write(input);
    frame.describeState = () => ({
      appType: options.appType,
      summary: options.intro,
      contentPreview: transcript.getContent().split("\n").slice(-8).join("\n"),
      shellPath: options.shellPath,
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      transcriptLineCount: transcript.getContent().split("\n").filter(Boolean).length,
      inputValue: inputLine.getValue()
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      armTerminalInput();
    };

    frame.body.on("click", armTerminalInput);
    transcript.on("click", armTerminalInput);
    inputLine.on("focus", () => this.windowManager.focusWindow(frame));

    this.windowManager.registerWindow(frame);
    frame.focus();
    frame.frame.on("resize", syncPtySize);
    this.screen.on("resize", handleScreenResize);
    syncPtySize();
    transcript.log(options.intro);
    this.syncState();
  }

  private promptForBackroomsTv(): void {
    const defaults: BackroomsChannel = {
      theme: "liminal fluorescent maze",
      primers: "",
      turns: 3,
      model: "sonnet"
    };
    this.overlays.openValuePrompt("Backrooms Theme", defaults.theme, (theme) => {
      this.openBackroomsPrimerPicker(theme.trim() || defaults.theme, defaults);
    });
  }

  private openBackroomsPrimerPicker(theme: string, defaults: BackroomsChannel): void {
    const allEntries = this.backrooms.collectPrimers();
    if (allEntries.length === 0) {
      this.overlays.flash("No Backrooms primers found.");
      return;
    }

    const frame = this.windowManager.createFrame("Backrooms Primer Picker", "browser");
    frame.frame.width = 96;
    frame.frame.height = 28;

    const header = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      style: { fg: "black", bg: "cyan" }
    });
    const searchBox = blessed.textbox({
      parent: frame.body,
      top: 2,
      left: 0,
      width: "36%",
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "white", bg: "blue" }
    });
    const list = blessed.list({
      parent: frame.body,
      top: 3,
      left: 0,
      width: "36%",
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    const preview = blessed.box({
      parent: frame.body,
      top: 2,
      left: "36%",
      right: 0,
      bottom: 0,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    });

    let searchValue = "";
    let filteredEntries = [...allEntries];
    const selectedLabels = new Set<string>();

    const syncHeader = () => {
      header.setContent(
        ` Theme: ${theme}\n Enter run  Space toggle  / search  Esc cancel  Letters jump  Selected: ${selectedLabels.size || 0} `
      );
    };

    const renderList = (selectedIndex = 0) => {
      list.setItems(
        filteredEntries.map((entry) => `${selectedLabels.has(entry.label) ? "[x]" : "[ ]"} ${entry.label}`)
      );
      if (filteredEntries.length > 0) {
        list.select(Math.max(0, Math.min(selectedIndex, filteredEntries.length - 1)));
      } else {
        list.select(0);
      }
      syncHeader();
      this.screen.render();
    };

    const updatePreview = (index: number) => {
      const entry = filteredEntries[index];
      if (!entry) {
        preview.setContent(searchValue ? `No primers match "${searchValue}".` : "No primer selected.");
        this.screen.render();
        return;
      }
      try {
        const content = fs.readFileSync(entry.filePath, "utf8");
        preview.setContent(`${entry.label}\n${entry.filePath}\n\n${content}`);
      } catch (error) {
        preview.setContent(`Cannot preview primer.\n\n${error instanceof Error ? error.message : String(error)}`);
      }
      this.screen.render();
    };

    const applyFilter = (preserveLabel?: string) => {
      const lowered = searchValue.toLowerCase();
      filteredEntries = allEntries.filter((entry) => entry.label.toLowerCase().includes(lowered));
      const nextIndex = preserveLabel
        ? Math.max(0, filteredEntries.findIndex((entry) => entry.label === preserveLabel))
        : 0;
      renderList(nextIndex < 0 ? 0 : nextIndex);
      updatePreview((list as List & { selected: number }).selected ?? 0);
    };

    const toggleSelected = () => {
      const index = (list as List & { selected: number }).selected ?? 0;
      const entry = filteredEntries[index];
      if (!entry) {
        return;
      }
      if (selectedLabels.has(entry.label)) {
        selectedLabels.delete(entry.label);
      } else {
        selectedLabels.add(entry.label);
      }
      renderList(index);
      updatePreview(index);
    };

    const jumpToLetter = (letter: string) => {
      const upper = letter.toUpperCase();
      const index = filteredEntries.findIndex((entry) => entry.label.charAt(0).toUpperCase() === upper);
      if (index >= 0) {
        list.select(index);
        updatePreview(index);
        this.screen.render();
      }
    };

    const closePicker = () => {
      frame.close();
    };

    const confirmSelection = () => {
      const focusedIndex = (list as List & { selected: number }).selected ?? 0;
      const fallback = filteredEntries[focusedIndex]?.label;
      const selected = selectedLabels.size > 0 ? [...selectedLabels] : fallback ? [fallback] : [];
      closePicker();
      this.promptForBackroomsRunOptions(theme, selected.join(","), defaults);
    };

    const focusSearch = () => {
      searchBox.focus();
      searchBox.readInput();
      this.screen.render();
    };

    searchBox.setValue(searchValue);
    searchBox.on("keypress", (_, key) => {
      if (key.name === "escape") {
        list.focus();
        this.screen.render();
        return;
      }
      if (key.name === "enter") {
        searchValue = searchBox.getValue().trim();
        applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
        list.focus();
        this.screen.render();
        return;
      }
      setTimeout(() => {
        searchValue = searchBox.getValue().trim();
        applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
      }, 0);
    });
    searchBox.on("submit", (value) => {
      searchValue = (value ?? "").trim();
      applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
      list.focus();
      this.screen.render();
    });

    list.on("select item", (_, index) => updatePreview(index));
    list.on("keypress", (ch, key) => {
      if (key.name === "enter") {
        confirmSelection();
        return;
      }
      if (key.name === "space") {
        toggleSelected();
        return;
      }
      if (key.name === "escape") {
        closePicker();
        return;
      }
      if (key.name === "slash") {
        focusSearch();
        return;
      }
      if (["up", "down", "j", "k", "pageup", "pagedown", "home", "end"].includes(key.name ?? "")) {
        setTimeout(() => updatePreview((list as List & { selected: number }).selected ?? 0), 0);
        return;
      }
      if (ch && /^[a-z]$/i.test(ch)) {
        jumpToLetter(ch);
      }
    });

    frame.kind = "browser";
    frame.describeState = () => ({
      appType: "backrooms-primer-picker",
      summary: `Backrooms primer picker with ${allEntries.length} primers.`,
      theme,
      searchValue,
      selectedPrimers: [...selectedLabels],
      visibleEntryCount: filteredEntries.length,
      selectedLabel: filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label,
      contentPreview: preview.getContent().split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      list.focus();
    };

    this.windowManager.registerWindow(frame);
    renderList(0);
    updatePreview(0);
    frame.focus();
  }

  private promptForBackroomsRunOptions(theme: string, primers: string, defaults: BackroomsChannel): void {
    this.overlays.openValuePrompt("Backrooms Turns", String(defaults.turns), (turnsValue) => {
      this.overlays.openValuePrompt("Backrooms Model", defaults.model, (modelValue) => {
        const turns = Math.max(1, Math.min(20, Number.parseInt(turnsValue, 10) || defaults.turns));
        const model = ["haiku", "sonnet", "opus"].includes(modelValue.trim()) ? (modelValue.trim() as BackroomsChannel["model"]) : defaults.model;
        this.openBackroomsTv({
          theme,
          primers,
          turns,
          model
        });
      });
    });
  }

  openBackroomsTv(channel: BackroomsChannel): void {
    const frame = this.windowManager.createFrame("Backrooms TV", "backrooms");
    frame.frame.width = 86;
    frame.frame.height = 24;

    const header = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      tags: true,
      style: { fg: "black", bg: "cyan" }
    });
    const transcript = blessed.log({
      parent: frame.body,
      top: 2,
      left: 0,
      right: 0,
      bottom: 1,
      tags: false,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    }) as LogBox;
    const footer = blessed.box({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: "black", bg: "white" }
    });

    let status = "IDLE";
    let phase: "idle" | "starting" | "waiting" | "streaming" | "playback" | "complete" | "error" = "idle";
    let processRef: ChildProcessWithoutNullStreams | undefined;
    let backroomsPartialLine = "";
    let logPath = this.backrooms.createLogPath(channel.theme);
    let fallbackTimer: ReturnType<typeof setInterval> | undefined;
    let fallbackPlaybackTimer: ReturnType<typeof setInterval> | undefined;
    let lastError = "";
    let sourceMode: "live" | "playback" | "simulated-live" = "live";
    let playbackSourceLabels: string[] = [];
    let liveStdoutBytes = 0;
    let liveStderrBytes = 0;
    let lastActivityAt = 0;
    let sawLiveStdout = false;
    let startTime = 0;
    let startedAt = "";
    let endedAt = "";
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let fallbackReason = "";
    const requestedMode = channel.mode ?? "auto";
    let launchMode = this.backrooms.resolveLaunchMode(requestedMode);
    const command = this.backrooms.resolveCliCommand();
    const cliArgs = this.backrooms.buildCliArgs(channel);
    const backroomsCwd = this.backrooms.resolveBackroomsPath();
    let runRoot = "";

    const updateChrome = () => {
      header.setContent(
        ` Theme: ${channel.theme}\n Model: ${channel.model}  Turns: ${channel.turns}  Primers: ${channel.primers || "(none)"}  Mode: ${launchMode}${
          (sourceMode === "playback" || sourceMode === "simulated-live") && playbackSourceLabels.length > 0 ? `  Playback: ${playbackSourceLabels.join(" | ")}` : ""
        } `
      );
      footer.setContent(` ${status} [${sourceMode}]  log: ${logPath}  Space restart  N restart  Alt-Shift-Arrows resize  +> mouse resize `);
    };

    const appendChunk = (chunk: string) => {
      const clean = this.backrooms.sanitizeOutputChunk(chunk);
      if (!clean) {
        return;
      }
      lastActivityAt = Date.now();
      liveStdoutBytes += Buffer.byteLength(clean);
      sawLiveStdout = sawLiveStdout || clean.length > 0;
      if (sourceMode === "live") {
        phase = "streaming";
        status = "STREAMING";
        updateChrome();
      }
      fs.appendFileSync(logPath, clean, "utf8");
      const combined = backroomsPartialLine + clean;
      const lines = combined.split("\n");
      backroomsPartialLine = lines.pop() ?? "";
      for (const line of lines) {
        transcript.log(line);
      }
      this.syncState();
      this.screen.render();
    };

    const stopBackrooms = () => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
      if (fallbackPlaybackTimer) {
        clearInterval(fallbackPlaybackTimer);
        fallbackPlaybackTimer = undefined;
      }
      if (!processRef || processRef.killed) {
        return;
      }
      processRef.kill("SIGTERM");
      processRef = undefined;
      phase = "idle";
      status = "IDLE";
      updateChrome();
      this.syncState();
      this.screen.render();
    };

    const startSimulatedLive = () => {
      const playback = this.backrooms.buildPlaybackStream(channel, 3);
      playbackSourceLabels = playback.labels;
      sourceMode = "simulated-live";
      phase = "streaming";
      status = "SIMULATED LIVE";
      fallbackReason = "forced-fake-live";
      updateChrome();
      if (playback.lines.length === 0) {
        transcript.log("[backrooms fake-live unavailable: no local sample files found]");
        phase = "error";
        status = "SIMULATED LIVE UNAVAILABLE";
        updateChrome();
        this.syncState();
        this.screen.render();
        return;
      }
      transcript.log(`[backrooms fake-live] ${playbackSourceLabels.join(", ")}`);
      let index = 0;
      fallbackPlaybackTimer = setInterval(() => {
        if (index >= playback.lines.length) {
          if (fallbackPlaybackTimer) {
            clearInterval(fallbackPlaybackTimer);
            fallbackPlaybackTimer = undefined;
          }
          phase = "complete";
          status = "SIMULATED COMPLETE";
          updateChrome();
          this.syncState();
          this.screen.render();
          return;
        }
        transcript.log(playback.lines[index]);
        index += 1;
        this.syncState();
        this.screen.render();
      }, 30);
    };

    const startPlaybackFallback = (reason: string) => {
      if (fallbackPlaybackTimer) {
        return;
      }
      if (processRef && !processRef.killed) {
        processRef.kill("SIGTERM");
        processRef = undefined;
      }
      fallbackReason = reason;
      sourceMode = "playback";
      phase = "playback";
      status = `PLAYBACK ${reason}`;
      const playback = this.backrooms.buildPlaybackStream(channel, 3);
      playbackSourceLabels = playback.labels;
      if (playback.lines.length === 0) {
        transcript.log("[backrooms playback unavailable: no local sample files found]");
        phase = "error";
        status = "PLAYBACK UNAVAILABLE";
        updateChrome();
        this.syncState();
        this.screen.render();
        return;
      }
      let index = 0;
      transcript.log(`[backrooms playback fallback] ${playbackSourceLabels.join(", ")}`);
      updateChrome();
      fallbackPlaybackTimer = setInterval(() => {
        if (index >= playback.lines.length) {
          if (fallbackPlaybackTimer) {
            clearInterval(fallbackPlaybackTimer);
            fallbackPlaybackTimer = undefined;
          }
          phase = "complete";
          status = "PLAYBACK COMPLETE";
          updateChrome();
          this.syncState();
          this.screen.render();
          return;
        }
        transcript.log(playback.lines[index]);
        index += 1;
        this.syncState();
        this.screen.render();
      }, 35);
    };

    const startBackrooms = () => {
      stopBackrooms();
      transcript.setContent("");
      backroomsPartialLine = "";
      logPath = this.backrooms.createLogPath(channel.theme);
      launchMode = this.backrooms.resolveLaunchMode(requestedMode);
      phase = "starting";
      status = "STARTING";
      sourceMode = "live";
      playbackSourceLabels = [];
      lastError = "";
      liveStdoutBytes = 0;
      liveStderrBytes = 0;
      lastActivityAt = Date.now();
      sawLiveStdout = false;
      startTime = Date.now();
      startedAt = new Date(startTime).toISOString();
      endedAt = "";
      exitCode = null;
      exitSignal = null;
      fallbackReason = "";
      runRoot = this.backrooms.prepareRunRoot(channel);
      updateChrome();

      if (launchMode === "fake-live") {
        startSimulatedLive();
        this.syncState();
        this.screen.render();
        return;
      }

      processRef = spawnProcess(command.command, cliArgs, {
        cwd: backroomsCwd,
        env: {
          ...process.env,
          TERM: "dumb",
          NO_COLOR: "1",
          DOTENV_CONFIG_QUIET: "true",
          WIBWOB_ROOT: runRoot,
          WIBWOB_AUTH_METHOD: process.env.WIBWOB_AUTH_METHOD || "claude-cli"
        }
      });

      processRef.stdout.on("data", (chunk: Buffer) => appendChunk(chunk.toString("utf8")));
      processRef.stderr.on("data", (chunk: Buffer) => {
        const text = this.backrooms.sanitizeOutputChunk(chunk.toString("utf8")).trim();
        liveStderrBytes += Buffer.byteLength(text);
        lastActivityAt = Date.now();
        if (!text) {
          return;
        }
        if (!sawLiveStdout) {
          phase = "waiting";
          status = "WAITING FOR FIRST TOKENS";
        }
        lastError = text;
        fs.appendFileSync(logPath, `[stderr] ${text}\n`, "utf8");
        transcript.log(`[stderr] ${text}`);
        this.syncState();
        this.screen.render();
      });
      processRef.on("close", (code, signal) => {
        if (fallbackTimer) {
          clearInterval(fallbackTimer);
          fallbackTimer = undefined;
        }
        processRef = undefined;
        endedAt = new Date().toISOString();
        exitCode = code ?? null;
        exitSignal = signal ?? null;
        if (backroomsPartialLine.length > 0) {
          transcript.log(backroomsPartialLine);
          backroomsPartialLine = "";
        }
        phase = code === 0 ? "complete" : "error";
        status = `EXIT ${code ?? "?"}/${signal ?? "none"}`;
        updateChrome();
        transcript.log(`[backrooms exited code=${code ?? "?"} signal=${signal ?? "none"}]`);
        if (!sawLiveStdout) {
          startPlaybackFallback(code === 0 && liveStderrBytes === 0 ? "silent" : "error");
        }
        this.syncState();
        this.screen.render();
      });

      fallbackTimer = setInterval(() => {
        const silentForMs = Date.now() - lastActivityAt;
        const uptimeMs = Date.now() - startTime;
        if (!processRef || processRef.killed || sourceMode !== "live" || sawLiveStdout) {
          return;
        }
        if (uptimeMs >= 1000 && phase === "starting") {
          phase = "waiting";
          status = "WAITING FOR FIRST TOKENS";
          updateChrome();
          this.syncState();
          this.screen.render();
        }
        if (uptimeMs >= 8000 && silentForMs >= 8000) {
          transcript.log("[backrooms live mode is still silent after 8s]");
          if (lastError) {
            transcript.log(`[backrooms last stderr] ${lastError}`);
          }
          startPlaybackFallback("timeout");
        }
      }, 1000);
    };

    updateChrome();
    frame.cleanup = () => stopBackrooms();
    frame.describeState = () => ({
      appType: "backrooms-tv",
      summary: "Streams existing backrooms cli-v3.ts output into a scrolling window.",
      theme: channel.theme,
      primers: channel.primers,
      turns: channel.turns,
      model: channel.model,
      requestedMode,
      launchMode,
      phase,
      status,
      sourceMode,
      playbackSources: playbackSourceLabels,
      lastError,
      fallbackReason,
      logPath,
      command: command.command,
      args: cliArgs,
      cwd: backroomsCwd,
      runRoot,
      pid: processRef?.pid,
      startedAt,
      endedAt,
      exitCode,
      exitSignal,
      liveStdoutBytes,
      liveStderrBytes,
      lastActivityMsAgo: Math.max(0, Date.now() - lastActivityAt),
      uptimeMs: Math.max(0, Date.now() - startTime),
      contentPreview: transcript.getContent().split("\n").slice(-12).join("\n"),
      transcriptLineCount: transcript.getContent().split("\n").filter(Boolean).length
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      transcript.focus();
    };
    frame.frame.key(["space", "n"], () => startBackrooms());
    this.windowManager.registerWindow(frame);
    frame.focus();
    startBackrooms();
  }

  private openPrimerBrowserWindow(restore?: { selectedIndex?: number }): void {
    const entries = this.content.collectPrimerEntries();
    if (entries.length === 0) {
      this.overlays.flash("No primer files found in modules, modules-private, or docs.");
      return;
    }
    const frame = this.windowManager.createFrame("Primer Browser", "browser");
    blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      content: " Enter opens file  j/k scroll  Esc closes menu ",
      style: { fg: "black", bg: "cyan" }
    });
    const list = blessed.list({
      parent: frame.body,
      top: 1,
      left: 0,
      right: 0,
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      items: entries.map((entry) => entry.label),
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    const initialSelectedIndex = Math.max(0, Math.min(restore?.selectedIndex ?? 0, entries.length - 1));
    const openSelected = (index?: number) => {
      const itemIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const entry = entries[itemIndex];
      if (entry) {
        this.openPrimerWindow(entry.filePath);
      }
    };
    list.on("select", (_, index) => openSelected(index));
    list.on("keypress", (_, key) => {
      if (key.name === "enter") {
        openSelected();
      }
    });
    frame.kind = "browser";
    frame.describeState = () => ({
      appType: "primer-browser",
      summary: `Primer browser listing ${entries.length} entries.`,
      selectedIndex: (list as List & { selected: number }).selected ?? 0,
      selectedLabel: entries[(list as List & { selected: number }).selected ?? 0]?.label,
      entryCount: entries.length
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      list.focus();
    };
    this.windowManager.registerWindow(frame);
    list.select(initialSelectedIndex);
    frame.focus();
  }

  private openPrimerGalleryWindow(restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number }): void {
    const allEntries = this.content.collectGalleryEntries();
    if (allEntries.length === 0) {
      this.overlays.flash("No gallery entries available.");
      return;
    }
    const tabs = this.content.buildGalleryTabs(allEntries);
    const frame = this.windowManager.createFrame("Primer Gallery", "gallery");
    const tabBar = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: "black", bg: "white" }
    });
    const filterBox = blessed.textbox({
      parent: frame.body,
      top: 1,
      left: 0,
      width: "34%",
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "black", bg: "cyan" }
    });
    const list = blessed.list({
      parent: frame.body,
      top: 2,
      left: 0,
      width: "34%",
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      items: tabs[0].entries.map((entry) => entry.label),
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    const preview = blessed.box({
      parent: frame.body,
      top: 1,
      left: "34%",
      right: 0,
      bottom: 0,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    });

    let activeTabIndex = Math.max(0, Math.min(restore?.activeTabIndex ?? 0, tabs.length - 1));
    let activeEntries = tabs[activeTabIndex].entries;
    let searchValue = restore?.searchValue ?? "";

    const updatePreview = (index: number) => {
      const entry = activeEntries[index];
      if (!entry) {
        preview.setContent("No primer selected.");
        this.screen.render();
        return;
      }
      try {
        const content = fs.readFileSync(entry.filePath, "utf8");
        preview.setContent(`${tabs[activeTabIndex].label} :: ${entry.label}\n${entry.filePath}\n\n${content}`);
      } catch (error) {
        preview.setContent(`Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`);
      }
      this.screen.render();
    };
    const openSelected = (index?: number) => {
      const currentIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const entry = activeEntries[currentIndex];
      if (entry) {
        this.openPrimerWindow(entry.filePath);
      }
    };
    const renderTabs = () => {
      tabBar.children.forEach((child) => child.destroy());
      let left = 0;
      tabs.forEach((tabConfig, index) => {
        const tabNode = blessed.box({
          parent: tabBar,
          top: 0,
          left,
          height: 1,
          width: tabConfig.label.length + 2,
          mouse: true,
          clickable: true,
          content: ` ${tabConfig.label} `,
          style: { fg: index === activeTabIndex ? "white" : "black", bg: index === activeTabIndex ? "blue" : "white" }
        });
        tabNode.on("click", () => switchTab(index));
        left += tabConfig.label.length + 2;
      });
    };
    const applySearch = () => {
      activeEntries = allEntries.filter((entry) => entry.label.toLowerCase().includes(searchValue.toLowerCase()));
      list.setItems(activeEntries.map((entry) => entry.label));
      list.select(0);
      updatePreview(0);
      this.screen.render();
    };
    const switchTab = (index: number) => {
      activeTabIndex = index;
      activeEntries = tabs[index].entries;
      list.setItems(activeEntries.map((entry) => entry.label));
      list.select(0);
      filterBox.setValue(index === 5 ? searchValue : ` ${tabs[index].label} `);
      renderTabs();
      updatePreview(0);
      if (index === 5) {
        filterBox.focus();
        filterBox.readInput();
      } else {
        list.focus();
      }
      this.screen.render();
    };

    list.on("select item", (_, index) => updatePreview(index));
    list.on("keypress", (_, key) => {
      if (key.name === "enter") {
        openSelected();
      } else if (["up", "down", "j", "k"].includes(key.name ?? "")) {
        setTimeout(() => updatePreview((list as List & { selected: number }).selected ?? 0), 0);
      } else if (key.name === "left") {
        switchTab((activeTabIndex - 1 + tabs.length) % tabs.length);
      } else if (key.name === "right") {
        switchTab((activeTabIndex + 1) % tabs.length);
      }
    });
    list.on("select", (_, index) => openSelected(index));
    filterBox.on("submit", (value) => {
      searchValue = (value ?? "").trim();
      applySearch();
      filterBox.focus();
      filterBox.readInput();
    });

    renderTabs();
    list.select(0);
    updatePreview(0);
    frame.kind = "gallery";
    frame.describeState = () => ({
      appType: "primer-gallery",
      summary: `Primer gallery with ${allEntries.length} total entries.`,
      activeTabIndex,
      activeTab: tabs[activeTabIndex]?.label,
      searchValue,
      selectedIndex: (list as List & { selected: number }).selected ?? 0,
      visibleEntryCount: activeEntries.length,
      selectedLabel: activeEntries[(list as List & { selected: number }).selected ?? 0]?.label,
      contentPreview: preview.getContent().split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      if (activeTabIndex === 5) {
        filterBox.focus();
        filterBox.readInput();
      } else {
        list.focus();
      }
    };
    this.windowManager.registerWindow(frame);
    if (activeTabIndex === 5) {
      filterBox.setValue(searchValue);
      applySearch();
      list.select(Math.max(0, Math.min(restore?.selectedIndex ?? 0, Math.max(0, activeEntries.length - 1))));
      updatePreview((list as List & { selected: number }).selected ?? 0);
    } else {
      switchTab(activeTabIndex);
      list.select(Math.max(0, Math.min(restore?.selectedIndex ?? 0, Math.max(0, activeEntries.length - 1))));
      updatePreview((list as List & { selected: number }).selected ?? 0);
    }
    frame.focus();
  }

  private openBrowserReaderWindow(filePath = MASTER_PHILOSOPHY_PATH): void {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      this.openTextViewerWindow(`Browser: ${path.basename(filePath)}`, `Location: ${filePath}\n\n${content}`, "reader", filePath);
    } catch (error) {
      this.overlays.flash(`Cannot open browser reader: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private promptForFigletText(): void {
    this.overlays.openValuePrompt("Figlet Text", "WIB WOB", (value) => this.openFigletFontPicker(value, getDefaultFigletFont()));
  }

  private openFigletFontPicker(text: string, currentFont: string, onSelect?: (font: string) => void): void {
    const choices = getFigletFontChoices();
    const initialIndex = Math.max(0, choices.findIndex((choice) => choice.value === currentFont));
    this.overlays.openListPrompt("FIGlet Font Picker", choices, initialIndex, (item) => {
      if (onSelect) {
        onSelect(item.value);
        return;
      }
      this.openFigletWindow(text, item.value);
    });
  }

  private openFigletWindow(text: string, initialFont = getDefaultFigletFont()): void {
    const title = `Banner: ${text.slice(0, 18) || "Banner"}`;
    const frame = this.windowManager.createFrame(title, "figlet");
    const toolbar = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      style: { fg: "black", bg: "cyan" }
    });
    const viewer = blessed.box({
      parent: frame.body,
      top: 2,
      left: 0,
      right: 0,
      bottom: 0,
      mouse: true,
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    });

    let currentText = text;
    let currentFont = initialFont;
    let lastMeasurement = measureFiglet(currentText, currentFont, 0);

    const syncTitle = () => {
      frame.title = `Banner: ${currentText.slice(0, 18) || "Banner"}`;
      frame.titleBar?.setContent(` ${frame.title} `);
    };

    const rerenderFiglet = () => {
      const availableWidth = Math.max(20, Number(viewer.width));
      const measured = measureFiglet(currentText, currentFont, availableWidth);
      lastMeasurement = measured;
      viewer.setContent(measured.rendered);
      const catalogue = getFigletCatalogue();
      const meta = catalogue.fontMetadata[currentFont];
      toolbar.setContent(
        ` Text: ${currentText}\n Font: ${currentFont}${meta ? ` (${meta.height}h x ${meta.width}w)` : ""}  e edit text  f pick font `
      );
      syncTitle();
      this.syncState();
      this.screen.render();
    };

    const editText = () => {
      this.overlays.openValuePrompt("Edit FIGlet Text", currentText, (value) => {
        currentText = value;
        rerenderFiglet();
      });
    };

    const pickFont = () => {
      this.openFigletFontPicker(currentText, currentFont, (font) => {
        currentFont = font;
        rerenderFiglet();
      });
    };

    frame.kind = "figlet";
    frame.describeState = () => ({
      appType: "figlet-banner",
      summary: "Rendered figlet banner window using the shared WibWob font catalogue.",
      inputText: currentText,
      font: currentFont,
      lineCount: lastMeasurement.height,
      contentWidth: lastMeasurement.width,
      contentHeight: lastMeasurement.height,
      contentPreview: viewer.getContent().split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      viewer.focus();
    };

    frame.frame.key(["e"], editText);
    frame.frame.key(["f"], pickFont);
    viewer.key(["e"], editText);
    viewer.key(["f"], pickFont);
    frame.frame.on("resize", rerenderFiglet);

    this.windowManager.registerWindow(frame);
    frame.focus();
    rerenderFiglet();

    const measured = measureFiglet(currentText, currentFont, 0);
    lastMeasurement = measured;
    const oneRowHeight = measured.fontHeight > 0 && measured.height > measured.fontHeight ? measured.fontHeight : measured.height;
    this.applyMeasuredWindowSize(frame, "figlet", {
      width: Math.max(measured.width, 32),
      height: Math.max(oneRowHeight, 5)
    });
  }

  private openPatternWindow(): void {
    this.openAnimatedWindow("Pattern Field", "pattern", (tick, width, height) => {
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
    });
  }

  private openOrbitWindow(): void {
    this.openAnimatedWindow("Orbit Engine", "orbit", (tick, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rows: string[] = [];
      for (let y = 0; y < height; y += 1) {
        let row = "";
        for (let x = 0; x < width; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) + tick / 10;
          const wave = Math.sin(dist / 2 - tick / 4) + Math.cos(angle * 3);
          row += wave > 1 ? "@" : wave > 0.5 ? "*" : wave > 0 ? "+" : wave > -0.5 ? "." : " ";
        }
        rows.push(row);
      }
      return rows.join("\n");
    });
  }

  private openGlitchWindow(): void {
    let source = "No source loaded.";
    try {
      source = fs.readFileSync(README_PATH, "utf8");
    } catch {
      source = "WibWob-DOS glitch engine source unavailable.";
    }
    const lines = source.split("\n").slice(0, 24);
    this.openAnimatedWindow("Glitch FX", "glitch", (tick) =>
      lines
        .map((line, index) =>
          line.split("").map((char, column) => {
            const value = (tick + index + column) % 17;
            return value === 0 ? "#" : value === 3 ? "@" : value === 7 ? "%" : char;
          }).join("")
        )
        .join("\n")
    );
  }

  private openChatWindow(restore?: { transcriptLines?: string[]; draft?: string }): void {
    const frame = this.windowManager.createFrame("Wib & Wob Chat", "chat");
    const transcript = blessed.log({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 1,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    }) as LogBox;
    const input = blessed.textbox({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "white", bg: "blue" }
    });
    const armChatInput = () => {
      input.focus();
      input.readInput();
      this.screen.render();
    };
    const initialLines = restore?.transcriptLines ?? [
      "Wib: A new desktop blooms.",
      "Wob: Systems nominal. Awaiting prompt."
    ];
    for (const line of initialLines) {
      transcript.log(line);
    }
    if (restore?.draft) {
      input.setValue(restore.draft);
    }
    input.on("submit", (value) => {
      const message = (value ?? "").trim();
      input.clearValue();
      if (!message) {
        armChatInput();
        return;
      }
      transcript.log(`You: ${message}`);
      transcript.log(`Wib: ${makeWibReply(message)}`);
      transcript.log(`Wob: ${makeWobReply(message)}`);
      this.screen.render();
      armChatInput();
    });
    frame.kind = "chat";
    frame.chat = { transcript, input };
    frame.describeState = () => ({
      appType: "chat-transcript",
      summary: "Synthetic Wib and Wob chat transcript.",
      contentPreview: transcript.getContent().split("\n").slice(-8).join("\n"),
      transcriptLineCount: transcript.getContent().split("\n").filter(Boolean).length,
      inputValue: input.getValue()
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      armChatInput();
    };
    frame.body.on("click", armChatInput);
    transcript.on("click", armChatInput);
    input.on("focus", () => this.windowManager.focusWindow(frame));
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openCompanionWindow(restore?: { tick?: number }): void {
    const frame = this.windowManager.createFrame("Scramble", "companion");
    frame.frame.width = 30;
    frame.frame.height = 10;
    const bubble = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      style: { fg: "white", bg: "black" }
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
      this.screen.render();
      tick += 1;
    };
    renderCompanion();
    frame.kind = "companion";
    frame.describeState = () => ({
      appType: "companion-widget",
      summary: "Animated scramble companion.",
      contentPreview: bubble.getContent(),
      tick
    });
    frame.cleanup = () => clearInterval(timer);
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      bubble.focus();
    };
    const timer = setInterval(renderCompanion, 2400);
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openWorkspaceManagerWindow(): void {
    const frame = this.windowManager.createFrame("Workspace Manager", "workspace");
    const footer = blessed.box({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      style: { fg: "black", bg: "cyan" }
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
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    const refreshFooter = () => {
      const names = this.workspace.list();
      footer.setContent(
        ` Current: ${this.workspace.currentName}\n File: ${this.workspace.path}\n Known: ${names.length > 0 ? names.join(", ") : "none"}`
      );
    };
    const actions = [
      () => this.saveWorkspace(),
      () => this.promptForWorkspaceSave(),
      () => this.promptForWorkspaceLoad(),
      () => this.windowManager.cascadeWindows(),
      () => this.windowManager.tileWindows(),
      () => this.openCommandPaletteWindow()
    ];
    list.on("select", (_, index) => actions[index]?.());
    refreshFooter();
    frame.kind = "workspace";
    frame.describeState = () => ({
      appType: "workspace-manager",
      summary: "Workspace save/load command window.",
      selectedAction: list.getItem((list as List & { selected: number }).selected ?? 0)?.getText().trim(),
      workspaceName: this.workspace.currentName,
      workspacePath: this.workspace.path,
      knownWorkspaces: this.workspace.list()
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      list.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openCommandPaletteWindow(): void {
    const commands = this.getPaletteCommands();
    const frame = this.windowManager.createFrame("Command Palette", "palette");
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
      scrollbar: this.createScrollbar(),
      items: commands.map((command) => command.label),
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    list.on("select", (_, index) => commands[index]?.action());
    frame.kind = "palette";
    frame.describeState = () => ({
      appType: "command-palette",
      summary: `Command palette with ${commands.length} actions.`,
      selectedCommand: commands[(list as List & { selected: number }).selected ?? 0]?.label,
      commandCount: commands.length
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      list.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private promptForPrimer(): void {
    this.overlays.openFileBrowserPrompt("Open Primer", REPO_ROOT, (filePath) => this.openPrimerWindow(filePath), {
      fileFilter: (filePath, isDirectory) => isDirectory || this.content.isTextLikeFile(path.basename(filePath)),
      previewLimit: 5000
    });
  }

  private promptForEditorPath(): void {
    this.overlays.openFileBrowserPrompt("Open Text File", path.dirname(SPIKE_NOTES_PATH), (filePath) => {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        this.openEditorWindow(filePath, path.basename(filePath), content);
      } catch (error) {
        this.overlays.flash(`Cannot open text file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, {
      fileFilter: (filePath, isDirectory) => isDirectory || this.content.isTextLikeFile(path.basename(filePath)),
      previewLimit: 5000
    });
  }

  private openPrimerWindow(filePath: string): void {
    try {
      const rawContent = fs.readFileSync(filePath, "utf8");
      const measured = measurePrimerContent(rawContent);
      this.openTextViewerWindow(path.basename(filePath), measured.primaryFrameText, "primer", filePath, {
        contentMeasurement: {
          contentWidth: measured.measurement.columnWidth,
          contentHeight: measured.measurement.lineCount,
          recommendedWidth: measured.measurement.recommendedWidth,
          recommendedHeight: measured.measurement.recommendedHeight,
          animated: measured.measurement.animated,
          frameCount: measured.measurement.frameCount,
          skippedCommentLines: measured.measurement.skippedCommentLines
        }
      });
    } catch (error) {
      this.overlays.flash(`Cannot open primer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private openEditorWindow(filePath?: string, title = "Untitled.txt", initial = "", restore?: { cursor?: number }): void {
    const frame = this.windowManager.createFrame(title, "editor");
    const editorWidget = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      keys: true,
      mouse: true,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    });
    frame.kind = "editor";
    frame.filePath = filePath;
    frame.editor = { widget: editorWidget, value: initial, cursor: Math.max(0, Math.min(restore?.cursor ?? initial.length, initial.length)) };
    frame.describeState = () => ({
      appType: "text-editor",
      summary: filePath ? `Editing ${filePath}` : "Unsaved text buffer.",
      filePath: frame.filePath,
      lineCount: frame.editor?.value.split("\n").length ?? 0,
      cursor: frame.editor?.cursor ?? 0,
      contentPreview: (frame.editor?.value ?? "").split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      editorWidget.focus();
    };
    this.renderEditor(frame);
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openArtWindow(): void {
    const frame = this.windowManager.createFrame("Generative Art", "art");
    const canvas = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      style: { fg: "white", bg: "black" }
    });
    let tick = 0;
    const renderArt = () => {
      const width = Math.max(12, Number(canvas.width));
      const height = Math.max(6, Number(canvas.height));
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
      canvas.setContent(rows.join("\n"));
      this.screen.render();
      tick += 1;
    };
    renderArt();
    const timer = setInterval(renderArt, 100);
    frame.kind = "art";
    frame.describeState = () => ({
      appType: "generative-art",
      summary: "Animated procedural art field.",
      contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
      tick
    });
    frame.cleanup = () => clearInterval(timer);
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      canvas.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private saveFocusedEditor(): void {
    const focused = this.windowManager.getFocusedWindow();
    if (!focused || focused.kind !== "editor" || !focused.editor) {
      this.overlays.flash("Focused window is not an editor.");
      return;
    }
    this.saveEditor(focused);
  }

  private saveEditor(window: WindowRecord): void {
    if (!window.editor) {
      return;
    }
    if (!window.filePath) {
      this.overlays.openPathPrompt("Save Text File Path", path.join(SPIKE_ROOT, window.title), (value) => this.content.completePath(value), (value) => {
        const resolved = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
        window.filePath = resolved;
        window.title = path.basename(resolved);
        this.writeEditor(window);
      });
      return;
    }
    this.writeEditor(window);
  }

  private writeEditor(window: WindowRecord): void {
    if (!window.editor || !window.filePath) {
      return;
    }
    fs.mkdirSync(path.dirname(window.filePath), { recursive: true });
    fs.writeFileSync(window.filePath, window.editor.value, "utf8");
    window.title = path.basename(window.filePath);
    window.titleBar?.setContent(` ${window.title} `);
    this.syncState();
    this.overlays.flash(`Saved ${window.filePath}`);
  }

  private handleFocusedEditorKeypress(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {
    const window = this.windowManager.getFocusedWindow();
    if (!window || window.kind !== "editor" || !window.editor) {
      return;
    }
    if (this.menuList || this.screen.focused !== window.editor.widget) {
      return;
    }
    if (key.ctrl && key.name === "s") {
      this.saveEditor(window);
      return;
    }
    if (key.full === "S-tab") {
      this.windowManager.focusNextWindow(-1);
      return;
    }
    if (key.name === "backspace") {
      this.deleteEditorBackward(window);
      return;
    }
    if (key.name === "delete") {
      this.deleteEditorForward(window);
      return;
    }
    if (key.name === "left") {
      window.editor.cursor = Math.max(0, window.editor.cursor - 1);
      this.renderEditor(window);
      return;
    }
    if (key.name === "right") {
      window.editor.cursor = Math.min(window.editor.value.length, window.editor.cursor + 1);
      this.renderEditor(window);
      return;
    }
    if (key.name === "enter") {
      this.insertEditorText(window, "\n");
      return;
    }
    if (ch && !key.ctrl && !key.meta) {
      this.insertEditorText(window, ch);
    }
  }

  private handleFocusedTerminalKeypress(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {
    const window = this.windowManager.getFocusedWindow();
    if (!window || window.kind !== "terminal" || window.terminal?.mode !== "xterm-bridge" || !window.writeInput) {
      return;
    }
    if (this.menuList || this.popupMenu) {
      return;
    }
    if (key.ctrl && key.name === "q") {
      return;
    }
    if (key.full === "S-tab") {
      return;
    }
    if (key.meta) {
      return;
    }
    if (key.name === "pageup") {
      window.terminal.scrollViewport?.(-8);
      return;
    }
    if (key.name === "pagedown") {
      window.terminal.scrollViewport?.(8);
      return;
    }
    const escapeSequences: Record<string, string> = {
      up: "\u001b[A",
      down: "\u001b[B",
      right: "\u001b[C",
      left: "\u001b[D",
      home: "\u001b[H",
      end: "\u001b[F",
      delete: "\u001b[3~",
      pageup: "\u001b[5~",
      pagedown: "\u001b[6~"
    };
    if (key.name === "enter") {
      window.writeInput("\r");
      return;
    }
    if (key.name === "backspace") {
      window.writeInput("\u007f");
      return;
    }
    if (key.name === "tab") {
      window.writeInput("\t");
      return;
    }
    if (key.name && escapeSequences[key.name]) {
      window.writeInput(escapeSequences[key.name]);
      return;
    }
    if (typeof key.sequence === "string" && key.sequence.length > 0) {
      window.writeInput(key.sequence);
      return;
    }
    if (ch && !key.meta) {
      window.writeInput(ch);
    }
  }

  private insertEditorText(window: WindowRecord, text: string): void {
    if (!window.editor) {
      return;
    }
    const { value, cursor } = window.editor;
    window.editor.value = `${value.slice(0, cursor)}${text}${value.slice(cursor)}`;
    window.editor.cursor += text.length;
    this.renderEditor(window);
  }

  private deleteEditorBackward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor === 0) {
      return;
    }
    const { value, cursor } = window.editor;
    window.editor.value = `${value.slice(0, cursor - 1)}${value.slice(cursor)}`;
    window.editor.cursor -= 1;
    this.renderEditor(window);
  }

  private deleteEditorForward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor >= window.editor.value.length) {
      return;
    }
    const { value, cursor } = window.editor;
    window.editor.value = `${value.slice(0, cursor)}${value.slice(cursor + 1)}`;
    this.renderEditor(window);
  }

  private renderEditor(window: WindowRecord): void {
    if (!window.editor) {
      return;
    }
    const { widget, value, cursor } = window.editor;
    const before = this.escapeTags(value.slice(0, cursor));
    const atCursor = value[cursor] ?? " ";
    const after = this.escapeTags(value.slice(cursor + 1));
    widget.setContent(`${before}{inverse}${this.escapeTags(atCursor)}{/inverse}${after}`);
    widget.setScrollPerc(100);
    this.syncState();
    this.screen.render();
  }

  private escapeTags(value: string): string {
    return value.replace(/[{}]/g, "\\$&");
  }

  private resolveShellPath(): string {
    for (const candidate of [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"]) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return "/bin/sh";
  }

  private getPtyEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
    env.TERM = env.TERM || "xterm-256color";
    env.COLORTERM = env.COLORTERM || "truecolor";
    return env;
  }

  private createScrollbar(): { ch: string; style: { bg: string } } {
    return { ch: " ", style: { bg: "white" } };
  }

  private applyMeasuredWindowSize(frame: WindowRecord, kind: WindowKind, content: { width: number; height: number }): void {
    const target = contentToWindowSize(content, getChromeModeForWindow(kind));
    const geometry = this.geometry.getGeometry();
    this.windowManager.resizeWindow(
      frame.id,
      Math.min(Math.max(target.width, 24), Math.max(24, geometry.width - Number(frame.frame.left))),
      Math.min(Math.max(target.height, 8), Math.max(8, geometry.height - 1 - Number(frame.frame.top)))
    );
  }

  private openTextViewerWindow(
    title: string,
    content: string,
    kind: WindowKind,
    filePath?: string,
    options?: {
      contentMeasurement?: {
        contentWidth: number;
        contentHeight: number;
        recommendedWidth: number;
        recommendedHeight: number;
        animated?: boolean;
        frameCount?: number;
        skippedCommentLines?: number;
      };
    }
  ): void {
    const frame = this.windowManager.createFrame(title, kind);
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
      scrollbar: this.createScrollbar(),
      content,
      style: { fg: "white", bg: "black" }
    });
    frame.kind = kind;
    frame.filePath = filePath;
    const fallbackMeasurement = options?.contentMeasurement ? undefined : measurePlainTextContent(content).measurement;
    const measuredWidth = options?.contentMeasurement?.contentWidth ?? fallbackMeasurement?.columnWidth ?? 0;
    const measuredHeight = options?.contentMeasurement?.contentHeight ?? fallbackMeasurement?.lineCount ?? 0;
    frame.describeState = () => ({
      appType: `${kind}-viewer`,
      summary: filePath ? `Viewing ${filePath}` : `Viewing ${kind} content.`,
      filePath,
      lineCount: measuredHeight,
      contentWidth: measuredWidth,
      contentHeight: measuredHeight,
      recommendedWidth: options?.contentMeasurement?.recommendedWidth,
      recommendedHeight: options?.contentMeasurement?.recommendedHeight,
      animated: options?.contentMeasurement?.animated,
      frameCount: options?.contentMeasurement?.frameCount,
      skippedCommentLines: options?.contentMeasurement?.skippedCommentLines,
      contentPreview: content.split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      viewer.focus();
    };
    this.windowManager.registerWindow(frame);
    if (options?.contentMeasurement) {
      this.applyMeasuredWindowSize(frame, kind, {
        width: options.contentMeasurement.contentWidth,
        height: options.contentMeasurement.contentHeight
      });
    }
    frame.focus();
  }

  private openAnimatedWindow(
    title: string,
    kind: WindowKind,
    renderFrame: (tick: number, width: number, height: number) => string
  ): void {
    const frame = this.windowManager.createFrame(title, kind);
    const canvas = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      style: { fg: "white", bg: "black" }
    });
    let tick = 0;
    const render = () => {
      canvas.setContent(renderFrame(tick, Math.max(12, Number(canvas.width)), Math.max(6, Number(canvas.height))));
      this.screen.render();
      tick += 1;
    };
    render();
    const timer = setInterval(render, 120);
    frame.kind = kind;
    frame.describeState = () => ({
      appType: `${kind}-animation`,
      summary: `Animated ${kind} window.`,
      contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n")
    });
    frame.cleanup = () => clearInterval(timer);
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      canvas.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openStateInspectorWindow(): void {
    const frame = this.windowManager.createFrame("State Inspector", "inspector");
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
      scrollbar: this.createScrollbar(),
      style: { fg: "white", bg: "black" }
    });
    const renderState = (state: DesktopState) => {
      viewer.setContent(JSON.stringify(state, null, 2));
      this.screen.render();
    };
    const unsubscribe = this.state.subscribe(renderState);
    frame.kind = "inspector";
    frame.describeState = () => ({
      appType: "state-inspector",
      summary: "Live JSON desktop state inspector.",
      contentPreview: viewer.getContent().split("\n").slice(0, 12).join("\n"),
      statePath: STATE_PATH
    });
    frame.cleanup = () => unsubscribe();
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      viewer.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private saveWorkspace(): void {
    const focusedId = this.windowManager.getFocusedWindow()?.id;
    const snapshots: WindowSnapshot[] = this.windowManager
      .getWindows()
      .filter((window) => window.kind !== "workspace" && window.kind !== "palette")
      .map((window) => this.serializeWindowSnapshot(window, focusedId));
    this.workspace.save(snapshots);
    this.overlays.flash(`Saved workspace to ${this.workspace.path}`);
  }

  saveWorkspaceNamed(name: string): void {
    this.workspace.setCurrentWorkspaceName(name);
    this.saveWorkspace();
  }

  private promptForWorkspaceSave(): void {
    this.overlays.openValuePrompt("Save Workspace As", this.workspace.currentName, (value) => {
      this.workspace.setCurrentWorkspaceName(value);
      this.saveWorkspace();
      this.syncState();
    });
  }

  private promptForWorkspaceLoad(): void {
    const names = this.workspace.list();
    if (names.length === 0) {
      this.overlays.flash(`No saved workspaces found in ${WORKSPACES_DIR}`);
      return;
    }
    const items = names.map((name) => ({
      label: `${name}${name === this.workspace.currentName ? " (current)" : ""}`,
      value: name,
      preview: `${path.join(WORKSPACES_DIR, `${name}.json`)}\n\n${fs.readFileSync(path.join(WORKSPACES_DIR, `${name}.json`), "utf8")}`,
      searchText: name
    }));
    const initialIndex = Math.max(0, names.findIndex((name) => name === this.workspace.currentName));
    this.overlays.openBrowserPrompt("Load Workspace", items, initialIndex, (item) => {
      this.workspace.setCurrentWorkspaceName(item.value);
      this.loadWorkspace();
    });
  }

  loadWorkspaceNamed(name: string): void {
    this.workspace.setCurrentWorkspaceName(name);
    this.loadWorkspace();
  }

  private loadWorkspace(): void {
    if (!this.workspace.exists()) {
      this.overlays.flash(`Workspace file not found: ${this.workspace.path}`);
      return;
    }
    let snapshots: WindowSnapshot[] = [];
    try {
      snapshots = this.workspace.load();
    } catch (error) {
      this.overlays.flash(`Cannot parse workspace: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    for (const window of this.windowManager.getWindows()) {
      if (window.kind !== "workspace") {
        window.close();
      }
    }
    let focusedWindow: WindowRecord | undefined;
    for (const snapshot of snapshots) {
      const restored = this.restoreWindowSnapshot(snapshot);
      if (snapshot.focused) {
        focusedWindow = restored;
      }
    }
    focusedWindow?.focus();
    this.syncState();
    this.overlays.flash(`Loaded workspace from ${this.workspace.path}`);
  }

  private restoreWindowSnapshot(snapshot: WindowSnapshot): WindowRecord | undefined {
    const payload = snapshot.payload ?? {};
    switch (snapshot.kind) {
      case "primer":
        if (snapshot.filePath) this.openPrimerWindow(snapshot.filePath);
        break;
      case "editor":
        this.openEditorWindow(
          snapshot.filePath,
          snapshot.title,
          typeof payload.content === "string"
            ? payload.content
            : snapshot.filePath && fs.existsSync(snapshot.filePath)
              ? fs.readFileSync(snapshot.filePath, "utf8")
              : "",
          { cursor: typeof payload.cursor === "number" ? payload.cursor : undefined }
        );
        break;
      case "reader":
        this.openBrowserReaderWindow(snapshot.filePath);
        break;
      case "figlet":
        this.openFigletWindow(
          typeof payload.inputText === "string" ? payload.inputText : snapshot.title.replace(/^Banner:\s*/, ""),
          typeof payload.font === "string" ? payload.font : getDefaultFigletFont()
        );
        break;
      case "pattern":
        this.openPatternWindow();
        break;
      case "orbit":
        this.openOrbitWindow();
        break;
      case "glitch":
        this.openGlitchWindow();
        break;
      case "chat":
        this.openChatWindow({
          transcriptLines: Array.isArray(payload.transcriptLines) ? payload.transcriptLines.filter((line): line is string => typeof line === "string") : undefined,
          draft: typeof payload.draft === "string" ? payload.draft : undefined
        });
        break;
      case "gallery":
        this.openPrimerGalleryWindow({
          activeTabIndex: typeof payload.activeTabIndex === "number" ? payload.activeTabIndex : undefined,
          searchValue: typeof payload.searchValue === "string" ? payload.searchValue : undefined,
          selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined
        });
        break;
      case "browser":
        this.openPrimerBrowserWindow({
          selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined
        });
        break;
      case "terminal":
        if (payload.appType === "xterm-shell") {
          void this.openXTermShellWindow();
        } else if (payload.appType === "pi-chat") {
          void this.openPiChatWindow();
        } else {
          void this.openTerminalWindow();
        }
        break;
      case "backrooms":
        this.openBackroomsTv({
          theme: typeof payload.theme === "string" ? payload.theme : "liminal fluorescent maze",
          primers: typeof payload.primers === "string" ? payload.primers : "",
          turns: typeof payload.turns === "number" ? payload.turns : 3,
          model:
            payload.model === "haiku" || payload.model === "opus" || payload.model === "sonnet"
              ? payload.model
              : "sonnet",
          mode:
            payload.mode === "live" || payload.mode === "fake-live" || payload.mode === "auto"
              ? payload.mode
              : "auto"
        });
        break;
      case "companion":
        this.openCompanionWindow({
          tick: typeof payload.tick === "number" ? payload.tick : undefined
        });
        break;
      case "art":
        this.openArtWindow();
        break;
      case "inspector":
        this.openStateInspectorWindow();
        break;
      default:
        break;
    }
    const restored = this.windowManager.getWindows().at(-1);
    if (restored) {
      restored.frame.left = snapshot.left;
      restored.frame.top = snapshot.top;
      restored.frame.width = snapshot.width;
      restored.frame.height = snapshot.height;
    }
    return restored;
  }

  private serializeWindowSnapshot(window: WindowRecord, focusedId?: number): WindowSnapshot {
    return {
      kind: window.kind,
      title: window.title,
      left: Number(window.frame.left),
      top: Number(window.frame.top),
      width: Number(window.frame.width),
      height: Number(window.frame.height),
      filePath: window.filePath,
      focused: window.id === focusedId,
      payload: this.buildWindowSnapshotPayload(window)
    };
  }

  private buildWindowSnapshotPayload(window: WindowRecord): Record<string, unknown> | undefined {
    switch (window.kind) {
      case "editor":
        return window.editor
          ? {
              content: window.editor.value,
              cursor: window.editor.cursor
            }
          : undefined;
      case "browser": {
        const details = window.describeState?.();
        return {
          selectedIndex: typeof details?.selectedIndex === "number" ? details.selectedIndex : 0
        };
      }
      case "gallery": {
        const details = window.describeState?.();
        return {
          activeTabIndex: typeof details?.activeTabIndex === "number" ? details.activeTabIndex : 0,
          searchValue: typeof details?.searchValue === "string" ? details.searchValue : "",
          selectedIndex: typeof details?.selectedIndex === "number" ? details.selectedIndex : 0
        };
      }
      case "figlet": {
        const details = window.describeState?.();
        return {
          inputText: typeof details?.inputText === "string" ? details.inputText : window.title.replace(/^Banner:\s*/, ""),
          font: typeof details?.font === "string" ? details.font : getDefaultFigletFont()
        };
      }
      case "chat":
        return window.chat
          ? {
              transcriptLines: window.chat.transcript.getContent().split("\n").filter(Boolean),
              draft: window.chat.input.getValue()
            }
          : undefined;
      case "backrooms": {
        const details = window.describeState?.();
        return {
          theme: typeof details?.theme === "string" ? details.theme : "liminal fluorescent maze",
          primers: typeof details?.primers === "string" ? details.primers : "",
          turns: typeof details?.turns === "number" ? details.turns : 3,
          model:
            details?.model === "haiku" || details?.model === "opus" || details?.model === "sonnet"
              ? details.model
              : "sonnet",
          mode:
            details?.requestedMode === "live" || details?.requestedMode === "fake-live" || details?.requestedMode === "auto"
              ? details.requestedMode
              : "auto"
        };
      }
      case "terminal": {
        const details = window.describeState?.();
        return {
          appType: typeof details?.appType === "string" ? details.appType : "terminal-shell"
        };
      }
      case "companion": {
        const details = window.describeState?.();
        return {
          tick: typeof details?.tick === "number" ? details.tick : 0
        };
      }
      default:
        return undefined;
    }
  }

  private getPaletteCommands(): Array<{ label: string; action: () => void }> {
    return [
      { label: "Open Backrooms TV", action: () => this.promptForBackroomsTv() },
      { label: "Open Primer Gallery", action: () => this.openPrimerGalleryWindow() },
      { label: "Open Browser Reader", action: () => this.openBrowserReaderWindow() },
      { label: "Open Figlet Banner", action: () => this.promptForFigletText() },
      { label: "Open Pattern Window", action: () => this.openPatternWindow() },
      { label: "Open Orbit Window", action: () => this.openOrbitWindow() },
      { label: "Open Glitch FX Window", action: () => this.openGlitchWindow() },
      { label: "Open Chat Transcript", action: () => this.openChatWindow() },
      { label: "Open Companion Window", action: () => this.openCompanionWindow() },
      { label: "Open Workspace Manager", action: () => this.openWorkspaceManagerWindow() },
      { label: "Save Workspace As...", action: () => this.promptForWorkspaceSave() },
      { label: "Load Workspace...", action: () => this.promptForWorkspaceLoad() },
      { label: "Open State Inspector", action: () => this.openStateInspectorWindow() },
      { label: "Save Workspace", action: () => this.saveWorkspace() },
      { label: "Load Workspace", action: () => this.loadWorkspace() },
      { label: "Tile Windows", action: () => this.windowManager.tileWindows() },
      { label: "Cascade Windows", action: () => this.windowManager.cascadeWindows() },
      { label: "Open Terminal", action: () => void this.openTerminalWindow() },
      { label: "Open XTerm Shell", action: () => void this.openXTermShellWindow() },
      { label: "Open Pi Chat", action: () => void this.openPiChatWindow() }
    ];
  }

  getDesktopState(): DesktopState {
    return this.state.getState();
  }

  getPrimerInfo(pathOrName: string): Record<string, unknown> {
    const entry = this.content.getPrimerInfo(pathOrName);
    if (!entry) {
      return { ok: false, path: pathOrName, error: "Primer not found" };
    }
    return {
      ok: true,
      path: entry.filePath,
      name: entry.label,
      content_width: entry.metadata?.contentWidth ?? 0,
      content_lines: entry.metadata?.contentHeight ?? 0,
      recommended_w: entry.metadata?.recommendedWidth ?? 0,
      recommended_h: entry.metadata?.recommendedHeight ?? 0,
      animated: entry.metadata?.animated ?? false,
      frame_count: entry.metadata?.frameCount ?? 1
    };
  }

  focusWindowById(id: number): boolean {
    return this.windowManager.focusWindowById(id);
  }

  moveWindowById(id: number, left: number, top: number): boolean {
    return this.windowManager.moveWindow(id, left, top);
  }

  resizeWindowById(id: number, width: number, height: number): boolean {
    return this.windowManager.resizeWindow(id, width, height);
  }

  closeWindowById(id: number): boolean {
    return this.windowManager.closeWindowById(id);
  }

  private syncState(): void {
    this.updateStatusLine();
    this.state.persistAndNotify();
  }

  private destroy(): void {
    this.controlApi.stop();
    this.screen.destroy();
    process.exit(0);
  }
}
