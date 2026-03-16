#!/usr/bin/env bun
/**
 * Convert a WibWob-DOS ThemeVariant to a pi agent theme JSON.
 *
 * Usage:
 *   bun scripts/export-pi-theme.ts <theme-module>
 *
 * Examples:
 *   bun scripts/export-pi-theme.ts dark-pastel
 *   bun scripts/export-pi-theme.ts phosphor
 *   bun scripts/export-pi-theme.ts dark-nord
 *
 * Output: ~/.pi/agent/themes/wibwob-<name>.json
 */

import { resolve, basename } from "path";
import type { ThemeTokens } from "../src/core/theme/types.js";

// ---------------------------------------------------------------------------
// 1. Load the WibWob theme
// ---------------------------------------------------------------------------

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: bun scripts/export-pi-theme.ts <theme-module>");
  console.error("  e.g. dark-pastel, phosphor, dark-nord, dark, light");
  process.exit(1);
}

const modPath = resolve(import.meta.dir, `../src/core/theme/${slug}.ts`);
const mod = await import(modPath);

// Find the ThemeVariant export (first export with a .tokens property)
const variant = Object.values(mod).find(
  (v: any) => v && typeof v === "object" && "tokens" in v && "name" in v
) as { name: string; tokens: ThemeTokens } | undefined;

if (!variant) {
  console.error(`No ThemeVariant export found in ${modPath}`);
  process.exit(1);
}

const t = variant.tokens;

// ---------------------------------------------------------------------------
// 2. Mapping logic: WibWob tokens → pi theme tokens
// ---------------------------------------------------------------------------

// Helper: pick just the foreground color from a StylePair
const fg = (pair: { fg: string }) => pair.fg;
const bg = (pair: { fg: string; bg: string }) => pair.bg;

// Derive tinted backgrounds from the base bg
function tintBg(base: string, tint: string, strength = 0.15): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const toHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

  const [br, bg, bb] = parse(base);
  const [tr, tg, tb] = parse(tint);
  return toHex(
    br + (tr - br) * strength,
    bg + (tg - bg) * strength,
    bb + (tb - bb) * strength
  );
}

const baseBg = bg(t.body);
const surfaceBg = bg(t.bodyAlt);
const textColor = fg(t.body);
const mutedColor = fg(t.muted);
const accentColor = fg(t.accent);
const highlightColor = fg(t.highlight);
const successColor = fg(t.success);
const errorColor = fg(t.error);
const warningColor = fg(t.warning);

// Dim: halfway between muted and base bg
function midpoint(a: string, b: string): string {
  return tintBg(a, b, 0.5);
}
const dimColor = midpoint(mutedColor, baseBg);

const piTheme = {
  $schema:
    "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  name: `wibwob-${slug}`,
  vars: {
    base: baseBg,
    surface: surfaceBg,
    text: textColor,
    accent: accentColor,
    highlight: highlightColor,
    success: successColor,
    error: errorColor,
    warning: warningColor,
    muted: mutedColor,
    dim: dimColor,
  },
  colors: {
    // Core UI
    accent: "accent",
    border: "accent",
    borderAccent: "highlight",
    borderMuted: "dim",
    success: "success",
    error: "error",
    warning: "warning",
    muted: "muted",
    dim: "dim",
    text: "text",
    thinkingText: "muted",

    // Backgrounds & Content
    selectedBg: "surface",
    userMessageBg: "surface",
    userMessageText: "text",
    customMessageBg: "surface",
    customMessageText: "text",
    customMessageLabel: "accent",
    toolPendingBg: "base",
    toolSuccessBg: tintBg(baseBg, successColor, 0.12),
    toolErrorBg: tintBg(baseBg, errorColor, 0.12),
    toolTitle: "accent",
    toolOutput: "text",

    // Markdown
    mdHeading: "highlight",
    mdLink: "accent",
    mdLinkUrl: "muted",
    mdCode: "success",
    mdCodeBlock: "text",
    mdCodeBlockBorder: "dim",
    mdQuote: "muted",
    mdQuoteBorder: "accent",
    mdHr: "dim",
    mdListBullet: "accent",

    // Tool Diffs
    toolDiffAdded: "success",
    toolDiffRemoved: "error",
    toolDiffContext: "muted",

    // Syntax Highlighting
    syntaxComment: "muted",
    syntaxKeyword: "highlight",
    syntaxFunction: "accent",
    syntaxVariable: warningColor,    // use warning/yellow tone for vars
    syntaxString: "success",
    syntaxNumber: "highlight",
    syntaxType: "accent",
    syntaxOperator: "accent",
    syntaxPunctuation: "muted",

    // Thinking levels (gradient from muted → accent → highlight → error)
    thinkingOff: "dim",
    thinkingMinimal: "muted",
    thinkingLow: "accent",
    thinkingMedium: "accent",
    thinkingHigh: "highlight",
    thinkingXhigh: "error",

    // Bash mode
    bashMode: "warning",
  },
  export: {
    pageBg: baseBg,
    cardBg: surfaceBg,
    infoBg: tintBg(surfaceBg, accentColor, 0.08),
  },
};

// ---------------------------------------------------------------------------
// 3. Write output
// ---------------------------------------------------------------------------

const outDir = resolve(Bun.env.HOME!, ".pi/agent/themes");
await Bun.write(resolve(outDir, "placeholder"), ""); // ensure dir exists
const fs = await import("fs");
fs.unlinkSync(resolve(outDir, "placeholder"));

const outPath = resolve(outDir, `wibwob-${slug}.json`);
await Bun.write(outPath, JSON.stringify(piTheme, null, 2) + "\n");
console.log(`✅ Wrote ${outPath}`);
console.log(`   Theme name: "${piTheme.name}"`);
console.log(`   Select in pi: /settings → theme → ${piTheme.name}`);
