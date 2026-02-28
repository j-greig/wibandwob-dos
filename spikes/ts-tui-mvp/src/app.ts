import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Box = blessed.Widgets.BoxElement;
type List = blessed.Widgets.ListElement;
type Prompt = blessed.Widgets.PromptElement;
type NodePtyModule = typeof import("node-pty");

type WindowKind = "primer" | "editor" | "terminal";

interface EditorState {
  widget: Box;
  value: string;
  cursor: number;
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
}

interface DragState {
  windowId: number;
  offsetX: number;
  offsetY: number;
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
  private readonly prompt: Prompt;
  private readonly notification: Box;
  private menuList?: List;
  private readonly menus: MenuConfig[];
  private readonly windows: WindowRecord[] = [];
  private focusedWindow?: WindowRecord;
  private nextWindowId = 1;
  private terminalPty?: NodePtyModule;
  private dragState?: DragState;

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

    this.prompt = blessed.prompt({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "70%",
      height: 9,
      border: "line",
      tags: true,
      label: " input ",
      keys: true,
      vi: true,
      mouse: true,
      hidden: true,
      style: {
        fg: "white",
        bg: "black",
        border: {
          fg: "cyan"
        }
      }
    });

    this.menus = [
      {
        label: "File",
        key: "f",
        left: 1,
        items: [
          { label: "Open Primer...", action: () => this.promptForPrimer() },
          { label: "Open Text File...", action: () => this.promptForEditorPath() },
          { label: "New Text Buffer", action: () => this.openEditorWindow() },
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
      }
    ];
  }

  run(): void {
    this.renderChrome();
    this.bindGlobalKeys();
    this.bindMenuClicks();
    this.openPrimerWindow(path.join(process.cwd(), "README.md"));
    this.openEditorWindow(undefined, "notes.txt", "Type here. Ctrl-S saves when the buffer has a path.\n");
    this.screen.render();
  }

  private renderChrome(): void {
    this.menuBar.setContent("");
    this.statusLine.setContent(
      " Alt-F File  Alt-E Edit  Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit "
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
    if (!this.terminalPty) {
      try {
        this.terminalPty = await import("node-pty");
      } catch (error) {
        this.flash(
          `node-pty failed to load: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
    }

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
      scrollbar: {
        ch: " ",
        style: {
          bg: "white"
        }
      },
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

    let pty;
    try {
      pty = this.terminalPty.spawn(this.resolveShellPath(), [], {
        name: "xterm-color",
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

    pty.onData((chunk) => {
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

    pty.onExit(({ exitCode }) => {
      transcript.log(`[process exited ${exitCode}]`);
      this.screen.render();
    });

    inputLine.on("submit", (value) => {
      const command = value ?? "";
      transcript.log(`$ ${command}`);
      pty.write(`${command}\r`);
      inputLine.clearValue();
      this.screen.render();
      inputLine.focus();
    });

    const record = frame;
    const baseClose = frame.close;
    record.kind = "terminal";
    record.writeInput = (input) => {
      pty.write(input);
    };
    record.close = () => {
      pty.kill();
      baseClose();
    };
    record.focus = () => {
      this.focusWindow(record);
      inputLine.focus();
    };

    this.registerWindow(record);
    record.focus();
    transcript.log(
      "Experimental shell window. Good for shell commands; full-screen TUIs are not expected to render cleanly yet."
    );
  }

  private promptForPrimer(): void {
    const initial = path.join(process.cwd(), "README.md");
    this.prompt.input("Open Primer Path", initial, (error, value) => {
      if (error || !value) {
        this.restoreWindowFocus();
        this.screen.render();
        return;
      }
      this.openPrimerWindow(value);
    });
  }

  private promptForEditorPath(): void {
    const initial = path.join(process.cwd(), "scratch", "mvp-notes.txt");
    this.prompt.input("Open Text File Path", initial, (error, value) => {
      if (error || !value) {
        this.restoreWindowFocus();
        this.screen.render();
        return;
      }
      const content = fs.existsSync(value) ? fs.readFileSync(value, "utf8") : "";
      this.openEditorWindow(value, path.basename(value), content);
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
      scrollbar: {
        ch: " ",
        style: {
          bg: "white"
        }
      },
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
      scrollbar: {
        ch: " ",
        style: {
          bg: "white"
        }
      },
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

    const record: WindowRecord = {
      id: this.nextWindowId++,
      kind,
      title,
      frame,
      body,
      titleBar,
      close: () => {
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
    return record;
  }

  private handleMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    if (!this.dragState) {
      return;
    }
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private registerWindow(record: WindowRecord): void {
    this.windows.push(record);
    this.focusWindow(record);
  }

  private focusWindow(record: WindowRecord): void {
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
      this.prompt.input("Save Text File Path", path.join(process.cwd(), window.title), (error, value) => {
        if (error || !value) {
          this.restoreWindowFocus();
          this.screen.render();
          return;
        }
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
