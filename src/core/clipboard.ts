/**
 * Cross-platform clipboard write.
 *
 * Single owner for system clipboard access.
 * Returns true on success, false if clipboard tooling is unavailable.
 */

import { execSync } from "node:child_process";

const IS_DARWIN = process.platform === "darwin";

export function copyToClipboard(text: string): boolean {
  try {
    if (IS_DARWIN) {
      execSync("pbcopy", { input: text });
    } else {
      execSync("xclip -selection clipboard", { input: text });
    }
    return true;
  } catch {
    return false;
  }
}
