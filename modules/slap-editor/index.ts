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
import { highlightCode, HIGHLIGHTED_LANGUAGES } from "../../src/services/syntax-highlight.js";

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
  for (const btn of [btnSave, btnFind, btnGoto]) {
    btn.on("mouseover", () => { btn.style = { ...btnHoverStyle }; host.screen.render(); });
    btn.on("mouseout", () => { btn.style = { ...btnStyle }; host.screen.render(); });
  }
  btnSave.on("click", () => {
    engine.saveFile().then((ok) => {
      showStatus(ok ? `Saved ${engine.filePath}` : "No file path");
    });
  });
  btnFind.on("click", () => { findMode = true; findInput = ""; render(); });
  btnGoto.on("click", () => { findMode = true; findInput = ":"; render(); });

  const gutterBox = blessed.box({
    parent: win.body,
    top: 1,
    left: 0,
    width: 5,
    bottom: 1,
    style: { fg: theme.gutterFg, bg: theme.gutterBg },
  });

  const textBox = blessed.box({
    parent: win.body,
    top: 1,
    left: 5,
    right: 0,
    bottom: 1,
    style: { fg: theme.fg, bg: theme.bg },
    tags: false, // ANSI mode — raw escape codes, no blessed tags
  });

  const statusBar = blessed.box({
    parent: win.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: theme.statusFg, bg: theme.statusBg },
  });

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
    "          Start typing to begin editing.",
    "          Open a file via the command palette.",
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
    const totalWidth = (win.body as any).width as number || 80;
    const viewHeight = ((win.body as any).height as number || 20) - 2; // minus header + status
    const gutterW = engine.gutterWidth() + 1; // extra space for padding

    // Update gutter width
    gutterBox.width = gutterW;
    textBox.left = gutterW;

    const textWidth = Math.max(1, totalWidth - gutterW);
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

      // Gutter — active line shows absolute number bold, others show relative distance
      const isCurrentLine = row === cursorRow;
      if (isCurrentLine) {
        const lineNum = String(row + 1).padStart(gutterW - 1);
        gutterLines.push(`${currentLineGutterBg}${gutterActive}${lineNum} ${A.r}`);
      } else {
        const relDist = Math.abs(row - cursorRow);
        const lineNum = String(relDist).padStart(gutterW - 1);
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
    } else if (statusMessage) {
      statusLeft = ` ${statusMessage}`;
    } else {
      statusLeft = ` Ln ${desc.cursor.row + 1}, Col ${desc.cursor.col + 1}`;
    }
    const scrollPct = engine.lineCount > 1
      ? Math.round((engine.scroll.row / Math.max(1, engine.lineCount - viewHeight)) * 100)
      : 100;
    const pct = Math.min(100, Math.max(0, scrollPct));
    // ANSI styled status bar
    const statusLeftAnsi = findMode || statusMessage
      ? ` ${statusLeft.trim()}`
      : ` ${accentCol}Ln ${desc.cursor.row + 1}${A.r}${dimCol}, Col ${desc.cursor.col + 1}${A.r}`;
    const langColour = hasHighlight ? accentCol : dimCol;
    const statusRightAnsi = `${langColour}${langLabel}${A.r}  ${dimCol}UTF-8  2 sp  ${desc.lines} ln  ${pct}%${A.r} `;
    // Calculate gap (strip ANSI for width)
    const leftPlain = stripAnsi(statusLeftAnsi).length;
    const rightPlain = stripAnsi(statusRightAnsi).length;
    const gap = Math.max(1, totalWidth - leftPlain - rightPlain);
    (statusBar as any).setContent(statusLeftAnsi + " ".repeat(gap) + statusRightAnsi);

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
    if (findMode) {
      handleFindKey(ch, key);
      return;
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
    gutterBox.style = { fg: theme.gutterFg, bg: theme.gutterBg };
    textBox.style = { fg: theme.fg, bg: theme.bg };
    statusBar.style = { fg: theme.statusFg, bg: theme.statusBg };
    headerBar.style = { fg: theme.statusFg, bg: theme.statusBg };
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
