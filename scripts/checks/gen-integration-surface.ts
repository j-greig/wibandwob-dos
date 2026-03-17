#!/usr/bin/env bun
// @name    gen-integration-surface
// @desc    Auto-generate .agents/reference/integration-surface.md from command-catalog + control-api

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const API_FILE = resolve(ROOT, "src/services/control-api.ts");
const CATALOG_FILE = resolve(ROOT, "src/core/command-catalog.ts");
const OUTPUT = resolve(ROOT, ".agents/reference/integration-surface.md");

// Extract endpoint table from control-api.ts
const apiSrc = readFileSync(API_FILE, "utf-8");
const endpointRegex = /\{\s*method:\s*"(\w+)",\s*path:\s*"([^"]+)"[^}]*description:\s*"([^"]+)"/g;
const endpoints: { method: string; path: string; desc: string }[] = [];
let m: RegExpExecArray | null;
while ((m = endpointRegex.exec(apiSrc))) {
  endpoints.push({ method: m[1], path: m[2], desc: m[3] });
}

// Extract commands from command-catalog.ts
const catSrc = readFileSync(CATALOG_FILE, "utf-8");
const cmdRegex = /id:\s*"([^"]+)",\s*\n\s*label:\s*"([^"]+)",\s*\n\s*description:\s*"([^"]+)"/g;
const commands: { id: string; label: string; desc: string }[] = [];
while ((m = cmdRegex.exec(catSrc))) {
  commands.push({ id: m[1], label: m[2], desc: m[3] });
}

// Generate markdown
const lines: string[] = [
  "# WibWob-DOS Integration Surface",
  "",
  "> **Auto-generated** by `scripts/checks/gen-integration-surface.ts`.",
  "> Do not edit by hand. Regenerate: `bun run scripts/checks/gen-integration-surface.ts`",
  "",
  `Generated: ${new Date().toISOString().split("T")[0]}`,
  `Endpoints: ${endpoints.length} · Commands: ${commands.length}`,
  "",
  "---",
  "",
  "## API Endpoints",
  "",
  "Default: `http://127.0.0.1:8099`. **Prefer `wibwob` CLI over `curl`.**",
  "",
];

// Group endpoints by path prefix
const groups = new Map<string, typeof endpoints>();
for (const ep of endpoints) {
  const prefix = ep.path.split("/").slice(0, 2).join("/") || "/";
  if (!groups.has(prefix)) groups.set(prefix, []);
  groups.get(prefix)!.push(ep);
}

for (const [prefix, eps] of groups) {
  lines.push(`### ${prefix}`);
  lines.push("");
  for (const ep of eps) {
    lines.push(`- \`${ep.method} ${ep.path}\` — ${ep.desc}`);
  }
  lines.push("");
}

lines.push("---", "", "## Commands (command-catalog.ts)", "");
lines.push("Execute via `bun run wibwob cmd <id>` or `POST /commands/run {\"id\":\"<id>\"}`.", "");

// Group commands by first segment
const cmdGroups = new Map<string, typeof commands>();
for (const cmd of commands) {
  const group = cmd.id.split(".")[0];
  if (!cmdGroups.has(group)) cmdGroups.set(group, []);
  cmdGroups.get(group)!.push(cmd);
}

for (const [group, cmds] of cmdGroups) {
  lines.push(`### ${group}`);
  lines.push("");
  for (const cmd of cmds) {
    lines.push(`- \`${cmd.id}\` — ${cmd.desc}`);
  }
  lines.push("");
}

const output = lines.join("\n");
const existing = readFileSync(OUTPUT, "utf-8").trim();
const generated = output.trim();

if (existing === generated) {
  console.log("✅ integration-surface.md is up to date");
  process.exit(0);
}

writeFileSync(OUTPUT, output);
const oldLines = existing.split("\n").length;
const newLines = generated.split("\n").length;
console.log(`✏️  integration-surface.md regenerated (${oldLines}→${newLines} lines)`);
