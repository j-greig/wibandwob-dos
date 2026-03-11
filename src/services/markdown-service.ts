/**
 * markdown-service.ts — Markdown → ANSI terminal rendering.
 *
 * Ported from pi-markdown-reader prototype (wibwob-sdk/modules/pi-markdown-reader/renderer.ts).
 * Architecture: marked.lexer() → AST token dispatch → ANSI-styled lines.
 *
 * Gap-fills vs spike renderer (S01 findings):
 *   - Proportional table column sizing with unicode box borders (from prototype)
 *   - Deeply nested lists via recursive renderList(depth)
 *   - Nested blockquotes via recursive token dispatch
 *
 * Figlet headings: H1–H5 rendered via figlet CLI (figlet-service.ts).
 *   Fonts: doom → slant → shadow → small → smslant.
 *   Colours: bright cyan → blue → magenta → yellow → green.
 *   Configurable via FigletHeadingConfig (defined in types.ts, wired in F03/S04).
 *   Default config matches prototype exactly.
 */

import { marked, type Token } from "marked";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { visibleWidth, wrapTextWithAnsi, padToWidth } from "../core/ansi-utils.js";
import { highlightCode } from "./syntax-highlight.js";
import { isFigletAvailable } from "./figlet-service.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const R = "\x1b[0m";
const bold        = (t: string) => `\x1b[1m${t}\x1b[22m`;
const italic      = (t: string) => `\x1b[3m${t}\x1b[23m`;
const underline   = (t: string) => `\x1b[4m${t}\x1b[24m`;
const strikethrough = (t: string) => `\x1b[9m${t}\x1b[29m`;
const dim         = (t: string) => `\x1b[2m${t}\x1b[22m`;

const theme = {
  link:          (t: string) => `\x1b[38;5;75m${t}${R}`,
  linkUrl:       (t: string) => dim(`\x1b[38;5;242m${t}${R}`),
  code:          (t: string) => `\x1b[38;5;223m\x1b[48;5;236m ${t} ${R}`,
  codeBlockBg:   (t: string) => `\x1b[38;5;252m\x1b[48;5;234m${t}${R}`,
  codeBlockBorder:(t: string)=> `\x1b[38;5;238m${t}${R}`,
  quote:         (t: string) => italic(`\x1b[38;5;250m${t}${R}`),
  quoteBorder:   (t: string) => `\x1b[38;5;240m${t}${R}`,
  hr:            (t: string) => `\x1b[38;5;238m${t}${R}`,
  listBullet:    (t: string) => `\x1b[36m${t}${R}`,
  bold, italic, strikethrough, underline,
};

// ── Figlet headings ───────────────────────────────────────────────────────────

const DEFAULT_FONTS  = ["doom", "slant", "shadow", "small", "smslant"];
const DEFAULT_COLORS = ["\x1b[96m", "\x1b[94m", "\x1b[95m", "\x1b[93m", "\x1b[92m"];

export interface FigletHeadingLevel {
  font: string;
  fallbackFonts: string[];
  color: string;
  plainFallback: boolean;
}

export interface FigletHeadingConfig {
  h1: FigletHeadingLevel;
  h2: FigletHeadingLevel;
  h3: FigletHeadingLevel;
  h4: FigletHeadingLevel;
  h5: FigletHeadingLevel;
  h6: FigletHeadingLevel;
}

export const DEFAULT_FIGLET_HEADING_CONFIG: FigletHeadingConfig = {
  h1: { font: "slant",      fallbackFonts: ["small","term"], color: "\x1b[96m", plainFallback: true },       // 6h
  h2: { font: "small",      fallbackFonts: ["smshadow","mini","term"], color: "\x1b[94m", plainFallback: true }, // 5h
  h3: { font: "threepoint", fallbackFonts: ["digital","term"], color: "\x1b[95m", plainFallback: true },        // 3h
  h4: { font: "digital",    fallbackFonts: ["term"], color: "\x1b[93m", plainFallback: true },                  // 3h
  h5: { font: "",           fallbackFonts: [], color: "\x1b[92m", plainFallback: true },                        // CAPS + =====
  h6: { font: "",           fallbackFonts: [], color: "\x1b[37m", plainFallback: true },                        // CAPS + -----
};

/** Plain-headings config: no figlet, just bold ANSI text. */
export const PLAIN_HEADING_CONFIG: FigletHeadingConfig = {
  h1: { font: "", fallbackFonts: [], color: DEFAULT_COLORS[0] ?? "\x1b[37m", plainFallback: true },
  h2: { font: "", fallbackFonts: [], color: DEFAULT_COLORS[1] ?? "\x1b[37m", plainFallback: true },
  h3: { font: "", fallbackFonts: [], color: DEFAULT_COLORS[2] ?? "\x1b[37m", plainFallback: true },
  h4: { font: "", fallbackFonts: [], color: DEFAULT_COLORS[3] ?? "\x1b[37m", plainFallback: true },
  h5: { font: "", fallbackFonts: [], color: DEFAULT_COLORS[4] ?? "\x1b[37m", plainFallback: true },
  h6: { font: "", fallbackFonts: [], color: "\x1b[37m", plainFallback: true },
};

function tryFiglet(text: string, font: string, width: number): string[] | null {
  if (!font || !isFigletAvailable()) return null;
  const result = spawnSync("figlet", ["-f", font, "-w", String(width), text], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  const lines = result.stdout.split("\n");
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  // Reject if any line exceeds width (figlet -w should prevent this, but guard)
  if (lines.some(l => visibleWidth(l) > width)) return null;
  return lines;
}

function renderFigletHeading(text: string, level: number, width: number, config: FigletHeadingConfig): string[] {
  const key = `h${Math.min(level, 6)}` as keyof FigletHeadingConfig;
  const cfg = config[key];
  const color = cfg.color;

  // Strip existing ANSI from heading text before passing to figlet
  let plain = text.replace(/\x1b\[[0-9;]*m/g, "");

  // Parse inline font override: `## Heading {fontname}`
  let overrideFont: string | undefined;
  const attrMatch = plain.match(/\s*\{([a-zA-Z0-9_-]+)\}\s*$/);
  if (attrMatch) {
    overrideFont = attrMatch[1];
    plain = plain.slice(0, attrMatch.index!).trimEnd();
  }

  // Try figlet — the -w flag handles word wrapping for long headings.
  // Only skip if absurdly long (> 200 chars) where figlet output would be noise.
  if (plain.length <= 200) {
    // If an override font was specified, try it first before defaults
    const fontList = overrideFont
      ? [overrideFont, cfg.font, ...cfg.fallbackFonts]
      : [cfg.font, ...cfg.fallbackFonts];
    for (const font of fontList) {
      const lines = tryFiglet(plain, font, width);
      if (lines) return lines.map(l => color + l + R);
    }
  }

  // Plain fallback — H5 gets CAPS + =====, H6 gets CAPS + -----
  if (cfg.plainFallback) {
    if (level === 5) {
      const caps = plain.toUpperCase();
      return [
        color + bold(caps) + R,
        color + "=".repeat(caps.length) + R,
      ];
    }
    if (level === 6) {
      const caps = plain.toUpperCase();
      return [
        color + bold(caps) + R,
        color + "-".repeat(caps.length) + R,
      ];
    }
    const prefix = "#".repeat(level) + " ";
    return [color + bold(underline(prefix + plain)) + R];
  }
  return [bold(plain)];
}

// ── Inline token renderer ─────────────────────────────────────────────────────

function renderInline(tokens: Token[]): string {
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "text":
        out += (t as any).tokens?.length ? renderInline((t as any).tokens) : ((t as any).text ?? "");
        break;
      case "paragraph":
        out += renderInline((t as any).tokens ?? []);
        break;
      case "strong":
        out += theme.bold(renderInline((t as any).tokens ?? []));
        break;
      case "em":
        out += theme.italic(renderInline((t as any).tokens ?? []));
        break;
      case "codespan":
        out += theme.code((t as any).text ?? "");
        break;
      case "link": {
        const linkText = renderInline((t as any).tokens ?? []);
        const href = (t as any).href ?? "";
        const text = (t as any).text ?? "";
        const hrefComp = href.startsWith("mailto:") ? href.slice(7) : href;
        if (text === href || text === hrefComp) {
          out += theme.link(underline(linkText));
        } else {
          out += theme.link(underline(linkText)) + theme.linkUrl(` (${href})`);
        }
        break;
      }
      case "br": out += "\n"; break;
      case "del": out += theme.strikethrough(renderInline((t as any).tokens ?? [])); break;
      case "html": out += (t as any).raw ?? ""; break;
      default: if ((t as any).text) out += (t as any).text;
    }
  }
  return out;
}

// ── List renderer (recursive, handles deep nesting) ───────────────────────────

function renderListItem(tokens: Token[], parentDepth: number): string[] {
  const lines: string[] = [];
  for (const token of tokens) {
    const t = token as any;
    if (t.type === "list") {
      lines.push(...renderList(t, parentDepth + 1));
    } else if (t.type === "text") {
      lines.push(t.tokens?.length ? renderInline(t.tokens) : (t.text ?? ""));
    } else if (t.type === "paragraph") {
      lines.push(renderInline(t.tokens ?? []));
    } else {
      const rendered = renderInline([token]);
      if (rendered) lines.push(rendered);
    }
  }
  return lines;
}

function renderList(token: any, depth: number): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  const start = token.start ?? 1;
  for (let i = 0; i < token.items.length; i++) {
    const item = token.items[i];
    const bullet = token.ordered ? `${start + i}. ` : "- ";
    const itemLines = renderListItem(item.tokens ?? [], depth);
    if (itemLines.length > 0) {
      const isNested = /^\s+\x1b\[36m/.test(itemLines[0]!);
      lines.push(isNested ? itemLines[0]! : indent + theme.listBullet(bullet) + itemLines[0]!);
      for (let j = 1; j < itemLines.length; j++) {
        const l = itemLines[j]!;
        lines.push(/^\s+\x1b\[36m/.test(l) ? l : `${indent}  ${l}`);
      }
    } else {
      lines.push(indent + theme.listBullet(bullet));
    }
  }
  return lines;
}

// ── Table renderer (proportional column sizing, unicode box borders) ───────────

function wrapCell(text: string, w: number): string[] {
  const wrapped = wrapTextWithAnsi(text, w);
  return wrapped.map(l => padToWidth(l, w));
}

function renderTable(token: any, available: number): string[] {
  const numCols = token.header?.length ?? 0;
  if (numCols === 0) return token.raw ? wrapTextWithAnsi(token.raw, available) : [];

  const borderOverhead = 3 * numCols + 1;
  const availForCells = available - borderOverhead;
  if (availForCells < numCols) return token.raw ? wrapTextWithAnsi(token.raw, available) : [];

  // Natural widths
  const natural: number[] = Array(numCols).fill(0);
  for (let i = 0; i < numCols; i++) {
    natural[i] = visibleWidth(renderInline(token.header[i].tokens ?? []));
  }
  for (const row of token.rows) {
    for (let i = 0; i < row.length; i++) {
      const w = visibleWidth(renderInline(row[i].tokens ?? []));
      if (w > (natural[i] ?? 0)) natural[i] = w;
    }
  }

  // Proportional sizing
  const totalNatural = natural.reduce((a, b) => a + b, 0) + borderOverhead;
  let colWidths: number[];
  if (totalNatural <= available) {
    colWidths = [...natural];
  } else {
    const totalNat = natural.reduce((a, b) => a + b, 0);
    colWidths = natural.map(n => Math.max(6, Math.floor((n / totalNat) * availForCells)));
    let used = colWidths.reduce((a, b) => a + b, 0);
    for (let i = 0; used < availForCells && i < numCols; i++) { colWidths[i]!++; used++; }
  }

  const rule = (l: string, m: string, r: string) =>
    l + "─" + colWidths.map(w => "─".repeat(w)).join("─" + m + "─") + "─" + r;

  function renderRowLines(cells: string[][], isBold = false): string[] {
    const rowLines: string[] = [];
    const maxLines = Math.max(...cells.map(c => c.length));
    for (let li = 0; li < maxLines; li++) {
      const parts = cells.map((cellLines, ci) => {
        const txt = cellLines[li] ?? " ".repeat(colWidths[ci]!);
        return isBold ? theme.bold(txt) : txt;
      });
      rowLines.push(`│ ${parts.join(" │ ")} │`);
    }
    return rowLines;
  }

  const lines: string[] = [];
  lines.push(theme.hr(rule("┌", "┬", "┐")));
  lines.push(...renderRowLines(token.header.map((h: any, i: number) => wrapCell(renderInline(h.tokens ?? []), colWidths[i]!)), true));
  lines.push(theme.hr(rule("├", "┼", "┤")));
  for (let ri = 0; ri < token.rows.length; ri++) {
    const row = token.rows[ri];
    lines.push(...renderRowLines(row.map((c: any, i: number) => wrapCell(renderInline(c.tokens ?? []), colWidths[i]!))));
    if (ri < token.rows.length - 1) lines.push(theme.hr(rule("├", "┼", "┤")));
  }
  lines.push(theme.hr(rule("└", "┴", "┘")));
  lines.push("");
  return lines;
}

// ── Code block renderer ───────────────────────────────────────────────────────

function renderCodeBlock(token: any, width: number): string[] {
  const lang   = (token.lang ?? "").toLowerCase();
  const bgWidth = Math.min(width, 88);
  const indent  = "  ";
  const lines: string[] = [];
  lines.push(theme.codeBlockBorder(padToWidth(`\`\`\`${lang}`, bgWidth)));
  for (const codeLine of highlightCode(token.text ?? "", lang)) {
    lines.push(theme.codeBlockBg(padToWidth(indent + codeLine, bgWidth)));
  }
  lines.push(theme.codeBlockBorder(padToWidth("```", bgWidth)));
  lines.push("");
  return lines;
}

// ── Token dispatcher ──────────────────────────────────────────────────────────

function renderToken(
  token: Token,
  width: number,
  nextType: string | undefined,
  config: FigletHeadingConfig,
  depth: number,
): string[] {
  const lines: string[] = [];
  switch (token.type) {
    case "heading": {
      const t = token as any;
      const headingText = renderInline(t.tokens ?? []);
      lines.push(...renderFigletHeading(headingText, t.depth, width, config));
      lines.push("");
      break;
    }
    case "paragraph": {
      const t = token as any;
      lines.push(renderInline(t.tokens ?? []));
      if (nextType && nextType !== "list" && nextType !== "space") lines.push("");
      break;
    }
    case "code":
      lines.push(...renderCodeBlock(token as any, width));
      break;
    case "list":
      lines.push(...renderList(token as any, 0));
      lines.push("");
      break;
    case "table":
      lines.push(...renderTable(token as any, width));
      break;
    case "blockquote": {
      const t = token as any;
      const quoteW = Math.max(1, width - 2);
      const quoteLines: string[] = [];
      const subTokens: Token[] = t.tokens ?? [];
      for (let i = 0; i < subTokens.length; i++) {
        quoteLines.push(...renderToken(subTokens[i]!, quoteW, subTokens[i + 1]?.type, config, depth + 1));
      }
      while (quoteLines.length && quoteLines[quoteLines.length - 1]!.trim() === "") quoteLines.pop();
      for (const ql of quoteLines) {
        for (const wl of wrapTextWithAnsi(theme.quote(ql), quoteW)) {
          lines.push(theme.quoteBorder("│ ") + wl);
        }
      }
      if (nextType !== "space") lines.push("");
      break;
    }
    case "hr":
      lines.push(theme.hr("─".repeat(Math.min(width, 88))));
      if (nextType !== "space") lines.push("");
      break;
    case "html": break; // skip badges, img tags
    case "space": lines.push(""); break;
    default: if ((token as any).text) lines.push((token as any).text);
  }
  return lines;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RenderMarkdownOptions {
  paddingX?: number;
  headingConfig?: FigletHeadingConfig;
}

/**
 * Render markdown text to an array of ANSI-styled terminal lines.
 * Lines are word-wrapped and padded to `width` columns.
 *
 * @param text    - Markdown source
 * @param width   - Available terminal width in columns
 * @param opts    - paddingX (default 2), headingConfig (default figlet config)
 */
export function renderMarkdown(text: string, width: number, opts: RenderMarkdownOptions = {}): string[] {
  const paddingX   = opts.paddingX ?? 2;
  const config     = opts.headingConfig ?? DEFAULT_FIGLET_HEADING_CONFIG;
  const contentW   = Math.max(1, width - paddingX * 2);
  const normalised = text.replace(/\t/g, "   ");
  const tokens     = marked.lexer(normalised);
  const raw: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    raw.push(...renderToken(tokens[i]!, contentW, tokens[i + 1]?.type, config, 0));
  }

  const leftMargin = " ".repeat(paddingX);
  const output: string[] = [];
  for (const line of raw) {
    for (const wrapped of wrapTextWithAnsi(line, contentW)) {
      output.push(padToWidth(leftMargin + wrapped, width));
    }
  }
  return output;
}

/**
 * Render a markdown file to ANSI lines. Throws if file cannot be read.
 */
export function renderMarkdownFile(filePath: string, width: number, opts: RenderMarkdownOptions = {}): string[] {
  const text = readFileSync(filePath, "utf8");
  return renderMarkdown(text, width, opts);
}

/** Returns true if filePath has a markdown extension. */
export function isMarkdownFile(filePath: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(filePath);
}

/**
 * Get the mtime of a file as a number (ms since epoch).
 * Used by MarkdownPanel live-watch to detect file changes.
 */
export function getFileMtime(filePath: string): number {
  try { return statSync(filePath).mtimeMs; } catch { return 0; }
}
