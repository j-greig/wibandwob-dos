/**
 * host-window-registrations.ts — Register all host window types.
 *
 * Called once at startup. Each entry wires a window factory to the registry.
 * App-controller dispatches via openHostWindow() instead of private methods.
 */
import { registerHostWindow } from "./host-window-registry.js";
import { openTerrainLabWindow } from "../windows/terrain-lab-window.js";
import { openCompanionWindow } from "../windows/generative-windows.js";
import { openMusicPlayerWindow, type MusicPlayerRestore } from "../windows/music-player-window.js";
import {
  type BackroomsWindowContext,
  openBackroomsLogBrowserWindow,
  openBackroomsPrimerPicker as openBackroomsPrimerPickerWindow,
  openBackroomsTvWindow,
  promptForBackroomsTv as promptForBackroomsTvWindowFactory,
} from "../windows/backrooms-windows.js";
import type { BackroomsChannel } from "../core/types.js";
import type { HostWindowDeps } from "./host-window-registry.js";

/** Build backrooms-specific context from standard host window deps. */
function buildBackroomsContext(deps: HostWindowDeps): BackroomsWindowContext {
  return {
    screen: deps.screen,
    windowManager: deps.windowManager,
    overlays: deps.overlays,
    backrooms: deps.backrooms,
    syncState: deps.onStateChanged,
    openEditorWindow: (filePath?, title?, initial?) =>
      deps.editor.openWindow(filePath, title, initial),
    openBackroomsTv: (channel: BackroomsChannel) => {
      // Delegate to the registry's own openBackroomsTv entry
      openBackroomsTvWindow(buildBackroomsContext(deps), channel);
    },
  };
}

export function registerAllHostWindows(): void {
  registerHostWindow({
    appType: "terrain-lab",
    factory: (deps) => {
      openTerrainLabWindow({
        screen: deps.screen,
        windowManager: deps.windowManager,
        onStateChanged: deps.onStateChanged,
      });
    },
  });

  registerHostWindow({
    appType: "companion-widget",
    factory: (deps, restore) => {
      openCompanionWindow(
        { screen: deps.screen, windowManager: deps.windowManager, onStateChanged: deps.onStateChanged },
        restore as { tick?: number } | undefined,
      );
    },
  });

  // ── Backrooms ──────────────────────────────────────────────────────────────

  registerHostWindow({
    appType: "backrooms-log-browser",
    factory: (deps) => {
      openBackroomsLogBrowserWindow(buildBackroomsContext(deps));
    },
  });

  registerHostWindow({
    appType: "backrooms-primer-picker",
    factory: (deps) => {
      promptForBackroomsTvWindowFactory(buildBackroomsContext(deps));
    },
  });

  registerHostWindow({
    appType: "backrooms-tv",
    multiInstance: true,
    factory: (deps, restore) => {
      const channel = restore as BackroomsChannel | undefined;
      if (channel) {
        openBackroomsTvWindow(buildBackroomsContext(deps), channel);
      }
    },
  });

  // ── Music Player ──────────────────────────────────────────────────────────

  registerHostWindow({
    appType: "music-player",
    factory: (deps, restore) => {
      openMusicPlayerWindow(
        { screen: deps.screen, windowManager: deps.windowManager, overlays: deps.overlays, onStateChanged: deps.onStateChanged },
        restore as MusicPlayerRestore | undefined,
      );
    },
  });
}
