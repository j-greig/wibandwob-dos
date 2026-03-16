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
import { openPrimerBrowserWindow } from "../windows/primer-browser-window.js";
import { openPrimerGalleryWindow } from "../windows/primer-gallery-window.js";
import { openChromeBrowserWindow } from "../windows/chrome-browser-window.js";
import { openBrowserReaderWindow } from "../windows/browser-reader-window.js";
import { openFileManagerWindow, type FileManagerRestore } from "../windows/file-manager-window.js";
import { openScrambleFloatingWindow, openScrambleSmolPopup } from "../windows/scramble-window.js";
import {
  openCommandPaletteWindow,
  openStateInspectorWindow,
  openWorkspaceManagerWindow,
} from "../windows/generative-windows.js";
import type { BackroomsChannel } from "../core/types.js";
import type { HostWindowDeps } from "./host-window-registry.js";
import { REPO_ROOT, MASTER_PHILOSOPHY_PATH } from "./config.js";
import { safeReadFile } from "./safe-fs.js";
import path from "node:path";

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

  // ── Browser / Content ──────────────────────────────────────────────────────

  registerHostWindow({
    appType: "primer-browser",
    factory: (deps, restore) => {
      openPrimerBrowserWindow({
        windowManager: deps.windowManager,
        overlays: deps.overlays,
        entries: deps.content.collectPrimerEntries(),
        onOpenPrimer: (filePath) => deps.openFile(filePath),
        restore: restore as { selectedIndex?: number } | undefined,
        onStateChanged: deps.onStateChanged,
      });
    },
  });

  registerHostWindow({
    appType: "primer-gallery",
    factory: (deps, restore) => {
      const allEntries = deps.content.collectGalleryEntries();
      openPrimerGalleryWindow({
        screen: deps.screen,
        windowManager: deps.windowManager,
        overlays: deps.overlays,
        allEntries,
        tabs: deps.content.buildGalleryTabs(allEntries),
        onOpenPrimer: (filePath) => deps.openFile(filePath),
        restore: restore as { activeTabIndex?: number; searchValue?: string; selectedIndex?: number } | undefined,
        onStateChanged: deps.onStateChanged,
      });
    },
  });

  registerHostWindow({
    appType: "web-reader",
    multiInstance: true,
    factory: (deps, restore) => {
      openChromeBrowserWindow({
        screen: deps.screen,
        windowManager: deps.windowManager,
        overlays: deps.overlays,
        initialUrl: (restore as { url?: string } | undefined)?.url,
        onStateChanged: deps.onStateChanged,
      });
    },
  });

  registerHostWindow({
    appType: "reader-viewer",
    multiInstance: true,
    factory: (deps, restore) => {
      const filePath = (restore as { filePath?: string } | undefined)?.filePath ?? MASTER_PHILOSOPHY_PATH;
      openBrowserReaderWindow({
        filePath,
        onOpenTextViewer: (title, content, kind, nextFilePath) =>
          deps.openTextViewer(title, content, kind, nextFilePath),
        onError: (message) => deps.flash(message),
      });
    },
  });

  registerHostWindow({
    appType: "file-manager",
    factory: (deps, restore) => {
      const r = restore as FileManagerRestore | undefined;
      openFileManagerWindow({
        screen: deps.screen,
        windowManager: deps.windowManager,
        overlays: deps.overlays,
        startPath: r?.currentPath ?? REPO_ROOT,
        restore: r,
        onOpenFile: (filePath) => deps.openFile(filePath),
        onViewFile: (filePath) => {
          const content = safeReadFile(filePath) ?? "";
          deps.openTextViewer(path.basename(filePath), content, "reader", filePath);
        },
        onStateChanged: deps.onStateChanged,
      });
    },
  });

  // ── Utility Windows ───────────────────────────────────────────────────────

  registerHostWindow({
    appType: "command-palette",
    factory: (deps) => {
      openCommandPaletteWindow({
        windowManager: deps.windowManager,
        commands: deps.commands.buildPalette(),
      });
    },
  });

  // Note: inspector and workspace-manager have deps that require StateService
  // and workspace callbacks — registered by app-controller directly until
  // HostWindowDeps grows to include them.

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
