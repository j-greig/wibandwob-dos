import stringWidth from "string-width";

type NamedColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "bright-black"
  | "bright-red"
  | "bright-green"
  | "bright-yellow"
  | "bright-blue"
  | "bright-magenta"
  | "bright-cyan"
  | "bright-white";

export interface TerminalCellStyle {
  fg?: NamedColor;
  bg?: NamedColor;
  bold?: boolean;
  inverse?: boolean;
}

export interface TerminalCell extends TerminalCellStyle {
  char: string;
}

interface CursorState {
  x: number;
  y: number;
}

function cloneStyle(style: TerminalCellStyle): TerminalCellStyle {
  return {
    fg: style.fg,
    bg: style.bg,
    bold: style.bold,
    inverse: style.inverse
  };
}

function blankCell(style: TerminalCellStyle = {}): TerminalCell {
  return {
    char: " ",
    ...cloneStyle(style)
  };
}

function blankLine(cols: number, style: TerminalCellStyle = {}): TerminalCell[] {
  return Array.from({ length: cols }, () => blankCell(style));
}

export class TerminalBuffer {
  private cols: number;
  private rows: number;
  private readonly scrollbackLimit: number;
  private lines: TerminalCell[][] = [];
  private cursor: CursorState = { x: 0, y: 0 };
  private savedCursor?: CursorState;
  private style: TerminalCellStyle = {};
  private viewportTop = 0;
  private parserState: "normal" | "escape" | "csi" | "osc" | "oscEscape" = "normal";
  private csiBuffer = "";
  private oscBuffer = "";
  private cursorVisible = true;

  constructor(cols: number, rows: number, scrollbackLimit = 2000) {
    this.cols = Math.max(1, cols);
    this.rows = Math.max(1, rows);
    this.scrollbackLimit = scrollbackLimit;
    this.reset();
  }

  reset(): void {
    this.lines = Array.from({ length: this.rows }, () => blankLine(this.cols));
    this.cursor = { x: 0, y: 0 };
    this.savedCursor = undefined;
    this.style = {};
    this.viewportTop = Math.max(0, this.lines.length - this.rows);
    this.parserState = "normal";
    this.csiBuffer = "";
    this.oscBuffer = "";
    this.cursorVisible = true;
  }

  resize(cols: number, rows: number): void {
    this.cols = Math.max(1, cols);
    this.rows = Math.max(1, rows);
    this.lines = this.lines.map((line) => {
      if (line.length > this.cols) {
        return line.slice(0, this.cols);
      }
      return [...line, ...Array.from({ length: this.cols - line.length }, () => blankCell())];
    });
    while (this.lines.length < this.rows) {
      this.lines.push(blankLine(this.cols));
    }
    this.cursor.x = Math.max(0, Math.min(this.cursor.x, this.cols - 1));
    this.cursor.y = Math.max(0, Math.min(this.cursor.y, this.lines.length - 1));
    this.viewportTop = Math.min(this.viewportTop, this.getMaxViewportTop());
  }

  write(data: string): void {
    const pinnedToBottom = this.viewportTop >= this.getMaxViewportTop();
    for (const char of data) {
      this.processChar(char);
    }
    this.enforceScrollbackLimit();
    if (pinnedToBottom) {
      this.scrollToBottom();
    } else {
      this.viewportTop = Math.min(this.viewportTop, this.getMaxViewportTop());
    }
  }

  scrollViewport(delta: number): void {
    this.viewportTop = Math.max(0, Math.min(this.viewportTop + delta, this.getMaxViewportTop()));
  }

  scrollToBottom(): void {
    this.viewportTop = this.getMaxViewportTop();
  }

  getCols(): number {
    return this.cols;
  }

  getRows(): number {
    return this.rows;
  }

  getCursor(): CursorState {
    return { ...this.cursor };
  }

  getViewportTop(): number {
    return this.viewportTop;
  }

  isCursorVisible(): boolean {
    return this.cursorVisible;
  }

  getScrollbackLineCount(): number {
    return Math.max(0, this.lines.length - this.rows);
  }

  getVisibleLines(): TerminalCell[][] {
    const start = this.viewportTop;
    const end = start + this.rows;
    const visible = this.lines.slice(start, end);
    while (visible.length < this.rows) {
      visible.push(blankLine(this.cols));
    }
    return visible.map((line) => {
      if (line.length >= this.cols) {
        return line.slice(0, this.cols);
      }
      return [...line, ...Array.from({ length: this.cols - line.length }, () => blankCell())];
    });
  }

  getPreviewText(lines = 8): string {
    return this.lines
      .slice(-lines)
      .map((line) => line.map((cell) => cell.char).join("").replace(/\s+$/g, ""))
      .join("\n")
      .trimEnd();
  }

  private processChar(char: string): void {
    switch (this.parserState) {
      case "normal":
        this.processNormalChar(char);
        return;
      case "escape":
        this.processEscapeChar(char);
        return;
      case "csi":
        this.processCsiChar(char);
        return;
      case "osc":
        this.processOscChar(char);
        return;
      case "oscEscape":
        if (char === "\\") {
          this.finishOsc();
        } else {
          this.oscBuffer += `\u001b${char}`;
          this.parserState = "osc";
        }
        return;
      default:
        return;
    }
  }

  private processNormalChar(char: string): void {
    if (char === "\u001b") {
      this.parserState = "escape";
      return;
    }
    if (char === "\r") {
      this.cursor.x = 0;
      return;
    }
    if (char === "\n") {
      this.lineFeed();
      return;
    }
    if (char === "\b") {
      this.cursor.x = Math.max(0, this.cursor.x - 1);
      return;
    }
    if (char === "\t") {
      const remainder = this.cursor.x % 8;
      const spaces = remainder === 0 ? 8 : 8 - remainder;
      for (let index = 0; index < spaces; index += 1) {
        this.putChar(" ");
      }
      return;
    }
    if (char === "\u0007") {
      return;
    }
    if (char < " " && char !== " ") {
      return;
    }
    this.putChar(char);
  }

  private processEscapeChar(char: string): void {
    if (char === "[") {
      this.csiBuffer = "";
      this.parserState = "csi";
      return;
    }
    if (char === "]") {
      this.oscBuffer = "";
      this.parserState = "osc";
      return;
    }
    if (char === "7") {
      this.savedCursor = { ...this.cursor };
      this.parserState = "normal";
      return;
    }
    if (char === "8") {
      if (this.savedCursor) {
        this.cursor = { ...this.savedCursor };
      }
      this.parserState = "normal";
      return;
    }
    this.parserState = "normal";
  }

  private processCsiChar(char: string): void {
    if (char >= "@" && char <= "~") {
      this.handleCsiSequence(this.csiBuffer, char);
      this.csiBuffer = "";
      this.parserState = "normal";
      return;
    }
    this.csiBuffer += char;
  }

  private processOscChar(char: string): void {
    if (char === "\u0007") {
      this.finishOsc();
      return;
    }
    if (char === "\u001b") {
      this.parserState = "oscEscape";
      return;
    }
    this.oscBuffer += char;
  }

  private finishOsc(): void {
    this.oscBuffer = "";
    this.parserState = "normal";
  }

  private handleCsiSequence(sequence: string, final: string): void {
    const privateMode = sequence.startsWith("?");
    const raw = privateMode ? sequence.slice(1) : sequence;
    const params = raw.length === 0 ? [] : raw.split(";").map((value) => (value.length > 0 ? Number.parseInt(value, 10) : NaN));
    switch (final) {
      case "A":
        this.cursor.y = Math.max(0, this.cursor.y - (this.paramOrDefault(params, 0, 1)));
        return;
      case "B":
        this.cursor.y = Math.min(this.lines.length - 1, this.cursor.y + this.paramOrDefault(params, 0, 1));
        return;
      case "C":
        this.cursor.x = Math.min(this.cols - 1, this.cursor.x + this.paramOrDefault(params, 0, 1));
        return;
      case "D":
        this.cursor.x = Math.max(0, this.cursor.x - this.paramOrDefault(params, 0, 1));
        return;
      case "H":
      case "f": {
        const row = Math.max(1, this.paramOrDefault(params, 0, 1));
        const col = Math.max(1, this.paramOrDefault(params, 1, 1));
        this.cursor.y = Math.min(this.lines.length - 1, row - 1);
        this.cursor.x = Math.min(this.cols - 1, col - 1);
        return;
      }
      case "J":
        this.clearScreen(this.paramOrDefault(params, 0, 0));
        return;
      case "K":
        this.clearLine(this.paramOrDefault(params, 0, 0));
        return;
      case "m":
        this.applySgr(params);
        return;
      case "s":
        this.savedCursor = { ...this.cursor };
        return;
      case "u":
        if (this.savedCursor) {
          this.cursor = { ...this.savedCursor };
        }
        return;
      case "h":
      case "l":
        if (privateMode) {
          this.applyPrivateMode(params, final);
        }
        return;
      default:
        return;
    }
  }

  private applyPrivateMode(params: number[], final: string): void {
    for (const param of params) {
      if (param === 25) {
        this.cursorVisible = final === "h";
      }
    }
  }

  private applySgr(params: number[]): void {
    const sequence = params.length === 0 ? [0] : params;
    for (let index = 0; index < sequence.length; index += 1) {
      const code = Number.isNaN(sequence[index]) ? 0 : sequence[index];
      if (code === 0) {
        this.style = {};
        continue;
      }
      if (code === 1) {
        this.style.bold = true;
        continue;
      }
      if (code === 22) {
        this.style.bold = false;
        continue;
      }
      if (code === 7) {
        this.style.inverse = true;
        continue;
      }
      if (code === 27) {
        this.style.inverse = false;
        continue;
      }
      if (code === 39) {
        delete this.style.fg;
        continue;
      }
      if (code === 49) {
        delete this.style.bg;
        continue;
      }
      if ((code === 38 || code === 48) && sequence[index + 1] === 5) {
        index += 2;
        continue;
      }
      if ((code === 38 || code === 48) && sequence[index + 1] === 2) {
        index += 4;
        continue;
      }
      const color = this.mapAnsiColor(code);
      if (!color) {
        continue;
      }
      if (code >= 30 && code <= 37 || code >= 90 && code <= 97) {
        this.style.fg = color;
        continue;
      }
      if (code >= 40 && code <= 47 || code >= 100 && code <= 107) {
        this.style.bg = color;
      }
    }
  }

  private mapAnsiColor(code: number): NamedColor | undefined {
    const baseColors: NamedColor[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    const brightColors: NamedColor[] = [
      "bright-black",
      "bright-red",
      "bright-green",
      "bright-yellow",
      "bright-blue",
      "bright-magenta",
      "bright-cyan",
      "bright-white"
    ];
    if (code >= 30 && code <= 37) {
      return baseColors[code - 30];
    }
    if (code >= 40 && code <= 47) {
      return baseColors[code - 40];
    }
    if (code >= 90 && code <= 97) {
      return brightColors[code - 90];
    }
    if (code >= 100 && code <= 107) {
      return brightColors[code - 100];
    }
    return undefined;
  }

  private paramOrDefault(params: number[], index: number, fallback: number): number {
    const value = params[index];
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private putChar(char: string): void {
    const width = Math.max(1, stringWidth(char));
    if (this.cursor.x >= this.cols) {
      this.lineFeed();
      this.cursor.x = 0;
    }
    this.ensureLine(this.cursor.y);
    const line = this.lines[this.cursor.y];
    line[this.cursor.x] = { char, ...cloneStyle(this.style) };
    for (let index = 1; index < width && this.cursor.x + index < this.cols; index += 1) {
      line[this.cursor.x + index] = blankCell(this.style);
    }
    this.cursor.x += width;
    if (this.cursor.x >= this.cols) {
      this.lineFeed();
      this.cursor.x = 0;
    }
  }

  private lineFeed(): void {
    this.cursor.y += 1;
    this.ensureLine(this.cursor.y);
  }

  private clearLine(mode: number): void {
    this.ensureLine(this.cursor.y);
    const line = this.lines[this.cursor.y];
    if (mode === 2) {
      this.lines[this.cursor.y] = blankLine(this.cols, this.style);
      return;
    }
    if (mode === 1) {
      for (let index = 0; index <= this.cursor.x && index < this.cols; index += 1) {
        line[index] = blankCell(this.style);
      }
      return;
    }
    for (let index = this.cursor.x; index < this.cols; index += 1) {
      line[index] = blankCell(this.style);
    }
  }

  private clearScreen(mode: number): void {
    if (mode === 2) {
      this.lines = Array.from({ length: this.rows }, () => blankLine(this.cols, this.style));
      this.cursor = { x: 0, y: 0 };
      this.scrollToBottom();
      return;
    }
    if (mode === 1) {
      for (let row = 0; row <= this.cursor.y; row += 1) {
        this.ensureLine(row);
        const line = this.lines[row];
        const end = row === this.cursor.y ? this.cursor.x + 1 : this.cols;
        for (let col = 0; col < end && col < this.cols; col += 1) {
          line[col] = blankCell(this.style);
        }
      }
      return;
    }
    for (let row = this.cursor.y; row < this.lines.length; row += 1) {
      this.ensureLine(row);
      const line = this.lines[row];
      const start = row === this.cursor.y ? this.cursor.x : 0;
      for (let col = start; col < this.cols; col += 1) {
        line[col] = blankCell(this.style);
      }
    }
  }

  private ensureLine(index: number): void {
    while (this.lines.length <= index) {
      this.lines.push(blankLine(this.cols));
    }
  }

  private enforceScrollbackLimit(): void {
    const maxLines = this.rows + this.scrollbackLimit;
    while (this.lines.length > maxLines) {
      this.lines.shift();
      this.cursor.y = Math.max(0, this.cursor.y - 1);
      this.viewportTop = Math.max(0, this.viewportTop - 1);
    }
  }

  private getMaxViewportTop(): number {
    return Math.max(0, this.lines.length - this.rows);
  }
}
