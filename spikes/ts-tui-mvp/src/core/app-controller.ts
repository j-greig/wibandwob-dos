import blessed from "blessed";
import { spawn as spawnProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn as spawnPty, type IPty as BunPtyTerminal, type IExitEvent as BunPtyExitEvent } from "@skitee3000/bun-pty/dist/index.js";

import { CONTROL_API_PORT, MASTER_PHILOSOPHY_PATH, README_PATH, REPO_ROOT, SPIKE_NOTES_PATH, SPIKE_ROOT, STATE_PATH, WORKSPACES_DIR } from "./config.js";
import { createSystemContextMenuItems, createWindowContextMenuItems } from "./context-menu-items.js";
import { DesktopGeometryService } from "./desktop-geometry.js";
import { createMenuConfigs, createPaletteCommands, type AppMenuActions } from "./menu-config.js";
import { MenuOverlayManager } from "./menu-overlay-manager.js";
import { OverlayManager } from "./overlay-manager.js";
import { createScrollbar, isRightClick } from "./ui-primitives.js";
import { restoreWindowSnapshot, serializeWindowSnapshot } from "./workspace-snapshots.js";
import type {
  BackroomsChannel,
  Box,
  BrowserEntry,
  ChatMessageEntry,
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
import { measurePlainTextContent, measurePrimerContent } from "../services/content-measurement.js";
import { ControlApiService } from "../services/control-api.js";
import { ContentService } from "../services/content-service.js";
import { getDefaultFigletFont, getFigletCatalogue, getFigletFontChoices, measureFiglet, renderFiglet } from "../services/figlet-service.js";
import { openPrimerFile, promptForEditorFile, promptForPrimerFile, saveEditorWindow } from "../services/file-actions.js";
import { PiService } from "../services/pi-service.js";
import { createPtySession, type PtySession } from "../services/pty-session.js";
import { deleteBackward as deleteEditorBackwardState, deleteForward as deleteEditorForwardState, insertText as insertEditorTextState, moveCursor as moveEditorCursorState, render as renderEditorState } from "../services/editor-service.js";
import { StateService } from "../services/state-service.js";
import { TerminalBuffer } from "../services/terminal-buffer.js";
import { renderTerminalBuffer } from "../services/terminal-renderer.js";
import { WibWobChatService } from "../services/wibwob-chat-service.js";
import { promptForWorkspaceLoad, promptForWorkspaceSave } from "../services/workspace-ui.js";
import { WorkspaceService } from "../services/workspace-service.js";
import {
  openFileManagerWindow as openFarjsFileManagerWindow,
  openPrimerBrowserWindow as openPrimerBrowserListWindow,
  openPrimerGalleryWindow as openPrimerGalleryListWindow,
  openTextViewerWindow as openContentViewerWindow
} from "../windows/content-windows.js";
import {
  openBrowserReaderWindow as openBrowserReaderContentWindow,
  openFigletFontPicker as openFigletFontPickerWindow,
  openFigletWindow as openFigletBannerWindow,
  promptForFigletText as promptForFigletBannerText
} from "../windows/figlet-windows.js";
import {
  openChatWindow as openChatTranscriptWindow,
  openCommandPaletteWindow as openPaletteWindow,
  openCompanionWindow as openScrambleWindow,
  openArtWindow as openGenerativeArtWindow,
  openGlitchWindow as openGlitchAnimationWindow,
  openOrbitWindow as openOrbitAnimationWindow,
  openPatternWindow as openPatternAnimationWindow,
  openStateInspectorWindow as openInspectorWindow,
  openWorkspaceManagerWindow as openWorkspaceCommandWindow
} from "../windows/misc-windows.js";
import { openEditorWindow as openTextEditorWindow } from "../windows/text-windows.js";
import { openWibWobChatWindow as openNativeWibWobChatWindow } from "../windows/wibwob-chat-window.js";
import { type TuiToolContext } from "../services/agent-tools.js";
import { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { openChromeBrowserWindow } from "../windows/chrome-browser-window.js";
import { openWibWobAgentWindow as openNativeWibWobAgentWindow } from "../windows/wibwob-agent-window.js";

export class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private readonly menus: MenuConfig[];
  private readonly menuUi: MenuOverlayManager;
  private readonly windowManager: WindowManager;
  private readonly overlays: OverlayManager;
  private readonly backrooms = new BackroomsService();
  private readonly content = new ContentService();
  private readonly pi = new PiService();
  private readonly wibwobChat = new WibWobChatService();
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
        this.repaintDesktop();
        this.syncState();
        this.refreshTerminalWindows();
      },
      (window, x, y) => this.openWindowContextMenu(window, x, y)
    );
    this.windowManager.setEditorWriteHook((id, text) => this.writeEditorTextById(id, text));
    this.geometry = new DesktopGeometryService(this.screen);
    this.overlays = new OverlayManager(this.screen, () => this.windowManager.restoreWindowFocus());
    this.menus = createMenuConfigs(this.getAppMenuActions());
    this.menuUi = new MenuOverlayManager(
      this.screen,
      this.menuBar,
      this.menus,
      () => this.windowManager.restoreWindowFocus(),
      () => this.syncState()
    );
    this.controlApi = new ControlApiService(CONTROL_API_PORT, {
      getState: () => this.getDesktopState(),
      getPrimerInfo: (pathOrName) => this.getPrimerInfo(pathOrName),
      openPrimerBrowser: () => this.openPrimerBrowserWindow(),
      openFileManager: () => this.openFileManagerWindow(),
      openPrimerGallery: () => this.openPrimerGalleryWindow(),
      openPrimerFile: (filePath) => this.openPrimerWindow(filePath),
      openBrowserReader: (filePath) => this.openBrowserReaderWindow(filePath),
      openFigletBanner: (text, font) => this.openFigletWindow(text ?? "WIB WOB", font ?? getDefaultFigletFont()),
      openArtWindow: () => this.openArtWindow(),
      openChatWindow: () => this.openChatWindow(),
      openWibWobChat: () => this.openWibWobChatWindow(),
      openWibWobAgent: () => this.openWibWobAgentWindow(),
      openCompanionWindow: () => this.openCompanionWindow(),
      openWorkspaceManager: () => this.openWorkspaceManagerWindow(),
      openCommandPalette: () => this.openCommandPaletteWindow(),
      openStateInspector: () => this.openStateInspectorWindow(),
      openEditorWindow: (filePath, title, initial) => this.openEditorWindow(filePath, title ?? "Untitled.txt", initial ?? ""),
      openXTermShell: () => void this.openXTermShellWindow(),
      closeXTermShells: () => this.closeWindowsByAppType("xterm-shell"),
      restartXTermShell: () => void this.restartXTermShell(),
      windows: this.windowManager,
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
        getOpenMenuLabel: () => this.menuUi.getOpenMenuLabel()
      }
    );
  }

  run(): void {
    this.renderChrome();
    this.bindGlobalKeys();
    this.menuUi.bindMenuClicks((label) => this.openMenu(label));
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
    const width = Math.max(1, Number(this.screen.width));
    const height = Math.max(1, Number(this.screen.height) - 2);
    const line = " ".repeat(width);
    this.desktop.setContent(Array.from({ length: height }, () => line).join("\n"));
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
      if (isRightClick(data) && !this.windowManager.getWindowAtPosition(data.x, data.y)) {
        this.openSystemContextMenu(data.x, data.y);
      }
    });
  }

  private openMenu(label: string): void {
    this.menuUi.openMenu(label);
  }

  private closeMenu(): void {
    this.menuUi.closeMenu();
  }

  private closePopupMenu(): void {
    this.menuUi.closePopupMenu();
  }

  private closeMenus(): void {
    this.menuUi.closeMenus();
  }

  private openPopupMenu(items: Array<{ label: string; action: () => void }>, x?: number, y?: number): void {
    this.menuUi.openPopupMenu(items, x, y);
  }

  private openWindowContextMenu(window: WindowRecord, x?: number, y?: number): void {
    this.openPopupMenu(
      createWindowContextMenuItems(window, {
        tileWindows: () => this.windowManager.tileWindows(),
        cascadeWindows: () => this.windowManager.cascadeWindows(),
        saveEditor: window.kind === "editor" ? () => this.saveEditor(window) : undefined,
        saveAsEditor: window.kind === "editor" ? () => {
          // Focus the window first, then use the shared Save As logic
          window.focus();
          this.saveAsFocusedEditor();
        } : undefined,
      }),
      x,
      y
    );
  }

  private openSystemContextMenu(x?: number, y?: number): void {
    this.openPopupMenu(
      createSystemContextMenuItems({
        openPrimerBrowser: () => this.openPrimerBrowserWindow(),
        openTextFile: () => this.promptForEditorPath(),
        openBackrooms: () => this.promptForBackroomsTv(),
        openXTermShell: () => void this.openXTermShellWindow(),
        openChromeBrowser: () => this.openChromeBrowserWindow(),
        openWibWobChat: () => this.openWibWobChatWindow(),
        openWibWobAgent: () => this.openWibWobAgentWindow(),
        openPiChat: () => void this.openPiChatWindow(),
        openWorkspaceManager: () => this.openWorkspaceManagerWindow(),
        tileWindows: () => this.windowManager.tileWindows(),
        cascadeWindows: () => this.windowManager.cascadeWindows()
      }),
      x,
      y
    );
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
      title: "Pi Terminal (Legacy)",
      appType: "pi-chat",
      command: launch.command,
      args: launch.args,
      cwd: launch.cwd,
      env: launch.env,
      intro: "Legacy Pi terminal surface. The native Wib&Wob Chat window uses the Pi SDK directly instead of this PTY path.",
      shellPath: launch.command
    });
  }

  private openWibWobChatWindow(restore?: {
    transcriptLines?: string[];
    draft?: string;
    messages?: unknown;
  }): void {
    const session = this.wibwobChat.createSession(REPO_ROOT);
    openNativeWibWobChatWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      chat: session,
      restore: {
        draft: restore?.draft,
        messages: Array.isArray(restore?.messages)
          ? restore.messages.filter((message): message is ChatMessageEntry => this.isChatMessageEntry(message))
          : undefined
      }
    });
  }

  private openWibWobAgentWindow(): void {
    const tuiContext: TuiToolContext = {
      getState: () => this.state.sync(),
      openWindow: (type) => {
        const before = this.windowManager.getWindows().length;
        const map: Record<string, () => void> = {
          terminal: () => void this.openXTermShellWindow(),
          editor: () => this.openEditorWindow(),
          art: () => this.openArtWindow(),
          gallery: () => this.openPrimerGalleryWindow(),
          browser: () => this.openBrowserReaderWindow(),
          pattern: () => this.openPatternWindow(),
          orbit: () => this.openOrbitWindow(),
          glitch: () => this.openGlitchWindow(),
          chat: () => this.openChatWindow(),
          companion: () => this.openCompanionWindow(),
          inspector: () => this.openStateInspectorWindow(),
          primer: () => this.openPrimerBrowserWindow(),
          figlet: () => this.openFigletWindow("WibWob"),
        };
        const fn = map[type];
        if (!fn) return { error: `unknown window type: ${type}` };
        fn();
        const wins = this.windowManager.getWindows();
        if (wins.length > before) {
          return { id: wins[wins.length - 1].id };
        }
        return { id: 0 };
      },
      openFigletWindow: (text, font) => {
        const before = this.windowManager.getWindows().length;
        this.openFigletWindow(text, font ?? getDefaultFigletFont());
        const wins = this.windowManager.getWindows();
        if (wins.length > before) {
          return { id: wins[wins.length - 1].id };
        }
        return { error: "figlet window failed to open" };
      },
      windows: this.windowManager,
    };

    const session = new WibWobAgentSession(tuiContext, REPO_ROOT);
    openNativeWibWobAgentWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      agent: session,
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
    const xtermLogDir = path.join(SPIKE_ROOT, "scratch", "xterm");
    fs.mkdirSync(xtermLogDir, { recursive: true });
    const logPath = path.join(
      xtermLogDir,
      `${new Date().toISOString().replaceAll(":", "-")}_${options.appType}.log`
    );
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
      const showCursor = this.windowManager.getFocusedWindow()?.id === frame.id && !this.menuUi.isAnyMenuOpen();
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

    const logEvent = (event: string, payload: string | Record<string, unknown>) => {
      const body = typeof payload === "string" ? payload : JSON.stringify(payload);
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${event} ${body}\n`, "utf8");
    };

    logEvent("spawn", {
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      cols: buffer.getCols(),
      rows: buffer.getRows()
    });

    session.onData((chunk) => {
      logEvent("data", JSON.stringify(chunk));
      buffer.write(chunk);
      render();
    });
    session.onExit((event) => {
      running = false;
      exitCode = event.exitCode;
      exitSignal = event.signal;
      logEvent("exit", {
        exitCode: event.exitCode,
        signal: event.signal
      });
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
      logEvent("input", JSON.stringify(input));
      session.write(input);
    };
    frame.refresh = render;
    frame.captureText = () => renderTerminalBuffer(buffer, false);
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
        debugLogPath: logPath,
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
      scrollbar: createScrollbar(),
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
    frame.captureText = () => transcript.getContent();
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
      scrollbar: createScrollbar(),
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
      scrollbar: createScrollbar(),
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
      scrollbar: createScrollbar(),
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
    openPrimerBrowserListWindow({
      windowManager: this.windowManager,
      overlays: this.overlays,
      entries: this.content.collectPrimerEntries(),
      onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
      restore
    });
  }

  private openFileManagerWindow(restore?: { currentPath?: string; selectedIndex?: number; filterValue?: string }): void {
    openFarjsFileManagerWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      startPath: restore?.currentPath ?? REPO_ROOT,
      restore,
      onOpenFile: (filePath) => {
        this.openEditorWindow(filePath, path.basename(filePath), fs.readFileSync(filePath, "utf8"));
      },
      onViewFile: (filePath) => {
        const content = fs.readFileSync(filePath, "utf8");
        this.openTextViewerWindow(path.basename(filePath), content, "reader", filePath);
      }
    });
  }

  private openPrimerGalleryWindow(restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number }): void {
    const allEntries = this.content.collectGalleryEntries();
    openPrimerGalleryListWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      allEntries,
      tabs: this.content.buildGalleryTabs(allEntries),
      onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
      restore
    });
  }

  private openChromeBrowserWindow(initialUrl?: string): void {
    openChromeBrowserWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      initialUrl,
    });
  }

  private openBrowserReaderWindow(filePath = MASTER_PHILOSOPHY_PATH): void {
    openBrowserReaderContentWindow({
      filePath,
      onOpenTextViewer: (title, content, kind, nextFilePath) => this.openTextViewerWindow(title, content, kind, nextFilePath),
      onError: (message) => this.overlays.flash(message)
    });
  }

  private promptForFigletText(): void {
    promptForFigletBannerText(this.overlays, (text, font) => this.openFigletFontPicker(text, font));
  }

  private openFigletFontPicker(text: string, currentFont: string, onSelect?: (font: string) => void): void {
    openFigletFontPickerWindow({
      overlays: this.overlays,
      text,
      currentFont,
      onSelect,
      onOpenWindow: (nextText, font) => this.openFigletWindow(nextText, font)
    });
  }

  private openFigletWindow(text: string, initialFont = getDefaultFigletFont()): void {
    openFigletBannerWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      applyMeasuredWindowSize: (frame, kind, content) => this.applyMeasuredWindowSize(frame, kind, content),
      text,
      initialFont,
      onOpenFontPicker: (nextText, currentFont, onSelect) => this.openFigletFontPicker(nextText, currentFont, onSelect),
      onSyncState: () => this.syncState()
    });
  }

  private openPatternWindow(): void {
    openPatternAnimationWindow({
      screen: this.screen,
      windowManager: this.windowManager
    });
  }

  private openOrbitWindow(): void {
    openOrbitAnimationWindow({
      screen: this.screen,
      windowManager: this.windowManager
    });
  }

  private openGlitchWindow(): void {
    let source = "No source loaded.";
    try {
      source = fs.readFileSync(README_PATH, "utf8");
    } catch {
      source = "WibWob-DOS glitch engine source unavailable.";
    }
    openGlitchAnimationWindow(
      {
        screen: this.screen,
        windowManager: this.windowManager
      },
      source
    );
  }

  private openChatWindow(restore?: { transcriptLines?: string[]; draft?: string }): void {
    openChatTranscriptWindow(
      {
        screen: this.screen,
        windowManager: this.windowManager
      },
      restore
    );
  }

  private openCompanionWindow(restore?: { tick?: number }): void {
    openScrambleWindow(
      {
        screen: this.screen,
        windowManager: this.windowManager
      },
      restore
    );
  }

  private openWorkspaceManagerWindow(): void {
    openWorkspaceCommandWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      workspace: this.workspace,
      saveWorkspace: () => this.saveWorkspace(),
      promptForWorkspaceSave: () => this.promptForWorkspaceSave(),
      promptForWorkspaceLoad: () => this.promptForWorkspaceLoad(),
      openCommandPaletteWindow: () => this.openCommandPaletteWindow()
    });
  }

  private openCommandPaletteWindow(): void {
    openPaletteWindow({
      windowManager: this.windowManager,
      commands: createPaletteCommands(this.getAppMenuActions())
    });
  }

  private promptForPrimer(): void {
    promptForPrimerFile({
      overlays: this.overlays,
      content: this.content,
      repoRoot: REPO_ROOT,
      onOpenPrimer: (filePath) => this.openPrimerWindow(filePath)
    });
  }

  private promptForEditorPath(): void {
    promptForEditorFile({
      overlays: this.overlays,
      content: this.content,
      startDir: path.dirname(SPIKE_NOTES_PATH),
      onOpenEditor: (filePath, title, content) => this.openEditorWindow(filePath, title, content)
    });
  }

  private openPrimerWindow(filePath: string): void {
    openPrimerFile({
      overlays: this.overlays,
      filePath,
      onOpenTextViewer: (title, content, kind, nextFilePath, options) =>
        this.openTextViewerWindow(title, content, kind, nextFilePath, options)
    });
  }

  private openEditorWindow(filePath?: string, title = "Untitled.txt", initial = "", restore?: { cursor?: number }): void {
    openTextEditorWindow({
      windowManager: this.windowManager,
      title,
      filePath,
      initial,
      cursor: restore?.cursor,
      renderEditor: (windowId) => {
        const window = this.windowManager.getWindowById(windowId);
        if (window) {
          this.renderEditor(window);
        }
      }
    });
    // Set initial saved content for dirty tracking
    const wins = this.windowManager.getWindows();
    const latest = wins[wins.length - 1];
    if (latest?.kind === "editor") {
      latest.lastSavedContent = initial;
      latest.isDirty = false;
    }
  }

  private openArtWindow(): void {
    openGenerativeArtWindow({
      screen: this.screen,
      windowManager: this.windowManager
    });
  }

  private saveFocusedEditor(): void {
    const focused = this.windowManager.getFocusedWindow();
    if (!focused || focused.kind !== "editor" || !focused.editor) {
      this.overlays.flash("Focused window is not an editor.");
      return;
    }
    this.saveEditor(focused);
  }

  private saveAsFocusedEditor(): void {
    const focused = this.windowManager.getFocusedWindow();
    if (!focused || focused.kind !== "editor" || !focused.editor) {
      this.overlays.flash("Focused window is not an editor.");
      return;
    }
    // Always prompt for a new path, regardless of current filePath
    const defaultPath = focused.filePath
      ? focused.filePath
      : path.join(SPIKE_ROOT, focused.title.replace(/^\*/, ""));
    this.overlays.openPathPrompt(
      "Save As",
      defaultPath,
      (value) => this.content.completePath(value),
      (value) => {
        const resolved = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, focused.editor!.value, "utf8");
        } catch (err) {
          this.overlays.flash(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
        focused.filePath = resolved;
        focused.title = path.basename(resolved);
        this.updateEditorTitleBar(focused);
        this.markEditorClean(focused);
        this.syncState();
        this.overlays.flash(`Saved as ${resolved}`);
      }
    );
  }

  private saveEditor(window: WindowRecord): void {
    saveEditorWindow({
      window,
      overlays: this.overlays,
      content: this.content,
      defaultDir: SPIKE_ROOT,
      onWritten: () => {
        this.markEditorClean(window);
        this.syncState();
        if (window.filePath) {
          this.overlays.flash(`Saved ${window.filePath}`);
        }
      }
    });
  }

  private handleFocusedEditorKeypress(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {
    const window = this.windowManager.getFocusedWindow();
    if (!window || window.kind !== "editor" || !window.editor) {
      return;
    }
    if (this.menuUi.isAnyMenuOpen() || this.screen.focused !== window.editor.widget) {
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
      moveEditorCursorState(window.editor, -1);
      this.renderEditor(window);
      return;
    }
    if (key.name === "right") {
      moveEditorCursorState(window.editor, 1);
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
    if (this.menuUi.isAnyMenuOpen()) {
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
    insertEditorTextState(window.editor, text);
    this.markEditorDirty(window);
    this.renderEditor(window);
  }

  private deleteEditorBackward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor === 0) {
      return;
    }
    deleteEditorBackwardState(window.editor);
    this.markEditorDirty(window);
    this.renderEditor(window);
  }

  private deleteEditorForward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor >= window.editor.value.length) {
      return;
    }
    deleteEditorForwardState(window.editor);
    this.markEditorDirty(window);
    this.renderEditor(window);
  }

  private markEditorDirty(window: WindowRecord): void {
    if (window.isDirty) return;
    window.isDirty = true;
    this.updateEditorTitleBar(window);
  }

  private markEditorClean(window: WindowRecord): void {
    window.isDirty = false;
    window.lastSavedContent = window.editor?.value;
    this.updateEditorTitleBar(window);
  }

  /** Update title bar display. window.title stays clean (no asterisk). */
  private updateEditorTitleBar(window: WindowRecord): void {
    if (!window.titleBar) return;
    const display = window.isDirty ? `*${window.title}` : window.title;
    window.titleBar.setContent(` ${display} `);
    this.screen.render();
  }

  private renderEditor(window: WindowRecord): void {
    if (!window.editor) {
      return;
    }
    renderEditorState(window.editor);
    this.syncState();
    this.screen.render();
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
    const fallbackMeasurement = options?.contentMeasurement ? undefined : measurePlainTextContent(content).measurement;
    openContentViewerWindow({
      windowManager: this.windowManager,
      applyMeasuredWindowSize: (frame, nextKind, measured) => this.applyMeasuredWindowSize(frame, nextKind, measured),
      title,
      content,
      kind,
      filePath,
      contentMeasurement: options?.contentMeasurement,
      fallbackMeasurement
    });
  }

  private openStateInspectorWindow(): void {
    openInspectorWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      state: this.state,
      statePath: STATE_PATH
    });
  }

  private saveWorkspace(): void {
    const focusedId = this.windowManager.getFocusedWindow()?.id;
    const snapshots: WindowSnapshot[] = this.windowManager
      .getWindows()
      .filter((window) => window.kind !== "workspace" && window.kind !== "palette")
      .map((window) => serializeWindowSnapshot(window, focusedId));
    this.workspace.save(snapshots);
    this.overlays.flash(`Saved workspace to ${this.workspace.path}`);
  }

  saveWorkspaceNamed(name: string): void {
    this.workspace.setCurrentWorkspaceName(name);
    this.saveWorkspace();
  }

  private promptForWorkspaceSave(): void {
    promptForWorkspaceSave({
      overlays: this.overlays,
      workspace: this.workspace,
      onSave: () => this.saveWorkspace(),
      onAfterChange: () => this.syncState()
    });
  }

  private promptForWorkspaceLoad(): void {
    promptForWorkspaceLoad({
      overlays: this.overlays,
      workspace: this.workspace,
      workspaceDir: WORKSPACES_DIR,
      onLoad: () => this.loadWorkspace()
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
      const restored = restoreWindowSnapshot(snapshot, {
        openPrimerWindow: (filePath) => this.openPrimerWindow(filePath),
        openEditorWindow: (filePath, title, initial, restore) => this.openEditorWindow(filePath, title, initial, restore),
        openBrowserReaderWindow: (filePath) => this.openBrowserReaderWindow(filePath),
        openFigletWindow: (text, font) => this.openFigletWindow(text, font),
        openPatternWindow: () => this.openPatternWindow(),
        openOrbitWindow: () => this.openOrbitWindow(),
        openGlitchWindow: () => this.openGlitchWindow(),
        openChatWindow: (restore) => this.openChatWindow(restore),
        openWibWobChatWindow: (restore) => this.openWibWobChatWindow(restore),
        openPrimerGalleryWindow: (restore) => this.openPrimerGalleryWindow(restore),
        openPrimerBrowserWindow: (restore) => this.openPrimerBrowserWindow(restore),
        openFileManagerWindow: (restore) => this.openFileManagerWindow(restore),
        openTerminalWindow: () => this.openTerminalWindow(),
        openXTermShellWindow: () => this.openXTermShellWindow(),
        openPiChatWindow: () => this.openPiChatWindow(),
        openBackroomsTv: (channel) => this.openBackroomsTv(channel),
        openCompanionWindow: (restore) => this.openCompanionWindow(restore),
        openArtWindow: () => this.openArtWindow(),
        openStateInspectorWindow: () => this.openStateInspectorWindow(),
        windows: this.windowManager
      });
      if (snapshot.focused) {
        focusedWindow = restored;
      }
    }
    focusedWindow?.focus();
    this.syncState();
    this.overlays.flash(`Loaded workspace from ${this.workspace.path}`);
  }

  private getAppMenuActions(): AppMenuActions {
    return {
      browsePrimers: () => this.openPrimerBrowserWindow(),
      openFileManager: () => this.openFileManagerWindow(),
      openPrimerPrompt: () => this.promptForPrimer(),
      openTextFilePrompt: () => this.promptForEditorPath(),
      openEditor: () => this.openEditorWindow(),
      saveFocusedEditor: () => this.saveFocusedEditor(),
      saveAsFocusedEditor: () => this.saveAsFocusedEditor(),
      saveWorkspaceAs: () => this.promptForWorkspaceSave(),
      loadWorkspacePrompt: () => this.promptForWorkspaceLoad(),
      openArtWindow: () => this.openArtWindow(),
      openTerminal: () => void this.openTerminalWindow(),
      openXTermShell: () => void this.openXTermShellWindow(),
      openWibWobChat: () => this.openWibWobChatWindow(),
      openWibWobAgent: () => this.openWibWobAgentWindow(),
      openPiChat: () => void this.openPiChatWindow(),
      quit: () => this.destroy(),
      focusNextWindow: () => this.windowManager.focusNextWindow(1),
      focusPreviousWindow: () => this.windowManager.focusNextWindow(-1),
      closeFocusedWindow: () => this.windowManager.closeFocusedWindow(),
      openBackroomsPrompt: () => this.promptForBackroomsTv(),
      tileWindows: () => this.windowManager.tileWindows(),
      cascadeWindows: () => this.windowManager.cascadeWindows(),
      openGallery: () => this.openPrimerGalleryWindow(),
      openBrowserReader: () => this.openBrowserReaderWindow(),
      openChromeBrowser: () => this.openChromeBrowserWindow(),
      openFigletBanner: () => this.promptForFigletText(),
      openPatternWindow: () => this.openPatternWindow(),
      openOrbitWindow: () => this.openOrbitWindow(),
      openGlitchWindow: () => this.openGlitchWindow(),
      openChatWindow: () => this.openChatWindow(),
      openCompanionWindow: () => this.openCompanionWindow(),
      openWorkspaceManager: () => this.openWorkspaceManagerWindow(),
      openCommandPalette: () => this.openCommandPaletteWindow(),
      openStateInspector: () => this.openStateInspectorWindow(),
      saveWorkspace: () => this.saveWorkspace(),
      loadWorkspace: () => this.loadWorkspace()
    };
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

  private isChatMessageEntry(value: unknown): value is ChatMessageEntry {
    if (!value || typeof value !== "object") {
      return false;
    }
    const entry = value as Record<string, unknown>;
    return (
      typeof entry.id === "string" &&
      (entry.role === "system" || entry.role === "user" || entry.role === "assistant" || entry.role === "status") &&
      typeof entry.text === "string"
    );
  }

  private writeEditorTextById(id: number, text: string): boolean {
    const window = this.windowManager.getWindowById(id);
    if (!window || !window.editor) return false;
    insertEditorTextState(window.editor, text);
    this.markEditorDirty(window);
    this.renderEditor(window);
    return true;
  }

  closeWindowsByAppType(appType: string): number {
    const targets = this.windowManager.getWindows().filter((window) => window.describeState?.().appType === appType);
    for (const window of targets) {
      window.close();
    }
    return targets.length;
  }

  restartXTermShell(): void {
    this.closeWindowsByAppType("xterm-shell");
    void this.openXTermShellWindow();
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
