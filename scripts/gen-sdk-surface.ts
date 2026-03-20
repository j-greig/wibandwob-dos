#!/usr/bin/env bun
// @name    gen-sdk-surface
// @desc    Generate SDK export directory from microapp-sdk.ts JSDoc tiers

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SDK_FILE = resolve(ROOT, "src/services/microapp-sdk.ts");
const OUTPUT = resolve(ROOT, ".pi/sdk-surface.md");

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

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Capture tier from JSDoc comment
  const tierMatch = line.match(/\/\*\*\s*(@public|@beta|@internal)(.*)?\*\//);
  if (tierMatch) {
    currentTier = tierMatch[1].replace("@", "");
    currentComment = (tierMatch[2] || "").replace(/\s*—\s*/, "").trim();
    continue;
  }

  if (!currentTier) continue;

  // export { name1, name2 } from "..."
  const namedExport = line.match(/^export\s+(type\s+)?\{([^}]+)\}/);
  if (namedExport) {
    const isType = !!namedExport[1];
    const names = namedExport[2].split(",").map((n) => n.trim()).filter(Boolean);
    exports.push({
      tier: currentTier,
      names,
      kind: isType ? "type" : "value",
      comment: currentComment || undefined,
    });
    currentTier = "";
    currentComment = "";
    continue;
  }

  // export function / export const / export class
  const directExport = line.match(/^export\s+(function|const|class)\s+(\w+)/);
  if (directExport) {
    exports.push({
      tier: currentTier,
      names: [directExport[2]],
      kind: "value",
      comment: currentComment || undefined,
    });
    currentTier = "";
    currentComment = "";
    continue;
  }

  // If we hit a non-blank, non-comment line without an export, reset
  if (line.trim() && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
    currentTier = "";
    currentComment = "";
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
  "# SDK Surface — microapp-sdk.ts",
  "",
  "> Auto-generated — do not edit. Regenerate: `bun scripts/gen-sdk-surface.ts`",
  "",
  `Generated: ${new Date().toISOString().split("T")[0]}`,
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
