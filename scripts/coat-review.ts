#!/usr/bin/env bun
// scripts/coat-review.ts — Agent review step for coat-compliance.sh
//
// Reads collected command execution results, asks Claude to judge each one,
// then compares verdicts to the baseline and exits 0/1.
//
// Usage (called by coat-compliance.sh):
//   bun scripts/coat-review.ts --results /tmp/coat-results.json \
//     --baseline coat-compliance.baseline.json --g1 true [--update-baseline]

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const has = (flag: string) => args.includes(flag);

const resultsPath  = get("--results")  ?? "";
const baselinePath = get("--baseline") ?? "coat-compliance.baseline.json";
const g1Pass       = get("--g1") === "true";
const updateBase   = has("--update-baseline");

if (!resultsPath || !existsSync(resultsPath)) {
  console.error("❌ --results file not found");
  process.exit(2);
}

type Result = { id: string; description: string; http_ok: boolean; before: object; after: object };
const results: Result[] = JSON.parse(readFileSync(resultsPath, "utf8"));

// ── Agent review ──────────────────────────────────────────────────────────────

const client = new Anthropic();

const prompt = `You are reviewing COAT compliance for WibWob-DOS — a terminal desktop where every command must be reachable and observable via the HTTP API.

For each command below, you are given:
- id: the command identifier
- description: what the catalog says it does
- http_ok: whether POST /commands/run succeeded
- before / after: structural desktop state snapshot (window count, IDs, kinds, focus)

Return a JSON array with one object per command:
{ "id": "...", "verdict": "PASS|FAIL|SKIP", "reason": "one line" }

Verdict rules:
- PASS  — clear observable change (window opened/closed, focus changed, window count changed)
- FAIL  — no meaningful change, not a skip case
- SKIP  — command requires arguments (description says "Args: <required-field>"), or is clearly destructive/navigational without a testable default
- Note: http_ok=false with no state change is still FAIL unless it's a SKIP case

Commands to review:
${JSON.stringify(results, null, 2)}

Return ONLY the JSON array. No explanation outside the array.`;

console.log("Asking Claude to review command executions...");

const response = await client.messages.create({
  model:      "claude-haiku-4-5",
  max_tokens: 8192,
  messages:   [{ role: "user", content: prompt }],
});

const raw = response.content[0].type === "text" ? response.content[0].text : "";

// Extract JSON array from response
const match = raw.match(/\[[\s\S]*\]/);
if (!match) {
  console.error("❌ Agent returned unexpected format:", raw.slice(0, 200));
  process.exit(2);
}

type Verdict = { id: string; verdict: "PASS" | "FAIL" | "SKIP"; reason: string };
const verdicts: Verdict[] = JSON.parse(match[0]);

// ── Print results ─────────────────────────────────────────────────────────────

console.log(`\nCapability Gap`);
console.log(`  ${g1Pass ? "✅" : "❌"} GET /errors/recent${g1Pass ? "" : " → 404"}`);

console.log(`\nCommand Round-Trips`);
let pass = 0, fail = 0, skip = 0;
const failed: string[] = [];

for (const v of verdicts) {
  if (v.verdict === "PASS") { console.log(`  ✅  ${v.id}`); pass++; }
  else if (v.verdict === "SKIP") { console.log(`  ⏭   ${v.id}  — ${v.reason}`); skip++; }
  else { console.log(`  ❌  ${v.id}  — ${v.reason}`); fail++; failed.push(`rt:${v.id}`); }
}
console.log(`  Score: ${pass}/${pass + fail}  (${skip} skipped)`);

// ── Baseline ──────────────────────────────────────────────────────────────────

const allFailed: string[] = [...failed];
if (!g1Pass) allFailed.push("gap:G1");

const checkedAt = new Date().toUTCString();

if (!existsSync(baselinePath) || updateBase) {
  writeFileSync(baselinePath, JSON.stringify({
    generatedAt:  checkedAt,
    note:         "Known failures — only new failures gate the build",
    knownFailures: allFailed,
  }, null, 2));
  const verb = updateBase ? "updated" : "written (first run)";
  console.log(`\nBaseline ${verb} → ${baselinePath}`);
  console.log("EXIT: 0");
  process.exit(0);
}

const known = new Set<string>(
  JSON.parse(readFileSync(baselinePath, "utf8")).knownFailures ?? []
);

const regressions  = allFailed.filter(f => !known.has(f));
const debt         = allFailed.filter(f =>  known.has(f));
const improvements = [...known].filter(k => !allFailed.includes(k));

// ── Summary ───────────────────────────────────────────────────────────────────

const total    = pass + fail + (g1Pass ? 1 : 0);
const possible = pass + fail + 1;
const pct      = Math.round(total / possible * 100);

console.log(`\n──────────────────────────────────────────────────────`);
console.log(`OVERALL: ${total}/${possible}  (${pct}%)`);

if (improvements.length) {
  console.log(`\n🎉 Improvements (remove from baseline):`);
  improvements.forEach(i => console.log(`   ${i}`));
}
if (debt.length) {
  console.log(`\n⚠️  Existing debt (not gating):`);
  debt.forEach(d => console.log(`   ${d}`));
}
if (regressions.length) {
  console.log(`\n🔴 REGRESSIONS (gates build):`);
  regressions.forEach(r => console.log(`   ${r}`));
  console.log(`\nEXIT: 1  — run --update-baseline to accept as new debt`);
  process.exit(1);
}

console.log(`\nEXIT: 0  ✅`);
