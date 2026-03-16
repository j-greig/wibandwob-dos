/**
 * vim-mode.ts — Vim modal input layer for EditorEngine.
 *
 * Adapted from pi-vim's keybinding logic but wired to our blessed-native
 * EditorEngine primitives. No dependencies on pi's extension API.
 *
 * Modes: normal, insert, visual (line)
 * Operators: d (delete), c (change), y (yank)
 * Motions: h/j/k/l, w/b/e/W/B/E, 0/$, gg/G, {/}, f/F/t/T{char}
 * Text objects: iw, aw (word), i"/a" etc deferred
 * Commands: :w, :q, :wq, :{n} (goto line)
 */

import type { EditorEngine } from "./editor-engine.js";

export type VimMode = "normal" | "insert" | "visual";

export interface VimState {
  mode: VimMode;
  pendingOperator: "d" | "c" | "y" | null;
  pendingCount: string;
  pendingChar: "f" | "F" | "t" | "T" | null;
  lastCharMotion: { motion: "f" | "F" | "t" | "T"; char: string } | null;
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
    lastCharMotion: null,
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

  // Waiting for char target (f/F/t/T)
  if (state.pendingChar) {
    if (ch && ch.length === 1) {
      executeCharMotion(engine, state, state.pendingChar, ch);
      state.pendingChar = null;
      callbacks.render();
    } else if (key.name === "escape") {
      state.pendingChar = null;
    }
    return true;
  }

  if (state.mode === "insert") {
    return handleInsertMode(engine, state, ch, key, callbacks);
  }

  if (state.mode === "normal" || state.mode === "visual") {
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

  // Mode switches
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
  if (ch === "v" && state.mode === "normal") {
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
  if (key.name === "escape") {
    state.mode = "normal";
    state.pendingOperator = null;
    state.pendingCount = "";
    engine.clearSelection();
    callbacks.render();
    return true;
  }

  // Operator-pending: d, c, y
  if ((ch === "d" || ch === "c" || ch === "y") && !state.pendingOperator && state.mode === "normal") {
    state.pendingOperator = ch;
    callbacks.render();
    return true;
  }

  // dd, cc, yy — line operations
  if (state.pendingOperator && ch === state.pendingOperator) {
    for (let i = 0; i < count; i++) {
      executeLinewiseOp(engine, state, callbacks);
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
      executeCharMotion(engine, state, state.lastCharMotion.motion, state.lastCharMotion.char);
      callbacks.render();
    }
    state.pendingCount = "";
    return true;
  }
  if (ch === ",") {
    if (state.lastCharMotion) {
      const reverse = { f: "F", F: "f", t: "T", T: "t" } as const;
      executeCharMotion(engine, state, reverse[state.lastCharMotion.motion], state.lastCharMotion.char);
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

  const selecting = state.mode === "visual";
  let motionExecuted = false;

  if (ch === "h" || key.name === "left") {
    for (let i = 0; i < count; i++) engine.moveLeft(selecting);
    motionExecuted = true;
  } else if (ch === "l" || key.name === "right") {
    for (let i = 0; i < count; i++) engine.moveRight(selecting);
    motionExecuted = true;
  } else if (ch === "j" || key.name === "down") {
    for (let i = 0; i < count; i++) engine.moveDown(selecting);
    motionExecuted = true;
  } else if (ch === "k" || key.name === "up") {
    for (let i = 0; i < count; i++) engine.moveUp(selecting);
    motionExecuted = true;
  } else if (ch === "w") {
    for (let i = 0; i < count; i++) engine.moveWordRight(selecting);
    motionExecuted = true;
  } else if (ch === "b") {
    for (let i = 0; i < count; i++) engine.moveWordLeft(selecting);
    motionExecuted = true;
  } else if (ch === "e") {
    // moveWordRight then back one — approximate word-end
    for (let i = 0; i < count; i++) engine.moveWordRight(selecting);
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
    // Paragraph up
    for (let i = 0; i < count; i++) moveParagraph(engine, -1, selecting);
    motionExecuted = true;
  } else if (ch === "}") {
    // Paragraph down
    for (let i = 0; i < count; i++) moveParagraph(engine, 1, selecting);
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
      // Delete char under cursor
      engine.deleteForward();
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "D") {
      // Delete to end of line
      selectToEndOfLine(engine);
      state.register = engine.getSelectedText();
      engine.deleteSelection();
      engine.clearSelection();
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
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "p") {
      // Paste after cursor
      if (state.register) {
        engine.moveRight();
        engine.insertText(state.register);
      }
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
    if (ch === "P") {
      if (state.register) {
        engine.insertText(state.register);
      }
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
        engine.moveEnd();
        engine.insertText(" ");
        // Delete the newline
        const nextLine = engine.lines[row + 1];
        if (nextLine !== undefined) {
          engine.lines.splice(row + 1, 1);
          engine.lines[row] = engine.lines[row]!.trimEnd() + " " + nextLine.trimStart();
          engine.dirty = true;
        }
      }
      state.pendingCount = "";
      callbacks.render();
      return true;
    }
  }

  // If a motion was executed with a pending operator, apply the operator
  if (motionExecuted && state.pendingOperator) {
    applyOperatorOnMotion(engine, state, callbacks);
    state.pendingOperator = null;
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

  // Visual mode operations on selection
  if (state.mode === "visual" && (ch === "d" || ch === "x")) {
    state.register = engine.getSelectedText();
    engine.deleteSelection();
    state.mode = "normal";
    engine.clearSelection();
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (state.mode === "visual" && ch === "y") {
    state.register = engine.getSelectedText();
    callbacks.copyToClipboard(state.register);
    state.mode = "normal";
    engine.clearSelection();
    state.statusMessage = `Yanked ${state.register.split("\n").length} lines`;
    state.pendingCount = "";
    callbacks.render();
    return true;
  }
  if (state.mode === "visual" && ch === "c") {
    state.register = engine.getSelectedText();
    engine.deleteSelection();
    state.mode = "insert";
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
): void {
  state.lastCharMotion = { motion, char };
  const line = engine.lines[engine.cursor.row] ?? "";
  const col = engine.cursor.col;

  if (motion === "f" || motion === "t") {
    const idx = line.indexOf(char, col + 1);
    if (idx !== -1) {
      engine.moveCursor(engine.cursor.row, motion === "t" ? idx - 1 : idx);
    }
  } else {
    const idx = line.lastIndexOf(char, col - 1);
    if (idx !== -1) {
      engine.moveCursor(engine.cursor.row, motion === "T" ? idx + 1 : idx);
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
  // The motion already moved the cursor. If we have a selection (visual) or
  // can infer the range from anchor, use that. Otherwise approximate.
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
