import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PRIMER_ROOTS, REPO_ROOT } from "../core/config.js";
import type { BrowserEntry, GalleryTab, PrimerGroup } from "../core/types.js";

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
    for (const root of ["modules", "modules-private"] as const) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      const modules = fs
        .readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      for (const moduleEntry of modules) {
        const primersPath = path.join(rootPath, moduleEntry.name, "primers");
        if (!fs.existsSync(primersPath)) {
          continue;
        }
        const entries = fs
          .readdirSync(primersPath, { withFileTypes: true })
          .filter((entry) => entry.isFile() && this.isTextLikeFile(entry.name))
          .map((entry) => ({
            label: entry.name,
            filePath: path.join(primersPath, entry.name)
          }))
          .sort((left, right) => left.label.localeCompare(right.label));
        if (entries.length > 0) {
          groups.push({
            label: root === "modules" ? moduleEntry.name : `private:${moduleEntry.name}`,
            entries
          });
        }
      }
    }
    return groups.sort((left, right) => left.label.localeCompare(right.label));
  }

  collectGalleryEntries(): BrowserEntry[] {
    const entries: BrowserEntry[] = [];
    for (const root of ["modules", "modules-private"] as const) {
      const rootPath = path.join(REPO_ROOT, root);
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      const modules = fs
        .readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      for (const moduleEntry of modules) {
        const primersPath = path.join(rootPath, moduleEntry.name, "primers");
        if (!fs.existsSync(primersPath)) {
          continue;
        }
        const moduleEntries = fs
          .readdirSync(primersPath, { withFileTypes: true })
          .filter((entry) => entry.isFile() && this.isTextLikeFile(entry.name))
          .map((entry) => ({
            label: `${moduleEntry.name} :: ${entry.name}`,
            filePath: path.join(primersPath, entry.name)
          }));
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
      if (child.isDirectory()) {
        this.walkPrimerEntries(childPath, rootLabel, entries, depth + 1);
        continue;
      }
      if (!this.isTextLikeFile(child.name)) {
        continue;
      }
      entries.push({
        label: `${rootLabel} :: ${path.relative(path.join(REPO_ROOT, rootLabel), childPath)}`,
        filePath: childPath
      });
    }
  }
}
