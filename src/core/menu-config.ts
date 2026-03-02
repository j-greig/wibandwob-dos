import type { MenuConfig, MenuItem } from "./types.js";
import {
  createMenuConfigsFromCatalog,
  createPaletteCommandsFromCatalog
} from "./command-catalog.js";

export interface AppMenuActions {
  browsePrimers: () => void;
  openFileManager: () => void;
  openPrimerPrompt: () => void;
  openTextFilePrompt: () => void;
  openEditor: () => void;
  saveFocusedEditor: () => void;
  saveAsFocusedEditor: () => void;
  saveWorkspaceAs: () => void;
  loadWorkspacePrompt: () => void;
  copyFocusedWindowText: () => void;
  exportFocusedWindowText: () => void;
  openArtWindow: () => void;
  openWibWobAgent: () => void;
  quit: () => void;
  focusNextWindow: () => void;
  focusPreviousWindow: () => void;
  closeFocusedWindow: () => void;
  openBackroomsPrompt: () => void;
  openBackroomsTv: (args?: Record<string, unknown>) => void;
  openBackroomsLogBrowser: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
  openGallery: () => void;
  openBrowserReader: () => void;
  openChromeBrowser: () => void;
  openFigletBanner: () => void;
  openPatternWindow: () => void;
  openCompanionWindow: () => void;
  openWorkspaceManager: () => void;
  openCommandPalette: () => void;
  openStateInspector: () => void;
  saveWorkspace: () => void;
  loadWorkspace: () => void;
}

export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  return createMenuConfigsFromCatalog(actions);
}

export function createPaletteCommands(actions: AppMenuActions): MenuItem[] {
  return createPaletteCommandsFromCatalog(actions);
}
