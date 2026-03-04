import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function truncatePreview(text: string, max = 50): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
}

export function formatRelativeSessionTime(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

  if (dayDiff === 0) {
    return `today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  if (dayDiff === 1) {
    return "yesterday";
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Find the most recent Claude Code JSONL for the current project cwd. */
export function findClaudeCodeJsonl(cwd: string): string | null {
  try {
    const safePath = cwd.replace(/\//g, "-");
    const projectDir = path.join(os.homedir(), ".claude", "projects", safePath);
    if (!fs.existsSync(projectDir)) return null;
    const files = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!files.length) return null;
    return path.join(projectDir, files[0].f);
  } catch {
    return null;
  }
}
