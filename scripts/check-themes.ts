// @name    check-themes
// @desc    Validate all theme files have required tokens
/**
 * check-themes.ts
 * Validates all theme variants (built-in + module) against the full ThemeTokens contract.
 * Reports missing or incomplete tokens. Exit code 1 if any issues found.
 *
 * Usage: bun run scripts/check-themes.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Required token keys (derived from ThemeTokens, excluding optional fields) ──

/** StylePair sub-fields */
const STYLE_PAIR_FIELDS = ["fg", "bg"] as const;

/** Top-level token keys → expected shape */
const REQUIRED_TOKENS: Record<string, "StylePair" | "string" | "scrollbar" | "shadow"> = {
  desktop:               "StylePair",
  desktopFillChar:       "string",
  menuBar:               "StylePair",
  statusLine:            "StylePair",
  windowFrame:           "StylePair",
  windowBorderFocused:   "StylePair",
  windowBorderUnfocused: "StylePair",
  titleBarFocused:       "StylePair",
  titleBarUnfocused:     "StylePair",
  closeButton:           "StylePair",
  resizeGrip:            "StylePair",
  windowShadow:          "shadow",
  body:                  "StylePair",
  bodyAlt:               "StylePair",
  agentBg:               "StylePair",
  header:                "StylePair",
  footer:                "StylePair",
  selected:              "StylePair",
  input:                 "StylePair",
  scrollbar:             "scrollbar",
  accent:                "StylePair",
  highlight:             "StylePair",
  warning:               "StylePair",
  error:                 "StylePair",
  success:               "StylePair",
  muted:                 "StylePair",
};

interface Issue {
  token: string;
  problem: string;
}

function checkTokens(tokens: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  for (const [key, shape] of Object.entries(REQUIRED_TOKENS)) {
    const val = tokens[key];
    if (val === undefined || val === null) {
      issues.push({ token: key, problem: "missing" });
      continue;
    }
    if (shape === "string") {
      if (typeof val !== "string") issues.push({ token: key, problem: `expected string, got ${typeof val}` });
      continue;
    }
    if (typeof val !== "object") {
      issues.push({ token: key, problem: `expected object, got ${typeof val}` });
      continue;
    }
    const obj = val as Record<string, unknown>;
    if (shape === "StylePair") {
      for (const field of STYLE_PAIR_FIELDS) {
        if (typeof obj[field] !== "string") {
          issues.push({ token: key, problem: `missing or non-string .${field}` });
        }
      }
    } else if (shape === "scrollbar") {
      for (const field of ["fg", "bg", "track"] as const) {
        if (typeof obj[field] !== "string") {
          issues.push({ token: key, problem: `missing or non-string .${field}` });
        }
      }
    } else if (shape === "shadow") {
      for (const field of ["fg", "bg", "char"] as const) {
        if (typeof obj[field] !== "string") {
          issues.push({ token: key, problem: `missing or non-string .${field}` });
        }
      }
    }
  }
  return issues;
}

interface ThemeResult {
  name: string;
  source: string;
  issues: Issue[];
}

async function loadBuiltInThemes(): Promise<ThemeResult[]> {
  const results: ThemeResult[] = [];
  const builtInFiles = ["dark.ts", "dark-nord.ts", "dark-pastel.ts", "light.ts"];
  for (const file of builtInFiles) {
    const absPath = path.join(REPO_ROOT, "src", "core", "theme", file);
    try {
      const mod = await import(absPath);
      const variant = mod.dark ?? mod.darkNord ?? mod.darkPastel ?? mod.light ?? mod.default;
      if (!variant?.name || !variant?.tokens) {
        results.push({ name: file, source: `src/core/theme/${file}`, issues: [{ token: "(root)", problem: "no ThemeVariant export found" }] });
        continue;
      }
      results.push({ name: variant.name, source: `src/core/theme/${file}`, issues: checkTokens(variant.tokens) });
    } catch (err) {
      results.push({ name: file, source: `src/core/theme/${file}`, issues: [{ token: "(import)", problem: String(err) }] });
    }
  }
  return results;
}

async function loadModuleThemes(): Promise<ThemeResult[]> {
  const results: ThemeResult[] = [];
  for (const root of ["modules", "modules-private"] as const) {
    const rootPath = path.join(REPO_ROOT, root);
    if (!fs.existsSync(rootPath)) continue;
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const moduleDir = path.join(rootPath, entry.name);
      const manifestPath = path.join(moduleDir, "microapp.json");
      if (!fs.existsSync(manifestPath)) continue;
      let manifest: Record<string, unknown>;
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { continue; }
      if (manifest.type !== "theme") continue;
      const entryFile = (manifest.entry as string | undefined) ?? "theme.ts";
      const themePath = path.join(moduleDir, entryFile);
      const relPath = `${root}/${entry.name}/${entryFile}`;
      if (!fs.existsSync(themePath)) {
        results.push({ name: entry.name, source: relPath, issues: [{ token: "(file)", problem: `entry file not found: ${entryFile}` }] });
        continue;
      }
      try {
        const mod = await import(themePath);
        // Grab first ThemeVariant-shaped export
        const variant = Object.values(mod).find(
          (v): v is { name: string; tokens: Record<string, unknown> } =>
            typeof v === "object" && v !== null && "name" in v && "tokens" in v
        );
        if (!variant) {
          results.push({ name: entry.name, source: relPath, issues: [{ token: "(root)", problem: "no ThemeVariant export found" }] });
          continue;
        }
        results.push({ name: variant.name, source: relPath, issues: checkTokens(variant.tokens as Record<string, unknown>) });
      } catch (err) {
        results.push({ name: entry.name, source: relPath, issues: [{ token: "(import)", problem: String(err) }] });
      }
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const builtIn = await loadBuiltInThemes();
const moduleThemes = await loadModuleThemes();
const all = [...builtIn, ...moduleThemes];

let totalIssues = 0;
const COL_NAME   = 26;
const COL_SOURCE = 48;

console.log("\nWibWob-DOS — Theme Completeness Check");
console.log("═".repeat(72));

for (const result of all) {
  const tag = result.issues.length === 0 ? "✓" : "✗";
  const name = result.name.padEnd(COL_NAME);
  const src  = result.source.padEnd(COL_SOURCE);
  if (result.issues.length === 0) {
    console.log(`  ${tag}  ${name}  ${src}  OK`);
  } else {
    console.log(`  ${tag}  ${name}  ${src}  ${result.issues.length} issue(s)`);
    for (const issue of result.issues) {
      console.log(`       └─ ${issue.token}: ${issue.problem}`);
    }
    totalIssues += result.issues.length;
  }
}

console.log("═".repeat(72));
if (totalIssues === 0) {
  console.log("  All themes complete.\n");
} else {
  console.log(`  ${totalIssues} issue(s) found across ${all.filter(r => r.issues.length > 0).length} theme(s).\n`);
  process.exit(1);
}
