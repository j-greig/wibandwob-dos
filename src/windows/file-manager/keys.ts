/**
 * file-manager/keys.ts — Unified key→action dispatcher for the file manager.
 *
 * Eliminates the ~120 lines of duplicated key handlers between list and icon views.
 * Both views bind keys to this single dispatcher.
 */
import type { FileAction } from "./types.js";

/**
 * Map a blessed keypress event to a FileAction.
 * Returns null if the key doesn't map to a known action.
 */
export function keyToAction(
  ch: string | undefined,
  key: { name?: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
): FileAction | null {
  const ctrl = key.ctrl ?? false;
  const meta = key.meta ?? false;

  if (ctrl || meta) return null; // Let ctrl/meta combos pass through

  switch (key.name) {
    case "enter":
    case "return":
      return "open";
    case "backspace":
      return "navigate-up";
    case "tab":
      return "toggle-view";
    case "escape":
      return "search-cancel";
    case "space":
      return "quicklook";
  }

  if (!ch) return null;

  switch (ch) {
    case "v": return "view";
    case "e": return "edit";
    case "c": return "copy-path";
    case "Y": return "yank-contents";
    case "E": return "external-editor";
    case "o": return "reveal";
    case "s": return "search-start";
    case "/": return "filter-focus";
    default: return null;
  }
}

/**
 * Check if a character is a jump-to-letter candidate (a-z, 0-9).
 * Used for the file list quick-jump feature.
 */
export function isJumpChar(ch: string | undefined): boolean {
  return typeof ch === "string" && /^[a-zA-Z0-9]$/.test(ch);
}

/**
 * Actions that should NOT trigger jump-to-letter even though they're single chars.
 */
const ACTION_CHARS = new Set(["v", "e", "c", "Y", "E", "o", "s"]);

export function isActionChar(ch: string): boolean {
  return ACTION_CHARS.has(ch);
}
