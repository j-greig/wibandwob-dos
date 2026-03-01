/**
 * Context menu adapter — thin layer over the command registry.
 *
 * Does NOT own command definitions, labels, or visibility logic.
 * The catalog owns that. This file only:
 *   1. Builds a MenuContext from the current state
 *   2. Asks the registry for applicable commands
 *   3. Prepends/appends truly local items (file-path actions, close)
 */

import { execSync } from "node:child_process";
import type { CommandRegistry, MenuContext } from "./command-registry.js";
import type { MenuItem, WindowRecord } from "./types.js";

// ── File-path actions (local, not commands) ─────────────────────

/**
 * Reusable file-path context menu items.
 * These are per-instance actions (specific file), not app commands.
 */
export function createFilePathMenuItems(filePath: string): MenuItem[] {
  const items: MenuItem[] = [
    {
      label: "Copy Path to Clipboard",
      action: () => {
        try {
          if (process.platform === "darwin") {
            execSync(`printf '%s' ${JSON.stringify(filePath)} | pbcopy`);
          } else {
            execSync(`printf '%s' ${JSON.stringify(filePath)} | xclip -selection clipboard 2>/dev/null || printf '%s' ${JSON.stringify(filePath)} | xsel --clipboard 2>/dev/null`);
          }
        } catch { /* clipboard not available */ }
      }
    }
  ];
  if (process.platform === "darwin") {
    items.push({
      label: "Reveal in Finder",
      action: () => {
        try { execSync(`open -R ${JSON.stringify(filePath)}`); } catch { /* noop */ }
      }
    });
  }
  return items;
}

// ── Context menu builders ───────────────────────────────────────

/** Build context menu for a right-click on a window frame. */
export function buildWindowContextMenu(
  window: WindowRecord,
  registry: CommandRegistry
): MenuItem[] {
  const ctx: MenuContext = {
    focusedWindow: {
      kind: window.kind ?? "unknown",
      filePath: window.filePath,
      title: window.title
    },
    selection: window.filePath ? "file" : "none"
  };

  const items: MenuItem[] = [
    { label: `Focus ${window.title}`, action: () => window.focus() },
  ];

  // Registry-derived commands for this window kind
  items.push(...registry.contextMenuItems(ctx));

  // File-path actions (per-instance, not in registry)
  if (window.filePath) {
    items.push(...createFilePathMenuItems(window.filePath));
  }

  // Close is always last — direct window action, not a command
  items.push({ label: "Close Window", action: () => window.close() });

  return items;
}

/** Build context menu for a right-click on the desktop background. */
export function buildDesktopContextMenu(
  registry: CommandRegistry
): MenuItem[] {
  const ctx: MenuContext = { selection: "none" };
  return registry.contextMenuItems(ctx);
}
