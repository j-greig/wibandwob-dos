/**
 * file-manager/git.ts — Git status integration for the file manager.
 *
 * Refreshes git status via `git status --porcelain`, propagates status
 * up to parent directories, and provides indicator strings for blessed tags.
 */
import { execSync } from "node:child_process";
import path from "node:path";

export interface GitState {
  root: string | null;
  statusMap: Map<string, string>;
}

export function createGitState(): GitState {
  return { root: null, statusMap: new Map() };
}

/**
 * Refresh git status for a directory. Populates the status map with
 * per-file status chars and propagates dots up to parent dirs.
 */
export function refreshGitStatus(git: GitState, dirPath: string): void {
  git.statusMap.clear();
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      cwd: dirPath,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString().trim();
    git.root = root;

    const raw = execSync("git status --porcelain -uall", {
      cwd: dirPath,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();

    for (const line of raw.split("\n")) {
      if (line.length < 4) continue;
      const status = line.slice(0, 2).trim();
      const filePath = path.resolve(root, line.slice(3));
      const ch = status.includes("?") ? "?"
        : status.includes("M") ? "M"
        : status.includes("A") ? "A"
        : status.includes("D") ? "D"
        : status.includes("R") ? "R"
        : status;
      git.statusMap.set(filePath, ch);

      // Propagate up to parent dirs
      let parent = path.dirname(filePath);
      while (parent.length >= root.length && parent !== path.dirname(parent)) {
        if (!git.statusMap.has(parent)) git.statusMap.set(parent, "\u2022");
        parent = path.dirname(parent);
      }
    }
  } catch {
    git.root = null;
  }
}

/**
 * Return a blessed-tagged 2-char indicator for a file's git status.
 */
export function gitIndicator(git: GitState, fullPath: string): string {
  const status = git.statusMap.get(fullPath);
  if (!status) return "  ";
  switch (status) {
    case "M": return "{yellow-fg}M{/yellow-fg} ";
    case "A": return "{green-fg}A{/green-fg} ";
    case "?": return "{red-fg}?{/red-fg} ";
    case "D": return "{red-fg}D{/red-fg} ";
    case "R": return "{cyan-fg}R{/cyan-fg} ";
    case "\u2022": return "{yellow-fg}\u2022{/yellow-fg} ";
    default: return "{magenta-fg}~{/magenta-fg} ";
  }
}

/**
 * Build a status summary string for the status bar (e.g. "git:3M/2?").
 */
export function gitSummary(git: GitState): string {
  if (!git.root) return "";
  const modified = [...git.statusMap.values()].filter(s => s === "M").length;
  const untracked = [...git.statusMap.values()].filter(s => s === "?").length;
  const added = [...git.statusMap.values()].filter(s => s === "A").length;
  const parts: string[] = [];
  if (modified) parts.push(`${modified}M`);
  if (added) parts.push(`${added}A`);
  if (untracked) parts.push(`${untracked}?`);
  return parts.length ? ` git:${parts.join("/")}` : " git:clean";
}
