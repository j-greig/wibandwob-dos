/**
 * ui/file-icons.ts — Pure functions for file icons, colours, and size formatting.
 *
 * Shared across file-manager, slap-editor, and any file-listing UI.
 * No blessed or state dependencies.
 */
import path from "node:path";

// ── Icons ────────────────────────────────────────────────────────────────────

export function fileIcon(entry: { isDirectory: boolean; label: string }): string {
  if (entry.isDirectory) {
    const name = entry.label.replace(/\/$/, "");
    if (name === "..") return "\u25C4";
    if (name.startsWith(".")) return "\u25AB";
    if (["src", "lib", "app"].includes(name)) return "\u25A3";
    if (["node_modules", "dist", "build", ".git"].includes(name)) return "\u25A1";
    return "\u25A0";
  }
  const ext = path.extname(entry.label).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "ts", ".tsx": "ts", ".js": "js", ".jsx": "js",
    ".py": "py", ".c": "<>", ".cpp": "<>", ".h": "<>", ".rs": "<>", ".go": "<>",
    ".md": "md", ".txt": "\u2261", ".doc": "\u2261", ".rtf": "\u2261",
    ".json": "{}", ".yaml": "::", ".yml": "::", ".toml": "::",
    ".xml": "</", ".html": "</", ".htm": "</",
    ".png": "\u263C", ".jpg": "\u263C", ".gif": "\u263C", ".svg": "\u263C", ".webp": "\u263C", ".bmp": "\u263C",
    ".sh": "$>", ".bash": "$>", ".zsh": "$>", ".fish": "$>",
    ".css": "##", ".scss": "##", ".less": "##",
    ".lock": "\u25CB",
  };
  return map[ext] ?? " \u2022";
}

// ── Colours ──────────────────────────────────────────────────────────────────

export function fileColour(entry: { isDirectory: boolean; label: string }): string {
  if (entry.isDirectory) {
    if (entry.label === "../") return "white";
    if (entry.label.startsWith(".")) return "gray";
    return "cyan";
  }
  const ext = path.extname(entry.label).toLowerCase();
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) return "yellow";
  if ([".py"].includes(ext)) return "green";
  if ([".md"].includes(ext)) return "light-green";
  if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) return "magenta";
  if ([".sh", ".bash", ".zsh"].includes(ext)) return "cyan";
  if ([".c", ".cpp", ".h", ".rs", ".go"].includes(ext)) return "blue";
  if ([".png", ".jpg", ".gif", ".svg", ".webp", ".bmp"].includes(ext)) return "light-magenta";
  return "white";
}

// ── Size formatting ──────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}M`;
  return `${(bytes / 1073741824).toFixed(1)}G`;
}

// ── Escaped label (blessed tags need { escaped) ──────────────────────────────

export function escapeBlessedTags(s: string): string {
  return s.replace(/\{/g, "\\{");
}
