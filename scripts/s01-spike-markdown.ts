#!/usr/bin/env bun
/**
 * S01 spike — markdown rendering approach evaluation
 *
 * Tests approach B (native TS, prototype-derived) against approach A
 * (Python Rich subprocess) on three real wwdos .md files.
 *
 * Usage:
 *   bun scripts/s01-spike-markdown.ts            # render test + latency
 *   bun scripts/s01-spike-markdown.ts --bench    # latency benchmark only
 *   bun scripts/s01-spike-markdown.ts --visual   # dump ANSI to stdout
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { eastAsianWidth } from "get-east-asian-width";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const WIDTH = 80;
const BENCH_RUNS = 5;

const TEST_FILES = [
  join(REPO, "README.md"),
  join(REPO, "AGENTS.md"),
  join(REPO, "NOTES.md"),
];

// ─── ANSI helpers (ported from prototype utils.ts) ──────────────────────────

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const zeroWidthRx = /^[\u200B-\u200D\uFEFF\u00AD]+$/;
const ansiRx = /\x1b\[[0-9;]*m/g;

function visibleWidth(s: string): number {
  const plain = s.replace(ansiRx, "");
  let w = 0;
  for (const { segment } of segmenter.segment(plain)) {
    if (zeroWidthRx.test(segment)) continue;
    const cp = segment.codePointAt(0)!;
    const ew = eastAsianWidth(cp);
    w += (ew === "wide" || ew === "fullwidth") ? 2 : 1;
  }
  return w;
}

function extractAnsiAt(s: string, i: number): string | null {
  if (s[i] !== "\x1b" || s[i + 1] !== "[") return null;
  let j = i + 2;
  while (j < s.length && (s[j] === ";" || (s[j]! >= "0" && s[j]! <= "9"))) j++;
  return s[j] === "m" ? s.slice(i, j + 1) : null;
}

function wrapTextWithAnsi(text: string, maxW: number): string[] {
  if (visibleWidth(text) <= maxW) return [text];
  const words: string[] = [];
  let cur = "";
  let i = 0;
  while (i < text.length) {
    const ansi = extractAnsiAt(text, i);
    if (ansi) { cur += ansi; i += ansi.length; continue; }
    if (text[i] === " ") { words.push(cur); cur = ""; i++; continue; }
    cur += text[i++];
  }
  if (cur) words.push(cur);
  const lines: string[] = [];
  let line = "";
  let lineW = 0;
  let openCodes = "";
  for (const w of words) {
    const plain = w.replace(ansiRx, "");
    const ww = visibleWidth(plain);
    if (lineW + (lineW ? 1 : 0) + ww > maxW && lineW > 0) {
      lines.push(line + "\x1b[0m");
      line = openCodes + w;
      lineW = ww;
    } else {
      line += (lineW ? " " : "") + w;
      lineW += (lineW ? 1 : 0) + ww;
    }
    const codes = w.match(ansiRx);
    if (codes) openCodes = codes[codes.length - 1] ?? "";
  }
  if (line) lines.push(line);
  return lines;
}

function padToWidth(s: string, w: number): string {
  const vw = visibleWidth(s);
  return vw < w ? s + " ".repeat(w - vw) : s;
}

// ─── Approach B: native TS renderer (minimal port of prototype) ──────────────

const R = "\x1b[0m";
const bold = (t: string) => `\x1b[1m${t}\x1b[22m`;
const italic = (t: string) => `\x1b[3m${t}\x1b[23m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[22m`;
const fg = (code: string, t: string) => `\x1b[${code}m${t}${R}`;

const HEADING_FONTS  = ["doom", "slant", "shadow", "small", "smslant"];
const HEADING_COLORS = ["\x1b[96m", "\x1b[94m", "\x1b[95m", "\x1b[93m", "\x1b[92m"];

function figletHeading(text: string, level: number, width: number): string[] {
  const idx   = Math.min(level - 1, HEADING_FONTS.length - 1);
  const font  = HEADING_FONTS[idx]!;
  const color = HEADING_COLORS[idx]!;
  const result = spawnSync("figlet", ["-f", font, "-w", String(width), text], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    return [bold(`${"#".repeat(level)} ${text}`)];
  }
  const lines = result.stdout.split("\n");
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines.map(l => color + l + R);
}

function renderInline(tokens: any[]): string {
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "text": out += t.tokens?.length ? renderInline(t.tokens) : (t.text ?? ""); break;
      case "strong": out += bold(renderInline(t.tokens ?? [])); break;
      case "em": out += italic(renderInline(t.tokens ?? [])); break;
      case "codespan": out += `\x1b[38;5;223m\x1b[48;5;236m ${t.text} ${R}`; break;
      case "link": {
        const txt = renderInline(t.tokens ?? []);
        const href = t.href ?? "";
        out += `\x1b[38;5;75m\x1b[4m${txt}${R}${t.text !== href ? dim(` (${href})`) : ""}`;
        break;
      }
      case "br": out += "\n"; break;
      case "del": out += `\x1b[9m${renderInline(t.tokens ?? [])}\x1b[29m`; break;
      default: if (t.text) out += t.text;
    }
  }
  return out;
}

function renderToken(token: any, width: number, nextType?: string): string[] {
  const lines: string[] = [];
  switch (token.type) {
    case "heading":
      lines.push(...figletHeading(renderInline(token.tokens ?? []).replace(ansiRx, ""), token.depth, width));
      lines.push("");
      break;
    case "paragraph": {
      const text = renderInline(token.tokens ?? []);
      lines.push(text);
      if (nextType && nextType !== "list" && nextType !== "space") lines.push("");
      break;
    }
    case "code": {
      const lang = (token.lang ?? "").toLowerCase();
      lines.push(dim(`\`\`\`${lang}`));
      for (const l of (token.text ?? "").split("\n"))
        lines.push(`\x1b[48;5;234m  ${l}${R}`);
      lines.push(dim("```"));
      lines.push("");
      break;
    }
    case "list": {
      for (let i = 0; i < token.items.length; i++) {
        const item = token.items[i];
        const bullet = token.ordered ? `${(token.start ?? 1) + i}. ` : "- ";
        const itemText = item.tokens?.map((t: any) => renderInline(t.tokens ?? [t])).join("") ?? "";
        lines.push(`\x1b[36m${bullet}${R}${itemText}`);
      }
      lines.push("");
      break;
    }
    case "blockquote": {
      for (const qt of token.tokens ?? []) {
        for (const ql of renderToken(qt, width - 2)) {
          lines.push(`\x1b[38;5;240m│${R} ${italic(`\x1b[38;5;250m${ql}${R}`)}`);
        }
      }
      lines.push("");
      break;
    }
    case "hr":
      lines.push(dim("─".repeat(Math.min(width, 88))));
      lines.push("");
      break;
    case "table": {
      // minimal table: just header + rows as plain text
      const cols = token.header?.length ?? 0;
      if (cols) {
        const header = token.header.map((h: any) => bold(renderInline(h.tokens ?? []))).join(" │ ");
        lines.push(`│ ${header} │`);
        lines.push("─".repeat(Math.min(width, 88)));
        for (const row of token.rows ?? []) {
          lines.push(`│ ${row.map((c: any) => renderInline(c.tokens ?? [])).join(" │ ")} │`);
        }
        lines.push("");
      }
      break;
    }
    case "space": lines.push(""); break;
    case "html": break; // skip
    default: if (token.text) lines.push(token.text);
  }
  return lines;
}

function renderMarkdownTS(text: string, width: number): string[] {
  const contentW = Math.max(1, width - 4);
  const tokens = marked.lexer(text.replace(/\t/g, "  "));
  const raw: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    raw.push(...renderToken(tokens[i]!, contentW, tokens[i + 1]?.type));
  }
  const margin = "  ";
  const out: string[] = [];
  for (const line of raw) {
    for (const wrapped of wrapTextWithAnsi(line, contentW)) {
      out.push(padToWidth(margin + wrapped, width));
    }
  }
  return out;
}

// ─── Approach A: Python Rich subprocess ──────────────────────────────────────

const RICH_SCRIPT = `
import sys, io
from rich.console import Console
from rich.markdown import Markdown
text = open(sys.argv[1]).read()
width = int(sys.argv[2])
buf = io.StringIO()
c = Console(file=buf, force_terminal=True, width=width, color_system="truecolor")
c.print(Markdown(text))
print(buf.getvalue(), end="")
`;

function renderMarkdownRich(filePath: string, width: number): { lines: string[]; ms: number } {
  const t0 = performance.now();
  const result = spawnSync("python3", ["-c", RICH_SCRIPT, filePath, String(width)], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  const ms = Math.round(performance.now() - t0);
  if (result.status !== 0) return { lines: [`ERROR: ${result.stderr?.trim()}`], ms };
  return { lines: result.stdout.split("\n"), ms };
}

// ─── Rendering gap checker ────────────────────────────────────────────────────

interface GapReport {
  file: string;
  tsLines: number;
  richLines: number;
  tsErrors: string[];
  richErrors: string[];
  tsMs: number;
  richMs: number;
}

function checkFile(filePath: string): GapReport {
  const text = readFileSync(filePath, "utf8");
  const tsErrors: string[] = [];
  const richErrors: string[] = [];

  // TS render
  let tsLines: string[] = [];
  let tsMs = 0;
  try {
    const t0 = performance.now();
    tsLines = renderMarkdownTS(text, WIDTH);
    tsMs = Math.round(performance.now() - t0);
  } catch (e: any) {
    tsErrors.push(`CRASH: ${e.message}`);
  }

  // Rich render
  const rich = renderMarkdownRich(filePath, WIDTH);
  const richMs = rich.ms;
  const richLines = rich.lines;
  if (richLines[0]?.startsWith("ERROR")) richErrors.push(richLines[0]);

  // Check for obvious rendering gaps in TS output
  const tsText = tsLines.join("\n");
  const tokens = marked.lexer(text);
  for (const t of tokens) {
    if (t.type === "table" && !tsText.includes("│")) tsErrors.push("table: no box chars rendered");
    if (t.type === "code" && !tsText.includes("```")) tsErrors.push("code block: no fence rendered");
  }

  return {
    file: filePath.replace(REPO + "/", ""),
    tsLines: tsLines.length,
    richLines: richLines.length,
    tsErrors,
    richErrors,
    tsMs,
    richMs,
  };
}

// ─── Benchmark ───────────────────────────────────────────────────────────────

function benchmark(filePath: string): void {
  const text = readFileSync(filePath, "utf8");
  const label = filePath.replace(REPO + "/", "");

  // TS cold (first run includes JIT)
  const tsTimes: number[] = [];
  for (let i = 0; i < BENCH_RUNS; i++) {
    const t0 = performance.now();
    renderMarkdownTS(text, WIDTH);
    tsTimes.push(Math.round(performance.now() - t0));
  }

  // Rich (each is a fresh python3 process — simulates real usage)
  const richTimes: number[] = [];
  for (let i = 0; i < BENCH_RUNS; i++) {
    richTimes.push(renderMarkdownRich(filePath, WIDTH).ms);
  }

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);

  console.log(`\n${label} (${BENCH_RUNS} runs each, width=${WIDTH})`);
  console.log(`  TS native:  avg=${avg(tsTimes)}ms  min=${min(tsTimes)}ms  max=${max(tsTimes)}ms`);
  console.log(`  Rich subp:  avg=${avg(richTimes)}ms  min=${min(richTimes)}ms  max=${max(richTimes)}ms`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isBench = args.includes("--bench");
const isVisual = args.includes("--visual");

if (isBench) {
  console.log("=== S01 Latency Benchmark ===");
  for (const f of TEST_FILES.filter(existsSync)) benchmark(f);
  process.exit(0);
}

if (isVisual) {
  const f = TEST_FILES.find(existsSync)!;
  const text = readFileSync(f, "utf8");
  const lines = renderMarkdownTS(text, WIDTH);
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

// Default: gap analysis
console.log("=== S01 Rendering Gap Analysis ===\n");
const reports: GapReport[] = [];
for (const f of TEST_FILES.filter(existsSync)) {
  process.stdout.write(`checking ${f.replace(REPO + "/", "")}...`);
  reports.push(checkFile(f));
  process.stdout.write(" done\n");
}

console.log("\n--- Results ---");
for (const r of reports) {
  console.log(`\n${r.file}`);
  console.log(`  TS native:  ${r.tsLines} lines  ${r.tsMs}ms${r.tsErrors.length ? "  ERRORS:" : "  OK"}`);
  for (const e of r.tsErrors) console.log(`    ! ${e}`);
  console.log(`  Rich subp:  ${r.richLines} lines  ${r.richMs}ms${r.richErrors.length ? "  ERRORS:" : "  OK"}`);
  for (const e of r.richErrors) console.log(`    ! ${e}`);
}
