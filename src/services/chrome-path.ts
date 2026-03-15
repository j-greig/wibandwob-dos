/**
 * chrome-path.ts — Locate Chrome/Chromium executable.
 *
 * Extracted from chrome-browser-service.ts to break circular dependency
 * with capability-service.ts.
 */
import fs from "node:fs";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",  // macOS
  "/usr/bin/google-chrome-stable",                                  // Linux (apt/rpm)
  "/usr/bin/chromium-browser",                                      // Linux (snap/apt)
  "/usr/bin/chromium",                                              // Linux (arch)
];

export function findChromeExecutablePath(): string | null {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
