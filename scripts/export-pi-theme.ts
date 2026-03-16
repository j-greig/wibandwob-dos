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

// Use the darkest available bg (agentBg crust > body base > shadow)
const darkestBg = bg(t.agentBg) || bg(t.body);
const baseBg = bg(t.body);       // mid-dark for surfaces
const surfaceBg = bg(t.bodyAlt); // lighter surface for panels
const textColor = fg(t.body);
const mutedColor = fg(t.muted);
const accentColor = fg(t.accent);          // blue
const highlightColor = fg(t.highlight);    // pink/red
const borderColor = fg(t.windowBorderFocused); // mauve/purple — bright chrome accent
const successColor = fg(t.success);
const errorColor = fg(t.error);
const warningColor = fg(t.warning);

// Dim: halfway between muted and darkest bg
function midpoint(a: string, b: string): string {
  return tintBg(a, b, 0.5);
}
const dimColor = midpoint(mutedColor, darkestBg);

const piTheme = {
  $schema:
    "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  name: `wibwob-${slug}`,
  vars: {
    darkest: darkestBg,
    base: baseBg,
    surface: surfaceBg,
    text: textColor,
    accent: accentColor,       // blue
    chrome: borderColor,       // purple/mauve — bright window chrome accent
    highlight: highlightColor, // pink/red
    success: successColor,
    error: errorColor,
    warning: warningColor,
    muted: mutedColor,
    dim: dimColor,
  },
  colors: {
    // Core UI — purple chrome accent is the primary brand color
    accent: "chrome",
    border: "chrome",
    borderAccent: "accent",
    borderMuted: "dim",
    success: "success",
    error: "error",
    warning: "warning",
    muted: "muted",
    dim: "dim",
    text: "text",
    thinkingText: "muted",

    // Backgrounds — darkest possible base, base for surfaces
    selectedBg: "base",
    userMessageBg: "base",
    userMessageText: "text",
    customMessageBg: "base",
    customMessageText: "text",
    customMessageLabel: "chrome",
    toolPendingBg: "darkest",
    toolSuccessBg: tintBg(darkestBg, successColor, 0.1),
    toolErrorBg: tintBg(darkestBg, errorColor, 0.1),
    toolTitle: "accent",         // blue for tool titles
    toolOutput: "text",

    // Markdown — pink headings, purple links, blue code
    mdHeading: "highlight",      // pink/red
    mdLink: "chrome",            // purple
    mdLinkUrl: "muted",
    mdCode: "accent",            // blue (not green)
    mdCodeBlock: "text",
    mdCodeBlockBorder: "dim",
    mdQuote: "muted",
    mdQuoteBorder: "chrome",
    mdHr: "dim",
    mdListBullet: "chrome",      // purple bullets

    // Tool Diffs
    toolDiffAdded: "success",
    toolDiffRemoved: "error",
    toolDiffContext: "muted",

    // Syntax Highlighting — purple keywords, blue functions
    syntaxComment: "muted",
    syntaxKeyword: "chrome",     // purple
    syntaxFunction: "accent",    // blue
    syntaxVariable: warningColor,
    syntaxString: "success",
    syntaxNumber: "highlight",   // pink
    syntaxType: "accent",        // blue
    syntaxOperator: "chrome",    // purple
    syntaxPunctuation: "muted",

    // Thinking levels (dim → purple → blue → pink → red)
    thinkingOff: "dim",
    thinkingMinimal: "muted",
    thinkingLow: "chrome",
    thinkingMedium: "accent",
    thinkingHigh: "highlight",
    thinkingXhigh: "error",

    // Bash mode
    bashMode: "warning",
  },
  export: {
    pageBg: darkestBg,
    cardBg: baseBg,
    infoBg: tintBg(baseBg, borderColor, 0.08),
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
