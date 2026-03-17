#!/usr/bin/env bun
// @name    drift-check
// @desc    Warn when specs are stale vs the code they cover

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, relative } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const SPECS_DIR = resolve(ROOT, ".agents/specs");
const verbose = process.argv.includes("--verbose");

// Extract "covers:" or "Key Files" file paths from a spec
function extractCoveredFiles(specPath: string): string[] {
  const content = readFileSync(specPath, "utf-8");
  const files: string[] = [];

  // Match lines like: - `src/core/window-facade.ts` or src/core/window-facade.ts
  const regex = /`?(src\/[^\s`]+\.ts)`?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content))) {
    const resolved = resolve(ROOT, m[1]);
    if (existsSync(resolved)) files.push(m[1]);
  }
  return [...new Set(files)];
}

// Get last modification date from git
function gitLastModified(filePath: string): Date | null {
  try {
    const ts = execSync(`git log -1 --format=%aI -- "${filePath}"`, {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
    return ts ? new Date(ts) : null;
  } catch {
    return null;
  }
}

const specs = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
let warnings = 0;
let suppressed = 0;

for (const specFile of specs) {
  const specPath = resolve(SPECS_DIR, specFile);
  const specDate = gitLastModified(relative(ROOT, specPath));
  if (!specDate) continue;

  const coveredFiles = extractCoveredFiles(specPath);
  if (coveredFiles.length === 0) continue;

  for (const file of coveredFiles) {
    const fileDate = gitLastModified(file);
    if (!fileDate) continue;

    if (fileDate > specDate) {
      const daysDrift = Math.floor(
        (fileDate.getTime() - specDate.getTime()) / 86400000,
      );
      if (warnings < 5 || verbose) {
        console.error(
          `⚠️  ${specFile} covers ${file} (changed ${daysDrift}d after spec)`,
        );
        warnings++;
      } else {
        suppressed++;
      }
    }
  }
}

if (suppressed > 0) {
  console.error(
    `   (${suppressed} more warnings suppressed — run with --verbose)`,
  );
}

if (warnings === 0) {
  console.log("✅ all specs up to date with covered files");
}
