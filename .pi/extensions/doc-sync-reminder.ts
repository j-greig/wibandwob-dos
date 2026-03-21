/**
 * doc-sync-reminder — Remind the agent to run gen scripts when watched files change.
 *
 * Reads @watches/@run/@output headers from scripts/gen-* at session start.
 * Watches edit/write/multi_edit tool calls during each agent turn.
 * At agent_end, if any modified path matches a @watches pattern, injects a
 * reminder message listing the stale generators and their run commands.
 *
 * Place: .pi/extensions/doc-sync-reminder.ts (project-local auto-discovery)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";

interface GenScript {
  file: string;
  watches: string[];   // glob-ish patterns from @watches
  output: string;      // @output value
  run: string;         // @run value
}

function parseGenScripts(repoRoot: string): GenScript[] {
  const scriptsDir = path.join(repoRoot, "scripts");
  if (!fs.existsSync(scriptsDir)) return [];

  const results: GenScript[] = [];
  for (const f of fs.readdirSync(scriptsDir)) {
    if (!f.startsWith("gen-")) continue;
    const fullPath = path.join(scriptsDir, f);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const watchesMatch = content.match(/@watches\s+(.+)/);
      const outputMatch  = content.match(/@output\s+(.+)/);
      const runMatch     = content.match(/@run\s+(.+)/);
      if (watchesMatch && outputMatch && runMatch) {
        results.push({
          file: f,
          watches: watchesMatch[1].trim().split(/\s+/),
          output:  outputMatch[1].trim(),
          run:     runMatch[1].trim(),
        });
      }
    } catch { /* skip unreadable */ }
  }
  return results;
}

/**
 * Simple glob match: supports * (within segment) and ** (any segments).
 * Good enough for the @watches patterns used in this repo.
 */
function globMatch(pattern: string, filePath: string): boolean {
  // Normalise both to forward slashes and strip leading ./
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/^\.\//, "");
  const p = norm(pattern);
  const f = norm(filePath);

  // Convert glob to regex
  const regex = new RegExp(
    "^" + p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape regex specials (not * ?)
      .replace(/\*\*/g, "\u0001")              // placeholder for **
      .replace(/\*/g, "[^/]*")                // * = anything within one segment
      .replace(/\u0001/g, ".*")               // ** = anything
    + "$"
  );
  return regex.test(f);
}

function pathMatchesAnyWatch(filePath: string, watches: string[], repoRoot: string): boolean {
  // Try both absolute → relative and raw match
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  return watches.some(w => globMatch(w, rel) || globMatch(w, filePath));
}

export default function (pi: ExtensionAPI) {
  let genScripts: GenScript[] = [];
  let modifiedPaths: Set<string> = new Set();
  let repoRoot = process.cwd();

  // Load gen scripts at session start
  pi.on("session_start", async (_event, ctx) => {
    repoRoot = ctx.cwd;
    genScripts = parseGenScripts(repoRoot);
  });

  // Reset modified paths at the start of each agent turn
  pi.on("agent_start", async () => {
    modifiedPaths = new Set();
  });

  // Track file writes/edits
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
      // multi_edit has: path (single), multi (array), patch (string)
      const input = event.input as Record<string, unknown>;
      if (typeof input.path === "string") modifiedPaths.add(input.path);
      if (Array.isArray(input.multi)) {
        for (const item of input.multi as Array<{ path?: string }>) {
          if (item.path) modifiedPaths.add(item.path);
        }
      }
      // patch format: paths appear on lines starting with "*** "
      if (typeof input.patch === "string") {
        for (const line of (input.patch as string).split("\n")) {
          const m = line.match(/^\*\*\* (Update File|Add File|Delete File): (.+)/);
          if (m) modifiedPaths.add(m[2].trim());
        }
      }
    }
  });

  // At agent_end, check for stale generators
  pi.on("agent_end", async (_event, ctx) => {
    if (modifiedPaths.size === 0 || genScripts.length === 0) return;

    const stale: GenScript[] = [];
    for (const gen of genScripts) {
      const triggered = [...modifiedPaths].some(p =>
        pathMatchesAnyWatch(p, gen.watches, repoRoot)
      );
      if (triggered) stale.push(gen);
    }

    if (stale.length === 0) return;

    const lines = [
      "📄 **Doc-sync reminder:** files changed this turn match generator @watches.",
      "",
      ...stale.map(g =>
        `• \`${g.run}\` → updates \`${g.output}\`  _(${g.file})_`
      ),
      "",
      "Run the commands above to keep generated docs in sync.",
    ];

    pi.sendMessage({
      customType: "doc-sync-reminder",
      content: lines.join("\n"),
      display: true,
    });
  });
}
