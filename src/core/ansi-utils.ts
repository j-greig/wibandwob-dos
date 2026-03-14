/**
 * ansi-utils.ts — ANSI-aware text measurement and word-wrapping.
 *
 * Ported from @mariozechner/pi-tui (MIT License, badlogic/pi-mono) via the
 * pi-markdown-reader prototype (wibwob-sdk/microapps/pi-markdown-reader/utils.ts).
 *
 * Use these instead of string-width anywhere ANSI codes may be present —
 * string-width does not preserve ANSI codes across line breaks.
 */

import { eastAsianWidth } from "get-east-asian-width";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// ── Emoji / CJK heuristics ────────────────────────────────────────────────────

function couldBeEmoji(segment: string): boolean {
  const cp = segment.codePointAt(0)!;
  return (
    (cp >= 0x1f000 && cp <= 0x1fbff) ||
    (cp >= 0x2300  && cp <= 0x23ff)  ||
    (cp >= 0x2600  && cp <= 0x27bf)  ||
    (cp >= 0x2b50  && cp <= 0x2b55)  ||
    segment.includes("\uFE0F")        ||
    segment.length > 2
  );
}

// ES2022-safe: use \u ranges instead of v-flag Unicode property escapes
const zeroWidthRegex     = /^[\u00AD\u200B-\u200F\u2028\u2029\uFEFF\u00A0]+$/u;
const leadingNonPrinting = /^[\u00AD\u200B-\u200F\u2028\u2029\uFEFF\u00A0]+/u;
// Emoji detection without v-flag: use cp range + fe0f variation selector heuristic
const rgiEmojiRegex      = /^\p{Emoji}$/u;

const WIDTH_CACHE_SIZE = 512;
const widthCache = new Map<string, number>();

function graphemeWidth(segment: string): number {
  if (zeroWidthRegex.test(segment)) return 0;
  if (couldBeEmoji(segment) && rgiEmojiRegex.test(segment)) return 2;
  const base = segment.replace(leadingNonPrinting, "");
  const cp   = base.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return 2;
  let width = eastAsianWidth(cp);
  if (segment.length > 1) {
    for (const char of segment.slice(1)) {
      const c = char.codePointAt(0)!;
      if (c >= 0xff00 && c <= 0xffef) width += eastAsianWidth(c);
    }
  }
  return width;
}

/** Visible terminal column width of a string (strips ANSI, handles emoji/CJK). */
export function visibleWidth(str: string): number {
  if (str.length === 0) return 0;

  // Fast path: pure ASCII printable
  let isPureAscii = true;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) { isPureAscii = false; break; }
  }
  if (isPureAscii) return str.length;

  const cached = widthCache.get(str);
  if (cached !== undefined) return cached;

  let width = 0;
  for (const { segment } of iterateVisibleSegments(str)) width += graphemeWidth(segment);

  if (widthCache.size >= WIDTH_CACHE_SIZE) {
    const firstKey = widthCache.keys().next().value as string | undefined;
    if (firstKey !== undefined) widthCache.delete(firstKey);
  }
  widthCache.set(str, width);
  return width;
}

function *iterateVisibleSegments(str: string): Generator<{ segment: string; start: number; end: number }> {
  let i = 0;
  while (i < str.length) {
    const ansiLen = extractAnsiCode(str, i);
    if (ansiLen) {
      i += ansiLen;
      continue;
    }
    const nextAnsiIndex = str.indexOf("\x1b", i);
    const end = nextAnsiIndex === -1 ? str.length : nextAnsiIndex;
    const chunk = str.slice(i, end).replace(/\t/g, "   ");
    let offset = 0;
    for (const { segment } of segmenter.segment(chunk)) {
      const start = i + offset;
      offset += segment.length;
      yield { segment, start, end: i + offset };
    }
    i = end;
  }
}

// ── ANSI code extraction ──────────────────────────────────────────────────────

/**
 * Extract an ANSI escape sequence starting at pos in str.
 * Returns the byte length of the sequence, or 0 if none.
 */
export function extractAnsiCode(str: string, pos: number): number {
  if (pos >= str.length || str[pos] !== "\x1b") return 0;
  const next = str[pos + 1];

  if (next === "[") {
    let j = pos + 2;
    while (j < str.length && !/[mGKHJ]/.test(str[j]!)) j++;
    return j < str.length ? j + 1 - pos : 0;
  }
  if (next === "]" || next === "_") {
    let j = pos + 2;
    while (j < str.length) {
      if (str[j] === "\x07") return j + 1 - pos;
      if (str[j] === "\x1b" && str[j + 1] === "\\") return j + 2 - pos;
      j++;
    }
    return 0;
  }
  return 0;
}

// ── ANSI state tracker ────────────────────────────────────────────────────────

export class AnsiCodeTracker {
  private bold = false;
  private dim = false;
  private italic = false;
  private underline = false;
  private blink = false;
  private inverse = false;
  private hidden = false;
  private strikethrough = false;
  private fgColor: string | null = null;
  private bgColor: string | null = null;

  process(str: string, start: number, len: number): void {
    const ansiCode = str.slice(start, start + len);
    if (!ansiCode.endsWith("m")) return;
    const match = ansiCode.match(/\x1b\[([\d;]*)m/);
    if (!match) return;
    const params = match[1];
    if (params === "" || params === "0") { this.reset(); return; }

    const parts = params!.split(";");
    let i = 0;
    while (i < parts.length) {
      const code = Number.parseInt(parts[i]!, 10);
      if ((code === 38 || code === 48) && parts[i + 1] === "5" && parts[i + 2] !== undefined) {
        const c = `${code};5;${parts[i + 2]}`;
        if (code === 38) this.fgColor = c; else this.bgColor = c;
        i += 3; continue;
      }
      if ((code === 38 || code === 48) && parts[i + 1] === "2" && parts[i + 4] !== undefined) {
        const c = `${code};2;${parts[i + 2]};${parts[i + 3]};${parts[i + 4]}`;
        if (code === 38) this.fgColor = c; else this.bgColor = c;
        i += 5; continue;
      }
      switch (code) {
        case 0: this.reset(); break;
        case 1: this.bold = true; break;
        case 2: this.dim = true; break;
        case 3: this.italic = true; break;
        case 4: this.underline = true; break;
        case 5: this.blink = true; break;
        case 7: this.inverse = true; break;
        case 8: this.hidden = true; break;
        case 9: this.strikethrough = true; break;
        case 21: case 22: this.bold = false; this.dim = false; break;
        case 23: this.italic = false; break;
        case 24: this.underline = false; break;
        case 25: this.blink = false; break;
        case 27: this.inverse = false; break;
        case 28: this.hidden = false; break;
        case 29: this.strikethrough = false; break;
        case 39: this.fgColor = null; break;
        case 49: this.bgColor = null; break;
        default:
          if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) this.fgColor = String(code);
          else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) this.bgColor = String(code);
      }
      i++;
    }
  }

  private reset(): void {
    this.bold = false; this.dim = false; this.italic = false; this.underline = false;
    this.blink = false; this.inverse = false; this.hidden = false; this.strikethrough = false;
    this.fgColor = null; this.bgColor = null;
  }

  clear(): void { this.reset(); }

  getActiveCodes(): string {
    const codes: string[] = [];
    if (this.bold) codes.push("1");
    if (this.dim) codes.push("2");
    if (this.italic) codes.push("3");
    if (this.underline) codes.push("4");
    if (this.blink) codes.push("5");
    if (this.inverse) codes.push("7");
    if (this.hidden) codes.push("8");
    if (this.strikethrough) codes.push("9");
    if (this.fgColor) codes.push(this.fgColor);
    if (this.bgColor) codes.push(this.bgColor);
    return codes.length === 0 ? "" : `\x1b[${codes.join(";")}m`;
  }

  hasActiveCodes(): boolean {
    return this.getActiveCodes() !== "";
  }

  getLineEndReset(): string {
    return this.underline ? "\x1b[24m" : "";
  }

  getFullReset(): string {
    return this.hasActiveCodes() ? "\x1b[0m" : "";
  }
}

// ── Word-wrap with ANSI preservation ─────────────────────────────────────────

function updateTracker(text: string, tracker: AnsiCodeTracker): void {
  let i = 0;
  while (i < text.length) {
    const len = extractAnsiCode(text, i);
    if (len) { tracker.process(text, i, len); i += len; } else i++;
  }
}

function splitTokens(text: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let pendingAnsi = "";
  let inWs = false;
  let i = 0;
  while (i < text.length) {
    const len = extractAnsiCode(text, i);
    if (len) { pendingAnsi += text.slice(i, i + len); i += len; continue; }
    const char = text[i]!;
    const isWs = char === " ";
    if (isWs !== inWs && cur) { tokens.push(cur); cur = ""; }
    if (pendingAnsi) { cur += pendingAnsi; pendingAnsi = ""; }
    inWs = isWs;
    cur += char;
    i++;
  }
  if (pendingAnsi) cur += pendingAnsi;
  if (cur) tokens.push(cur);
  return tokens;
}

function breakLongWord(word: string, width: number, tracker: AnsiCodeTracker): string[] {
  const lines: string[] = [];
  let line = tracker.getActiveCodes();
  let lineW = 0;
  let i = 0;
  while (i < word.length) {
    const len = extractAnsiCode(word, i);
    if (len) { line += word.slice(i, i + len); tracker.process(word, i, len); i += len; continue; }
    // walk to next ANSI or end
    let end = i;
    while (end < word.length && !extractAnsiCode(word, end)) end++;
    for (const seg of segmenter.segment(word.slice(i, end))) {
      const gw = graphemeWidth(seg.segment);
      if (lineW + gw > width) {
        lines.push(line + tracker.getLineEndReset());
        line = tracker.getActiveCodes();
        lineW = 0;
      }
      line += seg.segment;
      lineW += gw;
    }
    i = end;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function wrapLine(line: string, width: number): string[] {
  if (!line) return [""];
  if (visibleWidth(line) <= width) return [line];
  const wrapped: string[] = [];
  const tracker = new AnsiCodeTracker();
  const tokens = splitTokens(line);
  let cur = "";
  let curW = 0;
  for (const token of tokens) {
    const tw = visibleWidth(token);
    const isWs = token.trimStart() === "";
    if (tw > width && !isWs) {
      if (cur) { wrapped.push(cur.trimEnd() + tracker.getLineEndReset()); cur = ""; curW = 0; }
      const broken = breakLongWord(token, width, tracker);
      wrapped.push(...broken.slice(0, -1));
      cur = broken[broken.length - 1]!;
      curW = visibleWidth(cur);
      continue;
    }
    if (curW + tw > width && curW > 0) {
      wrapped.push(cur.trimEnd() + tracker.getLineEndReset());
      cur = isWs ? tracker.getActiveCodes() : tracker.getActiveCodes() + token;
      curW = isWs ? 0 : tw;
    } else {
      cur += token;
      curW += tw;
    }
    updateTracker(token, tracker);
  }
  if (cur) wrapped.push(cur);
  return wrapped.length > 0 ? wrapped.map(l => l.trimEnd()) : [""];
}

/**
 * Word-wrap text preserving ANSI codes across line breaks.
 */
export function wrapTextWithAnsi(text: string, width: number): string[] {
  if (!text) return [""];
  const inputLines = text.split("\n");
  const result: string[] = [];
  const tracker = new AnsiCodeTracker();
  for (const inputLine of inputLines) {
    const prefix = result.length > 0 ? tracker.getActiveCodes() : "";
    result.push(...wrapLine(prefix + inputLine, width));
    updateTracker(inputLine, tracker);
  }
  return result.length > 0 ? result : [""];
}

/** Clip a string to at most `width` visible columns without splitting graphemes. */
export function clipToVisibleWidth(line: string, width: number): string {
  if (width <= 0 || !line) return "";
  if (visibleWidth(line) <= width) return line;

  let result = "";
  let used = 0;
  let i = 0;
  const tracker = new AnsiCodeTracker();
  while (i < line.length && used < width) {
    const ansiLen = extractAnsiCode(line, i);
    if (ansiLen) {
      result += line.slice(i, i + ansiLen);
      tracker.process(line, i, ansiLen);
      i += ansiLen;
      continue;
    }

    const nextAnsiIndex = line.indexOf("\x1b", i);
    const end = nextAnsiIndex === -1 ? line.length : nextAnsiIndex;
    const chunk = line.slice(i, end).replace(/\t/g, "   ");
    for (const { segment } of segmenter.segment(chunk)) {
      const gw = graphemeWidth(segment);
      if (used + gw > width) return result + tracker.getFullReset();
      result += segment;
      used += gw;
    }
    i = end;
  }
  return result + tracker.getFullReset();
}

/** Pad a string to exactly `width` visible columns. */
export function padToWidth(line: string, width: number): string {
  const vw = visibleWidth(line);
  return vw >= width ? line : line + " ".repeat(width - vw);
}

/** Strip all ANSI escape codes from a string, returning plain text. */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}
