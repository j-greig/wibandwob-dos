import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type IPty as BunPtyTerminal, type IExitEvent as BunPtyExitEvent } from "@skitee3000/bun-pty/dist/index.js";

import { MASTER_PHILOSOPHY_PATH, README_PATH, REPO_ROOT, SPIKE_NOTES_PATH, SPIKE_ROOT, STATE_PATH, WORKSPACE_PATH } from "./config.js";
import { OverlayManager } from "./overlay-manager.js";
import type {
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
import { WindowManager } from "./window-manager.js";
import { makeWibReply, makeWobReply } from "../services/chat-service.js";
import { ContentService } from "../services/content-service.js";
import { renderFiglet } from "../services/figlet-service.js";
import { StateService } from "../services/state-service.js";
import { WorkspaceService } from "../services/workspace-service.js";

export class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private menuList?: List;
  private openMenuLabel?: string;
  private readonly menus: MenuConfig[];
  private readonly windowManager: WindowManager;
  private readonly overlays: OverlayManager;
  private readonly content = new ContentService();
  private readonly workspace = new WorkspaceService(WORKSPACE_PATH);
  private readonly state: StateService;

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

    this.windowManager = new WindowManager(this.screen, this.desktop, () => this.syncState());
    this.overlays = new OverlayManager(this.screen, () => this.windowManager.restoreWindowFocus());
    this.state = new StateService(
      {
        appName: "WibWob-DOS TS MVP",
        appMode: "terminal-native",
        cwd: REPO_ROOT,
        statePath: STATE_PATH
      },
      {
        getScreenSize: () => ({
          width: Number(this.screen.width),
          height: Number(this.screen.height)
        }),
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
          { label: "Open Art Window", action: () => this.openArtWindow() },
          { label: "Open Terminal", action: () => void this.openTerminalWindow() },
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
        label: "Window",
        key: "w",
        left: 15,
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
        left: 24,
        items: [
          { label: "Primer Gallery", action: () => this.openPrimerGalleryWindow() },
          { label: "Browser Reader", action: () => this.openBrowserReaderWindow() },
          { label: "Figlet Banner", action: () => this.promptForFigletText() },
          { label: "Pattern Window", action: () => this.openPatternWindow() },
          { label: "Orbit Window", action: () => this.openOrbitWindow() },
          { label: "Glitch FX", action: () => this.openGlitchWindow() },
          { label: "Chat Transcript", action: () => this.openChatWindow() },
          { label: "Companion", action: () => this.openCompanionWindow() },
          { label: "Workspace Manager", action: () => this.openWorkspaceManagerWindow() },
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
    this.openPrimerWindow(README_PATH);
    this.openEditorWindow(undefined, "notes.txt", "Type here. Ctrl-S saves when the buffer has a path.\n");
    this.openArtWindow();
    this.openCompanionWindow();
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

  private updateStatusLine(): void {
    const current = this.state.sync();
    const focus = current.windows.find((window) => window.focused);
    const focusSummary = focus
      ? ` Focus ${focus.id}:${focus.kind} ${focus.width}x${focus.height}@${focus.left},${focus.top}`
      : " Focus none";
    this.statusLine.setContent(
      ` Alt-F File  Alt-E Edit  Alt-W Window  Alt-T Tools  Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit  |  Term ${current.screen.width}x${current.screen.height}  Windows ${current.screen.openWindowCount}${focusSummary} `
    );
  }

  private repaintDesktop(): void {
    const width = Number(this.screen.width);
    const height = Math.max(0, Number(this.screen.height) - 2);
    this.desktop.setContent(Array.from({ length: height }, () => "▒".repeat(width)).join("\n"));
  }

  private bindGlobalKeys(): void {
    this.screen.key(["C-q"], () => this.destroy());
    this.screen.key(["M-f"], () => this.openMenu("File"));
    this.screen.key(["M-e"], () => this.openMenu("Edit"));
    this.screen.key(["M-w"], () => this.openMenu("Window"));
    this.screen.key(["M-t"], () => this.openMenu("Tools"));
    this.screen.key(["escape"], () => this.closeMenu());
    this.screen.key(["tab"], () => {
      const focused = this.windowManager.getFocusedWindow();
      if (focused?.kind === "editor") {
        this.insertEditorText(focused, "  ");
        return;
      }
      this.windowManager.focusNextWindow(1);
    });
    this.screen.key(["S-tab"], () => this.windowManager.focusNextWindow(-1));
    this.screen.key(["C-s"], () => this.saveFocusedEditor());
    this.screen.on("keypress", (ch, key) => this.handleFocusedEditorKeypress(ch, key));
    this.screen.on("mouse", (data) => this.windowManager.handleMouse(data));
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
    this.closeMenu();
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

  private async openTerminalWindow(): Promise<void> {
    const frame = this.windowManager.createFrame("Terminal", "terminal");
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
      pty = spawn(this.resolveShellPath(), ["-i"], {
        name: "xterm-256color",
        cols: Math.max(20, Number(frame.body.width)),
        rows: Math.max(8, Number(frame.body.height) - 1),
        cwd: REPO_ROOT,
        env: this.getPtyEnv()
      });
    } catch (error) {
      frame.close();
      this.overlays.flash(`Terminal launch failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const syncPtySize = () => pty.resize(Math.max(20, Number(frame.body.width)), Math.max(8, Number(frame.body.height) - 1));
    const handleScreenResize = () => syncPtySize();
    const armTerminalInput = () => {
      inputLine.focus();
      inputLine.readInput();
      this.screen.render();
    };

    pty.onData((chunk: string) => {
      const clean = chunk.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\r/g, "").replace(/\x07/g, "");
      for (const line of clean.split("\n")) {
        if (line.length > 0) {
          transcript.log(line);
        }
      }
      this.syncState();
      this.screen.render();
    });
    pty.onExit(({ exitCode, signal }: BunPtyExitEvent) => {
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
    frame.terminal = { transcript, input: inputLine };
    frame.cleanup = () => {
      this.screen.off("resize", handleScreenResize);
      pty.kill();
    };
    frame.writeInput = (input) => pty.write(input);
    frame.describeState = () => ({
      appType: "terminal-shell",
      summary: "Interactive shell pane backed by Bun PTY.",
      contentPreview: transcript.getContent().split("\n").slice(-8).join("\n"),
      shellPath: this.resolveShellPath(),
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
    transcript.log("Experimental shell window. Good for shell commands; full-screen TUIs are not expected to render cleanly yet.");
    this.syncState();
  }

  private openPrimerBrowserWindow(): void {
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
      selectedLabel: entries[(list as List & { selected: number }).selected ?? 0]?.label,
      entryCount: entries.length
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      list.focus();
    };
    this.windowManager.registerWindow(frame);
    frame.focus();
  }

  private openPrimerGalleryWindow(): void {
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

    let activeTabIndex = 0;
    let activeEntries = tabs[0].entries;
    let searchValue = "";

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
    filterBox.setValue(` ${tabs[0].label} `);
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
      activeTab: tabs[activeTabIndex]?.label,
      searchValue,
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
    this.overlays.openValuePrompt("Figlet Text", "WIB WOB", (value) => this.openFigletWindow(value));
  }

  private openFigletWindow(text: string): void {
    this.openTextViewerWindow(`Banner: ${text.slice(0, 18) || "Banner"}`, renderFiglet(text), "figlet");
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

  private openChatWindow(): void {
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
    transcript.log("Wib: A new desktop blooms.");
    transcript.log("Wob: Systems nominal. Awaiting prompt.");
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

  private openCompanionWindow(): void {
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
    let tick = 0;
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
      contentPreview: bubble.getContent()
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
    const list = blessed.list({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 2,
      keys: true,
      vi: true,
      mouse: true,
      items: ["Save Current Workspace", "Load Workspace", "Cascade Windows", "Tile Windows", "Open Command Palette"],
      style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
    });
    blessed.box({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      content: ` Workspace file:\n ${this.workspace.path}`,
      style: { fg: "black", bg: "cyan" }
    });
    const actions = [
      () => this.saveWorkspace(),
      () => this.loadWorkspace(),
      () => this.windowManager.cascadeWindows(),
      () => this.windowManager.tileWindows(),
      () => this.openCommandPaletteWindow()
    ];
    list.on("select", (_, index) => actions[index]?.());
    frame.kind = "workspace";
    frame.describeState = () => ({
      appType: "workspace-manager",
      summary: "Workspace save/load command window.",
      selectedAction: list.getItem((list as List & { selected: number }).selected ?? 0)?.getText().trim(),
      workspacePath: this.workspace.path
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
    this.overlays.openPathPrompt("Open Primer Path", README_PATH, (value) => this.content.completePath(value), (value) =>
      this.openPrimerWindow(value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value)
    );
  }

  private promptForEditorPath(): void {
    this.overlays.openPathPrompt("Open Text File Path", SPIKE_NOTES_PATH, (value) => this.content.completePath(value), (value) => {
      const resolved = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
      try {
        const exists = fs.existsSync(resolved);
        const content = exists ? fs.readFileSync(resolved, "utf8") : "";
        this.openEditorWindow(resolved, path.basename(resolved), content);
        if (!exists) {
          this.overlays.flash(`Opened new buffer for ${resolved}`);
        }
      } catch (error) {
        this.overlays.flash(`Cannot open text file: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private openPrimerWindow(filePath: string): void {
    try {
      this.openTextViewerWindow(path.basename(filePath), fs.readFileSync(filePath, "utf8"), "primer", filePath);
    } catch (error) {
      this.overlays.flash(`Cannot open primer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private openEditorWindow(filePath?: string, title = "Untitled.txt", initial = ""): void {
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
    frame.editor = { widget: editorWidget, value: initial, cursor: initial.length };
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

  private openTextViewerWindow(title: string, content: string, kind: WindowKind, filePath?: string): void {
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
    frame.describeState = () => ({
      appType: `${kind}-viewer`,
      summary: filePath ? `Viewing ${filePath}` : `Viewing ${kind} content.`,
      filePath,
      lineCount: content.split("\n").length,
      contentPreview: content.split("\n").slice(0, 8).join("\n")
    });
    frame.focus = () => {
      this.windowManager.focusWindow(frame);
      viewer.focus();
    };
    this.windowManager.registerWindow(frame);
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
    const snapshots: WindowSnapshot[] = this.windowManager
      .getWindows()
      .filter((window) => window.kind !== "workspace" && window.kind !== "palette")
      .map((window) => ({
        kind: window.kind,
        title: window.title,
        left: Number(window.frame.left),
        top: Number(window.frame.top),
        width: Number(window.frame.width),
        height: Number(window.frame.height),
        filePath: window.filePath
      }));
    this.workspace.save(snapshots);
    this.overlays.flash(`Saved workspace to ${this.workspace.path}`);
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
      if (window.kind !== "workspace" && window.kind !== "companion") {
        window.close();
      }
    }
    for (const snapshot of snapshots) {
      this.restoreWindowSnapshot(snapshot);
    }
    this.overlays.flash(`Loaded workspace from ${this.workspace.path}`);
  }

  private restoreWindowSnapshot(snapshot: WindowSnapshot): void {
    switch (snapshot.kind) {
      case "primer":
        if (snapshot.filePath) this.openPrimerWindow(snapshot.filePath);
        break;
      case "editor":
        this.openEditorWindow(snapshot.filePath, snapshot.title, snapshot.filePath && fs.existsSync(snapshot.filePath) ? fs.readFileSync(snapshot.filePath, "utf8") : "");
        break;
      case "reader":
        this.openBrowserReaderWindow(snapshot.filePath);
        break;
      case "figlet":
        this.openFigletWindow(snapshot.title.replace(/^Banner:\s*/, ""));
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
        this.openChatWindow();
        break;
      case "gallery":
        this.openPrimerGalleryWindow();
        break;
      case "browser":
        this.openPrimerBrowserWindow();
        break;
      case "terminal":
        void this.openTerminalWindow();
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
  }

  private getPaletteCommands(): Array<{ label: string; action: () => void }> {
    return [
      { label: "Open Primer Gallery", action: () => this.openPrimerGalleryWindow() },
      { label: "Open Browser Reader", action: () => this.openBrowserReaderWindow() },
      { label: "Open Figlet Banner", action: () => this.promptForFigletText() },
      { label: "Open Pattern Window", action: () => this.openPatternWindow() },
      { label: "Open Orbit Window", action: () => this.openOrbitWindow() },
      { label: "Open Glitch FX Window", action: () => this.openGlitchWindow() },
      { label: "Open Chat Transcript", action: () => this.openChatWindow() },
      { label: "Open Companion Window", action: () => this.openCompanionWindow() },
      { label: "Open Workspace Manager", action: () => this.openWorkspaceManagerWindow() },
      { label: "Open State Inspector", action: () => this.openStateInspectorWindow() },
      { label: "Save Workspace", action: () => this.saveWorkspace() },
      { label: "Load Workspace", action: () => this.loadWorkspace() },
      { label: "Tile Windows", action: () => this.windowManager.tileWindows() },
      { label: "Cascade Windows", action: () => this.windowManager.cascadeWindows() },
      { label: "Open Terminal", action: () => void this.openTerminalWindow() }
    ];
  }

  getDesktopState(): DesktopState {
    return this.state.getState();
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
    this.screen.destroy();
    process.exit(0);
  }
}
