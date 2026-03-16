/**
 * Slap Editor — code editor microapp for WibWob-DOS.
 *
 * Pure blessed rendering, no native addons.
 * Features: gutter, cursor, selection, undo/redo, find, save, clipboard,
 * ANSI syntax highlighting, current-line highlight, vim keybindings.
 */
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import { EditorEngine, type EditorTheme } from "./editor-engine.js";
import { createVimState, handleVimKey, type VimState } from "./vim-mode.js";
import { highlightCode, HIGHLIGHTED_LANGUAGES } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Code Editor",
    description: "Open a code editor. Pass filePath to edit a file.",
    menu: [{ category: "applications", order: 15, label: "Code Editor" }],
    palette: { order: 115, label: "Code Editor" },
    action: (args?: { filePath?: string }) => openEditor(host, args?.filePath),
  });
}

function getTheme(host: MicroappHost): EditorTheme {
  const t = host.theme();
  return {
    fg: t.body.fg,
    bg: t.body.bg,
    gutterFg: t.muted.fg,
    gutterBg: t.body.bg,
    cursorFg: t.body.bg,
    cursorBg: t.body.fg,
    selectionFg: t.selected.fg,
    selectionBg: t.selected.bg,
    statusFg: t.titleBarFocused.fg,
    statusBg: t.titleBarFocused.bg,
  };
}

/** Detect language from file extension for syntax highlighting */
function detectLang(filePath: string | null): string {
  if (!filePath) return "plain";
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx",
    py: "python", rs: "rust", go: "go", c: "c", cpp: "c++", h: "c",
    sh: "bash", zsh: "bash", bash: "bash",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", css: "css", html: "html", xml: "xml",
  };
  return map[ext] ?? "plain";
}

/** File type icon (borrowed from File Manager pattern) */
function fileIcon(filePath: string | null): string {
  if (!filePath) return "\u2022";
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    ts: "TS", tsx: "TS", js: "JS", jsx: "JS", py: "PY",
    rs: "RS", go: "GO", c: "C", cpp: "C+", h: "H",
    md: "MD", json: "{}", yaml: "::", yml: "::", toml: "::",
    sh: "$>", bash: "$>", zsh: "$>",
    css: "##", html: "<>", xml: "<>",
    txt: "\u2261",
  };
  return icons[ext] ?? "\u2022";
}

// ANSI escape helpers
const A = {
  r: "\x1b[0m",
  b: "\x1b[1m",
  d: "\x1b[2m",
  i: "\x1b[3m",
  rev: "\x1b[7m",
  // Colours by index — we resolve theme colours to ANSI 256 below
} as const;

/** Map blessed colour name to ANSI 256 fg code */
function ansiColour(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[30m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
    gray: "\x1b[90m", grey: "\x1b[90m",
    "light-red": "\x1b[91m", "light-green": "\x1b[92m", "light-yellow": "\x1b[93m",
    "light-blue": "\x1b[94m", "light-magenta": "\x1b[95m", "light-cyan": "\x1b[96m",
    "light-white": "\x1b[97m",
  };
  if (map[name]) return map[name];
  // Try #hex or raw number
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return "\x1b[37m"; // fallback white
}

function ansiBgColour(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[40m", red: "\x1b[41m", green: "\x1b[42m", yellow: "\x1b[43m",
    blue: "\x1b[44m", magenta: "\x1b[45m", cyan: "\x1b[46m", white: "\x1b[47m",
    gray: "\x1b[100m", grey: "\x1b[100m",
    "light-red": "\x1b[101m", "light-green": "\x1b[102m", "light-yellow": "\x1b[103m",
    "light-blue": "\x1b[104m", "light-magenta": "\x1b[105m", "light-cyan": "\x1b[106m",
    "light-white": "\x1b[107m",
  };
  if (map[name]) return map[name];
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[48;2;${r};${g};${b}m`;
  }
  return "\x1b[40m";
}

/** Strip all ANSI escape sequences from a string */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

async function openEditor(host: MicroappHost, filePath?: string) {
  const engine = new EditorEngine();

  if (filePath) {
    await engine.loadFile(filePath);
  }

  const title = filePath
    ? `Edit: ${filePath.split("/").pop()}`
    : "Code Editor";

  const win = host.createWindow({ title, width: 100, height: 35 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  let theme = getTheme(host);
  let findMode = false;
  let findInput = "";
  let statusMessage = "";
  let statusTimeout: ReturnType<typeof setTimeout> | null = null;
  let vimEnabled = true;
  const vim = createVimState();
  let pasteBuffer = ""; // Bracketed paste accumulator
  let isPasting = false;

  const lang = detectLang(filePath ?? null);
  const langLabel = lang === "plain" ? "Plain Text" : lang.toUpperCase();
  const hasHighlight = HIGHLIGHTED_LANGUAGES.has(lang);

  // --- Blessed widgets ---
  // Header bar (breadcrumb + toolbar buttons)
  const headerBar = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: theme.statusFg, bg: theme.statusBg },
  });
  // Toolbar buttons (right-aligned)
  const th = host.theme();
  const btnStyle = { fg: th.accent.fg, bg: th.body.bg ?? "black" };
  const btnHoverStyle = { fg: th.body.bg ?? "black", bg: th.accent.fg };
  const btnExplorer = blessed.box({
    parent: headerBar, top: 0, right: 36, width: 12, height: 1,
    content: " [^B] Tree ", mouse: true, style: { ...btnStyle },
  });
  const btnSave = blessed.box({
    parent: headerBar, top: 0, right: 24, width: 12, height: 1,
    content: " [^S] Save ", mouse: true, style: { ...btnStyle },
  });
  const btnFind = blessed.box({
    parent: headerBar, top: 0, right: 12, width: 12, height: 1,
    content: " [^F] Find ", mouse: true, style: { ...btnStyle },
  });
  const btnGoto = blessed.box({
    parent: headerBar, top: 0, right: 0, width: 12, height: 1,
    content: " [^G] Goto ", mouse: true, style: { ...btnStyle },
  });
  for (const btn of [btnExplorer, btnSave, btnFind, btnGoto]) {
    btn.on("mouseover", () => { btn.style = { ...btnHoverStyle }; host.screen.render(); });
    btn.on("mouseout", () => { btn.style = { ...btnStyle }; host.screen.render(); });
  }
  btnExplorer.on("click", () => { toggleSidebar(); });
  btnSave.on("click", () => {
    engine.saveFile().then((ok) => {
      showStatus(ok ? `Saved ${engine.filePath}` : "No file path");
    });
  });
  btnFind.on("click", () => { findMode = true; findInput = ""; render(); });
  btnGoto.on("click", () => { findMode = true; findInput = ":"; render(); });

  // --- File tree sidebar ---
  const SIDEBAR_WIDTH = 26;
  let sidebarVisible = !!filePath;
  let sidebarFiles: Array<{ name: string; isDir: boolean; path: string; lines: number }> = [];
  let sidebarSelected = 0;
  let sidebarScrollOffset = 0;

  const sidebarHeader = blessed.box({
    parent: win.body,
    top: 1,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: 1,
    style: { fg: th.accent.fg, bg: th.header.bg },
  });

  const sidebarBox = blessed.box({
    parent: win.body,
    top: 2,
    left: 0,
    width: SIDEBAR_WIDTH,
    bottom: 1,
    style: { fg: theme.fg, bg: theme.bg },
    tags: false,
    mouse: true,
  });

  const sidebarDivider = blessed.box({
    parent: win.body,
    top: 1,
    left: SIDEBAR_WIDTH,
    width: 1,
    bottom: 1,
    style: { fg: th.muted.fg, bg: theme.bg },
  });

  const sidebarLeft = sidebarVisible ? SIDEBAR_WIDTH + 1 : 0;

  const gutterBox = blessed.box({
    parent: win.body,
    top: 1,
    left: sidebarLeft,
    width: 5,
    bottom: 1,
    style: { fg: theme.gutterFg, bg: theme.gutterBg },
  });

  const textBox = blessed.box({
    parent: win.body,
    top: 1,
    left: sidebarLeft + 5,
    right: 0,
    bottom: 1,
    style: { fg: theme.fg, bg: theme.bg },
    tags: false,
  });

  const statusBar = blessed.box({
    parent: win.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: theme.statusFg, bg: theme.statusBg },
  });

  // Populate sidebar file list
  function loadSidebarFiles() {
    if (!engine.filePath) { sidebarFiles = []; return; }
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const dir = path.dirname(engine.filePath);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      sidebarFiles = entries
        .filter(e => !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map(e => {
          const fpath = path.join(dir, e.name);
          let lineCount = 0;
          if (!e.isDirectory()) {
            try {
              const content = fs.readFileSync(fpath, "utf-8");
              lineCount = content.split("\n").length;
            } catch { /* ignore */ }
          }
          return { name: e.name, isDir: e.isDirectory(), path: fpath, lines: lineCount };
        });
      // Select current file
      const currentName = path.basename(engine.filePath);
      const idx = sidebarFiles.findIndex(f => f.name === currentName);
      if (idx >= 0) sidebarSelected = idx;
    } catch {
      sidebarFiles = [];
    }
  }

  function renderSidebar() {
    if (!sidebarVisible) {
      sidebarHeader.hide();
      sidebarBox.hide();
      sidebarDivider.hide();
      return;
    }
    sidebarHeader.show();
    sidebarBox.show();
    sidebarDivider.show();

    const t2 = host.theme();
    const accentC = ansiColour(t2.accent.fg);
    const mutedC = ansiColour(t2.muted.fg);
    const brightC = ansiColour(t2.body.fg);
    const selBg = ansiBgColour(t2.selected.bg);
    const selFg = ansiColour(t2.selected.fg);

    // Header
    const dirName = engine.filePath
      ? require("path").basename(require("path").dirname(engine.filePath))
      : "EXPLORER";
    sidebarHeader.setContent(` ${accentC}${A.b}EXPLORER${A.r} ${mutedC}${dirName}${A.r}`);

    // Divider
    const h = Math.max(1, Number(sidebarDivider.height) || 1);
    sidebarDivider.setContent("\u2502\n".repeat(h).trim());

    // File list
    const viewH = Math.max(1, Number(sidebarBox.height) || 1);
    // Ensure selected is visible
    if (sidebarSelected < sidebarScrollOffset) sidebarScrollOffset = sidebarSelected;
    if (sidebarSelected >= sidebarScrollOffset + viewH) sidebarScrollOffset = sidebarSelected - viewH + 1;

    const lines: string[] = [];
    const w = SIDEBAR_WIDTH - 2;
    for (let i = 0; i < viewH; i++) {
      const idx = sidebarScrollOffset + i;
      if (idx >= sidebarFiles.length) { lines.push(""); continue; }
      const f = sidebarFiles[idx];
      const icon = f.isDir ? "\u25A0 " : `${fileIcon(f.path)} `;
      const name = f.name.length > w - 3 ? f.name.slice(0, w - 5) + ".." : f.name;
      const isActive = idx === sidebarSelected;
      const isCurrent = engine.filePath && f.path === engine.filePath;
      const lnSuffix = !f.isDir && f.lines > 0 ? `${mutedC} ${f.lines}${A.r}` : "";
      const nameW = w - icon.length - (f.lines > 0 ? String(f.lines).length + 1 : 0);
      const trimName = name.length > nameW ? name.slice(0, nameW - 2) + ".." : name;
      if (isActive) {
        lines.push(`${selBg}${selFg} ${icon}${trimName}${" ".repeat(Math.max(0, nameW - trimName.length))}${A.r}${lnSuffix}`);
      } else if (isCurrent) {
        lines.push(` ${accentC}${icon}${A.b}${trimName}${A.r}${lnSuffix}`);
      } else if (f.isDir) {
        lines.push(` ${mutedC}${icon}${brightC}${trimName}${A.r}`);
      } else {
        lines.push(` ${mutedC}${icon}${trimName}${A.r}${lnSuffix}`);
      }
    }
    sidebarBox.setContent(lines.join("\n"));
  }

  // Sidebar keyboard handling
  sidebarBox.on("keypress", (_ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name === "up" || key.name === "k") {
      sidebarSelected = Math.max(0, sidebarSelected - 1);
      renderSidebar(); host.screen.render();
    } else if (key.name === "down" || key.name === "j") {
      sidebarSelected = Math.min(sidebarFiles.length - 1, sidebarSelected + 1);
      renderSidebar(); host.screen.render();
    } else if (key.name === "return" || key.name === "enter") {
      const f = sidebarFiles[sidebarSelected];
      if (f && !f.isDir) {
        engine.loadFile(f.path).then(() => {
          highlightDirty = true;
          win.setTitle(`Edit: ${f.name}`);
          render();
        });
      }
    } else if (key.name === "tab") {
      textBox.focus();
    }
  });

  // Toggle sidebar with Ctrl+B (VSCode pattern)
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    const sl = sidebarVisible ? SIDEBAR_WIDTH + 1 : 0;
    gutterBox.left = sl;
    textBox.left = sl + (Number(gutterBox.width) || 5);
    if (!sidebarVisible) {
      sidebarHeader.hide();
      sidebarBox.hide();
      sidebarDivider.hide();
      textBox.focus();
    } else {
      sidebarHeader.show();
      sidebarBox.show();
      sidebarDivider.show();
    }
    renderSidebar();
    render();
  }

  if (filePath) loadSidebarFiles();

  // --- Rendering ---

  function showStatus(msg: string, duration = 3000) {
    statusMessage = msg;
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusMessage = "";
      render();
    }, duration);
    render();
  }

  // Welcome screen for empty/new files
  const welcomeLines = [
    "",
    "",
    "",
    "          \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "          \u2502     WibWob Code Editor       \u2502",
    "          \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
    "",
    "          Quick Start",
    "          \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "          Ctrl+S     Save file",
    "          Ctrl+F     Find text",
    "          Ctrl+G     Go to line",
    "          Ctrl+Z     Undo",
    "          Ctrl+Y     Redo",
    "          Ctrl+A     Select all",
    "          Ctrl+C     Copy",
    "          Ctrl+X     Cut",
    "",
    "          Navigation",
    "          \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "          Arrows     Move cursor",
    "          Ctrl+Left  Word left",
    "          Ctrl+Right Word right",
    "          Home/End   Line start/end",
    "          PgUp/PgDn  Page scroll",
    "",
    "          Ctrl+O     Open file...",
    "",
    "          Start typing to begin editing,",
    "          or press Ctrl+O to open a file.",
  ];

  // Cached highlighted lines
  let highlightedLines: string[] = [];
  let highlightDirty = true;

  function rehighlight() {
    if (hasHighlight) {
      highlightedLines = highlightCode(engine.text, lang);
    } else {
      highlightedLines = engine.lines.map(l => l);
    }
    highlightDirty = false;
  }

  function render() {
    const bodyWidth = (win.body as any).width as number || 80;
    const viewHeight = ((win.body as any).height as number || 20) - 2; // minus header + status
    const gutterW = engine.gutterWidth() + 1; // extra space for padding
    const sl = sidebarVisible ? SIDEBAR_WIDTH + 1 : 0;

    // Update positions
    gutterBox.left = sl;
    gutterBox.width = gutterW;
    textBox.left = sl + gutterW;

    const totalWidth = bodyWidth;
    const textWidth = Math.max(1, bodyWidth - sl - gutterW);
    engine.ensureCursorVisible(textWidth, viewHeight);

    if (highlightDirty) rehighlight();

    const selRange = engine.getSelectionRange();
    const cursorRow = engine.cursor.row;
    const cursorCol = engine.cursor.col;

    // ANSI colour codes from theme
    const gutterAccent = ansiColour(theme.gutterFg);
    const gutterActive = `${A.b}${ansiColour(theme.cursorBg)}`;
    const cursorAnsi = `${ansiBgColour(theme.cursorBg)}${ansiColour(theme.cursorFg)}`;
    const selAnsi = `${ansiBgColour(theme.selectionBg)}${ansiColour(theme.selectionFg)}`;
    // Current line: use bodyAlt bg from theme for subtle highlight
    const t = host.theme();
    const currentLineBg = ansiBgColour(t.bodyAlt.bg);
    const currentLineGutterBg = ansiBgColour(t.bodyAlt.bg);

    const gutterLines: string[] = [];
    const textLines: string[] = [];

    // Welcome screen for empty untitled buffer
    const showWelcome = !engine.filePath && engine.lineCount <= 1 && engine.lines[0] === "";
    if (showWelcome) {
      const welcomeAccent = ansiColour(t.accent.fg);
      const welcomeMuted = ansiColour(t.muted.fg);
      const welcomeBright = `${A.b}${ansiColour(t.body.fg)}`;
      for (let y = 0; y < viewHeight; y++) {
        gutterLines.push(`${A.d}${gutterAccent}${"~".padStart(gutterW - 1)} ${A.r}`);
        if (y < welcomeLines.length) {
          const wl = welcomeLines[y];
          // Style: headers in accent, shortcuts in bright, descriptions in muted
          if (wl.includes("WibWob Code Editor")) {
            textLines.push(`${welcomeAccent}${A.b}${wl}${A.r}`);
          } else if (wl.includes("Quick Start") || wl.includes("Navigation")) {
            textLines.push(`${welcomeAccent}${wl}${A.r}`);
          } else if (wl.includes("\u2500")) {
            textLines.push(`${welcomeMuted}${wl}${A.r}`);
          } else if (wl.match(/^\s+Ctrl\+|^\s+Arrows|^\s+Home|^\s+PgUp/)) {
            const parts = wl.match(/^(\s+)(\S+\s+\S*)\s{2,}(.*)$/);
            if (parts) {
              textLines.push(`${parts[1]}${welcomeBright}${parts[2].padEnd(12)}${A.r}${welcomeMuted}${parts[3]}${A.r}`);
            } else {
              textLines.push(`${welcomeMuted}${wl}${A.r}`);
            }
          } else if (wl.includes("Start typing") || wl.includes("Open a file")) {
            textLines.push(`${welcomeMuted}${A.i}${wl}${A.r}`);
          } else {
            textLines.push(wl);
          }
        } else {
          textLines.push("");
        }
      }
      gutterBox.setContent(gutterLines.join("\n"));
      textBox.setContent(textLines.join("\n"));
      const wAccent = ansiColour(t.accent.fg);
      const wDim = ansiColour(t.muted.fg);
      const wBright = ansiColour(t.body.fg);
      (headerBar as any).setContent(` ${wAccent}\u2022${A.r} ${wBright}${A.b}untitled${A.r}`);
      const statusLeftAnsi2 = ` ${wAccent}Ln 1${A.r}${wDim}, Col 1${A.r}`;
      const statusRightAnsi2 = `${wDim}Plain Text  UTF-8  2 sp  1 ln  100%${A.r} `;
      const leftP = stripAnsi(statusLeftAnsi2).length;
      const rightP = stripAnsi(statusRightAnsi2).length;
      const gap2 = Math.max(1, totalWidth - leftP - rightP);
      (statusBar as any).setContent(statusLeftAnsi2 + " ".repeat(gap2) + statusRightAnsi2);
      host.screen.render();
      return;
    }

    for (let y = 0; y < viewHeight; y++) {
      const row = engine.scroll.row + y;
      if (row >= engine.lineCount) {
        gutterLines.push(`${A.d}${gutterAccent}${"~".padStart(gutterW - 1)} ${A.r}`);
        textLines.push("");
        continue;
      }

      // Gutter — absolute line numbers, current line highlighted
      const isCurrentLine = row === cursorRow;
      const lineNum = String(row + 1).padStart(gutterW - 1);
      if (isCurrentLine) {
        gutterLines.push(`${currentLineGutterBg}${gutterActive}${lineNum} ${A.r}`);
      } else {
        gutterLines.push(`${gutterAccent}${lineNum} ${A.r}`);
      }

      // Text — start from highlighted line, overlay cursor/selection
      const rawLine = engine.lines[row] ?? "";
      const hlLine = highlightedLines[row] ?? rawLine;

      // We need to map visual columns to positions in the ANSI string
      // Strategy: for cursor/selection, build char-by-char with ANSI overlays
      const scrollCol = engine.scroll.col;
      let lineOut = "";

      // Strip the highlighted line to get per-char ANSI spans
      // Simpler approach: render plain chars with per-char styling
      for (let x = 0; x < textWidth; x++) {
        const col = scrollCol + x;
        const ch = col < rawLine.length ? rawLine[col] : " ";

        const isCursor = isCurrentLine && col === cursorCol;
        const isSelected = selRange !== null && isInSelection(row, col, selRange);

        const lineBgInit = isCurrentLine ? currentLineBg : "";
        if (isCursor) {
          lineOut += `${cursorAnsi}${ch}${A.r}`;
        } else if (isSelected) {
          lineOut += `${selAnsi}${ch}${A.r}`;
        } else if (lineBgInit) {
          lineOut += `${lineBgInit}${ch}${A.r}`;
        } else {
          lineOut += ch;
        }
      }

      // If we have syntax highlighting AND no selection/cursor on this line,
      // use the pre-highlighted version for much better performance
      if (hasHighlight && !isCurrentLine && selRange === null) {
        // Use highlighted line, sliced to viewport
        const plain = stripAnsi(hlLine);
        if (scrollCol === 0 && plain.length <= textWidth) {
          lineOut = hlLine + " ".repeat(Math.max(0, textWidth - plain.length));
        }
      } else if (hasHighlight) {
        // For the current line or lines with selection, we need per-char render
        // but with syntax colour per character
        // Re-highlight just this line and extract per-char colours
        const singleHL = highlightCode(rawLine, lang)[0] ?? rawLine;
        lineOut = "";
        // Walk the ANSI string to extract colour per source char
        const charColours = extractCharColours(singleHL, rawLine.length);
        for (let x = 0; x < textWidth; x++) {
          const col = scrollCol + x;
          const ch = col < rawLine.length ? rawLine[col] : " ";
          const isCursor = isCurrentLine && col === cursorCol;
          const isSelected = selRange !== null && isInSelection(row, col, selRange);

          const lineBg = isCurrentLine ? currentLineBg : "";
          if (isCursor) {
            lineOut += `${cursorAnsi}${ch}${A.r}`;
          } else if (isSelected) {
            lineOut += `${selAnsi}${ch}${A.r}`;
          } else if (col < charColours.length && charColours[col]) {
            lineOut += `${lineBg}${charColours[col]}${ch}${A.r}`;
          } else {
            lineOut += `${lineBg}${ch}${A.r}`;
          }
        }
      }

      textLines.push(lineOut);
    }

    gutterBox.setContent(gutterLines.join("\n"));
    textBox.setContent(textLines.join("\n"));

    // Header bar — breadcrumb (ANSI styled)
    const icon = fileIcon(engine.filePath);
    const fname = engine.filePath?.split("/").pop() ?? "untitled";
    const dirPath = engine.filePath
      ? engine.filePath.split("/").slice(-3, -1).join("/")
      : "";
    const dirtyMark = engine.dirty ? ` ${ansiColour(t.warning.fg)}\u25CF${A.r}` : "";
    const accentCol = ansiColour(t.accent.fg);
    const dimCol = ansiColour(t.muted.fg);
    const brightCol = ansiColour(t.body.fg);
    const headerText = dirPath
      ? ` ${accentCol}${icon}${A.r} ${dimCol}${dirPath}/${A.r}${brightCol}${A.b}${fname}${A.r}${dirtyMark}`
      : ` ${accentCol}${icon}${A.r} ${brightCol}${A.b}${fname}${A.r}${dirtyMark}`;
    (headerBar as any).setContent(headerText);

    // Status bar — rich info
    const desc = engine.describe();
    let statusLeft = "";
    let statusRight = "";
    if (findMode) {
      statusLeft = ` Find: ${findInput}_ `;
      if (engine.findMatches.length > 0) {
        statusLeft += `(${engine.findIndex + 1}/${engine.findMatches.length})`;
      } else if (findInput) {
        statusLeft += "(no matches)";
      }
    } else if (vim.statusMessage || statusMessage) {
      statusLeft = ` ${vim.statusMessage || statusMessage}`;
    } else if (vim.commandMode) {
      statusLeft = ` :${vim.commandBuffer}_`;
    } else {
      const vimTag = vimEnabled
        ? vim.mode === "insert" ? " INSERT " : vim.mode === "visual" ? " VISUAL " : " NORMAL "
        : "";
      const opTag = vim.pendingOperator ? `${vim.pendingOperator}` : "";
      statusLeft = ` ${vimTag}${opTag}Ln ${desc.cursor.row + 1}, Col ${desc.cursor.col + 1}`;
    }
    const scrollPct = engine.lineCount > 1
      ? Math.round((engine.scroll.row / Math.max(1, engine.lineCount - viewHeight)) * 100)
      : 100;
    const pct = Math.min(100, Math.max(0, scrollPct));
    // ANSI styled status bar
    const vimModeAnsi = vimEnabled
      ? vim.mode === "insert" ? `${A.rev} INSERT ${A.r} ` : vim.mode === "visual" ? `${A.rev} VISUAL ${A.r} ` : `${A.rev} NORMAL ${A.r} `
      : "";
    const opAnsi = vim.pendingOperator ? `${accentCol}${vim.pendingOperator}${A.r}` : "";
    const statusLeftAnsi = findMode || vim.statusMessage || statusMessage || vim.commandMode
      ? ` ${statusLeft.trim()}`
      : ` ${vimModeAnsi}${opAnsi}${accentCol}Ln ${desc.cursor.row + 1}${A.r}${dimCol}, Col ${desc.cursor.col + 1}${A.r}`;
    const langColour = hasHighlight ? accentCol : dimCol;
    // Visual scroll bar (5 chars)
    const barLen = 5;
    const scrollPos = Math.round((pct / 100) * (barLen - 1));
    let scrollBar = "";
    for (let i = 0; i < barLen; i++) {
      scrollBar += i === scrollPos ? `${accentCol}\u2588${A.r}` : `${dimCol}\u2591${A.r}`;
    }
    const statusRightAnsi = `${langColour}${langLabel}${A.r} ${dimCol}\u2502${A.r} ${dimCol}UTF-8${A.r} ${dimCol}\u2502${A.r} ${dimCol}2 sp${A.r} ${dimCol}\u2502${A.r} ${dimCol}${desc.lines} ln${A.r} ${dimCol}\u2502${A.r} ${scrollBar} ${dimCol}${pct}%${A.r} `;
    // Calculate gap (strip ANSI for width)
    const leftPlain = stripAnsi(statusLeftAnsi).length;
    const rightPlain = stripAnsi(statusRightAnsi).length;
    const gap = Math.max(1, totalWidth - leftPlain - rightPlain);
    (statusBar as any).setContent(statusLeftAnsi + " ".repeat(gap) + statusRightAnsi);

    renderSidebar();
    host.screen.render();
  }

  /** Extract per-character ANSI colour codes from a highlighted line */
  function extractCharColours(hlLine: string, srcLen: number): string[] {
    const colours: string[] = new Array(srcLen).fill("");
    let srcIdx = 0;
    let currentColour = "";
    let i = 0;
    while (i < hlLine.length && srcIdx < srcLen) {
      if (hlLine[i] === "\x1b") {
        // Read full escape sequence
        let seq = "\x1b";
        i++;
        while (i < hlLine.length && hlLine[i] !== "m") {
          seq += hlLine[i];
          i++;
        }
        if (i < hlLine.length) {
          seq += "m";
          i++;
        }
        if (seq === A.r) {
          currentColour = "";
        } else {
          currentColour = seq;
        }
      } else {
        if (srcIdx < srcLen) {
          colours[srcIdx] = currentColour;
        }
        srcIdx++;
        i++;
      }
    }
    return colours;
  }

  function isInSelection(
    row: number,
    col: number,
    range: { start: { row: number; col: number }; end: { row: number; col: number } }
  ): boolean {
    const { start, end } = range;
    if (row < start.row || row > end.row) return false;
    if (row === start.row && row === end.row)
      return col >= start.col && col < end.col;
    if (row === start.row) return col >= start.col;
    if (row === end.row) return col < end.col;
    return true;
  }

  // --- Keyboard handling ---

  function handleKey(
    ch: string | undefined,
    key: blessed.Widgets.Events.IKeyEventArg
  ) {
    // Bracketed paste handling — terminal sends ESC[200~ ... ESC[201~
    if (key.full === "\x1b[200~" || key.name === "bracketed-paste-start" || (ch && ch.includes("\x1b[200~"))) {
      isPasting = true;
      pasteBuffer = "";
      // Switch to insert mode for paste if in normal mode
      if (vimEnabled && vim.mode === "normal") {
        vim.mode = "insert";
      }
      return;
    }
    if (key.full === "\x1b[201~" || key.name === "bracketed-paste-end" || (ch && ch.includes("\x1b[201~"))) {
      if (pasteBuffer) {
        engine.insertText(pasteBuffer);
        highlightDirty = true;
      }
      isPasting = false;
      pasteBuffer = "";
      render();
      return;
    }
    if (isPasting) {
      if (ch) pasteBuffer += ch;
      return;
    }

    if (findMode) {
      handleFindKey(ch, key);
      return;
    }

    // Vim mode intercept
    if (vimEnabled) {
      const consumed = handleVimKey(engine, vim, ch, key, {
        save: () => engine.saveFile().then((ok) => {
          showStatus(ok ? `Written: ${engine.filePath}` : "No file path");
          return ok;
        }),
        quit: () => win.close(),
        copyToClipboard: (text) => host.screen.copyToClipboard(text),
        flash: (msg) => showStatus(msg),
        render: () => { highlightDirty = true; render(); },
      }, height());

      if (consumed) {
        // If vim switched to insert mode, let subsequent keys fall through
        return;
      }
      // In insert mode, vim returns false — fall through to normal editor handling
    }

    const shift = key.shift ?? false;
    const ctrl = key.ctrl ?? false;
    const meta = key.meta ?? false;

    // Navigation
    if (key.name === "left" && ctrl) {
      engine.moveWordLeft(shift);
    } else if (key.name === "right" && ctrl) {
      engine.moveWordRight(shift);
    } else if (key.name === "left") {
      engine.moveLeft(shift);
    } else if (key.name === "right") {
      engine.moveRight(shift);
    } else if (key.name === "up") {
      engine.moveUp(shift);
    } else if (key.name === "down") {
      engine.moveDown(shift);
    } else if (key.name === "home") {
      engine.moveHome(shift);
    } else if (key.name === "end") {
      engine.moveEnd(shift);
    } else if (key.name === "pageup") {
      engine.pageUp(height(), shift);
    } else if (key.name === "pagedown") {
      engine.pageDown(height(), shift);
    }
    // Ctrl combos
    else if (ctrl && key.name === "s") {
      engine.saveFile().then((ok) => {
        showStatus(ok ? `Saved ${engine.filePath}` : "No file path");
      });
    } else if (ctrl && key.name === "z") {
      engine.undo(); highlightDirty = true;
    } else if (ctrl && key.name === "y") {
      engine.redo(); highlightDirty = true;
    } else if (ctrl && key.name === "f") {
      findMode = true;
      findInput = "";
    } else if (ctrl && key.name === "a") {
      engine.selectAll();
    } else if (ctrl && key.name === "c") {
      const text = engine.getSelectedText();
      if (text) {
        host.screen.copyToClipboard(text);
        showStatus(`Copied ${text.length} chars`);
      }
    } else if (ctrl && key.name === "x") {
      const text = engine.getSelectedText();
      if (text) {
        host.screen.copyToClipboard(text);
        engine.deleteSelection(); highlightDirty = true;
        showStatus(`Cut ${text.length} chars`);
      }
    } else if (ctrl && key.name === "g") {
      findMode = true;
      findInput = ":";
    } else if (ctrl && key.name === "b") {
      toggleSidebar();
      return;
    } else if (ctrl && key.name === "o") {
      // Open file picker
      const startDir = engine.filePath
        ? require("path").dirname(engine.filePath)
        : host.repoRoot;
      host.pickFile("Open File", startDir, (filePath) => {
        engine.loadFile(filePath).then(() => {
          highlightDirty = true;
          loadSidebarFiles();
          sidebarVisible = true;
          const sl = SIDEBAR_WIDTH + 1;
          gutterBox.left = sl;
          textBox.left = sl + (Number(gutterBox.width) || 5);
          sidebarHeader.show();
          sidebarBox.show();
          sidebarDivider.show();
          win.setTitle(`Edit: ${filePath.split("/").pop()}`);
          render();
        });
      }, {
        fileFilter: (fp, isDir) => isDir || /\.(ts|tsx|js|jsx|json|md|txt|py|rs|go|c|cpp|h|sh|bash|css|html|xml|yaml|yml|toml)$/i.test(fp),
      });
      return;
    }
    // Editing (mark highlight dirty)
    else if (key.name === "return" || key.name === "enter") {
      engine.insertNewline(); highlightDirty = true;
    } else if (key.name === "backspace") {
      engine.backspace(); highlightDirty = true;
    } else if (key.name === "delete") {
      engine.deleteForward(); highlightDirty = true;
    } else if (key.name === "tab") {
      engine.insertTab(); highlightDirty = true;
    }
    // Regular character
    else if (
      ch &&
      ch.length === 1 &&
      !ctrl &&
      !meta &&
      ch.charCodeAt(0) >= 32
    ) {
      engine.insertText(ch); highlightDirty = true;
    }

    render();
  }

  function height(): number {
    return ((win.body as any).height as number || 20) - 2; // minus header + status
  }

  function handleFindKey(
    ch: string | undefined,
    key: blessed.Widgets.Events.IKeyEventArg
  ) {
    if (key.name === "escape") {
      findMode = false;
      engine.clearSelection();
    } else if (key.name === "return" || key.name === "enter") {
      if (findInput.startsWith(":")) {
        const lineNum = parseInt(findInput.slice(1), 10);
        if (!isNaN(lineNum)) {
          engine.goToLine(lineNum);
          showStatus(`Jumped to line ${lineNum}`);
        }
        findMode = false;
      } else {
        engine.findNext();
      }
    } else if (key.name === "backspace") {
      findInput = findInput.slice(0, -1);
      if (!findInput.startsWith(":")) engine.find(findInput);
    } else if (key.ctrl && key.name === "n") {
      engine.findNext();
    } else if (key.ctrl && key.name === "p") {
      engine.findPrev();
    } else if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32) {
      findInput += ch;
      if (!findInput.startsWith(":")) engine.find(findInput);
    }
    render();
  }

  // --- Mouse handling ---

  function handleMouse(data: blessed.Widgets.Events.IMouseEventArg) {
    const boxPos = textBox as any;
    const relX = data.x - (boxPos.aleft || 0) - (boxPos.ileft || 0);
    const relY = data.y - (boxPos.atop || 0) - (boxPos.itop || 0);

    if (relX < 0 || relY < 0) return;

    const col = engine.scroll.col + relX;
    const row = engine.scroll.row + relY;

    if (data.action === "mousedown") {
      engine.moveCursor(row, col, false);
      render();
    }
  }

  // Wire up events
  textBox.on("keypress", handleKey);
  textBox.on("mouse", handleMouse);

  // Focus the text box
  textBox.focus();
  win.setFocusTarget(textBox);

  // Cursor blink timer
  createTimer(
    () => {
      render();
    },
    530,
    timers
  );

  // --- Lifecycle ---

  win.describeState(() => engine.describe());
  win.captureText(() => engine.text);

  win.onRestyle(() => {
    theme = getTheme(host);
    const t3 = host.theme();
    gutterBox.style = { fg: theme.gutterFg, bg: theme.gutterBg };
    textBox.style = { fg: theme.fg, bg: theme.bg };
    statusBar.style = { fg: theme.statusFg, bg: theme.statusBg };
    headerBar.style = { fg: theme.statusFg, bg: theme.statusBg };
    sidebarHeader.style = { fg: t3.accent.fg, bg: t3.header.bg };
    sidebarBox.style = { fg: theme.fg, bg: theme.bg };
    sidebarDivider.style = { fg: t3.muted.fg, bg: theme.bg };
    render();
  });

  win.onResize(() => render());

  win.onCleanup(() => {
    clearTimers(timers);
    if (statusTimeout) clearTimeout(statusTimeout);
  });

  // Initial render
  render();
  win.focus();
}
