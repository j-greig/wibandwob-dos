/**
 * host-window-registrations.ts — Register all host window types.
 *
 * Called once at startup. Each entry wires a window factory to the registry.
 * App-controller dispatches via openHostWindow() instead of private methods.
 */
import { registerHostWindow } from "./host-window-registry.js";
import { openTerrainLabWindow } from "../windows/terrain-lab-window.js";
import { openCompanionWindow } from "../windows/generative-windows.js";
import { openMusicPlayerWindow } from "../windows/music-player-window.js";

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
        restore as any,
      );
    },
  });

  registerHostWindow({
    appType: "music-player",
    factory: (deps, restore) => {
      openMusicPlayerWindow(
        { screen: deps.screen, windowManager: deps.windowManager, overlays: deps.overlays, onStateChanged: deps.onStateChanged },
        restore as any,
      );
    },
  });
}
