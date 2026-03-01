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
  openArtWindow: () => void;
  openTerminal: () => void;
  openXTermShell: () => void;
  openWibWobChat: () => void;
  openWibWobAgent: () => void;
  openPiChat: () => void;
  quit: () => void;
  focusNextWindow: () => void;
  focusPreviousWindow: () => void;
  closeFocusedWindow: () => void;
  openBackroomsPrompt: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
  openGallery: () => void;
  openBrowserReader: () => void;
  openChromeBrowser: () => void;
  openFigletBanner: () => void;
  openPatternWindow: () => void;
  openOrbitWindow: () => void;
  openGlitchWindow: () => void;
  openChatWindow: () => void;
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
