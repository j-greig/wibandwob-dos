/**
 * VT100 animation parser and frame generator.
 *
 * Uses @xterm/headless to parse VT100 escape sequences and maintain
 * a virtual terminal screen. Animations are loaded from embedded .vt files
 * and split into chunks that can be fed progressively for animation.
 */
import { Terminal } from "@xterm/headless";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/** Animation metadata */
export interface VtAnimation {
  name: string;
  description: string;
  data: Buffer;
  /** Chunks for progressive playback */
  chunks: Buffer[];
  totalBytes: number;
}

/** Descriptions from theattyr's source */
const DESCRIPTIONS: Record<string, string> = {
  "bambi.vt": "Bambi vs. Godzilla",
  "bambi_godzila": "Bambi Versus Godzilla",
  "barney.vt": "Barney Being Crushed by a Rock",
  "beer.vt": "Time for a Beer Break, Folks!",
  "bevis.butthead.vt": "Beavis and Butthead",
  "blinkeyes.vt": "Blinking Eyes",
  "bomb.vt": "The Bomb Test",
  "bugsbunny.vt": "Bugs Bunny: That's All, Folks",
  "cartwhee.vt": "Doing a Cartwheel",
  "castle.vt": "Disney's Fantasy in the Sky",
  "cert18.vt": "Make Money Fast: The Revenge",
  "cow.vt": "Exploding Cow",
  "cowboom.vt": "Cow Explodes, Gets Hauled Off",
  "crash.vt": "Shuttle Blows Up",
  "cursor.vt": "Cursor Control Examples",
  "delay.vt": "A Small Delay",
  "demo.vt": "Alan's Impressive Demonstration",
  "dirty.vt": "Someone Having Fun",
  "dogs.vt": "Dogs",
  "dont-wor.vt": "Don't Worry, be Happy",
  "dontworry.vt": "Don't Worry, Be Happy",
  "duckpaint.vt": "Duck Painting",
  "firework.vt": "Fireworks by Chen Lin",
  "fireworks.vt": "Guy Setting Off Fireworks",
  "fishy-fishy.vt": "3-D Fishy Fishy",
  "fishy.vt": "Fish Swimming By, Glug Glug",
  "fishy2.vt": "Shamus the Fish",
  "flatmap.vt": "Shifting Flat World Map",
  "frogs.vt": "Hopping Frog",
  "glass.vt": "Filling Glass of Liquid",
  "globe.vt": "Spinning Globe",
  "hallow.vt": "Happy Halloween",
  "hello.vt": "HELLO!",
  "juanspla.vt": "Typewriter",
  "july.4.vt": "July 4th Animation",
  "jumble.vt": "Now Is the Time",
  "maingate.vt": "Disneyland Main Gate",
  "mark_twain.vt": "Mark Twain Ferry",
  "monkey.vt": "The Monkey",
  "monorail.vt": "Disneyland's Monorail",
  "moon.animation": "Winking Moon",
  "movglobe.vt": "Spinning, Moving Globe",
  "mr_pumpkin": "Halloween Pumpkin",
  "nasa.vt": "NASA: Keep Reaching for the Stars",
  "new_year.vt": "Happy New Year",
  "newbeer.vt": "Working on a VT100",
  "nifty.vt": "Small Animated Word NIFTY",
  "outerlimits.vt": "The Outer Limits",
  "pac3d.vt": "Pac Man in 3-D",
  "paradise.vt": "A Bomb in Paradise",
  "peace.vt": "Imagine World Peace",
  "prey.vt": "Klingon Bird of Prey",
  "prey_col.vt": "Klingon Bird of Prey (Color)",
  "safesex.vt": "Safe Sex",
  "shuttle.vt": "Technology, Who Needs It",
  "skyway.vt": "Disneyland's Skyway",
  "snowing": "Merry Christmas from Woodrow",
  "snowing.vt": "Tis the Season",
  "spinweb.vt": "Spinning Web",
  "sship.vt": "Space Ship Warps and Fires",
  "startrek.vt": "Star Trek Enterprise",
  "strike.vt": "Bowling a Strike",
  "sun.vt": "A Happy Sun",
  "surf.vt": "Surfing Wave",
  "tetris.vt": "Tetris Game",
  "tomorrw.vt": "Disneyland's Tomorrowland",
  "torturet.vt": "VT100 Torture Test",
  "treadmill.vt": "The Treadmill",
  "trek.vt": "Enterprise Blows up Satellite",
  "trekvid.vt": "Star Trek",
  "turkey.vt": "Happy Thanksgiving",
  "tv.vt": "The Outer Limits Television",
  "twilight.vt": "The Twilight Zone",
  "twilightzone.vt": "Twilight Zone Opener",
  "valentin.vt": "Happy Valentine's Day",
  "valentine.vt": "Happy Valentine's Day",
  "van_halen.vt": "Van Halen's 5150",
  "wineglas.vt": "Wine Glass Filling",
  "xmas-00.vt": "Santa: Merry Christmas",
  "xmas-01.vt": "Merry Christmas",
  "xmas-02.vt": "Bird, Tree, Merry Christmas",
  "xmas-03.vt": "Christmas Tree, Train, Presents",
  "xmas-04.vt": "Champagne Glass, Jack-in-the-Box",
  "xmas-05.vt": "Happy Holidays, Starry Night",
  "xmas-06.vt": "Hearth and Tree",
  "xmas-07.vt": "A Christmas Card",
  "xmas-08.vt": "Christmas Eve, 1992",
  "xmas-09.vt": "Reindeer Land on Roof",
  "xmas.large": "Christmas Compilation",
  "xmas.vt": "Merry Christmas",
  "xmas2.vt": "Christmas Collection",
  "xmasshort.vt": "Christmas: Tree, Train, Present",
  "zorro.vt": "The Story of Zorro",
  "dvd.vt": "WibWob-DOS DVD Screensaver",
};

/**
 * Split VT data into animation chunks for progressive playback.
 *
 * TheaTTYr reads line-by-line (splitting on \n). We replicate that:
 * split on newlines, and if the file has none, split into small byte chunks.
 */
export function splitIntoChunks(data: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  let start = 0;

  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x0a) {
      chunks.push(Buffer.from(data.subarray(start, i + 1)));
      start = i + 1;
    }
  }

  // Remaining data after last newline
  if (start < data.length) {
    const remaining = Buffer.from(data.subarray(start));
    if (chunks.length === 0) {
      // No newlines at all — split into small byte chunks for smooth animation
      const CHUNK_SIZE = 32;
      for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
        chunks.push(
          Buffer.from(remaining.subarray(i, Math.min(i + CHUNK_SIZE, remaining.length))),
        );
      }
    } else {
      chunks.push(remaining);
    }
  }

  return chunks;
}

/**
 * Live VT100 player. Feeds data progressively to @xterm/headless
 * and reads back the virtual terminal screen for rendering.
 *
 * Key difference from theattyr: theattyr accumulates ALL previously-read data
 * and re-processes the entire buffer each tick. We feed data cumulatively too
 * but xterm handles incremental parsing efficiently.
 */
export class Vt100Player {
  private terminal: Terminal;
  private animation: VtAnimation | null = null;
  private chunkIndex = 0;
  private _isFinished = false;
  private _isPlaying = false;

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    this.terminal = new Terminal({
      rows: height,
      cols: width,
      allowProposedApi: true,
      scrollback: 0,
    });
  }

  get isFinished(): boolean {
    return this._isFinished;
  }
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  get currentAnimation(): VtAnimation | null {
    return this.animation;
  }
  get progress(): number {
    if (!this.animation || this.animation.chunks.length === 0) return 1;
    return this.chunkIndex / this.animation.chunks.length;
  }

  /** Load an animation and reset the player */
  load(animation: VtAnimation): void {
    this.animation = animation;
    this.chunkIndex = 0;
    this._isFinished = false;
    this._isPlaying = true;
    this.terminal.reset();
  }

  /**
   * Process the next chunk (fire-and-forget write).
   * For TUI use: the async write completes before the next render frame.
   * Returns true if data was queued.
   */
  tick(): boolean {
    if (!this.animation || this._isFinished) return false;
    if (this.chunkIndex >= this.animation.chunks.length) {
      this._isFinished = true;
      this._isPlaying = false;
      return false;
    }

    const chunk = this.animation.chunks[this.chunkIndex];
    this.chunkIndex++;

    // Write chunk as binary string — VT100 files are byte streams with escape sequences
    this.terminal.write(chunk.toString("binary"));

    if (this.chunkIndex >= this.animation.chunks.length) {
      this._isFinished = true;
      this._isPlaying = false;
    }
    return true;
  }

  /**
   * Process the next chunk and wait for the write to complete.
   * For benchmark use: ensures readScreen() returns up-to-date state.
   */
  async tickAsync(): Promise<boolean> {
    if (!this.animation || this._isFinished) return false;
    if (this.chunkIndex >= this.animation.chunks.length) {
      this._isFinished = true;
      this._isPlaying = false;
      return false;
    }

    const chunk = this.animation.chunks[this.chunkIndex];
    this.chunkIndex++;

    await new Promise<void>((resolve) => {
      this.terminal.write(chunk.toString("binary"), resolve);
    });

    if (this.chunkIndex >= this.animation.chunks.length) {
      this._isFinished = true;
      this._isPlaying = false;
    }
    return true;
  }

  /** Process multiple chunks at once */
  tickN(n: number): boolean {
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (this.tick()) changed = true;
      if (this._isFinished) break;
    }
    return changed;
  }

  /** Skip to end — feed all remaining data, awaiting each write */
  async skipToEnd(): Promise<void> {
    if (!this.animation) return;
    while (!this._isFinished) {
      await this.tickAsync();
    }
  }

  /** Skip to end synchronously — feed all data at once (for TUI) */
  skipToEndSync(): void {
    if (!this.animation) return;
    // Feed all remaining data in one write
    const remaining: Buffer[] = [];
    while (this.chunkIndex < this.animation.chunks.length) {
      remaining.push(this.animation.chunks[this.chunkIndex]);
      this.chunkIndex++;
    }
    if (remaining.length > 0) {
      this.terminal.write(Buffer.concat(remaining).toString("binary"));
    }
    this._isFinished = true;
    this._isPlaying = false;
  }

  /** Restart the current animation */
  restart(): void {
    if (!this.animation) return;
    const anim = this.animation;
    this.load(anim);
  }

  /**
   * Seek to a specific chunk index.
   * Since VT100 is a streaming format, seeking backward requires replaying
   * all data from the start up to the target chunk.
   */
  seekTo(targetChunk: number): void {
    if (!this.animation) return;
    const total = this.animation.chunks.length;
    const target = Math.max(0, Math.min(targetChunk, total));

    if (target >= this.chunkIndex) {
      // Forward seek: just feed remaining chunks up to target
      while (this.chunkIndex < target && this.chunkIndex < total) {
        const chunk = this.animation.chunks[this.chunkIndex];
        this.terminal.write(chunk.toString("binary"));
        this.chunkIndex++;
      }
    } else {
      // Backward seek: reset terminal and replay from start
      this.terminal.reset();
      this.chunkIndex = 0;
      for (let i = 0; i < target; i++) {
        const chunk = this.animation.chunks[i];
        this.terminal.write(chunk.toString("binary"));
        this.chunkIndex++;
      }
    }

    this._isFinished = this.chunkIndex >= total;
    this._isPlaying = !this._isFinished;
  }

  /** Get current chunk index */
  get currentChunk(): number {
    return this.chunkIndex;
  }

  /** Get total chunk count */
  get totalChunks(): number {
    return this.animation?.chunks.length ?? 0;
  }

  /** Resize the virtual terminal */
  resize(cols: number, rows: number): void {
    try {
      this.terminal.resize(cols, rows);
    } catch {
      // xterm may throw on invalid sizes
    }
  }

  /**
   * Read the current terminal screen as plain text lines.
   */
  readScreen(): string[] {
    const buf = this.terminal.buffer.active;
    const lines: string[] = [];
    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buf.getLine(y);
      lines.push(line ? line.translateToString(false) : "");
    }
    return lines;
  }

  /**
   * Read the current terminal screen with blessed color tags.
   * Returns lines with {color-fg}{color-bg} markup for colored cells.
   */
  readScreenColored(): string[] {
    const buf = this.terminal.buffer.active;
    const lines: string[] = [];

    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buf.getLine(y);
      if (!line) {
        lines.push("");
        continue;
      }

      let result = "";
      let inTag = false; // whether we've emitted an unclosed color tag

      for (let x = 0; x < this.terminal.cols; x++) {
        const cell = line.getCell(x);
        if (!cell) {
          result += " ";
          continue;
        }

        const ch = cell.getChars() || " ";
        const fgIdx = cell.getFgColor();
        const bgIdx = cell.getBgColor();
        const bold = cell.isBold() !== 0;
        const underline = cell.isUnderline() !== 0;
        const blink = cell.isBlink() !== 0;
        const inverse = cell.isInverse() !== 0;

        // Detect explicitly set colors via colorMode (0 = default/unset)
        const hasFg = cell.getFgColorMode() !== 0;
        const hasBg = cell.getBgColorMode() !== 0;
        const hasAttr = bold || underline || blink;

        if (hasFg || hasBg || hasAttr || inverse) {
          if (inTag) result += "{/}";

          let fgName: string;
          let bgName: string;

          if (inverse) {
            fgName = hasBg ? ANSI_NAMES[bgIdx] || "black" : "black";
            bgName = hasFg ? ANSI_NAMES[fgIdx] || "white" : "white";
          } else {
            fgName = hasFg
              ? (bold ? ANSI_BOLD_NAMES[fgIdx] || ANSI_NAMES[fgIdx] : ANSI_NAMES[fgIdx]) || ""
              : "";
            bgName = hasBg ? ANSI_NAMES[bgIdx] || "" : "";
          }

          // Build tags: attributes + colors
          if (bold) result += "{bold}";
          if (underline) result += "{underline}";
          if (blink) result += "{blink}";
          if (fgName && bgName) {
            result += `{${fgName}-fg}{${bgName}-bg}`;
          } else if (fgName) {
            result += `{${fgName}-fg}`;
          } else if (bgName) {
            result += `{${bgName}-bg}`;
          }
          inTag = true;
        } else if (inTag) {
          result += "{/}";
          inTag = false;
        }

        // Escape blessed tag chars in the actual content
        result += ch === "{" ? "\\{" : ch === "}" ? "\\}" : ch;
      }

      if (inTag) result += "{/}";
      lines.push(result);
    }

    return lines;
  }

  /** Read screen as a single plain text string */
  readPlainText(): string {
    return this.readScreen().join("\n");
  }

  /**
   * Read the current terminal screen with ANSI escape codes for colors/attributes.
   * Suitable for text export — universally understood by terminals and viewers.
   */
  readScreenAnsi(): string[] {
    const buf = this.terminal.buffer.active;
    const lines: string[] = [];
    const RESET = "\x1b[0m";

    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buf.getLine(y);
      if (!line) { lines.push(""); continue; }

      let result = "";
      let curSgr = ""; // track current SGR state to avoid redundant codes

      for (let x = 0; x < this.terminal.cols; x++) {
        const cell = line.getCell(x);
        if (!cell) { result += " "; continue; }

        const ch = cell.getChars() || " ";
        const hasFg = cell.getFgColorMode() !== 0;
        const hasBg = cell.getBgColorMode() !== 0;
        const bold = cell.isBold() !== 0;
        const underline = cell.isUnderline() !== 0;
        const blink = cell.isBlink() !== 0;
        const inverse = cell.isInverse() !== 0;

        if (hasFg || hasBg || bold || underline || blink || inverse) {
          const params: number[] = [];
          if (bold) params.push(1);
          if (underline) params.push(4);
          if (blink) params.push(5);
          if (inverse) params.push(7);
          if (hasFg) params.push(30 + cell.getFgColor());
          if (hasBg) params.push(40 + cell.getBgColor());
          const sgr = params.join(";");
          if (sgr !== curSgr) {
            result += `\x1b[${sgr}m`;
            curSgr = sgr;
          }
        } else if (curSgr) {
          result += RESET;
          curSgr = "";
        }
        result += ch;
      }
      if (curSgr) result += RESET;
      lines.push(result);
    }
    return lines;
  }

  /**
   * Count cells with non-default foreground or background colors.
   * Returns { coloredCells, totalNonSpace, fgColors, bgColors }.
   */
  countColorCells(): {
    coloredCells: number;
    totalNonSpace: number;
    fgColors: Set<number>;
    bgColors: Set<number>;
  } {
    const buf = this.terminal.buffer.active;
    let coloredCells = 0;
    let totalNonSpace = 0;
    const fgColors = new Set<number>();
    const bgColors = new Set<number>();

    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buf.getLine(y);
      if (!line) continue;
      for (let x = 0; x < this.terminal.cols; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;
        const ch = cell.getChars();
        if (ch && ch !== " ") {
          totalNonSpace++;
          const fg = cell.getFgColor();
          const bg = cell.getBgColor();
          if (fg !== -1) {
            coloredCells++;
            fgColors.add(fg);
          }
          if (bg !== -1) {
            coloredCells++;
            bgColors.add(bg);
          }
        }
      }
    }

    return { coloredCells, totalNonSpace, fgColors, bgColors };
  }

  /** Clean up */
  dispose(): void {
    this.terminal.dispose();
  }
}

/**
 * Generate a reference frame by feeding ALL data to @xterm/headless at once.
 * This gives us the expected final state for comparison.
 * Uses write callback to ensure data is fully processed before reading.
 */
export async function generateReferenceFrame(
  data: Buffer,
  cols: number,
  rows: number,
): Promise<string[]> {
  const t = new Terminal({ rows, cols, allowProposedApi: true, scrollback: 0 });
  await new Promise<void>((resolve) => {
    t.write(data.toString("binary"), resolve);
  });
  const buf = t.buffer.active;
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    const line = buf.getLine(y);
    lines.push(line ? line.translateToString(false) : "");
  }
  t.dispose();
  return lines;
}

/** Map ANSI color index → blessed color name */
const ANSI_NAMES: Record<number, string> = {
  0: "black",
  1: "red",
  2: "green",
  3: "yellow",
  4: "blue",
  5: "magenta",
  6: "cyan",
  7: "white",
  8: "black",    // bright black (grey)
  9: "red",
  10: "green",
  11: "yellow",
  12: "blue",
  13: "magenta",
  14: "cyan",
  15: "white",
};

/** Bold variants (bright) */
const ANSI_BOLD_NAMES: Record<number, string> = {
  0: "grey",
  1: "red",
  2: "green",
  3: "yellow",
  4: "blue",
  5: "magenta",
  6: "cyan",
  7: "white",
};

/** Load all animations from a directory */
export function loadAnimationList(vtDir: string): VtAnimation[] {
  const files = readdirSync(vtDir).sort();
  const animations: VtAnimation[] = [];

  for (const file of files) {
    const fullPath = join(vtDir, file);
    const stat = statSync(fullPath);
    if (!stat.isFile()) continue;

    const data = readFileSync(fullPath);
    const chunks = splitIntoChunks(data);

    animations.push({
      name: file,
      description: DESCRIPTIONS[file] || file,
      data,
      chunks,
      totalBytes: data.length,
    });
  }

  return animations;
}
