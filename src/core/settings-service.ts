/**
 * settings-service.ts — Persistent user settings at DATA_ROOT/settings.json.
 *
 * Owns the global layer of the TuiSkin merge stack. Read at startup; written
 * on demand by patchSkin(). Lightweight by design — this is not a general
 * config dumping ground. Add new fields sparingly.
 *
 * File format (all fields optional):
 * {
 *   "skin": {
 *     "borderStyle": "line" | "bg" | "none",
 *     "borderChar": "░",
 *     "shadowEnabled": true
 *   }
 * }
 */

import path from "node:path";
import { safeReadJSON, safeWriteFile } from "./safe-fs.js";
import { DATA_ROOT } from "./config.js";
import type { TuiSkin } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsFile {
  skin?: Partial<TuiSkin>;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const SETTINGS_PATH = path.join(DATA_ROOT, "settings.json");

let _settings: SettingsFile = {};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load settings from disk. Safe — returns empty object on missing/corrupt file. */
export function loadSettings(): void {
  const raw = safeReadJSON<SettingsFile>(SETTINGS_PATH);
  _settings = raw ?? {};
}

/** Return the in-memory settings object. */
export function getSettings(): SettingsFile {
  return _settings;
}

/** Return the skin override from settings (may be partial / undefined). */
export function getSettingsSkin(): Partial<TuiSkin> | undefined {
  return _settings.skin;
}

/**
 * Merge a partial skin update into settings and persist to disk.
 * Only the provided fields are changed; others are preserved.
 */
export function patchSkin(partial: Partial<TuiSkin>): void {
  _settings = {
    ..._settings,
    skin: { ..._settings.skin, ...partial },
  };
  safeWriteFile(SETTINGS_PATH, JSON.stringify(_settings, null, 2));
}

/** Replace the entire skin in settings and persist. */
export function setSkin(skin: Partial<TuiSkin>): void {
  _settings = { ..._settings, skin };
  safeWriteFile(SETTINGS_PATH, JSON.stringify(_settings, null, 2));
}
