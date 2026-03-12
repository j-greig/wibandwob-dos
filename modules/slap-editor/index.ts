/**
 * Slap Editor — Sublime-like code editor microapp for WibWob-DOS.
 *
 * Pure blessed rendering, no native addons.
 * Features: gutter, cursor, selection, undo/redo, find, save, clipboard.
 */
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import { EditorEngine, type EditorTheme } from "./editor-engine.js";

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

/** blessed.escape is unreliable — do it ourselves */
function esc(s: string): string {
  return s.replace(/\{/g, "{open}").replace(/\}/g, "{close}");
  // blessed tags: {open} and {close} aren't real tags, so let's use a
  // different approach — encode then decode
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

  // --- Blessed widgets ---
  // Use two separate boxes: gutter (no tags) and text area (no tags).
  // For cursor/selection we'll use tags only on the text box.

  const gutterBox = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    width: 5, // updated dynamically
    bottom: 1,
    style: { fg: theme.gutterFg, bg: theme.gutterBg },
  });

  const textBox = blessed.box({
    parent: win.body,
    top: 0,
    left: 5, // updated dynamically
    right: 0,
    bottom: 1,
    style: { fg: theme.fg, bg: theme.bg },
    tags: true,
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

  function render() {
    const totalWidth = (win.body as any).width as number || 80;
    const height = ((win.body as any).height as number || 20) - 1; // minus status bar
    const gutterW = engine.gutterWidth();

    // Update gutter width
    gutterBox.width = gutterW;
    textBox.left = gutterW;

    const textWidth = totalWidth - gutterW;
    engine.ensureCursorVisible(textWidth, height);

    const selRange = engine.getSelectionRange();

    // Gutter content
    const gutterLines: string[] = [];
    const textLines: string[] = [];

    for (let y = 0; y < height; y++) {
      const row = engine.scroll.row + y;
      if (row >= engine.lineCount) {
        gutterLines.push(" ".repeat(gutterW));
        textLines.push("");
        continue;
      }

      // Gutter
      gutterLines.push(String(row + 1).padStart(gutterW - 1) + " ");

      // Text — build with blessed tags for cursor and selection
      const fullLine = engine.lines[row];
      let lineStr = "";

      for (let x = 0; x < textWidth; x++) {
        const col = engine.scroll.col + x;
        const rawCh = col < fullLine.length ? fullLine[col] : " ";
        // Escape blessed tag chars — blessed uses {open} and {close}
        const ch = rawCh === "{" ? "{open}" : rawCh === "}" ? "{close}" : rawCh;

        const isCursor = row === engine.cursor.row && col === engine.cursor.col;
        const isSelected = selRange !== null && isInSelection(row, col, selRange);

        if (isCursor) {
          lineStr += `{${theme.cursorFg}-fg}{${theme.cursorBg}-bg}${ch}{/}`;
        } else if (isSelected) {
          lineStr += `{${theme.selectionFg}-fg}{${theme.selectionBg}-bg}${ch}{/}`;
        } else {
          lineStr += ch;
        }
      }

      textLines.push(lineStr);
    }

    gutterBox.setContent(gutterLines.join("\n"));
    textBox.setContent(textLines.join("\n"));

    // Status bar
    const desc = engine.describe();
    let status = "";
    if (findMode) {
      status = ` Find: ${findInput}_ `;
      if (engine.findMatches.length > 0) {
        status += `(${engine.findIndex + 1}/${engine.findMatches.length})`;
      } else if (findInput) {
        status += "(no matches)";
      }
    } else if (statusMessage) {
      status = ` ${statusMessage}`;
    } else {
      const fname = desc.filePath?.split("/").pop() ?? "untitled";
      status = ` ${fname}${desc.dirty ? " [+]" : ""} | Ln ${desc.cursor.row + 1}, Col ${desc.cursor.col + 1} | ${desc.lines} lines`;
    }
    statusBar.setContent(status);

    host.screen.render();
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
      engine.undo();
    } else if (ctrl && key.name === "y") {
      engine.redo();
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
        engine.deleteSelection();
        showStatus(`Cut ${text.length} chars`);
      }
    } else if (ctrl && key.name === "g") {
      findMode = true;
      findInput = ":";
    }
    // Editing
    else if (key.name === "return" || key.name === "enter") {
      engine.insertNewline();
    } else if (key.name === "backspace") {
      engine.backspace();
    } else if (key.name === "delete") {
      engine.deleteForward();
    } else if (key.name === "tab") {
      engine.insertTab();
    }
    // Regular character
    else if (
      ch &&
      ch.length === 1 &&
      !ctrl &&
      !meta &&
      ch.charCodeAt(0) >= 32
    ) {
      engine.insertText(ch);
    }

    render();
  }

  function height(): number {
    return ((win.body as any).height as number || 20) - 1;
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
