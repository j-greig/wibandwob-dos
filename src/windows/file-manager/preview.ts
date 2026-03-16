/**
 * file-manager/preview.ts — Preview content rendering for the file manager.
 *
 * Pure functions that produce blessed-tagged strings for different file types.
 * No blessed widget dependencies — returns content + header strings.
 */
import fs from "node:fs";
import path from "node:path";
import { safeReadFile } from "../../core/safe-fs.js";
import { renderMarkdownFile, PLAIN_HEADING_CONFIG } from "../../services/markdown-service.js";
import { highlightCode, HIGHLIGHTED_LANGUAGES } from "../../services/syntax-highlight.js";
import { formatSize, escapeBlessedTags } from "./icons.js";
import type { FileEntry } from "./types.js";

export interface PreviewResult {
  header: string;
  content: string;
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function renderEmptyPreview(): PreviewResult {
  return {
    header: "",
    content: [
      "",
      "       {bold}\u2302 WibWob File Manager{/bold}",
      "",
      "       Select a file to preview",
      "       or press {bold}S{/bold} to search",
      "",
      "       {gray-fg}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{/gray-fg}",
      "",
      "       {gray-fg}Keys:{/gray-fg}",
      "       {bold}\u21B5{/bold}  Open in editor",
      "       {bold}V{/bold}  View file",
      "       {bold}e{/bold}  Edit inline",
      "       {bold}E{/bold}  External editor",
      "       {bold}Y{/bold}  Yank contents",
      "       {bold}C{/bold}  Copy path",
      "       {bold}SPC{/bold} Quick Look",
      "       {bold}/{/bold}  Filter files",
      "       {bold}S{/bold}  Search contents",
      "",
      "       {gray-fg}Right-click for menu{/gray-fg}",
    ].join("\n"),
  };
}

// ── Directory preview ────────────────────────────────────────────────────────

export function renderDirectoryPreview(dirPath: string, previewHeight: number): PreviewResult {
  try {
    const children = fs.readdirSync(dirPath, { withFileTypes: true });
    const childDirs = children.filter(c => c.isDirectory());
    const childFiles = children.filter(c => !c.isDirectory());

    const header = `{bold}\u2302 ${path.basename(dirPath)}/{/bold}  {cyan-fg}${childDirs.length} dirs{/cyan-fg}, {green-fg}${childFiles.length} files{/green-fg}`;

    const maxDirs = Math.min(childDirs.length, Math.max(8, Math.floor(previewHeight * 0.4)));
    const maxFiles = Math.min(childFiles.length, Math.max(8, Math.floor(previewHeight * 0.4)));

    const dirItems = childDirs.slice(0, maxDirs).map(c => {
      let childCount = "";
      try {
        const n = fs.readdirSync(path.join(dirPath, c.name)).length;
        childCount = ` {gray-fg}(${n}){/gray-fg}`;
      } catch {}
      return `  {cyan-fg}\u25A0{/cyan-fg} ${c.name}/${childCount}`;
    });

    const fileItems = childFiles.slice(0, maxFiles).map(c => {
      const ext = path.extname(c.name).toLowerCase();
      const col = [".md", ".txt"].includes(ext) ? "green"
        : [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? "yellow"
        : [".json", ".yaml", ".yml"].includes(ext) ? "magenta"
        : [".sh", ".bash"].includes(ext) ? "cyan"
        : "white";
      let sizeStr = "";
      try { sizeStr = formatSize(fs.statSync(path.join(dirPath, c.name)).size); } catch {}
      const padded = sizeStr ? ` {gray-fg}${sizeStr}{/gray-fg}` : "";
      return `  {${col}-fg}\u2022{/${col}-fg} ${c.name}${padded}`;
    });

    const truncDirs = childDirs.length > maxDirs ? `  {cyan-fg}... +${childDirs.length - maxDirs} more dirs{/cyan-fg}` : "";
    const truncFiles = childFiles.length > maxFiles ? `  {green-fg}... +${childFiles.length - maxFiles} more files{/green-fg}` : "";

    // Extension distribution
    const extCounts: Record<string, number> = {};
    for (const f of childFiles) {
      const ext = path.extname(f.name).toLowerCase() || "(none)";
      extCounts[ext] = (extCounts[ext] ?? 0) + 1;
    }
    const extBar = Object.entries(extCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([ext, count]) => {
        const col = [".md", ".txt"].includes(ext) ? "green"
          : [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? "yellow"
          : [".json", ".yaml", ".yml"].includes(ext) ? "magenta"
          : [".sh", ".bash"].includes(ext) ? "cyan"
          : "white";
        return `{${col}-fg}${ext}:${count}{/${col}-fg}`;
      }).join("  ");

    const sections: string[] = [""];
    if (dirItems.length) sections.push(dirItems.join("\n"));
    if (truncDirs) sections.push(truncDirs);
    if (fileItems.length) sections.push("\n" + fileItems.join("\n"));
    if (truncFiles) sections.push(truncFiles);
    if (extBar) sections.push("\n  " + extBar);

    // Largest + most recent
    if (childFiles.length > 0) {
      const withStats = childFiles.map(c => {
        try {
          const s = fs.statSync(path.join(dirPath, c.name));
          return { name: c.name, size: s.size, mtime: s.mtimeMs };
        } catch { return { name: c.name, size: 0, mtime: 0 }; }
      });
      const largest = [...withStats].sort((a, b) => b.size - a.size).slice(0, 3);
      const recent = [...withStats].sort((a, b) => b.mtime - a.mtime).slice(0, 3);

      const fmtDate = (ms: number) => {
        const diff = Date.now() - ms;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      };

      sections.push(`\n  {bold}Largest:{/bold} ${largest.map(f => `${f.name} {gray-fg}${formatSize(f.size)}{/gray-fg}`).join(", ")}`);
      sections.push(`  {bold}Recent:{/bold}  ${recent.map(f => `${f.name} {gray-fg}${fmtDate(f.mtime)}{/gray-fg}`).join(", ")}`);
    }

    return { header, content: sections.join("\n") };
  } catch (error) {
    return {
      header: `{bold}${path.basename(dirPath)}/{/bold}`,
      content: `\u2302 ${dirPath}\n\n  Cannot read directory.\n  ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── File preview ─────────────────────────────────────────────────────────────

export function renderFilePreview(entry: FileEntry, previewWidth: number): PreviewResult {
  const ext = path.extname(entry.label).toLowerCase();

  // Markdown
  if (ext === ".md") {
    return renderMarkdownPreview(entry, previewWidth);
  }

  // JSON
  if (ext === ".json") {
    return renderJsonPreview(entry);
  }

  // Default: line-numbered text with optional syntax highlighting
  return renderCodePreview(entry, ext);
}

function renderMarkdownPreview(entry: FileEntry, width: number): PreviewResult {
  try {
    const stat = fs.statSync(entry.fullPath);
    const header = `{bold}${path.basename(entry.fullPath)}{/bold}  ${formatSize(stat.size)}  MD`;
    const w = Math.max(1, width - 4);
    const lines = renderMarkdownFile(entry.fullPath, w, { headingConfig: PLAIN_HEADING_CONFIG });
    return { header, content: lines.join("\n") };
  } catch (error) {
    return {
      header: `{bold}${path.basename(entry.fullPath)}{/bold}`,
      content: `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function renderJsonPreview(entry: FileEntry): PreviewResult {
  const esc = escapeBlessedTags;
  try {
    const raw = (safeReadFile(entry.fullPath) ?? "").slice(0, 8000);
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    const stat = fs.statSync(entry.fullPath);
    const header = `{bold}${path.basename(entry.fullPath)}{/bold}  ${formatSize(stat.size)}  JSON`;
    const content = pretty.split("\n")
      .map((ln: string, i: number) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${esc(ln)}`)
      .join("\n");
    return { header, content };
  } catch {
    const raw = (safeReadFile(entry.fullPath) ?? "").slice(0, 8000);
    const content = raw.split("\n")
      .map((ln: string, i: number) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${esc(ln)}`)
      .join("\n");
    return { header: `{bold}${path.basename(entry.fullPath)}{/bold}`, content };
  }
}

function renderCodePreview(entry: FileEntry, ext: string): PreviewResult {
  try {
    const content = safeReadFile(entry.fullPath) ?? "";
    const rawLines = content.slice(0, 8000).split("\n");
    const stat = fs.statSync(entry.fullPath);
    const sizeStr = formatSize(stat.size);
    const dateStr = new Date(stat.mtimeMs).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const langLabel = ext.replace(".", "").toUpperCase();
    const header = `{bold}${path.basename(entry.fullPath)}{/bold}  ${sizeStr}  ${dateStr}  ${langLabel}`;

    const lang = ext.replace(".", "");
    const useHighlight = HIGHLIGHTED_LANGUAGES.has(lang);

    let numbered: string;
    if (useHighlight) {
      const highlighted = highlightCode(rawLines.join("\n"), lang);
      numbered = highlighted.map((ln, i) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${ln}`).join("\n");
    } else {
      numbered = rawLines.map((ln, i) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${escapeBlessedTags(ln)}`).join("\n");
    }
    return { header, content: numbered };
  } catch (error) {
    return {
      header: "",
      content: `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── Search result preview ────────────────────────────────────────────────────

export function renderSearchResultPreview(
  result: { file: string; line: number; text: string },
): PreviewResult {
  const filePath = result.file;
  const header = `{bold}${path.basename(filePath)}{/bold}:{result.line}`;

  try {
    const content = safeReadFile(filePath) ?? "";
    const allLines = content.split("\n");
    const lineIdx = result.line - 1;
    const contextBefore = 5;
    const contextAfter = 20;
    const startLine = Math.max(0, lineIdx - contextBefore);
    const endLine = Math.min(allLines.length, lineIdx + contextAfter);
    const contextLines = allLines.slice(startLine, endLine);

    const numbered = contextLines.map((ln, i) => {
      const lineNum = startLine + i + 1;
      const marker = lineNum === result.line ? " \u25B6" : "  ";
      return `{gray-fg}${String(lineNum).padStart(4, " ")}${marker}|{/gray-fg} ${escapeBlessedTags(ln)}`;
    }).join("\n");

    return { header, content: numbered };
  } catch {
    return { header, content: `Cannot read file: ${filePath}` };
  }
}
