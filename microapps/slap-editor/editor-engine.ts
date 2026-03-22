/**
 * Minimal blessed-native text editor engine.
 * Inspired by slap-editor's architecture but with zero native addon dependencies.
 *
 * Features: line-numbered gutter, cursor movement, selection, insert/delete,
 * undo/redo, find, clipboard, scroll, tab handling.
 */
// eslint-disable-next-line no-restricted-imports
import type blessed from "blessed";

export interface EditorTheme {
  fg: string;
  bg: string;
  gutterFg: string;
  gutterBg: string;
  cursorFg: string;
  cursorBg: string;
  selectionFg: string;
  selectionBg: string;
  statusFg: string;
  statusBg: string;
}

interface Point {
  row: number;
  col: number;
}

interface UndoEntry {
  lines: string[];
  cursor: Point;
}

export class EditorEngine {
  lines: string[] = [""];
  cursor: Point = { row: 0, col: 0 };
  anchor: Point | null = null; // selection anchor (null = no selection)
  scroll: Point = { row: 0, col: 0 };
  filePath: string | null = null;
  dirty = false;
  insertMode = true;

  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxUndo = 500;

  // Find state
  findQuery = "";
  findMatches: { row: number; col: number; len: number }[] = [];
  findIndex = -1;

  get lineCount(): number {
    return this.lines.length;
  }
  get lastRow(): number {
    return this.lines.length - 1;
  }
  get currentLine(): string {
    return this.lines[this.cursor.row] ?? "";
  }
  get text(): string {
    return this.lines.join("\n");
  }

  setText(text: string) {
    this.lines = text.split("\n");
    if (this.lines.length === 0) this.lines = [""];
    this.cursor = { row: 0, col: 0 };
    this.anchor = null;
    this.scroll = { row: 0, col: 0 };
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
  }

  async loadFile(path: string) {
    const fs = await import("fs");
    try {
      const content = fs.readFileSync(path, "utf-8");
      this.setText(content);
      this.filePath = path;
      this.dirty = false;
    } catch {
      // New file
      this.setText("");
      this.filePath = path;
      this.dirty = false;
    }
  }

  async saveFile(path?: string) {
    const fs = await import("fs");
    const target = path ?? this.filePath;
    if (!target) return false;
    fs.writeFileSync(target, this.text, "utf-8");
    this.filePath = target;
    this.dirty = false;
    return true;
  }

  // --- Undo/Redo ---

  private snapshot(): UndoEntry {
    return {
      lines: [...this.lines],
      cursor: { ...this.cursor },
    };
  }

  private pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.redoStack.push(this.snapshot());
    this.lines = entry.lines;
    this.cursor = entry.cursor;
    this.anchor = null;
    this.dirty = true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.undoStack.push(this.snapshot());
    this.lines = entry.lines;
    this.cursor = entry.cursor;
    this.anchor = null;
    this.dirty = true;
  }

  // --- Selection ---

  hasSelection(): boolean {
    return this.anchor !== null;
  }

  getSelectionRange(): { start: Point; end: Point } | null {
    if (!this.anchor) return null;
    const a = this.anchor;
    const b = this.cursor;
    if (a.row < b.row || (a.row === b.row && a.col <= b.col)) {
      return { start: { ...a }, end: { ...b } };
    }
    return { start: { ...b }, end: { ...a } };
  }

  getSelectedText(): string {
    const range = this.getSelectionRange();
    if (!range) return "";
    const { start, end } = range;
    if (start.row === end.row) {
      return this.lines[start.row].slice(start.col, end.col);
    }
    const result: string[] = [];
    result.push(this.lines[start.row].slice(start.col));
    for (let r = start.row + 1; r < end.row; r++) {
      result.push(this.lines[r]);
    }
    result.push(this.lines[end.row].slice(0, end.col));
    return result.join("\n");
  }

  deleteSelection() {
    const range = this.getSelectionRange();
    if (!range) return;
    this.pushUndo();
    const { start, end } = range;
    const before = this.lines[start.row].slice(0, start.col);
    const after = this.lines[end.row].slice(end.col);
    this.lines.splice(start.row, end.row - start.row + 1, before + after);
    this.cursor = { ...start };
    this.anchor = null;
    this.dirty = true;
  }

  selectAll() {
    this.anchor = { row: 0, col: 0 };
    this.cursor = {
      row: this.lastRow,
      col: this.lines[this.lastRow].length,
    };
  }

  clearSelection() {
    this.anchor = null;
  }

  // --- Cursor movement ---

  private clampCursor() {
    this.cursor.row = Math.max(0, Math.min(this.cursor.row, this.lastRow));
    this.cursor.col = Math.max(
      0,
      Math.min(this.cursor.col, this.lines[this.cursor.row].length)
    );
  }

  moveCursor(row: number, col: number, selecting = false) {
    if (selecting && !this.anchor) {
      this.anchor = { ...this.cursor };
    } else if (!selecting) {
      this.anchor = null;
    }
    this.cursor.row = row;
    this.cursor.col = col;
    this.clampCursor();
  }

  moveLeft(selecting = false) {
    if (this.cursor.col > 0) {
      this.moveCursor(this.cursor.row, this.cursor.col - 1, selecting);
    } else if (this.cursor.row > 0) {
      this.moveCursor(
        this.cursor.row - 1,
        this.lines[this.cursor.row - 1].length,
        selecting
      );
    }
  }

  moveRight(selecting = false) {
    if (this.cursor.col < this.currentLine.length) {
      this.moveCursor(this.cursor.row, this.cursor.col + 1, selecting);
    } else if (this.cursor.row < this.lastRow) {
      this.moveCursor(this.cursor.row + 1, 0, selecting);
    }
  }

  moveUp(selecting = false) {
    if (this.cursor.row > 0) {
      this.moveCursor(this.cursor.row - 1, this.cursor.col, selecting);
    }
  }

  moveDown(selecting = false) {
    if (this.cursor.row < this.lastRow) {
      this.moveCursor(this.cursor.row + 1, this.cursor.col, selecting);
    }
  }

  moveHome(selecting = false) {
    this.moveCursor(this.cursor.row, 0, selecting);
  }

  moveEnd(selecting = false) {
    this.moveCursor(this.cursor.row, this.currentLine.length, selecting);
  }

  moveWordLeft(selecting = false) {
    if (this.cursor.col === 0 && this.cursor.row > 0) {
      this.moveCursor(
        this.cursor.row - 1,
        this.lines[this.cursor.row - 1].length,
        selecting
      );
      return;
    }
    const line = this.currentLine;
    let col = this.cursor.col - 1;
    // skip whitespace
    while (col > 0 && /\s/.test(line[col])) col--;
    // skip word chars
    while (col > 0 && /\w/.test(line[col - 1])) col--;
    this.moveCursor(this.cursor.row, Math.max(0, col), selecting);
  }

  moveWordRight(selecting = false) {
    const line = this.currentLine;
    if (this.cursor.col >= line.length && this.cursor.row < this.lastRow) {
      this.moveCursor(this.cursor.row + 1, 0, selecting);
      return;
    }
    let col = this.cursor.col;
    // skip word chars
    while (col < line.length && /\w/.test(line[col])) col++;
    // skip whitespace
    while (col < line.length && /\s/.test(line[col])) col++;
    this.moveCursor(this.cursor.row, col, selecting);
  }

  pageUp(viewHeight: number, selecting = false) {
    this.moveCursor(
      Math.max(0, this.cursor.row - viewHeight),
      this.cursor.col,
      selecting
    );
  }

  pageDown(viewHeight: number, selecting = false) {
    this.moveCursor(
      Math.min(this.lastRow, this.cursor.row + viewHeight),
      this.cursor.col,
      selecting
    );
  }

  goToLine(lineNum: number) {
    this.moveCursor(Math.max(0, lineNum - 1), 0);
  }

  // --- Editing ---

  insertText(text: string) {
    if (this.hasSelection()) this.deleteSelection();
    else this.pushUndo();

    const insertLines = text.split("\n");
    const before = this.currentLine.slice(0, this.cursor.col);
    const after = this.currentLine.slice(this.cursor.col);

    if (insertLines.length === 1) {
      this.lines[this.cursor.row] = before + insertLines[0] + after;
      this.cursor.col += insertLines[0].length;
    } else {
      this.lines[this.cursor.row] = before + insertLines[0];
      for (let i = 1; i < insertLines.length - 1; i++) {
        this.lines.splice(this.cursor.row + i, 0, insertLines[i]);
      }
      const lastInsert = insertLines[insertLines.length - 1];
      this.lines.splice(
        this.cursor.row + insertLines.length - 1,
        0,
        lastInsert + after
      );
      this.cursor.row += insertLines.length - 1;
      this.cursor.col = lastInsert.length;
    }
    this.dirty = true;
  }

  insertNewline() {
    if (this.hasSelection()) this.deleteSelection();
    else this.pushUndo();

    const before = this.currentLine.slice(0, this.cursor.col);
    const after = this.currentLine.slice(this.cursor.col);

    // Auto-indent: copy leading whitespace from current line
    const indent = before.match(/^(\s*)/)?.[1] ?? "";
    this.lines[this.cursor.row] = before;
    this.lines.splice(this.cursor.row + 1, 0, indent + after);
    this.cursor.row += 1;
    this.cursor.col = indent.length;
    this.dirty = true;
  }

  backspace() {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }
    this.pushUndo();
    if (this.cursor.col > 0) {
      const line = this.currentLine;
      this.lines[this.cursor.row] =
        line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col);
      this.cursor.col--;
    } else if (this.cursor.row > 0) {
      const prevLen = this.lines[this.cursor.row - 1].length;
      this.lines[this.cursor.row - 1] += this.currentLine;
      this.lines.splice(this.cursor.row, 1);
      this.cursor.row--;
      this.cursor.col = prevLen;
    }
    this.dirty = true;
  }

  deleteForward() {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }
    this.pushUndo();
    if (this.cursor.col < this.currentLine.length) {
      const line = this.currentLine;
      this.lines[this.cursor.row] =
        line.slice(0, this.cursor.col) + line.slice(this.cursor.col + 1);
    } else if (this.cursor.row < this.lastRow) {
      this.lines[this.cursor.row] += this.lines[this.cursor.row + 1];
      this.lines.splice(this.cursor.row + 1, 1);
    }
    this.dirty = true;
  }

  insertTab() {
    this.insertText("  "); // 2-space tabs
  }

  // --- Find ---

  find(query: string) {
    this.findQuery = query;
    this.findMatches = [];
    this.findIndex = -1;
    if (!query) return;

    for (let r = 0; r < this.lines.length; r++) {
      let col = 0;
      while (true) {
        const idx = this.lines[r].indexOf(query, col);
        if (idx === -1) break;
        this.findMatches.push({ row: r, col: idx, len: query.length });
        col = idx + 1;
      }
    }
    if (this.findMatches.length > 0) {
      this.findNext();
    }
  }

  findNext() {
    if (this.findMatches.length === 0) return;
    this.findIndex = (this.findIndex + 1) % this.findMatches.length;
    const m = this.findMatches[this.findIndex];
    this.cursor = { row: m.row, col: m.col };
    this.anchor = { row: m.row, col: m.col + m.len };
  }

  findPrev() {
    if (this.findMatches.length === 0) return;
    this.findIndex =
      (this.findIndex - 1 + this.findMatches.length) %
      this.findMatches.length;
    const m = this.findMatches[this.findIndex];
    this.cursor = { row: m.row, col: m.col };
    this.anchor = { row: m.row, col: m.col + m.len };
  }

  // --- Scroll ---

  ensureCursorVisible(viewWidth: number, viewHeight: number) {
    // Vertical
    if (this.cursor.row < this.scroll.row) {
      this.scroll.row = this.cursor.row;
    }
    if (this.cursor.row >= this.scroll.row + viewHeight) {
      this.scroll.row = this.cursor.row - viewHeight + 1;
    }
    // Horizontal
    const gutterW = this.gutterWidth();
    const textW = viewWidth - gutterW;
    if (this.cursor.col < this.scroll.col) {
      this.scroll.col = this.cursor.col;
    }
    if (this.cursor.col >= this.scroll.col + textW) {
      this.scroll.col = this.cursor.col - textW + 1;
    }
  }

  gutterWidth(): number {
    return String(this.lineCount).length + 1;
  }

  // --- Describe state ---

  describe(): {
    summary: string;
    filePath: string | null;
    cursor: Point;
    lines: number;
    dirty: boolean;
  } {
    const name = this.filePath
      ? this.filePath.split("/").pop()
      : "untitled";
    return {
      summary: `Editing ${name} — line ${this.cursor.row + 1}/${this.lineCount}${this.dirty ? " [modified]" : ""}`,
      filePath: this.filePath,
      cursor: { ...this.cursor },
      lines: this.lineCount,
      dirty: this.dirty,
    };
  }
}
