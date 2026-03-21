/**
 * doc-sync-reminder — Remind the agent to run gen scripts when watched files change.
 *
 * Reads @watches/@run/@output headers from scripts/gen-* at session start.
 * Also parses <progressive-disclosure> blocks from ARCHITECTURE.md as a
 * supplementary source of gen script config (canonical reference).
 * Watches edit/write/multi_edit/bash tool calls during each agent turn.
 * At agent_end, if any modified path matches a @watches pattern, injects a
 * reminder message listing the stale generators and their run commands.
 *
 * Improvements over v1:
 *  1. Tracks bash tool calls for file modifications (>, >>, tee, sed -i, cp, mv)
 *  2. mtime check: skips reminder if output is already fresher than modified sources
 *  3. Missing vs. stale urgency: ❌ MISSING vs ⚠️ possibly stale
 *  4. Session-level deduplication: only re-fires if output was regenerated since last reminder
 *  5. Parses <progressive-disclosure> from ARCHITECTURE.md as supplementary config
 *  6. Multi-line @watches support: multiple @watches lines per script
 *  7. Auto-run mode: set COAT_AUTOSYNC=1 to run gens instead of just reminding
 *
 * Place: .pi/extensions/doc-sync-reminder.ts (project-local auto-discovery)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface GenScript {
  file: string;
  watches: string[];   // glob-ish patterns from @watches (multi-line supported)
  output: string;      // @output value — relative path from repo root
  run: string;         // @run value
}

// ─── Config parsing ───────────────────────────────────────────────────────────

function parseGenScripts(repoRoot: string): GenScript[] {
  const scriptsDir = path.join(repoRoot, "scripts");
  if (!fs.existsSync(scriptsDir)) return [];

  const results: GenScript[] = [];
  for (const f of fs.readdirSync(scriptsDir)) {
    if (!f.startsWith("gen-")) continue;
    const fullPath = path.join(scriptsDir, f);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      // Improvement 6: collect all @watches lines (multi-line support)
      const watchesLines = [...content.matchAll(/@watches\s+(.+)/g)].map(m => m[1]!.trim());
      const outputMatch  = content.match(/@output\s+(.+)/);
      const runMatch     = content.match(/@run\s+(.+)/);
      if (watchesLines.length > 0 && outputMatch && runMatch) {
        results.push({
          file: f,
          watches: watchesLines.flatMap(line => line.split(/\s+/)),
          output:  outputMatch[1]!.trim(),
          run:     runMatch[1]!.trim(),
        });
      }
    } catch { /* skip unreadable */ }
  }
  return results;
}

/**
 * Improvement 5: parse <progressive-disclosure> blocks from ARCHITECTURE.md.
 * Extracts {output, run} pairs. For watches, parses the "regenerate if X changed"
 * hint from the <generator> tag. Supplements (does not replace) @watches from scripts.
 */
function parseProgressiveDisclosure(repoRoot: string): GenScript[] {
  const archPath = path.join(repoRoot, "ARCHITECTURE.md");
  if (!fs.existsSync(archPath)) return [];

  const content = fs.readFileSync(archPath, "utf8");
  const results: GenScript[] = [];

  const blockRe = /<progressive-disclosure>([\s\S]*?)<\/progressive-disclosure>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1]!;
    const outputLine    = block.match(/<output>([\s\S]*?)<\/output>/)?.[1]?.trim() ?? "";
    const generatorLine = block.match(/<generator>([\s\S]*?)<\/generator>/)?.[1]?.trim() ?? "";
    if (!outputLine || !generatorLine) continue;

    // Extract output path from first backtick-quoted token
    const outputFile = outputLine.match(/`([^`]+)`/)?.[1] ?? "";
    // Extract run command from first backtick-quoted token in generator line
    const runCmd = generatorLine.match(/`([^`]+)`/)?.[1] ?? "";
    if (!outputFile || !runCmd) continue;

    // Parse watch patterns from "regenerate if X or Y changed"
    const watchHint = generatorLine.match(/regenerate if (.+?) changed/i);
    const watches: string[] = [];
    if (watchHint) {
      const parts = watchHint[1]!.split(/\s*(?:,\s*|\s+or\s+|\s+and\s+)\s*/i);
      for (const part of parts) {
        const fname = part.replace(/`/g, "").trim();
        if (fname) watches.push(`**/${fname}`);
      }
    }

    results.push({
      file: "ARCHITECTURE.md (progressive-disclosure)",
      watches,
      output: outputFile,
      run:    runCmd,
    });
  }
  return results;
}

/**
 * Merge gen scripts from scripts/gen-* and progressive-disclosure blocks.
 * Scripts from gen-* files take precedence (their @watches are more precise).
 * PD entries only added if no gen script already covers the same output file.
 */
function loadGenScripts(repoRoot: string): GenScript[] {
  const fromScripts = parseGenScripts(repoRoot);
  const fromArch    = parseProgressiveDisclosure(repoRoot);
  const coveredOutputs = new Set(fromScripts.map(g => g.output));
  const extras = fromArch.filter(g => !coveredOutputs.has(g.output));
  return [...fromScripts, ...extras];
}

// ─── Glob matching ────────────────────────────────────────────────────────────

function globMatch(pattern: string, filePath: string): boolean {
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/^\.\//, "");
  const p = norm(pattern);
  const f = norm(filePath);
  const regex = new RegExp(
    "^" + p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0001")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0001/g, ".*")
    + "$"
  );
  return regex.test(f);
}

function pathMatchesAnyWatch(filePath: string, watches: string[], repoRoot: string): boolean {
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  return watches.some(w => globMatch(w, rel) || globMatch(w, filePath));
}

// ─── Improvement 1: bash file-modification extraction ────────────────────────

/**
 * Extract file paths that a bash command is likely to write/modify.
 * Handles: redirects (> >>), tee, sed -i, cp <src> <dst>, mv <src> <dst>.
 * Errs on the side of inclusion — false positives only cause extra mtime checks.
 */
function extractBashWritePaths(command: string): string[] {
  const paths: Set<string> = new Set();

  // stdout redirect: > path or >> path (not inside strings, best-effort)
  for (const m of command.matchAll(/(?:^|[;&|])\s*[^>]*>{1,2}\s*([^\s;|&>]+)/g)) {
    const p = m[1]!.trim();
    if (p && !p.startsWith("-") && p !== "/dev/null") paths.add(p);
  }
  // tee [flags] path...
  for (const m of command.matchAll(/\btee\b\s+(?:-[a-z]\s+)*([^\s;|&]+)/g)) {
    paths.add(m[1]!.trim());
  }
  // sed -i [backup] 's/.../' path
  for (const m of command.matchAll(/\bsed\b[^;|&]*-i\b[^;|&]*\s('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")[^;|&]*\s([^\s;|&]+)/g)) {
    const p = m[2]!.trim();
    if (p && !p.startsWith("-")) paths.add(p);
  }
  // cp src dst  (dst is the write target)
  for (const m of command.matchAll(/\bcp\b(?:\s+-[a-zA-Z]+)*\s+\S+\s+([^\s;|&]+)/g)) {
    paths.add(m[1]!.trim());
  }
  // mv src dst  (dst is the write target)
  for (const m of command.matchAll(/\bmv\b(?:\s+-[a-zA-Z]+)*\s+\S+\s+([^\s;|&]+)/g)) {
    paths.add(m[1]!.trim());
  }

  return [...paths];
}

// ─── Improvement 2 + 3: staleness check ──────────────────────────────────────

type Staleness = "missing" | "stale" | "fresh";

function checkStaleness(outputRel: string, triggeredSources: string[], repoRoot: string): Staleness {
  const outputAbs = path.resolve(repoRoot, outputRel);
  if (!fs.existsSync(outputAbs)) return "missing";
  const outputMtime = fs.statSync(outputAbs).mtimeMs;
  const allFresh = triggeredSources.every(src => {
    try { return outputMtime > fs.statSync(src).mtimeMs; }
    catch { return false; }
  });
  return allFresh ? "fresh" : "stale";
}

// ─── Improvement 7: auto-run ─────────────────────────────────────────────────

function tryAutoRun(gen: GenScript, repoRoot: string): boolean {
  try {
    execSync(gen.run, { cwd: repoRoot, stdio: "pipe", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let genScripts: GenScript[]      = [];
  let modifiedPaths: Set<string>   = new Set();
  let repoRoot                     = process.cwd();
  const autoSync                   = process.env.COAT_AUTOSYNC === "1";

  // Improvement 4: track last reminder timestamp per gen script
  // Key: gen.file → timestamp of last reminder. Cleared when output is refreshed.
  const lastRemindedAt = new Map<string, number>();

  pi.on("session_start", async (_event, ctx) => {
    repoRoot   = ctx.cwd;
    genScripts = loadGenScripts(repoRoot);
    lastRemindedAt.clear();
  });

  pi.on("agent_start", async () => {
    modifiedPaths = new Set();
  });

  pi.on("tool_call", async (event) => {
    if (isToolCallEventType("write", event)) {
      const p = event.input.path as string | undefined;
      if (p) modifiedPaths.add(p);
    }
    if (isToolCallEventType("edit", event)) {
      const p = event.input.path as string | undefined;
      if (p) modifiedPaths.add(p);
    }
    if (isToolCallEventType("multi_edit", event)) {
      const input = event.input as Record<string, unknown>;
      if (typeof input.path === "string") modifiedPaths.add(input.path);
      if (Array.isArray(input.multi)) {
        for (const item of input.multi as Array<{ path?: string }>) {
          if (item.path) modifiedPaths.add(item.path);
        }
      }
      if (typeof input.patch === "string") {
        for (const line of (input.patch as string).split("\n")) {
          const m = line.match(/^\*\*\* (?:Update File|Add File|Delete File): (.+)/);
          if (m) modifiedPaths.add(m[1]!.trim());
        }
      }
    }
    // Improvement 1: track bash-mediated file writes
    if (isToolCallEventType("bash", event)) {
      const cmd = event.input.command as string | undefined;
      if (cmd) {
        for (const p of extractBashWritePaths(cmd)) {
          // Resolve relative paths against cwd; keep absolute as-is
          modifiedPaths.add(path.isAbsolute(p) ? p : path.resolve(repoRoot, p));
        }
      }
    }
  });

  pi.on("agent_end", async () => {
    if (modifiedPaths.size === 0 || genScripts.length === 0) return;

    const now = Date.now();
    type StaleEntry = { gen: GenScript; staleness: Staleness };
    const toReport: StaleEntry[] = [];
    const autoRan:  GenScript[]  = [];

    for (const gen of genScripts) {
      const triggered = [...modifiedPaths].filter(p =>
        pathMatchesAnyWatch(p, gen.watches, repoRoot)
      );
      if (triggered.length === 0) continue;

      // Improvement 2 + 3: check actual staleness
      const staleness = checkStaleness(gen.output, triggered, repoRoot);
      if (staleness === "fresh") continue;

      // Improvement 4: session deduplication
      // Suppress if we already reminded this session AND the output hasn't been
      // regenerated since the last reminder (i.e. nothing improved since we last nagged)
      const lastReminded = lastRemindedAt.get(gen.file) ?? 0;
      if (lastReminded > 0) {
        const outputAbs = path.resolve(repoRoot, gen.output);
        const outputMtime = fs.existsSync(outputAbs) ? fs.statSync(outputAbs).mtimeMs : 0;
        if (outputMtime < lastReminded) continue; // still stale, already reminded → skip
        // If outputMtime >= lastReminded, the gen was run since last reminder → allow re-trigger
      }

      // Improvement 7: auto-run if COAT_AUTOSYNC=1
      if (autoSync) {
        const ok = tryAutoRun(gen, repoRoot);
        if (ok) { autoRan.push(gen); continue; }
        // If auto-run failed, fall through to reminder
      }

      toReport.push({ gen, staleness });
      lastRemindedAt.set(gen.file, now);
    }

    if (toReport.length === 0 && autoRan.length === 0) return;

    const lines: string[] = [];

    if (autoRan.length > 0) {
      lines.push("✅ **Doc-sync (auto):** regenerated stale outputs automatically.", "");
      for (const gen of autoRan) {
        lines.push(`• \`${gen.run}\` → \`${gen.output}\`  _(${gen.file})_`);
      }
    }

    if (toReport.length > 0) {
      lines.push("📄 **Doc-sync reminder:** files changed this turn match generator @watches.", "");
      for (const { gen, staleness } of toReport) {
        // Improvement 3: differentiate missing vs. stale
        const badge = staleness === "missing" ? "❌ MISSING — run now" : "⚠️  possibly stale";
        lines.push(`• ${badge}  \`${gen.run}\` → \`${gen.output}\`  _(${gen.file})_`);
      }
      lines.push("", "Run the commands above to keep generated docs in sync.");
    }

    pi.sendMessage({
      customType: "doc-sync-reminder",
      content: lines.join("\n"),
      display: true,
    });
  });
}
