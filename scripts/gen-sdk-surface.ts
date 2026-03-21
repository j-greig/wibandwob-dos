#!/usr/bin/env bun
// @name    gen-sdk-surface
// @desc    Generate SDK export directory from microapp-sdk.ts JSDoc tiers
// @watches src/services/microapp-sdk.ts
// @output  src/sdk/README.md
// @run     bun scripts/gen-sdk-surface.ts

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SDK_FILE = resolve(ROOT, "src/services/microapp-sdk.ts");
const OUTPUT = resolve(ROOT, "src/sdk/README.md");



const src = readFileSync(SDK_FILE, "utf-8");
const lines = src.split("\n");

interface Export {
  tier: string;
  names: string[];
  kind: "value" | "type";
  comment?: string;
}

const exports: Export[] = [];
let currentTier = "";
let currentComment = "";

// Join entire file back to handle multiline export blocks cleanly
// Strategy: find @public/@beta/@internal markers, then extract the
// complete export block that follows (handles multiline { ... } blocks).
const fullSrc = src;

// Pass 1: find all tier annotations and their positions
const tierPositions: Array<{ pos: number; tier: string; comment: string }> = [];
const tierRe = /\/\*\*\s*(@public|@beta|@internal)(.*?)\*\//g;
let tm: RegExpExecArray | null;
while ((tm = tierRe.exec(fullSrc)) !== null) {
  tierPositions.push({
    pos: tm.index + tm[0].length,
    tier: tm[1].replace("@", ""),
    comment: (tm[2] || "").replace(/\s*—\s*/, "").trim(),
  });
}

// Pass 2: for each tier annotation, grab the export that immediately follows
for (const { pos, tier, comment } of tierPositions) {
  const rest = fullSrc.slice(pos);

  // Skip whitespace and pure comment lines to find the first 'export'
  const exportStart = rest.search(/^export\s/m);
  if (exportStart < 0) continue;
  // Make sure nothing significant intervenes (no non-comment, non-whitespace before export)
  const gap = rest.slice(0, exportStart);
  if (/^[^/\s]/.test(gap.replace(/\s+/g, "").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""))) continue;

  const exportSlice = rest.slice(exportStart);

  // export function/const/class name
  const directMatch = exportSlice.match(/^export\s+(function|const|class)\s+(\w+)/);
  if (directMatch) {
    exports.push({ tier, names: [directMatch[2]], kind: "value", comment: comment || undefined });
    continue;
  }

  // export { ... } or export type { ... } — possibly multiline
  const braceMatch = exportSlice.match(/^export\s+(type\s+)?\{/);
  if (braceMatch) {
    const isType = !!braceMatch[1];
    // Find matching closing brace (handles nested content)
    let depth = 0;
    let end = -1;
    for (let ci = braceMatch[0].length - 1; ci < exportSlice.length; ci++) {
      if (exportSlice[ci] === "{") depth++;
      else if (exportSlice[ci] === "}") { depth--; if (depth === 0) { end = ci; break; } }
    }
    if (end < 0) continue;
    const body = exportSlice.slice(braceMatch[0].length - 1 + 1, end);
    // Strip inline comments, extract identifiers
    const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Each entry is like: name or name as alias
    const names = cleaned.split(",")
      .map(n => n.trim().replace(/\s+as\s+\w+/, "").trim())
      .filter(n => /^\w+$/.test(n));
    if (names.length > 0) {
      exports.push({ tier, names, kind: isType ? "type" : "value", comment: comment || undefined });
    }
  }
}

// Group by tier
const tiers = ["public", "beta", "internal"];
const grouped = new Map<string, Export[]>();
for (const t of tiers) grouped.set(t, []);
for (const e of exports) {
  grouped.get(e.tier)?.push(e);
}

// Generate markdown
const out: string[] = [
  "---",
  "generated-by: bun scripts/gen-sdk-surface.ts",
  "watches:",
  "  - src/services/microapp-sdk.ts",
  "parent: ARCHITECTURE.md",
  "do-not-edit: true",
  "---",
  "",
  "# src/sdk — SDK Implementation",
  "",
  "> Entry point for microapp authors: `SDK.md` · Source of truth: `src/services/microapp-sdk.ts`",
  "",
  "Implementation home for the microapp SDK. The stable public import path stays",
  "`src/services/microapp-sdk.ts` — this directory owns the underlying logic.",
  "",
  "**Rule:** microapps never import from here directly. Blessed internals and host-side",
  "services must not leak through the `microapp-sdk.ts` boundary.",
  "",
  "---",
  "",
  `## Export surface — ${new Date().toISOString().split("T")[0]}`,
  "",
];

for (const tier of tiers) {
  const items = grouped.get(tier) || [];
  if (items.length === 0) continue;

  const totalNames = items.reduce((n, e) => n + e.names.length, 0);
  out.push(`## @${tier} (${totalNames} exports)`);
  out.push("");

  for (const e of items) {
    const badge = e.kind === "type" ? "type" : "value";
    const comment = e.comment ? ` — ${e.comment}` : "";
    for (const name of e.names) {
      out.push(`- \`${name}\` (${badge})${comment}`);
    }
  }
  out.push("");
}

const output = out.join("\n");
const existing = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf-8").trim() : "";

if (existing === output.trim()) {
  console.log("✅ sdk-surface.md is up to date");
  process.exit(0);
}

writeFileSync(OUTPUT, output);
console.log(`✏️  sdk-surface.md generated (${exports.reduce((n, e) => n + e.names.length, 0)} exports across ${tiers.filter((t) => (grouped.get(t)?.length ?? 0) > 0).length} tiers)`);
