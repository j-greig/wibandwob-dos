import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  spawn,
  type IPty as BunPtyTerminal,
  type IExitEvent as BunPtyExitEvent
} from "@skitee3000/bun-pty/dist/index.js";

type Box = blessed.Widgets.BoxElement;
type List = blessed.Widgets.ListElement;
type Textbox = blessed.Widgets.TextboxElement;

type WindowKind = "primer" | "editor" | "terminal" | "browser" | "art";

const PRIMER_ROOTS = ["modules", "modules-private", "docs"] as const;

interface EditorState {
  widget: Box;
  value: string;
  cursor: number;
}

interface BrowserEntry {
  label: string;
  filePath: string;
}

interface WindowRecord {
  id: number;
  kind: WindowKind;
  title: string;
  frame: Box;
  body: Box;
  close: () => void;
  focus: () => void;
  titleBar?: Box;
  editor?: EditorState;
  filePath?: string;
  writeInput?: (input: string) => void;
  cleanup?: () => void;
}

interface DragState {
  windowId: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  windowId: number;
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
  startX: number;
  startY: number;
}

interface MenuConfig {
  label: string;
  key: string;
  left: number;
  items: MenuItem[];
}

interface MenuItem {
  label: string;
  action: () => void;
}

class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private readonly notification: Box;
  private menuList?: List;
  private readonly menus: MenuConfig[];
  private readonly windows: WindowRecord[] = [];
  private focusedWindow?: WindowRecord;
  private nextWindowId = 1;
  private dragState?: DragState;
  private resizeState?: ResizeState;

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
      style: {
        fg: "black",
        bg: "white"
      }
    });

    this.desktop = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      bottom: 1,
      width: "100%",
      tags: false,
      style: {
        fg: "blue",
        bg: "blue"
      }
    });

    this.statusLine = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      height: 1,
      width: "100%",
      tags: true,
      style: {
        fg: "black",
        bg: "white"
      }
    });

    this.notification = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "shrink",
      height: "shrink",
      border: "line",
      padding: { left: 1, right: 1 },
      hidden: true,
      style: {
        fg: "white",
        bg: "black",
        border: {
          fg: "yellow"
        }
      }
    });

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
          { label: "Focus Next Window", action: () => this.focusNextWindow(1) },
          { label: "Focus Previous Window", action: () => this.focusNextWindow(-1) },
          { label: "Close Focused Window", action: () => this.closeFocusedWindow() }
        ]
      },
      {
        label: "Window",
        key: "w",
        left: 15,
        items: [
          { label: "Tile Windows", action: () => this.tileWindows() },
          { label: "Cascade Windows", action: () => this.cascadeWindows() },
          { label: "Open Browser", action: () => this.openPrimerBrowserWindow() },
          { label: "Open Art", action: () => this.openArtWindow() }
        ]
      }
    ];
  }

  run(): void {
    this.renderChrome();
    this.bindGlobalKeys();
    this.bindMenuClicks();
    this.openPrimerWindow(path.join(process.cwd(), "README.md"));
    this.openEditorWindow(undefined, "notes.txt", "Type here. Ctrl-S saves when the buffer has a path.\n");
    this.openArtWindow();
    this.screen.render();
  }

  private renderChrome(): void {
    this.menuBar.setContent("");
    this.statusLine.setContent(
      " Alt-F File  Alt-E Edit  Alt-W Window  Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit  Drag title  Resize corner "
    );
    this.repaintDesktop();
    this.screen.on("resize", () => {
      this.repaintDesktop();
      this.screen.render();
    });
  }

  private repaintDesktop(): void {
    const width = Number(this.screen.width);
    const height = Math.max(0, Number(this.screen.height) - 2);
    const line = "▒".repeat(width);
    const rows = Array.from({ length: height }, () => line);
    this.desktop.setContent(rows.join("\n"));
  }

  private bindGlobalKeys(): void {
    this.screen.key(["C-q"], () => this.destroy());
    this.screen.key(["M-f"], () => this.openMenu("File"));
    this.screen.key(["M-e"], () => this.openMenu("Edit"));
    this.screen.key(["M-w"], () => this.openMenu("Window"));
    this.screen.key(["escape"], () => this.closeMenu());
    this.screen.key(["tab"], () => {
      if (this.focusedWindow?.kind === "editor") {
        this.insertEditorText(this.focusedWindow, "  ");
        return;
      }
      this.focusNextWindow(1);
    });
    this.screen.key(["S-tab"], () => this.focusNextWindow(-1));
    this.screen.key(["C-s"], () => this.saveFocusedEditor());
    this.screen.on("keypress", (ch, key) => this.handleFocusedEditorKeypress(ch, key));
    this.screen.on("mouse", (data) => this.handleMouse(data));
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
          hover: {
            fg: "white",
            bg: "blue"
          }
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
        border: {
          fg: "white"
        },
        selected: {
          fg: "black",
          bg: "cyan"
        }
      },
      items: menu.items.map((item) => item.label)
    });
    this.menuList.focus();
    this.menuList.select(0);
    this.menuList.on("select", (_, index) => {
      this.closeMenu();
      menu.items[index].action();
    });
    this.screen.render();
  }

  private closeMenu(): void {
    if (!this.menuList) {
      return;
    }
    this.menuList.destroy();
    this.menuList = undefined;
    this.restoreWindowFocus();
    this.screen.render();
  }

  private restoreWindowFocus(): void {
    if (!this.focusedWindow) {
      return;
    }
    this.focusedWindow.focus();
  }

  private async openTerminalWindow(): Promise<void> {
    const frame = this.createFrame("Terminal", "terminal");
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
      style: {
        fg: "white",
        bg: "black"
      }
    });
    const inputLine = blessed.textbox({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "blue"
      }
    });

    let pty: BunPtyTerminal;
    try {
      pty = spawn(this.resolveShellPath(), ["-i"], {
        name: "xterm-256color",
        cols: Math.max(20, Number(frame.body.width)),
        rows: Math.max(8, Number(frame.body.height) - 1),
        cwd: process.cwd(),
        env: this.getPtyEnv()
      });
    } catch (error) {
      frame.close();
      this.flash(
        `Terminal launch failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    const syncPtySize = () => {
      const cols = Math.max(20, Number(frame.body.width));
      const rows = Math.max(8, Number(frame.body.height) - 1);
      pty.resize(cols, rows);
    };
    const handleScreenResize = () => syncPtySize();
    const armTerminalInput = () => {
      inputLine.focus();
      inputLine.readInput();
      this.screen.render();
    };

    pty.onData((chunk: string) => {
      const clean = chunk
        .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\r/g, "")
        .replace(/\x07/g, "");
      for (const line of clean.split("\n")) {
        if (line.length > 0) {
          transcript.log(line);
        }
      }
      this.screen.render();
    });

    pty.onExit(({ exitCode, signal }: BunPtyExitEvent) => {
      transcript.log(`[process exited ${exitCode} signal ${signal ?? "none"}]`);
      this.screen.render();
    });

    inputLine.on("submit", (value) => {
      const command = value ?? "";
      transcript.log(`$ ${command}`);
      pty.write(`${command}\r`);
      inputLine.clearValue();
      this.screen.render();
      armTerminalInput();
    });

    const record = frame;
    const baseClose = frame.close;
    record.kind = "terminal";
    record.cleanup = () => {
      this.screen.off("resize", handleScreenResize);
      pty.kill();
    };
    record.writeInput = (input) => {
      pty.write(input);
    };
    record.close = () => {
      baseClose();
    };
    record.focus = () => {
      this.focusWindow(record);
      armTerminalInput();
    };

    frame.body.on("click", armTerminalInput);
    frame.body.on("mousedown", armTerminalInput);
    transcript.on("click", armTerminalInput);
    transcript.on("mousedown", armTerminalInput);
    inputLine.on("click", armTerminalInput);
    inputLine.on("focus", () => this.focusWindow(record));

    this.registerWindow(record);
    record.focus();
    frame.frame.on("resize", syncPtySize);
    this.screen.on("resize", handleScreenResize);
    syncPtySize();
    transcript.log(
      "Experimental shell window. Good for shell commands; full-screen TUIs are not expected to render cleanly yet."
    );
  }

  private openPrimerBrowserWindow(): void {
    const entries = this.collectPrimerEntries();
    if (entries.length === 0) {
      this.flash("No primer files found in modules, modules-private, or docs.");
      return;
    }

    const frame = this.createFrame("Primer Browser", "browser");
    const help = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      content: " Enter opens file  j/k scroll  Esc closes menu ",
      style: {
        fg: "black",
        bg: "cyan"
      }
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
      style: {
        fg: "white",
        bg: "black",
        selected: {
          fg: "black",
          bg: "white"
        }
      }
    });

    const openSelected = (index?: number) => {
      const itemIndex =
        typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const entry = entries[itemIndex];
      if (!entry) {
        return;
      }
      this.openPrimerWindow(entry.filePath);
    };

    list.on("select", (_, index) => openSelected(index));
    list.on("keypress", (_, key) => {
      if (key.name === "enter") {
        openSelected();
      }
    });

    const record = frame;
    record.kind = "browser";
    record.focus = () => {
      this.focusWindow(record);
      list.focus();
    };

    void help;
    this.registerWindow(record);
    record.focus();
  }

  private promptForPrimer(): void {
    const initial = path.join(process.cwd(), "README.md");
    this.openPathPrompt("Open Primer Path", initial, (value) => this.openPrimerWindow(value));
  }

  private promptForEditorPath(): void {
    const initial = path.join(process.cwd(), "scratch", "mvp-notes.txt");
    this.openPathPrompt("Open Text File Path", initial, (value) => {
      try {
        const exists = fs.existsSync(value);
        const content = exists ? fs.readFileSync(value, "utf8") : "";
        this.openEditorWindow(value, path.basename(value), content);
        if (!exists) {
          this.flash(`Opened new buffer for ${value}`);
        }
      } catch (error) {
        this.flash(`Cannot open text file: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private openPrimerWindow(filePath: string): void {
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      this.flash(`Cannot open primer: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const frame = this.createFrame(path.basename(filePath), "primer");
    const viewer = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: false,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      content,
      style: {
        fg: "white",
        bg: "black"
      }
    });

    const record = frame;
    record.kind = "primer";
    record.focus = () => {
      this.focusWindow(record);
      viewer.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private openEditorWindow(filePath?: string, title = "Untitled.txt", initial = ""): void {
    const frame = this.createFrame(title, "editor");
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
      style: {
        fg: "white",
        bg: "black"
      }
    });

    const editor: EditorState = {
      widget: editorWidget,
      value: initial,
      cursor: initial.length
    };

    const record = frame;
    record.kind = "editor";
    record.editor = editor;
    record.filePath = filePath;
    record.focus = () => {
      this.focusWindow(record);
      editorWidget.focus();
    };

    this.renderEditor(record);
    this.registerWindow(record);
    record.focus();
  }

  private openArtWindow(): void {
    const frame = this.createFrame("Generative Art", "art");
    const canvas = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: false,
      style: {
        fg: "white",
        bg: "black"
      }
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
          const index = Math.min(
            palette.length - 1,
            Math.max(0, Math.floor(value * palette.length))
          );
          row += palette[index];
        }
        rows.push(row);
      }

      canvas.setContent(rows.join("\n"));
      this.screen.render();
      tick += 1;
    };

    renderArt();
    const timer = setInterval(renderArt, 100);

    const record = frame;
    record.kind = "art";
    record.cleanup = () => clearInterval(timer);
    record.focus = () => {
      this.focusWindow(record);
      canvas.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private createFrame(title: string, kind: WindowKind): WindowRecord {
    const offset = this.windows.length * 2;
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frame = blessed.box({
      parent: this.desktop,
      top: 1 + offset,
      left: 2 + offset,
      width: Math.min(screenWidth - 6, 72),
      height: Math.min(screenHeight - 6, 20),
      border: "line",
      tags: true,
      mouse: true,
      shadow: true,
      style: {
        fg: "white",
        bg: "black",
        border: {
          fg: "white"
        }
      }
    });
    const titleBar = blessed.box({
      parent: frame,
      top: 0,
      left: 2,
      right: 2,
      height: 1,
      tags: true,
      content: ` ${title} `,
      style: {
        fg: "black",
        bg: "white"
      }
    });
    const body = blessed.box({
      parent: frame,
      top: 1,
      left: 1,
      right: 1,
      bottom: 1,
      style: {
        fg: "white",
        bg: "black"
      }
    });
    const closeHint = blessed.box({
      parent: frame,
      top: 0,
      right: 1,
      width: 3,
      height: 1,
      mouse: true,
      clickable: true,
      content: " x ",
      style: {
        fg: "white",
        bg: "red"
      }
    });
    const resizeGrip = blessed.box({
      parent: frame,
      bottom: 0,
      right: 1,
      width: 2,
      height: 1,
      mouse: true,
      clickable: true,
      content: "+>",
      style: {
        fg: "yellow",
        bg: "black"
      }
    });

    const record: WindowRecord = {
      id: this.nextWindowId++,
      kind,
      title,
      frame,
      body,
      titleBar,
      close: () => {
        record.cleanup?.();
        frame.destroy();
        const index = this.windows.findIndex((window) => window.id === record.id);
        if (index >= 0) {
          this.windows.splice(index, 1);
        }
        if (this.focusedWindow?.id === record.id) {
          this.focusedWindow = undefined;
          this.focusNextWindow(-1);
        }
        this.screen.render();
      },
      focus: () => {
        this.focusWindow(record);
        body.focus();
      }
    };

    closeHint.on("click", () => record.close());
    frame.on("click", () => this.focusWindow(record));
    frame.on("mousedown", () => this.focusWindow(record));
    titleBar.on("click", () => this.focusWindow(record));
    titleBar.on("mousedown", (data) => {
      this.focusWindow(record);
      this.startDrag(record, data);
    });
    resizeGrip.on("mousedown", (data) => {
      this.focusWindow(record);
      this.startResize(record, data);
    });
    return record;
  }

  private handleMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    if (this.dragState) {
      this.handleDragMouse(data);
      return;
    }
    if (this.resizeState) {
      this.handleResizeMouse(data);
      return;
    }
  }

  private handleDragMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    if (data.action === "mouseup") {
      this.dragState = undefined;
      return;
    }
    if (data.action !== "mousemove" && data.action !== "mousedown") {
      return;
    }
    const record = this.windows.find((window) => window.id === this.dragState?.windowId);
    if (!record) {
      this.dragState = undefined;
      return;
    }

    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Number(record.frame.width);
    const frameHeight = Number(record.frame.height);
    const nextLeft = this.clamp(data.x - this.dragState.offsetX, 0, Math.max(0, screenWidth - frameWidth));
    const nextTop = this.clamp(
      data.y - this.dragState.offsetY,
      1,
      Math.max(1, screenHeight - 2 - frameHeight)
    );

    record.frame.left = nextLeft;
    record.frame.top = nextTop;
    this.screen.render();
  }

  private handleResizeMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    if (!this.resizeState) {
      return;
    }
    if (data.action === "mouseup") {
      this.resizeState = undefined;
      return;
    }
    if (data.action !== "mousemove" && data.action !== "mousedown") {
      return;
    }
    const record = this.windows.find((window) => window.id === this.resizeState?.windowId);
    if (!record) {
      this.resizeState = undefined;
      return;
    }

    const desktopWidth = Number(this.screen.width);
    const desktopHeight = Number(this.screen.height) - 2;
    const deltaX = data.x - this.resizeState.startX;
    const deltaY = data.y - this.resizeState.startY;
    const maxWidth = Math.max(24, desktopWidth - this.resizeState.originLeft);
    const maxHeight = Math.max(8, desktopHeight - this.resizeState.originTop);

    record.frame.width = this.clamp(this.resizeState.originWidth + deltaX, 24, maxWidth);
    record.frame.height = this.clamp(this.resizeState.originHeight + deltaY, 8, maxHeight);
    this.screen.render();
  }

  private startDrag(record: WindowRecord, data: blessed.Widgets.Events.IMouseEventArg): void {
    const coords = record.frame.lpos;
    if (!coords) {
      return;
    }
    this.dragState = {
      windowId: record.id,
      offsetX: data.x - coords.xi,
      offsetY: data.y - coords.yi
    };
  }

  private startResize(record: WindowRecord, data: blessed.Widgets.Events.IMouseEventArg): void {
    this.resizeState = {
      windowId: record.id,
      originLeft: Number(record.frame.left),
      originTop: Number(record.frame.top),
      originWidth: Number(record.frame.width),
      originHeight: Number(record.frame.height),
      startX: data.x,
      startY: data.y
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private registerWindow(record: WindowRecord): void {
    this.windows.push(record);
    this.focusWindow(record);
  }

  private focusWindow(record: WindowRecord): void {
    const index = this.windows.findIndex((window) => window.id === record.id);
    if (index >= 0) {
      const [active] = this.windows.splice(index, 1);
      this.windows.push(active);
    }
    this.focusedWindow = record;
    record.frame.setFront();
    for (const window of this.windows) {
      const active = window.id === record.id;
      window.frame.style.border = { fg: active ? "cyan" : "white" };
    }
    this.screen.render();
  }

  private focusNextWindow(direction: 1 | -1): void {
    if (this.windows.length === 0) {
      return;
    }
    const currentIndex = this.focusedWindow
      ? this.windows.findIndex((window) => window.id === this.focusedWindow?.id)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + this.windows.length) % this.windows.length;
    this.windows[nextIndex].focus();
  }

  private closeFocusedWindow(): void {
    this.focusedWindow?.close();
  }

  private saveFocusedEditor(): void {
    if (!this.focusedWindow || this.focusedWindow.kind !== "editor" || !this.focusedWindow.editor) {
      this.flash("Focused window is not an editor.");
      return;
    }
    this.saveEditor(this.focusedWindow);
  }

  private saveEditor(window: WindowRecord): void {
    if (!window.editor) {
      return;
    }
    if (!window.filePath) {
      this.openPathPrompt("Save Text File Path", path.join(process.cwd(), window.title), (value) => {
        window.filePath = value;
        window.title = path.basename(value);
        this.writeEditor(window);
      });
      return;
    }
    this.writeEditor(window);
  }

  private writeEditor(window: WindowRecord): void {
    if (!window.editor) {
      return;
    }
    const targetPath = window.filePath!;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, window.editor.value, "utf8");
    window.title = path.basename(targetPath);
    window.titleBar?.setContent(` ${window.title} `);
    this.flash(`Saved ${targetPath}`);
  }

  private handleFocusedEditorKeypress(
    ch: string,
    key: blessed.Widgets.Events.IKeyEventArg
  ): void {
    const window = this.focusedWindow;
    if (!window || window.kind !== "editor" || !window.editor) {
      return;
    }
    if (this.menuList || this.screen.focused !== window.editor.widget) {
      return;
    }

    const editor = window.editor;
    if (key.ctrl && key.name === "s") {
      this.saveEditor(window);
      return;
    }
    if (key.ctrl && key.name === "q") {
      return;
    }
    if (key.full === "S-tab") {
      this.focusNextWindow(-1);
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
      editor.cursor = Math.max(0, editor.cursor - 1);
      this.renderEditor(window);
      return;
    }
    if (key.name === "right") {
      editor.cursor = Math.min(editor.value.length, editor.cursor + 1);
      this.renderEditor(window);
      return;
    }
    if (key.name === "up" || key.name === "down") {
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
    const cursorCell = `{inverse}${this.escapeTags(atCursor)}{/inverse}`;
    widget.setContent(`${before}${cursorCell}${after}`);
    widget.setScrollPerc(100);
    this.screen.render();
  }

  private escapeTags(value: string): string {
    return value.replace(/[{}]/g, "\\$&");
  }

  private resolveShellPath(): string {
    const candidates = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"];
    for (const candidate of candidates) {
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

  private collectPrimerEntries(): BrowserEntry[] {
    const entries: BrowserEntry[] = [];
    for (const root of PRIMER_ROOTS) {
      const rootPath = path.join(process.cwd(), root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      this.walkPrimerEntries(rootPath, root, entries, 0);
    }
    return entries.sort((left, right) => left.label.localeCompare(right.label));
  }

  private walkPrimerEntries(
    directory: string,
    rootLabel: string,
    entries: BrowserEntry[],
    depth: number
  ): void {
    if (depth > 3) {
      return;
    }
    const children = fs.readdirSync(directory, { withFileTypes: true });
    for (const child of children) {
      if (child.name.startsWith(".") || child.name.endsWith(".log")) {
        continue;
      }
      const childPath = path.join(directory, child.name);
      if (child.isDirectory()) {
        this.walkPrimerEntries(childPath, rootLabel, entries, depth + 1);
        continue;
      }
      if (!this.isTextLikeFile(child.name)) {
        continue;
      }
      entries.push({
        label: `${rootLabel} :: ${path.relative(path.join(process.cwd(), rootLabel), childPath)}`,
        filePath: childPath
      });
    }
  }

  private isTextLikeFile(fileName: string): boolean {
    const extension = path.extname(fileName).toLowerCase();
    return extension === "" || [".md", ".txt", ".json", ".prompt", ".log", ".yaml", ".yml"].includes(extension);
  }

  private createScrollbar(): { ch: string; style: { bg: string } } {
    return {
      ch: " ",
      style: {
        bg: "white"
      }
    };
  }

  private openPathPrompt(label: string, initialValue: string, onSubmit: (value: string) => void): void {
    const modal = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "80%",
      height: 7,
      border: "line",
      label: ` ${label} `,
      tags: true,
      mouse: true,
      keys: true,
      style: {
        fg: "white",
        bg: "black",
        border: {
          fg: "cyan"
        }
      }
    });
    const input: Textbox = blessed.textbox({
      parent: modal,
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "blue"
      }
    });
    const help = blessed.box({
      parent: modal,
      bottom: 1,
      left: 1,
      right: 1,
      height: 1,
      content: " Enter open/save  Esc cancel ",
      style: {
        fg: "black",
        bg: "white"
      }
    });

    const closePrompt = () => {
      input.removeAllListeners("submit");
      input.removeAllListeners("cancel");
      input.removeAllListeners("keypress");
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    input.setValue(initialValue);
    input.key(["tab"], () => {
      const currentValue = input.getValue();
      const completedValue = this.completePath(currentValue);
      if (completedValue !== currentValue) {
        input.setValue(completedValue);
        this.screen.render();
      }
    });
    input.on("submit", (value) => {
      const nextValue = (value ?? "").trim();
      closePrompt();
      if (!nextValue) {
        return;
      }
      onSubmit(nextValue);
    });
    input.on("cancel", closePrompt);
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
    });

    void help;
    this.screen.render();
    input.focus();
    input.readInput();
  }

  private completePath(value: string): string {
    const expandedValue = value.startsWith("~")
      ? path.join(os.homedir(), value.slice(1))
      : value;
    const directory = expandedValue.endsWith(path.sep)
      ? expandedValue
      : path.dirname(expandedValue);
    const base = expandedValue.endsWith(path.sep) ? "" : path.basename(expandedValue);

    if (!fs.existsSync(directory)) {
      return value;
    }

    const matches = fs
      .readdirSync(directory)
      .filter((entry) => entry.startsWith(base))
      .sort((left, right) => left.localeCompare(right));
    if (matches.length === 0) {
      return value;
    }

    const nextPath = path.join(directory, matches[0]);
    return nextPath.startsWith(os.homedir())
      ? `~${nextPath.slice(os.homedir().length)}`
      : nextPath;
  }

  private tileWindows(): void {
    if (this.windows.length === 0) {
      return;
    }
    const desktopWidth = Math.max(40, Number(this.screen.width));
    const desktopHeight = Math.max(12, Number(this.screen.height) - 2);
    const columns = Math.max(1, Math.ceil(Math.sqrt(this.windows.length)));
    const rows = Math.max(1, Math.ceil(this.windows.length / columns));
    const cellWidth = Math.max(24, Math.floor(desktopWidth / columns));
    const cellHeight = Math.max(8, Math.floor(desktopHeight / rows));

    for (const [index, window] of this.windows.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = column * cellWidth;
      const top = 1 + row * cellHeight;
      const width = column === columns - 1 ? desktopWidth - left : cellWidth;
      const height = row === rows - 1 ? desktopHeight - row * cellHeight : cellHeight;
      window.frame.left = Math.max(0, left);
      window.frame.top = Math.max(1, top);
      window.frame.width = Math.max(24, width);
      window.frame.height = Math.max(8, height);
    }

    this.screen.render();
  }

  private cascadeWindows(): void {
    const desktopWidth = Math.max(40, Number(this.screen.width));
    const desktopHeight = Math.max(12, Number(this.screen.height) - 2);
    const width = Math.min(desktopWidth - 4, 72);
    const height = Math.min(desktopHeight - 2, 20);
    for (const [index, window] of this.windows.entries()) {
      const offset = index * 2;
      window.frame.left = this.clamp(offset, 0, Math.max(0, desktopWidth - width));
      window.frame.top = this.clamp(1 + offset, 1, Math.max(1, desktopHeight - height));
      window.frame.width = width;
      window.frame.height = height;
    }
    this.screen.render();
  }

  private flash(message: string): void {
    this.notification.setContent(` ${message} `);
    this.notification.show();
    this.screen.render();
    setTimeout(() => {
      this.notification.hide();
      this.screen.render();
    }, 2200);
  }

  private destroy(): void {
    this.screen.destroy();
    process.exit(0);
  }
}

process.env.TERM = process.env.TERM || "xterm-256color";
process.env.HOME = process.env.HOME || os.homedir();

new TsTuiMvpApp().run();
