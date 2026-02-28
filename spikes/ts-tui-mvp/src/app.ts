import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  spawn,
  type IPty as BunPtyTerminal,
  type IExitEvent as BunPtyExitEvent
} from "@skitee3000/bun-pty/dist/index.js";

type Box = blessed.Widgets.BoxElement;
type List = blessed.Widgets.ListElement;
type Textbox = blessed.Widgets.TextboxElement;
type LogBox = Box & { log: (text: string) => void };

type WindowKind =
  | "primer"
  | "editor"
  | "terminal"
  | "browser"
  | "art"
  | "gallery"
  | "reader"
  | "figlet"
  | "pattern"
  | "orbit"
  | "glitch"
  | "chat"
  | "companion"
  | "workspace"
  | "palette";

const PRIMER_ROOTS = ["modules", "modules-private", "docs"] as const;
const APP_FILE = fileURLToPath(import.meta.url);
const SPIKE_ROOT = path.resolve(path.dirname(APP_FILE), "..");
const REPO_ROOT = path.resolve(SPIKE_ROOT, "..", "..");
const WORKSPACE_PATH = path.join(SPIKE_ROOT, "scratch", "ts-tui-workspace.json");
const FIGLET_FONT: Record<string, string[]> = {
  A: ["  A  ", " A A ", "AAAAA", "A   A", "A   A"],
  B: ["BBBB ", "B   B", "BBBB ", "B   B", "BBBB "],
  C: [" CCCC", "C    ", "C    ", "C    ", " CCCC"],
  D: ["DDDD ", "D   D", "D   D", "D   D", "DDDD "],
  E: ["EEEEE", "E    ", "EEE  ", "E    ", "EEEEE"],
  F: ["FFFFF", "F    ", "FFF  ", "F    ", "F    "],
  G: [" GGGG", "G    ", "G GGG", "G   G", " GGG "],
  H: ["H   H", "H   H", "HHHHH", "H   H", "H   H"],
  I: ["IIIII", "  I  ", "  I  ", "  I  ", "IIIII"],
  J: ["JJJJJ", "   J ", "   J ", "J  J ", " JJ  "],
  K: ["K  K ", "K K  ", "KK   ", "K K  ", "K  K "],
  L: ["L    ", "L    ", "L    ", "L    ", "LLLLL"],
  M: ["M   M", "MM MM", "M M M", "M   M", "M   M"],
  N: ["N   N", "NN  N", "N N N", "N  NN", "N   N"],
  O: [" OOO ", "O   O", "O   O", "O   O", " OOO "],
  P: ["PPPP ", "P   P", "PPPP ", "P    ", "P    "],
  Q: [" QQQ ", "Q   Q", "Q   Q", "Q  QQ", " QQQQ"],
  R: ["RRRR ", "R   R", "RRRR ", "R  R ", "R   R"],
  S: [" SSSS", "S    ", " SSS ", "    S", "SSSS "],
  T: ["TTTTT", "  T  ", "  T  ", "  T  ", "  T  "],
  U: ["U   U", "U   U", "U   U", "U   U", " UUU "],
  V: ["V   V", "V   V", "V   V", " V V ", "  V  "],
  W: ["W   W", "W   W", "W W W", "WW WW", "W   W"],
  X: ["X   X", " X X ", "  X  ", " X X ", "X   X"],
  Y: ["Y   Y", " Y Y ", "  Y  ", "  Y  ", "  Y  "],
  Z: ["ZZZZZ", "   Z ", "  Z  ", " Z   ", "ZZZZZ"],
  "0": [" 000 ", "0  00", "0 0 0", "00  0", " 000 "],
  "1": ["  1  ", " 11  ", "  1  ", "  1  ", "11111"],
  "2": [" 222 ", "2   2", "   2 ", "  2  ", "22222"],
  "3": ["3333 ", "    3", " 333 ", "    3", "3333 "],
  "4": ["4  4 ", "4  4 ", "44444", "   4 ", "   4 "],
  "5": ["55555", "5    ", "5555 ", "    5", "5555 "],
  "6": [" 666 ", "6    ", "6666 ", "6   6", " 666 "],
  "7": ["77777", "   7 ", "  7  ", " 7   ", "7    "],
  "8": [" 888 ", "8   8", " 888 ", "8   8", " 888 "],
  "9": [" 999 ", "9   9", " 9999", "    9", " 999 "],
  " ": ["  ", "  ", "  ", "  ", "  "],
  "-": ["     ", "     ", "-----", "     ", "     "],
  "!": ["  !  ", "  !  ", "  !  ", "     ", "  !  "],
  ".": ["     ", "     ", "     ", "     ", "  .  "]
};

interface EditorState {
  widget: Box;
  value: string;
  cursor: number;
}

interface BrowserEntry {
  label: string;
  filePath: string;
}

interface PrimerGroup {
  label: string;
  entries: BrowserEntry[];
}

interface TerminalState {
  transcript: LogBox;
  input: Textbox;
}

interface ChatState {
  transcript: LogBox;
  input: Textbox;
}

interface WindowSnapshot {
  kind: WindowKind;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  filePath?: string;
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
  terminal?: TerminalState;
  chat?: ChatState;
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
          { label: "Command Palette", action: () => this.openCommandPaletteWindow() }
        ]
      }
    ];
  }

  run(): void {
    this.renderChrome();
    this.bindGlobalKeys();
    this.bindMenuClicks();
    this.openPrimerWindow(path.join(REPO_ROOT, "README.md"));
    this.openEditorWindow(undefined, "notes.txt", "Type here. Ctrl-S saves when the buffer has a path.\n");
    this.openArtWindow();
    this.openCompanionWindow();
    this.screen.render();
  }

  private renderChrome(): void {
    this.menuBar.setContent("");
    this.statusLine.setContent(
      " Alt-F File  Alt-E Edit  Alt-W Window  Alt-T Tools  Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit "
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
    this.screen.key(["M-t"], () => this.openMenu("Tools"));
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
        cwd: REPO_ROOT,
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

  private openPrimerGalleryWindow(): void {
    const groups = this.collectPrimerGroups();
    if (groups.length === 0) {
      this.flash("No gallery entries available.");
      return;
    }

    const frame = this.createFrame("Primer Gallery", "gallery");
    const tabBar = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: {
        fg: "black",
        bg: "white"
      }
    });
    const list = blessed.list({
      parent: frame.body,
      top: 1,
      left: 0,
      width: "34%",
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      items: groups[0].entries.map((entry) => entry.label),
      style: {
        fg: "white",
        bg: "black",
        selected: {
          fg: "black",
          bg: "white"
        }
      }
    });
    const preview = blessed.box({
      parent: frame.body,
      top: 1,
      left: "34%",
      right: 0,
      bottom: 0,
      tags: false,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: this.createScrollbar(),
      style: {
        fg: "white",
        bg: "black"
      }
    });

    let activeGroupIndex = 0;
    let activeEntries = groups[0].entries;

    const updatePreview = (index: number) => {
      const entry = activeEntries[index];
      if (!entry) {
        return;
      }
      try {
        const content = fs.readFileSync(entry.filePath, "utf8");
        const header = `${groups[activeGroupIndex].label} :: ${entry.label}\n${entry.filePath}\n\n`;
        preview.setContent(header + content);
      } catch (error) {
        preview.setContent(`Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`);
      }
      this.screen.render();
    };
    const openSelected = (index?: number) => {
      const currentIndex =
        typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const entry = activeEntries[currentIndex];
      if (entry) {
        this.openPrimerWindow(entry.filePath);
      }
    };

    const renderTabs = () => {
      tabBar.children.forEach((child) => child.destroy());
      let left = 0;
      groups.forEach((group, index) => {
        const isActive = index === activeGroupIndex;
        const tab = blessed.box({
          parent: tabBar,
          top: 0,
          left,
          height: 1,
          width: group.label.length + 2,
          mouse: true,
          clickable: true,
          content: ` ${group.label} `,
          style: {
            fg: isActive ? "white" : "black",
            bg: isActive ? "blue" : "white"
          }
        });
        tab.on("click", () => switchGroup(index));
        left += group.label.length + 2;
      });
    };

    const switchGroup = (index: number) => {
      activeGroupIndex = index;
      activeEntries = groups[index].entries;
      list.setItems(activeEntries.map((entry) => entry.label));
      list.select(0);
      renderTabs();
      updatePreview(0);
      list.focus();
      this.screen.render();
    };

    list.on("select item", (_, index) => updatePreview(index));
    list.on("keypress", (_, key) => {
      if (key.name === "enter") {
        openSelected();
      } else if (key.name === "up" || key.name === "down" || key.name === "j" || key.name === "k") {
        setTimeout(() => updatePreview((list as List & { selected: number }).selected ?? 0), 0);
      } else if (key.name === "left") {
        switchGroup((activeGroupIndex - 1 + groups.length) % groups.length);
      } else if (key.name === "right") {
        switchGroup((activeGroupIndex + 1) % groups.length);
      }
    });
    list.on("select", (_, index) => openSelected(index));

    renderTabs();
    list.setItems(activeEntries.map((entry) => entry.label));
    list.select(0);
    updatePreview(0);

    const record = frame;
    record.kind = "gallery";
    record.focus = () => {
      this.focusWindow(record);
      list.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private openBrowserReaderWindow(filePath = path.join(REPO_ROOT, "docs", "master-philosophy.md")): void {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const header = `Location: ${filePath}\n\n`;
      this.openTextViewerWindow(`Browser: ${path.basename(filePath)}`, header + content, "reader", filePath);
    } catch (error) {
      this.flash(`Cannot open browser reader: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private promptForFigletText(): void {
    this.openValuePrompt("Figlet Text", "WIB WOB", (value) => this.openFigletWindow(value));
  }

  private openFigletWindow(text: string): void {
    const content = this.renderFiglet(text);
    this.openTextViewerWindow(`Banner: ${text.slice(0, 18) || "Banner"}`, content, "figlet");
  }

  private openPatternWindow(): void {
    this.openAnimatedWindow("Pattern Field", "pattern", (tick, width, height) => {
      const glyphs = ["░", "▒", "▓", "█"];
      const rows: string[] = [];
      for (let y = 0; y < height; y += 1) {
        let row = "";
        for (let x = 0; x < width; x += 1) {
          const index = Math.abs((x + y + tick) % glyphs.length);
          row += glyphs[index];
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
      source = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    } catch {
      source = "WibWob-DOS glitch engine source unavailable.";
    }

    const lines = source.split("\n").slice(0, 24);
    this.openAnimatedWindow("Glitch FX", "glitch", (tick) =>
      lines
        .map((line, index) =>
          line
            .split("")
            .map((char, column) => {
              const value = (tick + index + column) % 17;
              if (value === 0) {
                return "#";
              }
              if (value === 3) {
                return "@";
              }
              if (value === 7) {
                return "%";
              }
              return char;
            })
            .join("")
        )
        .join("\n")
    );
  }

  private openChatWindow(): void {
    const frame = this.createFrame("Wib & Wob Chat", "chat");
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
      style: {
        fg: "white",
        bg: "black"
      }
    });
    const input = blessed.textbox({
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
      transcript.log(`Wib: ${this.makeWibReply(message)}`);
      transcript.log(`Wob: ${this.makeWobReply(message)}`);
      this.screen.render();
      armChatInput();
    });

    const record = frame;
    record.kind = "chat";
    record.chat = { transcript, input };
    record.focus = () => {
      this.focusWindow(record);
      armChatInput();
    };

    frame.body.on("click", armChatInput);
    transcript.on("click", armChatInput);
    input.on("focus", () => this.focusWindow(record));

    this.registerWindow(record);
    record.focus();
  }

  private openCompanionWindow(): void {
    const frame = this.createFrame("Scramble", "companion");
    frame.frame.width = 30;
    frame.frame.height = 10;
    const bubble = blessed.box({
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
    const moods = [
      " /\\_/\\\\\n( o.o )\n > ^ <\n\nScramble: lurking",
      " /\\_/\\\\\n( -.- )\n > ^ <\n\nScramble: judging layout",
      " /\\_/\\\\\n( 0.0 )\n > ^ <\n\nScramble: cat online",
      " /\\_/\\\\\n( ^.^ )\n > ^ <\n\nScramble: purring in ANSI"
    ];
    let tick = 0;
    const renderCompanion = () => {
      bubble.setContent(moods[tick % moods.length]);
      this.screen.render();
      tick += 1;
    };
    renderCompanion();
    const timer = setInterval(renderCompanion, 2400);

    const record = frame;
    record.kind = "companion";
    record.cleanup = () => clearInterval(timer);
    record.focus = () => {
      this.focusWindow(record);
      bubble.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private openWorkspaceManagerWindow(): void {
    const frame = this.createFrame("Workspace Manager", "workspace");
    const list = blessed.list({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 2,
      keys: true,
      vi: true,
      mouse: true,
      items: [
        "Save Current Workspace",
        "Load Workspace",
        "Cascade Windows",
        "Tile Windows",
        "Open Command Palette"
      ],
      style: {
        fg: "white",
        bg: "black",
        selected: {
          fg: "black",
          bg: "white"
        }
      }
    });
    const footer = blessed.box({
      parent: frame.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      content: ` Workspace file:\n ${WORKSPACE_PATH}`,
      style: {
        fg: "black",
        bg: "cyan"
      }
    });

    const actions = [
      () => this.saveWorkspace(),
      () => this.loadWorkspace(),
      () => this.cascadeWindows(),
      () => this.tileWindows(),
      () => this.openCommandPaletteWindow()
    ];

    list.on("select", (_, index) => actions[index]?.());

    const record = frame;
    record.kind = "workspace";
    record.focus = () => {
      this.focusWindow(record);
      list.focus();
    };

    void footer;
    this.registerWindow(record);
    record.focus();
  }

  private openCommandPaletteWindow(): void {
    const commands = this.getPaletteCommands();
    const frame = this.createFrame("Command Palette", "palette");
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
      style: {
        fg: "white",
        bg: "black",
        selected: {
          fg: "black",
          bg: "white"
        }
      }
    });

    list.on("select", (_, index) => {
      const command = commands[index];
      if (command) {
        command.action();
      }
    });

    const record = frame;
    record.kind = "palette";
    record.focus = () => {
      this.focusWindow(record);
      list.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private promptForPrimer(): void {
    const initial = path.join(REPO_ROOT, "README.md");
    this.openPathPrompt("Open Primer Path", initial, (value) => this.openPrimerWindow(value));
  }

  private promptForEditorPath(): void {
    const initial = path.join(SPIKE_ROOT, "scratch", "mvp-notes.txt");
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
    const dragState = this.dragState;
    if (!dragState) {
      return;
    }
    if (data.action === "mouseup") {
      this.dragState = undefined;
      return;
    }
    if (data.action !== "mousemove" && data.action !== "mousedown") {
      return;
    }
    const record = this.windows.find((window) => window.id === dragState.windowId);
    if (!record) {
      this.dragState = undefined;
      return;
    }

    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Number(record.frame.width);
    const frameHeight = Number(record.frame.height);
    const nextLeft = this.clamp(data.x - dragState.offsetX, 0, Math.max(0, screenWidth - frameWidth));
    const nextTop = this.clamp(
      data.y - dragState.offsetY,
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
      this.openPathPrompt("Save Text File Path", path.join(SPIKE_ROOT, window.title), (value) => {
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
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      this.walkPrimerEntries(rootPath, root, entries, 0);
    }
    return entries.sort((left, right) => left.label.localeCompare(right.label));
  }

  private collectPrimerGroups(): PrimerGroup[] {
    const groups: PrimerGroup[] = [];
    for (const root of ["modules", "modules-private"] as const) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      const modules = fs
        .readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      for (const moduleEntry of modules) {
        const primersPath = path.join(rootPath, moduleEntry.name, "primers");
        if (!fs.existsSync(primersPath)) {
          continue;
        }
        const entries = fs
          .readdirSync(primersPath, { withFileTypes: true })
          .filter((entry) => entry.isFile() && this.isTextLikeFile(entry.name))
          .map((entry) => ({
            label: entry.name,
            filePath: path.join(primersPath, entry.name)
          }))
          .sort((left, right) => left.label.localeCompare(right.label));
        if (entries.length > 0) {
          groups.push({
            label: root === "modules" ? moduleEntry.name : `private:${moduleEntry.name}`,
            entries
          });
        }
      }
    }
    return groups.sort((left, right) => left.label.localeCompare(right.label));
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
        label: `${rootLabel} :: ${path.relative(path.join(REPO_ROOT, rootLabel), childPath)}`,
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

  private openTextViewerWindow(title: string, content: string, kind: WindowKind, filePath?: string): void {
    const frame = this.createFrame(title, kind);
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
      style: {
        fg: "white",
        bg: "black"
      }
    });

    const record = frame;
    record.kind = kind;
    record.filePath = filePath;
    record.focus = () => {
      this.focusWindow(record);
      viewer.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private openAnimatedWindow(
    title: string,
    kind: WindowKind,
    renderFrame: (tick: number, width: number, height: number) => string
  ): void {
    const frame = this.createFrame(title, kind);
    const canvas = blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      style: {
        fg: "white",
        bg: "black"
      }
    });

    let tick = 0;
    const render = () => {
      const width = Math.max(12, Number(canvas.width));
      const height = Math.max(6, Number(canvas.height));
      canvas.setContent(renderFrame(tick, width, height));
      this.screen.render();
      tick += 1;
    };

    render();
    const timer = setInterval(render, 120);

    const record = frame;
    record.kind = kind;
    record.cleanup = () => clearInterval(timer);
    record.focus = () => {
      this.focusWindow(record);
      canvas.focus();
    };

    this.registerWindow(record);
    record.focus();
  }

  private openValuePrompt(label: string, initialValue: string, onSubmit: (value: string) => void): void {
    const modal = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "70%",
      height: 7,
      border: "line",
      label: ` ${label} `,
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
      mouse: true,
      keys: true,
      style: {
        fg: "white",
        bg: "blue"
      }
    });

    const closePrompt = () => {
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    input.setValue(initialValue);
    input.on("submit", (value) => {
      closePrompt();
      const nextValue = (value ?? "").trim();
      if (nextValue) {
        onSubmit(nextValue);
      }
    });
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
    });

    this.screen.render();
    input.focus();
    input.readInput();
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

  private renderFiglet(text: string): string {
    const upper = text.toUpperCase();
    const rows = Array.from({ length: 5 }, () => "");
    for (const char of upper) {
      const glyph = FIGLET_FONT[char] ?? FIGLET_FONT[" "];
      for (let row = 0; row < rows.length; row += 1) {
        rows[row] += `${glyph[row] ?? "     "} `;
      }
    }
    return `${rows.join("\n")}\n\n${text}`;
  }

  private makeWibReply(message: string): string {
    return `I turned "${message}" into sparks and banners.`;
  }

  private makeWobReply(message: string): string {
    return `Interpreted request "${message}". System response remains stable.`;
  }

  private saveWorkspace(): void {
    const snapshots: WindowSnapshot[] = this.windows
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
    fs.mkdirSync(path.dirname(WORKSPACE_PATH), { recursive: true });
    fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(snapshots, null, 2), "utf8");
    this.flash(`Saved workspace to ${WORKSPACE_PATH}`);
  }

  private loadWorkspace(): void {
    if (!fs.existsSync(WORKSPACE_PATH)) {
      this.flash(`Workspace file not found: ${WORKSPACE_PATH}`);
      return;
    }
    let snapshots: WindowSnapshot[] = [];
    try {
      snapshots = JSON.parse(fs.readFileSync(WORKSPACE_PATH, "utf8")) as WindowSnapshot[];
    } catch (error) {
      this.flash(`Cannot parse workspace: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    for (const window of [...this.windows]) {
      if (window.kind !== "workspace" && window.kind !== "companion") {
        window.close();
      }
    }

    for (const snapshot of snapshots) {
      this.restoreWindowSnapshot(snapshot);
    }
    this.flash(`Loaded workspace from ${WORKSPACE_PATH}`);
  }

  private restoreWindowSnapshot(snapshot: WindowSnapshot): void {
    switch (snapshot.kind) {
      case "primer":
        if (snapshot.filePath) {
          this.openPrimerWindow(snapshot.filePath);
        }
        break;
      case "editor": {
        const content =
          snapshot.filePath && fs.existsSync(snapshot.filePath)
            ? fs.readFileSync(snapshot.filePath, "utf8")
            : "";
        this.openEditorWindow(snapshot.filePath, snapshot.title, content);
        break;
      }
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

    const restored = this.windows[this.windows.length - 1];
    if (!restored) {
      return;
    }
    restored.frame.left = snapshot.left;
    restored.frame.top = snapshot.top;
    restored.frame.width = snapshot.width;
    restored.frame.height = snapshot.height;
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
      { label: "Save Workspace", action: () => this.saveWorkspace() },
      { label: "Load Workspace", action: () => this.loadWorkspace() },
      { label: "Tile Windows", action: () => this.tileWindows() },
      { label: "Cascade Windows", action: () => this.cascadeWindows() },
      { label: "Open Terminal", action: () => void this.openTerminalWindow() }
    ];
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
