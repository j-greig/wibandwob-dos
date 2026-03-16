/**
 * vim-mode.ts — Vim modal input layer for EditorEngine.
 *
 * Modes: normal, insert, visual (char), visual-line
 * Operators: d (delete), c (change), y (yank), > (indent), < (dedent)
 * Motions: h/j/k/l, w/b/e/W/B/E, 0/$, gg/G, {/}, f/F/t/T{char}, %
 * Text objects: iw/aw (word), i"/a", i(/a(, i{/a{, i[/a[
 * Commands: :w, :q, :wq, :{n} (goto line)
 * Extra: . (dot repeat), ~ (case toggle), r{char} (replace), */#, >>/<<, V (visual-line)
 */

import type { EditorEngine } from "./editor-engine.js";

export type VimMode = "normal" | "insert" | "visual" | "visual-line";

/** Replay descriptor for dot-repeat */
type LastChange =
  | { type: "simple"; action: string; count: number }
  | { type: "replace"; char: string; count: number }
  | { type: "line-op"; operator: string; count: number }
  | { type: "operator-motion"; operator: string; motion: string; count: number }
  | { type: "text-object"; operator: string; kind: "i" | "a"; target: string; count: number };

export interface VimState {
  mode: VimMode;
  pendingOperator: "d" | "c" | "y" | ">" | "<" | null;
  pendingCount: string;
  pendingChar: "f" | "F" | "t" | "T" | null;
  pendingReplace: boolean;
  pendingTextObject: "i" | "a" | null;
  lastCharMotion: { motion: "f" | "F" | "t" | "T"; char: string } | null;
  lastChange: LastChange | null;
  commandBuffer: string; // for : commands
  commandMode: boolean;
  register: string; // yanked text
  statusMessage: string;
}

export function createVimState(): VimState {
  return {
    mode: "normal",
    pendingOperator: null,
    pendingCount: "",
    pendingChar: null,
    pendingReplace: false,
    pendingTextObject: null,
    lastCharMotion: null,
    lastChange: null,
    commandBuffer: "",
    commandMode: false,
    register: "",
    statusMessage: "",
  };
}

export interface VimCallbacks {
  save: () => Promise<boolean>;
  quit: () => void;
  copyToClipboard: (text: string) => void;
  flash: (msg: string) => void;
  render: () => void;
}

/**
 * Process a keypress in vim mode. Returns true if the key was consumed.
 */
export function handleVimKey(
  engine: EditorEngine,
  state: VimState,
  ch: string | undefined,
  key: { name?: string; ctrl?: boolean; shift?: boolean; meta?: boolean; full?: string },
  callbacks: VimCallbacks,
  viewHeight: number,
): boolean {
  state.statusMessage = "";

  // Command mode (:w, :q, :wq, :{n})
  if (state.commandMode) {
    return handleCommandMode(engine, state, ch, key, callbacks);
  }

  // Waiting for replacement char (r{char})
  if (state.pendingReplace) {
    if (ch && ch.length === 1) {
      replaceCharUnderCursor(engine, ch);
      state.lastChange = { type: "replace", char: ch, count: 1 };
      state.pendingReplace = false;
      callbacks.render();
    } else if (key.name === "escape") {
      state.pendingReplace = false;
    }
    return true;
  }

  // Waiting for char target (f/F/t/T)
  if (state.pendingChar) {
    if (ch && ch.length === 1) {
      const selecting = state.pendingOperator !== null || state.mode === "visual" || state.mode === "visual-line";
      executeCharMotion(engine, state, state.pendingChar, ch, selecting);
      state.pendingChar = null;
      if (state.pendingOperator) {
        applyOperatorOnMotion(engine, state, callbacks);
        state.pendingOperator = null;
        state.pendingCount = "";
      }
      callbacks.render();
    } else if (key.name === "escape") {
      state.pendingChar = null;
      state.pendingOperator = null;
    }
    return true;
  }

  // Waiting for text object target (after di, ca, etc.)
  if (state.pendingTextObject) {
    if (ch && ch.length === 1) {
      handleTextObjectTarget(engine, state, ch, callbacks);
      state.pendingTextObject = null;
      state.pendingCount = "";
      callbacks.render();
    } else if (key.name === "escape") {
      state.pendingTextObject = null;
      state.pendingOperator = null;
      state.pendingCount = "";
    }
    return true;
  }

  if (state.mode === "insert") {
    return handleInsertMode(engine, state, ch, key, callbacks);
  }

  if (state.mode === "normal" || state.mode === "visual" || state.mode === "visual-line") {
    return handleNormalMode(engine, state, ch, key, callbacks, viewHeight);
  }

  return false;
}

// ── Insert Mode ──────────────────────────────────────────────────────────────

function handleInsertMode(
  engine: EditorEngine,
  state: VimState,
  ch: string | undefined,
  key: { name?: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
  callbacks: VimCallbacks,
): boolean {
  if (key.name === "escape" || (key.ctrl && key.name === "[")) {
    state.mode = "normal";
    engine.clearSelection();
    // Move cursor left one (vim convention)
    if (engine.cursor.col > 0) engine.moveLeft();
    callbacks.render();
    return true;
  }

  // In insert mode, return false to let the normal editor handle the key
  return false;
}

// ── Normal / Visual Mode ─────────────────────────────────────────────────────

function handleNormalMode(
  engine: EditorEngine,
  state: VimState,
  ch: string | undefined,
  key: { name?: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
  callbacks: VimCallbacks,
  viewHeight: number,
): boolean {
  const ctrl = key.ctrl ?? false;

  // Count prefix (1-9 first digit, 0-9 after)
  if (ch && ch >= "1" && ch <= "9" && !state.pendingOperator && !state.pendingCount) {
    state.pendingCount = ch;
    return true;
  }
  if (ch && ch >= "0" && ch <= "9" && state.pendingCount) {
    state.pendingCount += ch;
    return true;
  }

  const count = state.pendingCount ? Math.min(parseInt(state.pendingCount, 10), 9999) : 1;

  // ── Text object start (i/a when operator is pending) ───────────────────

  if ((ch === "i" || ch === "a") && state.pendingOperator) {
    state.pendingTextObject = ch;
    return true;
  }

  // ── Mode switches (only when no pending operator) ──────────────────────

  if (ch === "i" && state.mode === "normal") {
    state.mode = "insert";
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "a" && state.mode === "normal") {
    state.mode = "insert";
    engine.moveRight();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "A" && state.mode === "normal") {
    state.mode = "insert";
    engine.moveEnd();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "I" && state.mode === "normal") {
    state.mode = "insert";
    moveToFirstNonWhitespace(engine);
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "o" && state.mode === "normal") {
    engine.moveEnd();
    engine.insertNewline();
    state.mode = "insert";
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "O" && state.mode === "normal") {
    engine.moveHome();
    engine.insertNewline();
    engine.moveUp();
    state.mode = "insert";
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // v — toggle char-visual mode
  if (ch === "v" && (state.mode === "normal" || state.mode === "visual-line")) {
    state.mode = "visual";
    engine.anchor = { ...engine.cursor };
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "v" && state.mode === "visual") {
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // V — toggle visual-line mode
  if (ch === "V" && (state.mode === "normal" || state.mode === "visual")) {
    state.mode = "visual-line";
    engine.anchor = { row: engine.cursor.row, col: 0 };
    engine.moveCursor(engine.cursor.row, (engine.lines[engine.cursor.row] ?? "").length, true);
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (ch === "V" && state.mode === "visual-line") {
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  if (key.name === "escape") {
    state.mode = "normal";
    state.pendingOperator = null;
    state.pendingCount = "";
    state.pendingReplace = false;
    state.pendingTextObject = null;
    engine.clearSelection();
    callbacks.render();
    return true;
  }

  // ── Operator-pending: d, c, y, >, < ───────────────────────────────────

  if ((ch === "d" || ch === "c" || ch === "y" || ch === ">" || ch === "<") && !state.pendingOperator && state.mode === "normal") {
    state.pendingOperator = ch;
    callbacks.render();
    return true;
  }

  // dd, cc, yy, >>, << — line operations
  if (state.pendingOperator && ch === state.pendingOperator) {
    if (state.pendingOperator === ">" || state.pendingOperator === "<") {
      // Indent/dedent current line(s)
      const dir = state.pendingOperator;
      for (let i = 0; i < count; i++) {
        indentLine(engine, engine.cursor.row, dir);
      }
      state.lastChange = { type: "line-op", operator: dir + dir, count };
    } else {
      for (let i = 0; i < count; i++) {
        executeLinewiseOp(engine, state, callbacks);
      }
      if (state.pendingOperator === "d" || state.pendingOperator === "c") {
        state.lastChange = { type: "line-op", operator: state.pendingOperator + state.pendingOperator, count };
      }
    }
    state.pendingOperator = null;
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // Char motions: f/F/t/T
  if (ch === "f" || ch === "F" || ch === "t" || ch === "T") {
    state.pendingChar = ch;
    return true;
  }

  // Semicolon/comma: repeat last char motion
  if (ch === ";") {
    if (state.lastCharMotion) {
      const selecting = state.mode === "visual" || state.mode === "visual-line";
      executeCharMotion(engine, state, state.lastCharMotion.motion, state.lastCharMotion.char, selecting);
      callbacks.render();
    }
    state.pendingCount = "";
    return true;
  }
  if (ch === ",") {
    if (state.lastCharMotion) {
      const reverse = { f: "F", F: "f", t: "T", T: "t" } as const;
      const selecting = state.mode === "visual" || state.mode === "visual-line";
      executeCharMotion(engine, state, reverse[state.lastCharMotion.motion], state.lastCharMotion.char, selecting);
      callbacks.render();
    }
    state.pendingCount = "";
    return true;
  }

  // Command mode
  if (ch === ":") {
    state.commandMode = true;
    state.commandBuffer = "";
    callbacks.render();
    return true;
  }

  // ── Motions ────────────────────────────────────────────────────────────

  // In visual-line mode, we need whole-line selection; in visual or operator-pending, char selection
  const selecting = state.mode === "visual" || state.mode === "visual-line" || state.pendingOperator !== null;
  let motionExecuted = false;

  if (ch === "h" || key.name === "left") {
    for (let i = 0; i < count; i++) engine.moveLeft(selecting);
    motionExecuted = true;
  } else if (ch === "l" || key.name === "right") {
    for (let i = 0; i < count; i++) engine.moveRight(selecting);
    motionExecuted = true;
  } else if (ch === "j" || key.name === "down") {
    for (let i = 0; i < count; i++) engine.moveDown(selecting);
    if (state.mode === "visual-line") expandToFullLines(engine);
    motionExecuted = true;
  } else if (ch === "k" || key.name === "up") {
    for (let i = 0; i < count; i++) engine.moveUp(selecting);
    if (state.mode === "visual-line") expandToFullLines(engine);
    motionExecuted = true;
  } else if (ch === "w") {
    for (let i = 0; i < count; i++) engine.moveWordRight(selecting);
    motionExecuted = true;
  } else if (ch === "b") {
    for (let i = 0; i < count; i++) engine.moveWordLeft(selecting);
    motionExecuted = true;
  } else if (ch === "e") {
    for (let i = 0; i < count; i++) moveWordEnd(engine, selecting);
    motionExecuted = true;
  } else if (ch === "W") {
    // WORD motion: whitespace-delimited forward
    for (let i = 0; i < count; i++) moveWORDForward(engine, selecting);
    motionExecuted = true;
  } else if (ch === "B") {
    // WORD motion: whitespace-delimited backward
    for (let i = 0; i < count; i++) moveWORDBackward(engine, selecting);
    motionExecuted = true;
  } else if (ch === "E") {
    // WORD motion: whitespace-delimited end
    for (let i = 0; i < count; i++) moveWORDEnd(engine, selecting);
    motionExecuted = true;
  } else if (ch === "0") {
    engine.moveHome(selecting);
    motionExecuted = true;
  } else if (ch === "$") {
    engine.moveEnd(selecting);
    motionExecuted = true;
  } else if (ch === "^") {
    moveToFirstNonWhitespace(engine);
    motionExecuted = true;
  } else if (ch === "G") {
    engine.goToLine(engine.lines.length);
    motionExecuted = true;
  } else if (ch === "g") {
    // gg — go to top (simplified: single g also goes to top)
    engine.goToLine(count > 1 ? count : 1);
    state.pendingCount = "";
    motionExecuted = true;
  } else if (ch === "{") {
    for (let i = 0; i < count; i++) moveParagraph(engine, -1, selecting);
    motionExecuted = true;
  } else if (ch === "}") {
    for (let i = 0; i < count; i++) moveParagraph(engine, 1, selecting);
    motionExecuted = true;
  } else if (ch === "%") {
    // Match bracket
    const match = findMatchingBracket(engine);
    if (match) {
      engine.moveCursor(match.row, match.col, selecting);
    }
    motionExecuted = true;
  } else if (ctrl && key.name === "d") {
    engine.pageDown(Math.floor(viewHeight / 2));
    motionExecuted = true;
  } else if (ctrl && key.name === "u") {
    engine.pageUp(Math.floor(viewHeight / 2));
    motionExecuted = true;
  }

  // ── Single-key operations (non-motion) ─────────────────────────────────

  if (!motionExecuted) {
    if (ch === "x") {
      for (let i = 0; i < count; i++) engine.deleteForward();
      state.lastChange = { type: "simple", action: "x", count };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "D") {
      selectToEndOfLine(engine);
      state.register = engine.getSelectedText();
      engine.deleteSelection();
      engine.clearSelection();
      state.lastChange = { type: "simple", action: "D", count: 1 };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "C") {
      selectToEndOfLine(engine);
      state.register = engine.getSelectedText();
      engine.deleteSelection();
      engine.clearSelection();
      state.mode = "insert";
      state.lastChange = { type: "simple", action: "C", count: 1 };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "p") {
      const text = state.register || getSystemClipboard();
      if (text) {
        if (text.endsWith("\n")) {
          // Linewise paste: insert below current line
          const row = engine.cursor.row;
          engine.lines.splice(row + 1, 0, text.slice(0, -1));
          engine.moveCursor(row + 1, 0);
          engine.dirty = true;
        } else {
          engine.moveRight();
          engine.insertText(text);
        }
      }
      state.lastChange = { type: "simple", action: "p", count: 1 };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "P") {
      const text = state.register || getSystemClipboard();
      if (text) {
        if (text.endsWith("\n")) {
          // Linewise paste: insert above current line
          const row = engine.cursor.row;
          engine.lines.splice(row, 0, text.slice(0, -1));
          engine.moveCursor(row, 0);
          engine.dirty = true;
        } else {
          engine.insertText(text);
        }
      }
      state.lastChange = { type: "simple", action: "P", count: 1 };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "u") {
      engine.undo();
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ctrl && key.name === "r") {
      engine.redo();
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "J") {
      // Join lines
      const row = engine.cursor.row;
      if (row < engine.lines.length - 1) {
        const currentLine = engine.lines[row] ?? "";
        const nextLine = engine.lines[row + 1] ?? "";
        engine.lines[row] = currentLine.trimEnd() + " " + nextLine.trimStart();
        engine.lines.splice(row + 1, 1);
        engine.dirty = true;
      }
      state.lastChange = { type: "simple", action: "J", count: 1 };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }

    // ~ — toggle case of char under cursor
    if (ch === "~") {
      for (let i = 0; i < count; i++) {
        toggleCaseAtCursor(engine);
      }
      state.lastChange = { type: "simple", action: "~", count };
      state.pendingCount = "";
      callbacks.render();
      return true;
    }

    // r — replace single char (wait for target char)
    if (ch === "r") {
      state.pendingReplace = true;
      state.pendingCount = "";
      return true;
    }

    // . — dot repeat last change
    if (ch === ".") {
      if (state.lastChange) {
        replayLastChange(engine, state, callbacks, count);
      }
      state.pendingCount = "";
      callbacks.render();
      return true;
    }

    // * — search word under cursor forward
    if (ch === "*") {
      searchWordUnderCursor(engine, state, true);
      state.pendingCount = "";
      callbacks.render();
      return true;
    }

    // # — search word under cursor backward
    if (ch === "#") {
      searchWordUnderCursor(engine, state, false);
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
  }

  // If a motion was executed with a pending operator, apply the operator
  if (motionExecuted && state.pendingOperator) {
    if (state.pendingOperator === ">" || state.pendingOperator === "<") {
      // Indent/dedent the lines in the selection range
      const range = engine.getSelectionRange();
      if (range) {
        for (let row = range.start.row; row <= range.end.row; row++) {
          indentLine(engine, row, state.pendingOperator);
        }
      }
      engine.clearSelection();
    } else {
      applyOperatorOnMotion(engine, state, callbacks);
    }
    state.pendingOperator = null;
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // If motion in visual-line mode, ensure full-line selection
  if (motionExecuted && state.mode === "visual-line") {
    expandToFullLines(engine);
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // If motion in visual mode, just render
  if (motionExecuted && state.mode === "visual") {
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // ── Visual mode operations on selection ────────────────────────────────

  if ((state.mode === "visual" || state.mode === "visual-line") && (ch === "d" || ch === "x")) {
    state.register = engine.getSelectedText();
    if (state.mode === "visual-line") state.register += "\n";
    engine.deleteSelection();
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if ((state.mode === "visual" || state.mode === "visual-line") && ch === "y") {
    state.register = engine.getSelectedText();
    if (state.mode === "visual-line") state.register += "\n";
    callbacks.copyToClipboard(state.register);
    state.mode = "normal";
    engine.clearSelection();
    state.statusMessage = `Yanked ${state.register.split("\n").length} lines`;
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if ((state.mode === "visual" || state.mode === "visual-line") && ch === "c") {
    state.register = engine.getSelectedText();
    if (state.mode === "visual-line") state.register += "\n";
    engine.deleteSelection();
    state.mode = "insert";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if ((state.mode === "visual" || state.mode === "visual-line") && ch === ">") {
    const range = engine.getSelectionRange();
    if (range) {
      for (let row = range.start.row; row <= range.end.row; row++) {
        indentLine(engine, row, ">");
      }
    }
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if ((state.mode === "visual" || state.mode === "visual-line") && ch === "<") {
    const range = engine.getSelectionRange();
    if (range) {
      for (let row = range.start.row; row <= range.end.row; row++) {
        indentLine(engine, row, "<");
      }
    }
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  if (motionExecuted) {
    state.pendingCount = "";
    callbacks.render();
    return true;
  }

  // Unrecognized key in normal mode — consume to prevent insertion
  state.pendingCount = "";
  return true;
}

// ── Command Mode (:w, :q, :wq, :{n}) ────────────────────────────────────────

function handleCommandMode(
  engine: EditorEngine,
  state: VimState,
  ch: string | undefined,
  key: { name?: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
  callbacks: VimCallbacks,
): boolean {
  if (key.name === "escape") {
    state.commandMode = false;
    state.commandBuffer = "";
    callbacks.render();
    return true;
  }
  if (key.name === "return" || key.name === "enter") {
    const cmd = state.commandBuffer.trim();
    state.commandMode = false;
    state.commandBuffer = "";

    if (cmd === "w") {
      callbacks.save().then((ok) => {
        state.statusMessage = ok ? `Written: ${engine.filePath}` : "No file path";
        callbacks.render();
      });
    } else if (cmd === "q") {
      callbacks.quit();
    } else if (cmd === "wq" || cmd === "x") {
      callbacks.save().then(() => callbacks.quit());
    } else if (/^\d+$/.test(cmd)) {
      engine.goToLine(parseInt(cmd, 10));
      callbacks.render();
    } else {
      state.statusMessage = `Unknown command: :${cmd}`;
      callbacks.render();
    }
    return true;
  }
  if (key.name === "backspace") {
    state.commandBuffer = state.commandBuffer.slice(0, -1);
    if (state.commandBuffer.length === 0) {
      state.commandMode = false;
    }
    callbacks.render();
    return true;
  }
  if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32) {
    state.commandBuffer += ch;
    callbacks.render();
    return true;
  }
  return true;
}

// ── WORD motions (whitespace-delimited) ──────────────────────────────────────

/** W — move to start of next WORD (whitespace-delimited) */
function moveWORDForward(engine: EditorEngine, selecting = false): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  let col = engine.cursor.col;

  // At end of line, go to next line
  if (col >= line.length && engine.cursor.row < engine.lines.length - 1) {
    engine.moveCursor(engine.cursor.row + 1, 0, selecting);
    return;
  }

  // Skip current non-whitespace (current WORD)
  while (col < line.length && !/\s/.test(line[col]!)) col++;
  // Skip whitespace
  while (col < line.length && /\s/.test(line[col]!)) col++;

  if (col >= line.length && engine.cursor.row < engine.lines.length - 1) {
    engine.moveCursor(engine.cursor.row + 1, 0, selecting);
    return;
  }

  engine.moveCursor(engine.cursor.row, Math.min(col, line.length), selecting);
}

/** B — move to start of previous WORD */
function moveWORDBackward(engine: EditorEngine, selecting = false): void {
  if (engine.cursor.col === 0 && engine.cursor.row > 0) {
    const prevLen = (engine.lines[engine.cursor.row - 1] ?? "").length;
    engine.moveCursor(engine.cursor.row - 1, prevLen, selecting);
    return;
  }
  const line = engine.lines[engine.cursor.row] ?? "";
  let col = engine.cursor.col - 1;
  // Skip whitespace backward
  while (col > 0 && /\s/.test(line[col]!)) col--;
  // Skip non-whitespace backward (find start of WORD)
  while (col > 0 && !/\s/.test(line[col - 1]!)) col--;
  engine.moveCursor(engine.cursor.row, Math.max(0, col), selecting);
}

/** E — move to end of current/next WORD */
function moveWORDEnd(engine: EditorEngine, selecting = false): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  let col = engine.cursor.col + 1;

  // At end of line, go to next line
  if (col >= line.length) {
    if (engine.cursor.row < engine.lines.length - 1) {
      const nextLine = engine.lines[engine.cursor.row + 1] ?? "";
      let nc = 0;
      // Skip leading whitespace
      while (nc < nextLine.length && /\s/.test(nextLine[nc]!)) nc++;
      // Find end of WORD
      while (nc < nextLine.length - 1 && !/\s/.test(nextLine[nc + 1]!)) nc++;
      engine.moveCursor(engine.cursor.row + 1, nc, selecting);
    }
    return;
  }

  // Skip whitespace
  while (col < line.length && /\s/.test(line[col]!)) col++;
  // Skip to end of WORD (last non-whitespace before next whitespace)
  while (col < line.length - 1 && !/\s/.test(line[col + 1]!)) col++;
  engine.moveCursor(engine.cursor.row, Math.min(col, line.length - 1), selecting);
}

/** e — move to end of current/next word (keyword-aware) */
function moveWordEnd(engine: EditorEngine, selecting = false): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  let col = engine.cursor.col + 1;

  // At end of line, go to next line
  if (col >= line.length) {
    if (engine.cursor.row < engine.lines.length - 1) {
      const nextLine = engine.lines[engine.cursor.row + 1] ?? "";
      let nc = 0;
      while (nc < nextLine.length && /\s/.test(nextLine[nc]!)) nc++;
      if (nc < nextLine.length) {
        const isWord = /\w/.test(nextLine[nc]!);
        while (nc < nextLine.length - 1) {
          const nextIsWord = /\w/.test(nextLine[nc + 1]!);
          const nextIsSpace = /\s/.test(nextLine[nc + 1]!);
          if (nextIsSpace || nextIsWord !== isWord) break;
          nc++;
        }
      }
      engine.moveCursor(engine.cursor.row + 1, nc, selecting);
    }
    return;
  }

  // Skip whitespace
  while (col < line.length && /\s/.test(line[col]!)) col++;
  if (col >= line.length) {
    engine.moveCursor(engine.cursor.row, line.length - 1, selecting);
    return;
  }

  // Determine char type and advance through same type
  const isWord = /\w/.test(line[col]!);
  while (col < line.length - 1) {
    const nextIsWord = /\w/.test(line[col + 1]!);
    const nextIsSpace = /\s/.test(line[col + 1]!);
    if (nextIsSpace || nextIsWord !== isWord) break;
    col++;
  }

  engine.moveCursor(engine.cursor.row, col, selecting);
}

// ── Text Objects ─────────────────────────────────────────────────────────────

function handleTextObjectTarget(
  engine: EditorEngine,
  state: VimState,
  target: string,
  callbacks: VimCallbacks,
): void {
  const kind = state.pendingTextObject!;
  const range = findTextObjectRange(engine, kind, target);

  if (!range) {
    state.pendingOperator = null;
    return;
  }

  // Set selection to the text object range
  engine.anchor = { row: range.startRow, col: range.startCol };
  engine.moveCursor(range.endRow, range.endCol, true);

  if (state.pendingOperator) {
    const op = state.pendingOperator;
    applyOperatorOnMotion(engine, state, callbacks);
    state.lastChange = { type: "text-object", operator: op, kind, target, count: 1 };
    state.pendingOperator = null;
  }
}

function findTextObjectRange(
  engine: EditorEngine,
  kind: "i" | "a",
  target: string,
): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  if (target === "w") return findWordObject(engine, kind);
  if (target === '"' || target === "'" || target === "`") return findQuoteObject(engine, kind, target);
  if (target === "(" || target === ")" || target === "b") return findDelimiterObject(engine, kind, "(", ")");
  if (target === "{" || target === "}" || target === "B") return findDelimiterObject(engine, kind, "{", "}");
  if (target === "[" || target === "]") return findDelimiterObject(engine, kind, "[", "]");
  return null;
}

/** Find word boundaries around cursor for iw/aw text objects */
function findWordObject(
  engine: EditorEngine,
  kind: "i" | "a",
): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const row = engine.cursor.row;
  const line = engine.lines[row] ?? "";
  let col = Math.min(engine.cursor.col, Math.max(0, line.length - 1));

  if (line.length === 0) return null;

  const isWordCh = (c: string) => /\w/.test(c);

  // If on whitespace, find nearest word
  if (col < line.length && /\s/.test(line[col]!)) {
    // Try to find a word char to the right
    let right = col;
    while (right < line.length && /\s/.test(line[right]!)) right++;
    if (right < line.length) {
      col = right;
    } else {
      // Try left
      let left = col;
      while (left >= 0 && /\s/.test(line[left]!)) left--;
      if (left < 0) return null;
      col = left;
    }
  }

  // Determine if we're on a word char or punctuation
  const onWord = col < line.length && isWordCh(line[col]!);

  // Find boundaries of current word/punct sequence
  let start = col;
  let end = col + 1;

  if (onWord) {
    while (start > 0 && isWordCh(line[start - 1]!)) start--;
    while (end < line.length && isWordCh(line[end]!)) end++;
  } else {
    // Punctuation object
    while (start > 0 && !isWordCh(line[start - 1]!) && !/\s/.test(line[start - 1]!)) start--;
    while (end < line.length && !isWordCh(line[end]!) && !/\s/.test(line[end]!)) end++;
  }

  if (kind === "a") {
    // Include trailing whitespace, or leading if no trailing
    let trailEnd = end;
    while (trailEnd < line.length && /\s/.test(line[trailEnd]!)) trailEnd++;
    if (trailEnd > end) {
      end = trailEnd;
    } else {
      while (start > 0 && /\s/.test(line[start - 1]!)) start--;
    }
  }

  return { startRow: row, startCol: start, endRow: row, endCol: end };
}

/** Find quote boundaries on current line for i"/a" etc. */
function findQuoteObject(
  engine: EditorEngine,
  kind: "i" | "a",
  quote: string,
): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const row = engine.cursor.row;
  const line = engine.lines[row] ?? "";
  const col = engine.cursor.col;

  // Find the quote pair surrounding the cursor
  let openIdx = -1;
  let closeIdx = -1;

  // Look for quotes on the line, skipping escaped ones
  const quotePositions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === quote && (i === 0 || line[i - 1] !== "\\")) {
      quotePositions.push(i);
    }
  }

  // Find the pair that contains the cursor
  for (let i = 0; i < quotePositions.length - 1; i += 2) {
    const open = quotePositions[i]!;
    const close = quotePositions[i + 1]!;
    if (col >= open && col <= close) {
      openIdx = open;
      closeIdx = close;
      break;
    }
  }

  // If cursor is not between quotes, try first pair after cursor
  if (openIdx === -1 && quotePositions.length >= 2) {
    for (let i = 0; i < quotePositions.length - 1; i += 2) {
      if (quotePositions[i]! >= col) {
        openIdx = quotePositions[i]!;
        closeIdx = quotePositions[i + 1]!;
        break;
      }
    }
  }

  if (openIdx === -1 || closeIdx === -1) return null;

  if (kind === "i") {
    return { startRow: row, startCol: openIdx + 1, endRow: row, endCol: closeIdx };
  }
  // "a" includes the quotes
  return { startRow: row, startCol: openIdx, endRow: row, endCol: closeIdx + 1 };
}

/** Find matching delimiter pair for i(/a(, i{/a{, i[/a[ */
function findDelimiterObject(
  engine: EditorEngine,
  kind: "i" | "a",
  open: string,
  close: string,
): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const { row, col } = engine.cursor;

  // Search backward for opening delimiter
  let depth = 0;
  let openRow = -1;
  let openCol = -1;

  // Check if cursor is on the delimiter itself
  const curLine = engine.lines[row] ?? "";
  if (curLine[col] === open) {
    openRow = row;
    openCol = col;
  } else if (curLine[col] === close) {
    // On closing delimiter — search backward for the opener
    depth = 1;
  } else {
    // Not on a delimiter — search backward for the opener
    depth = 1;
  }

  if (openRow === -1) {
    // Search backward for unmatched opening delimiter
    let r = row;
    let c = curLine[col] === close ? col - 1 : col;

    while (r >= 0) {
      const line = engine.lines[r] ?? "";
      if (r !== row) c = line.length - 1;
      while (c >= 0) {
        if (line[c] === close) depth++;
        else if (line[c] === open) {
          depth--;
          if (depth === 0) {
            openRow = r;
            openCol = c;
            break;
          }
        }
        c--;
      }
      if (openRow !== -1) break;
      r--;
    }
  }

  if (openRow === -1) return null;

  // Search forward for matching closing delimiter
  depth = 1;
  let closeRow = -1;
  let closeCol = -1;
  let r = openRow;
  let c = openCol + 1;

  while (r < engine.lines.length) {
    const line = engine.lines[r] ?? "";
    while (c < line.length) {
      if (line[c] === open) depth++;
      else if (line[c] === close) {
        depth--;
        if (depth === 0) {
          closeRow = r;
          closeCol = c;
          break;
        }
      }
      c++;
    }
    if (closeRow !== -1) break;
    r++;
    c = 0;
  }

  if (closeRow === -1) return null;

  if (kind === "i") {
    // Inner: between delimiters (exclusive)
    return { startRow: openRow, startCol: openCol + 1, endRow: closeRow, endCol: closeCol };
  }
  // Around: including delimiters
  return { startRow: openRow, startCol: openCol, endRow: closeRow, endCol: closeCol + 1 };
}

// ── Bracket matching (%) ─────────────────────────────────────────────────────

function findMatchingBracket(
  engine: EditorEngine,
): { row: number; col: number } | null {
  const line = engine.lines[engine.cursor.row] ?? "";
  const ch = line[engine.cursor.col];
  if (!ch) return null;

  const pairs: Record<string, string> = {
    "(": ")", ")": "(",
    "{": "}", "}": "{",
    "[": "]", "]": "[",
  };

  const target = pairs[ch];
  if (!target) return null;

  const isOpen = "({[".includes(ch);

  if (isOpen) {
    // Search forward
    let depth = 1;
    let row = engine.cursor.row;
    let col = engine.cursor.col + 1;
    while (row < engine.lines.length) {
      const l = engine.lines[row] ?? "";
      while (col < l.length) {
        if (l[col] === ch) depth++;
        else if (l[col] === target) depth--;
        if (depth === 0) return { row, col };
        col++;
      }
      row++;
      col = 0;
    }
  } else {
    // Search backward
    let depth = 1;
    let row = engine.cursor.row;
    let col = engine.cursor.col - 1;
    while (row >= 0) {
      const l = engine.lines[row] ?? "";
      while (col >= 0) {
        if (l[col] === ch) depth++;
        else if (l[col] === target) depth--;
        if (depth === 0) return { row, col };
        col--;
      }
      row--;
      if (row >= 0) col = (engine.lines[row] ?? "").length - 1;
    }
  }

  return null;
}

// ── Case toggle (~) ──────────────────────────────────────────────────────────

function toggleCaseAtCursor(engine: EditorEngine): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  const col = engine.cursor.col;
  if (col >= line.length) return;

  const ch = line[col]!;
  const toggled = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
  engine.lines[engine.cursor.row] = line.slice(0, col) + toggled + line.slice(col + 1);
  engine.dirty = true;

  // Move cursor right (vim convention)
  if (col < line.length - 1) {
    engine.moveCursor(engine.cursor.row, col + 1);
  }
}

// ── Replace char (r{char}) ───────────────────────────────────────────────────

function replaceCharUnderCursor(engine: EditorEngine, ch: string): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  const col = engine.cursor.col;
  if (col >= line.length) return;

  engine.lines[engine.cursor.row] = line.slice(0, col) + ch + line.slice(col + 1);
  engine.dirty = true;
}

// ── Indent/Dedent (>>/<< and visual >/<) ─────────────────────────────────────

const INDENT_WIDTH = 2;

function indentLine(engine: EditorEngine, row: number, direction: ">" | "<"): void {
  const line = engine.lines[row] ?? "";
  if (direction === ">") {
    engine.lines[row] = " ".repeat(INDENT_WIDTH) + line;
  } else {
    // Remove up to INDENT_WIDTH leading spaces
    let remove = 0;
    while (remove < INDENT_WIDTH && remove < line.length && line[remove] === " ") remove++;
    engine.lines[row] = line.slice(remove);
  }
  engine.dirty = true;
}

// ── Search word under cursor (*/#) ───────────────────────────────────────────

function searchWordUnderCursor(engine: EditorEngine, state: VimState, forward: boolean): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  const col = engine.cursor.col;

  // Find word boundaries around cursor
  if (col >= line.length) return;

  let start = col;
  let end = col;
  while (start > 0 && /\w/.test(line[start - 1]!)) start--;
  while (end < line.length && /\w/.test(line[end]!)) end++;

  if (start === end) return;
  const word = line.slice(start, end);

  // Use engine's find to search for the word
  engine.find(word);
  if (engine.findMatches.length === 0) {
    state.statusMessage = `Pattern not found: ${word}`;
    return;
  }

  // Find the match at/after cursor (for *) or before cursor (for #)
  if (forward) {
    engine.findNext();
  } else {
    engine.findPrev();
  }

  state.statusMessage = `/${word} [${engine.findIndex + 1}/${engine.findMatches.length}]`;
}

// ── Visual-line helpers ──────────────────────────────────────────────────────

/** Expand selection to cover full lines (for visual-line mode) */
function expandToFullLines(engine: EditorEngine): void {
  if (!engine.anchor) return;

  const startRow = Math.min(engine.anchor.row, engine.cursor.row);
  const endRow = Math.max(engine.anchor.row, engine.cursor.row);

  engine.anchor = { row: startRow, col: 0 };
  engine.moveCursor(endRow, (engine.lines[endRow] ?? "").length, true);
}

// ── Dot repeat ───────────────────────────────────────────────────────────────

function replayLastChange(
  engine: EditorEngine,
  state: VimState,
  callbacks: VimCallbacks,
  count: number,
): void {
  const change = state.lastChange!;
  const n = count > 1 ? count : change.count;

  switch (change.type) {
    case "simple":
      for (let i = 0; i < n; i++) {
        switch (change.action) {
          case "x":
            engine.deleteForward();
            break;
          case "~":
            toggleCaseAtCursor(engine);
            break;
          case "J": {
            const row = engine.cursor.row;
            if (row < engine.lines.length - 1) {
              const currentLine = engine.lines[row] ?? "";
              const nextLine = engine.lines[row + 1] ?? "";
              engine.lines[row] = currentLine.trimEnd() + " " + nextLine.trimStart();
              engine.lines.splice(row + 1, 1);
              engine.dirty = true;
            }
            break;
          }
          case "D":
            selectToEndOfLine(engine);
            state.register = engine.getSelectedText();
            engine.deleteSelection();
            engine.clearSelection();
            break;
          case "C":
            selectToEndOfLine(engine);
            state.register = engine.getSelectedText();
            engine.deleteSelection();
            engine.clearSelection();
            state.mode = "insert";
            break;
          case "p": {
            const text = state.register;
            if (text) {
              if (text.endsWith("\n")) {
                const r = engine.cursor.row;
                engine.lines.splice(r + 1, 0, text.slice(0, -1));
                engine.moveCursor(r + 1, 0);
                engine.dirty = true;
              } else {
                engine.moveRight();
                engine.insertText(text);
              }
            }
            break;
          }
          case "P": {
            const text = state.register;
            if (text) {
              if (text.endsWith("\n")) {
                const r = engine.cursor.row;
                engine.lines.splice(r, 0, text.slice(0, -1));
                engine.moveCursor(r, 0);
                engine.dirty = true;
              } else {
                engine.insertText(text);
              }
            }
            break;
          }
        }
      }
      break;

    case "replace":
      replaceCharUnderCursor(engine, change.char);
      break;

    case "line-op":
      if (change.operator === "dd") {
        state.pendingOperator = "d";
        for (let i = 0; i < n; i++) executeLinewiseOp(engine, state, callbacks);
        state.pendingOperator = null;
      } else if (change.operator === "cc") {
        state.pendingOperator = "c";
        for (let i = 0; i < n; i++) executeLinewiseOp(engine, state, callbacks);
        state.pendingOperator = null;
      } else if (change.operator === ">>" || change.operator === "<<") {
        const dir = change.operator[0] as ">" | "<";
        for (let i = 0; i < n; i++) indentLine(engine, engine.cursor.row, dir);
      }
      break;

    case "text-object": {
      const range = findTextObjectRange(engine, change.kind, change.target);
      if (range) {
        engine.anchor = { row: range.startRow, col: range.startCol };
        engine.moveCursor(range.endRow, range.endCol, true);
        state.pendingOperator = change.operator as "d" | "c" | "y";
        applyOperatorOnMotion(engine, state, callbacks);
        state.pendingOperator = null;
      }
      break;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function moveToFirstNonWhitespace(engine: EditorEngine): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  const match = line.match(/^\s*/);
  engine.moveCursor(engine.cursor.row, match ? match[0].length : 0);
}

function moveParagraph(engine: EditorEngine, direction: 1 | -1, selecting = false): void {
  let row = engine.cursor.row + direction;
  // Skip current blank lines
  while (row >= 0 && row < engine.lines.length && (engine.lines[row]?.trim() === "")) {
    row += direction;
  }
  // Find next blank line
  while (row >= 0 && row < engine.lines.length && (engine.lines[row]?.trim() !== "")) {
    row += direction;
  }
  row = Math.max(0, Math.min(engine.lines.length - 1, row));
  engine.moveCursor(row, 0, selecting);
}

function selectToEndOfLine(engine: EditorEngine): void {
  const line = engine.lines[engine.cursor.row] ?? "";
  engine.anchor = { ...engine.cursor };
  engine.moveCursor(engine.cursor.row, line.length);
}

function executeCharMotion(
  engine: EditorEngine,
  state: VimState,
  motion: "f" | "F" | "t" | "T",
  char: string,
  selecting = false,
): void {
  state.lastCharMotion = { motion, char };
  const line = engine.lines[engine.cursor.row] ?? "";
  const col = engine.cursor.col;

  if (motion === "f" || motion === "t") {
    const idx = line.indexOf(char, col + 1);
    if (idx !== -1) {
      engine.moveCursor(engine.cursor.row, motion === "t" ? idx - 1 : idx, selecting);
    }
  } else {
    const idx = line.lastIndexOf(char, col - 1);
    if (idx !== -1) {
      engine.moveCursor(engine.cursor.row, motion === "T" ? idx + 1 : idx, selecting);
    }
  }
}

function executeLinewiseOp(
  engine: EditorEngine,
  state: VimState,
  callbacks: VimCallbacks,
): void {
  const row = engine.cursor.row;
  const line = engine.lines[row] ?? "";

  if (state.pendingOperator === "y") {
    state.register = line + "\n";
    callbacks.copyToClipboard(state.register);
    state.statusMessage = "1 line yanked";
  } else if (state.pendingOperator === "d") {
    state.register = line + "\n";
    if (engine.lines.length > 1) {
      engine.lines.splice(row, 1);
      engine.cursor.row = Math.min(row, engine.lines.length - 1);
      engine.cursor.col = 0;
      engine.dirty = true;
    } else {
      engine.lines[0] = "";
      engine.cursor.col = 0;
      engine.dirty = true;
    }
  } else if (state.pendingOperator === "c") {
    state.register = line + "\n";
    engine.lines[row] = "";
    engine.cursor.col = 0;
    engine.dirty = true;
    state.mode = "insert";
  }
}

function applyOperatorOnMotion(
  engine: EditorEngine,
  state: VimState,
  callbacks: VimCallbacks,
): void {
  const selected = engine.getSelectedText();
  if (selected) {
    if (state.pendingOperator === "y") {
      state.register = selected;
      callbacks.copyToClipboard(selected);
      engine.clearSelection();
      state.statusMessage = `Yanked ${selected.split("\n").length} lines`;
    } else if (state.pendingOperator === "d") {
      state.register = selected;
      engine.deleteSelection();
      engine.clearSelection();
    } else if (state.pendingOperator === "c") {
      state.register = selected;
      engine.deleteSelection();
      engine.clearSelection();
      state.mode = "insert";
    }
  }
}

// ── System clipboard ─────────────────────────────────────────────────────────

function getSystemClipboard(): string {
  try {
    const { execSync } = require("node:child_process");
    return execSync("pbpaste", { encoding: "utf8", timeout: 2000 }).replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
}

/** Copy to system clipboard via pbcopy/xclip. */
export function systemCopy(text: string): boolean {
  try {
    const { execSync } = require("node:child_process");
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else {
      execSync("xclip -selection clipboard", { input: text });
    }
    return true;
  } catch {
    return false;
  }
}
