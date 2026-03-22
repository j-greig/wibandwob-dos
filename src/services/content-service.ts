import fs from "node:fs";
import { safeReadFile } from "../core/safe-fs.js";
import os from "node:os";
import path from "node:path";

import { PRIMER_ROOTS, REPO_ROOT } from "../core/config.js";
import type { BrowserEntry, GalleryTab, PrimerGroup } from "../core/types.js";
import { measurePrimerContent } from "./content-measurement.js";

export class ContentService {
  collectPrimerEntries(): BrowserEntry[] {
    const entries: BrowserEntry[] = [];
    for (const root of PRIMER_ROOTS) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      this.walkPrimerEntries(rootPath, root, entries, 0);
    }
    return entries.sort((left, right) => left.label.localeCompare(right.label));
  }

  collectPrimerGroups(): PrimerGroup[] {
    const groups: PrimerGroup[] = [];
    for (const root of PRIMER_ROOTS) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      const modules = fs
        .readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith(".") && this.isDirectoryEntry(rootPath, entry));
      for (const moduleEntry of modules) {
        const primersPath = path.join(rootPath, moduleEntry.name, "primers");
        if (!fs.existsSync(primersPath)) {
          continue;
        }
        const entries = fs
          .readdirSync(primersPath, { withFileTypes: true })
          .filter((entry) => this.isTextFileEntry(primersPath, entry))
          .map((entry) => this.createBrowserEntry(entry.name, path.join(primersPath, entry.name)))
          .sort((left, right) => left.label.localeCompare(right.label));
        if (entries.length > 0) {
          groups.push({
            label: root.includes("private") ? `private:${moduleEntry.name}` : moduleEntry.name,
            entries
          });
        }
      }
    }
    return groups.sort((left, right) => left.label.localeCompare(right.label));
  }

  collectGalleryEntries(): BrowserEntry[] {
    const entries: BrowserEntry[] = [];
    for (const root of PRIMER_ROOTS) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      const modules = fs
        .readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith(".") && this.isDirectoryEntry(rootPath, entry));
      for (const moduleEntry of modules) {
        const primersPath = path.join(rootPath, moduleEntry.name, "primers");
        if (!fs.existsSync(primersPath)) {
          continue;
        }
        const moduleEntries = fs
          .readdirSync(primersPath, { withFileTypes: true })
          .filter((entry) => this.isTextFileEntry(primersPath, entry))
          .map((entry) => this.createBrowserEntry(entry.name, path.join(primersPath, entry.name)));
        entries.push(...moduleEntries);
      }
    }
    return entries.sort((left, right) => left.label.localeCompare(right.label));
  }

  buildGalleryTabs(entries: BrowserEntry[]): GalleryTab[] {
    const ranges = [
      { label: "1 A-E", start: "A", end: "E" },
      { label: "2 F-J", start: "F", end: "J" },
      { label: "3 K-O", start: "K", end: "O" },
      { label: "4 P-T", start: "P", end: "T" },
      { label: "5 U-Z", start: "U", end: "Z" }
    ];
    const chunkTabs = ranges.map((range) => ({
      label: range.label,
      entries: entries.filter((entry) => {
        const primerName = entry.label.split("::").pop()?.trim() ?? entry.label;
        const first = primerName.charAt(0).toUpperCase();
        return first >= range.start && first <= range.end;
      })
    }));
    return [...chunkTabs, { label: "6 Search", entries }];
  }

  completePath(value: string): string {
    const expandedValue = value.startsWith("~")
      ? path.join(os.homedir(), value.slice(1))
      : value;
    const directory = expandedValue.endsWith(path.sep)
      ? expandedValue
      : path.dirname(expandedValue);
    const base = expandedValue.endsWith(path.sep) ? "" : path.basename(expandedValue);

    if (!fs.existsSync(directory)) {
      return value;
    }

    const matches = fs
      .readdirSync(directory)
      .filter((entry) => entry.startsWith(base))
      .sort((left, right) => left.localeCompare(right));
    if (matches.length === 0) {
      return value;
    }

    const nextPath = path.join(directory, matches[0]);
    return nextPath.startsWith(os.homedir())
      ? `~${nextPath.slice(os.homedir().length)}`
      : nextPath;
  }

  isTextLikeFile(fileName: string): boolean {
    const extension = path.extname(fileName).toLowerCase();
    return extension === "" || [".md", ".txt", ".json", ".prompt", ".log", ".yaml", ".yml"].includes(extension);
  }

  getPrimerInfo(pathOrName: string): BrowserEntry | undefined {
    const normalized = pathOrName.trim();
    if (!normalized) {
      return undefined;
    }
    if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
      return this.createBrowserEntry(path.basename(normalized), normalized);
    }
    const lower = normalized.toLowerCase();
    return this.collectPrimerEntries().find((entry) => {
      const fileName = path.basename(entry.filePath).toLowerCase();
      const bare = fileName.endsWith(".txt") ? fileName.slice(0, -4) : fileName;
      return fileName === lower || bare === lower;
    });
  }

  private walkPrimerEntries(
    directory: string,
    rootLabel: string,
    entries: BrowserEntry[],
    depth: number
  ): void {
    if (depth > 3) {
      return;
    }
    const children = fs.readdirSync(directory, { withFileTypes: true });
    for (const child of children) {
      if (child.name.startsWith(".") || child.name.endsWith(".log")) {
        continue;
      }
      const childPath = path.join(directory, child.name);
      if (this.isDirectoryEntry(directory, child)) {
        this.walkPrimerEntries(childPath, rootLabel, entries, depth + 1);
        continue;
      }
      if (!this.isTextFileEntry(directory, child)) {
        continue;
      }
      entries.push(this.createBrowserEntry(child.name, childPath));
    }
  }

  private isDirectoryEntry(directory: string, entry: fs.Dirent): boolean {
    if (entry.isDirectory()) {
      return true;
    }
    if (!entry.isSymbolicLink()) {
      return false;
    }
    return this.safeStat(path.join(directory, entry.name))?.isDirectory() === true;
  }

  private isTextFileEntry(directory: string, entry: fs.Dirent): boolean {
    if (!this.isTextLikeFile(entry.name)) {
      return false;
    }
    if (entry.isFile()) {
      return true;
    }
    if (!entry.isSymbolicLink()) {
      return false;
    }
    return this.safeStat(path.join(directory, entry.name))?.isFile() === true;
  }

  private safeStat(filePath: string): fs.Stats | undefined {
    try {
      return fs.statSync(filePath);
    } catch {
      return undefined;
    }
  }

  private createBrowserEntry(label: string, filePath: string): BrowserEntry {
    return {
      label,
      filePath,
      metadata: undefined  // Lazy — measured on demand via measureEntry()
    };
  }

  /** Measure a single entry on demand. Caches the result. */
  measureEntry(entry: BrowserEntry): BrowserEntry["metadata"] {
    if (entry.metadata) return entry.metadata;
    const text = safeReadFile(entry.filePath);
    if (text) entry.metadata = measurePrimerContent(text).measurement;
    return entry.metadata;
  }

  private readPrimerMetadata(filePath: string): BrowserEntry["metadata"] | undefined {
    const text = safeReadFile(filePath);
    return text ? measurePrimerContent(text).measurement : undefined;
  }
}
