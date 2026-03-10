/**
 * Maps blessed key events to game commands.
 */

import type { GameCommand } from "./rogue-engine/types.js";

const KEY_MAP: Record<string, GameCommand> = {
  // Vi keys
  h: "move-west",
  j: "move-south",
  k: "move-north",
  l: "move-east",
  // Arrow keys (blessed sends these as names)
  up: "move-north",
  down: "move-south",
  left: "move-west",
  right: "move-east",
  // Squeeze
  w: "squeeze-toggle",
  // Interact
  e: "interact",
  enter: "interact",
  space: "interact",
};

/**
 * Convert a blessed keypress name/ch to a GameCommand, or null if unmapped.
 */
export function mapKey(name: string | undefined, ch: string | undefined): GameCommand | null {
  // blessed gives name for special keys, ch for printable chars
  if (name && KEY_MAP[name]) return KEY_MAP[name];
  if (ch && KEY_MAP[ch]) return KEY_MAP[ch];
  return null;
}
