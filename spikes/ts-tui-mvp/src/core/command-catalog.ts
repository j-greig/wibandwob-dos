import type { MenuConfig, MenuItem } from "./types.js";
import type { AppMenuActions } from "./menu-config.js";

export type AppCommandCategory = "file" | "edit" | "view" | "window" | "tools";
export type AppCommandGroup =
  | "browse"
  | "open"
  | "save"
  | "focus"
  | "layout"
  | "surface"
  | "inspect"
  | "system";

export interface AppCommandDefinition {
  id: string;
  label: string;
  category: AppCommandCategory;
  group: AppCommandGroup;
  order: number;
  actionKey: keyof AppMenuActions;
  visibility: {
    menu?: boolean;
    palette?: boolean;
  };
}

interface MenuDefinition {
  category: AppCommandCategory;
  label: MenuConfig["label"];
  key: MenuConfig["key"];
  left: MenuConfig["left"];
}

const MENU_DEFINITIONS: MenuDefinition[] = [
  { category: "file", label: "File", key: "f", left: 1 },
  { category: "edit", label: "Edit", key: "e", left: 8 },
  { category: "view", label: "View", key: "v", left: 15 },
  { category: "window", label: "Window", key: "w", left: 22 },
  { category: "tools", label: "Tools", key: "t", left: 31 }
];

const APP_COMMANDS: AppCommandDefinition[] = [
  { id: "file.browse_primers", label: "Browse Primers", category: "file", group: "browse", order: 0, actionKey: "browsePrimers", visibility: { menu: true } },
  { id: "file.open_file_manager", label: "Open File Manager", category: "file", group: "browse", order: 10, actionKey: "openFileManager", visibility: { menu: true, palette: true } },
  { id: "file.open_primer_prompt", label: "Open Primer...", category: "file", group: "open", order: 20, actionKey: "openPrimerPrompt", visibility: { menu: true } },
  { id: "file.open_text_file_prompt", label: "Open Text File...", category: "file", group: "open", order: 30, actionKey: "openTextFilePrompt", visibility: { menu: true } },
  { id: "file.new_text_buffer", label: "New Text Buffer", category: "file", group: "open", order: 40, actionKey: "openEditor", visibility: { menu: true } },
  { id: "file.save", label: "Save", category: "file", group: "save", order: 50, actionKey: "saveFocusedEditor", visibility: { menu: true, palette: true } },
  { id: "file.save_as", label: "Save As...", category: "file", group: "save", order: 60, actionKey: "saveAsFocusedEditor", visibility: { menu: true, palette: true } },
  { id: "workspace.save_as", label: "Save Workspace...", category: "file", group: "save", order: 70, actionKey: "saveWorkspaceAs", visibility: { menu: true, palette: true } },
  { id: "workspace.load_prompt", label: "Load Workspace...", category: "file", group: "save", order: 80, actionKey: "loadWorkspacePrompt", visibility: { menu: true, palette: true } },
  { id: "file.open_art_window", label: "Open Art Window", category: "file", group: "open", order: 90, actionKey: "openArtWindow", visibility: { menu: true } },
  { id: "terminal.open_legacy", label: "Open Terminal", category: "file", group: "open", order: 100, actionKey: "openTerminal", visibility: { menu: true, palette: true } },
  { id: "terminal.open_xterm", label: "Open XTerm Shell", category: "file", group: "open", order: 110, actionKey: "openXTermShell", visibility: { menu: true, palette: true } },
  { id: "browser.open_chrome", label: "Open Chrome Browser", category: "file", group: "open", order: 120, actionKey: "openChromeBrowser", visibility: { menu: true, palette: true } },
  { id: "chat.open_wibwob", label: "Open Wib&Wob Chat", category: "file", group: "open", order: 130, actionKey: "openWibWobChat", visibility: { menu: true, palette: true } },
  { id: "agent.open_wibwob", label: "Open Wib&Wob Agent", category: "file", group: "open", order: 140, actionKey: "openWibWobAgent", visibility: { menu: true, palette: true } },
  { id: "terminal.open_pi_legacy", label: "Open Pi Terminal (Legacy)", category: "file", group: "open", order: 150, actionKey: "openPiChat", visibility: { menu: true, palette: true } },
  { id: "app.quit", label: "Quit", category: "file", group: "system", order: 190, actionKey: "quit", visibility: { menu: true } },

  { id: "window.focus_next", label: "Focus Next Window", category: "edit", group: "focus", order: 10, actionKey: "focusNextWindow", visibility: { menu: true } },
  { id: "window.focus_previous", label: "Focus Previous Window", category: "edit", group: "focus", order: 20, actionKey: "focusPreviousWindow", visibility: { menu: true } },
  { id: "window.close_focused", label: "Close Focused Window", category: "edit", group: "focus", order: 30, actionKey: "closeFocusedWindow", visibility: { menu: true } },

  { id: "backrooms.open_prompt", label: "Backrooms TV...", category: "view", group: "surface", order: 10, actionKey: "openBackroomsPrompt", visibility: { menu: true, palette: true } },

  { id: "window.tile", label: "Tile Windows", category: "window", group: "layout", order: 10, actionKey: "tileWindows", visibility: { menu: true, palette: true } },
  { id: "window.cascade", label: "Cascade Windows", category: "window", group: "layout", order: 20, actionKey: "cascadeWindows", visibility: { menu: true, palette: true } },
  { id: "gallery.open", label: "Open Gallery", category: "window", group: "surface", order: 30, actionKey: "openGallery", visibility: { menu: true } },
  { id: "file_manager.open_window", label: "Open File Manager", category: "window", group: "surface", order: 40, actionKey: "openFileManager", visibility: { menu: true } },
  { id: "reader.open", label: "Open Browser", category: "window", group: "surface", order: 50, actionKey: "openBrowserReader", visibility: { menu: true } },
  { id: "browser.open_window_chrome", label: "Open Chrome Browser", category: "window", group: "surface", order: 60, actionKey: "openChromeBrowser", visibility: { menu: true } },
  { id: "art.open_window", label: "Open Art", category: "window", group: "surface", order: 70, actionKey: "openArtWindow", visibility: { menu: true } },

  { id: "backrooms.open_tools", label: "Backrooms TV", category: "tools", group: "surface", order: 0, actionKey: "openBackroomsPrompt", visibility: { menu: true, palette: true } },
  { id: "gallery.open_tools", label: "Primer Gallery", category: "tools", group: "surface", order: 10, actionKey: "openGallery", visibility: { menu: true, palette: true } },
  { id: "file_manager.open_tools", label: "File Manager", category: "tools", group: "surface", order: 20, actionKey: "openFileManager", visibility: { menu: true } },
  { id: "reader.open_tools", label: "Browser Reader", category: "tools", group: "surface", order: 30, actionKey: "openBrowserReader", visibility: { menu: true, palette: true } },
  { id: "browser.open_chrome_tools", label: "Chrome Browser", category: "tools", group: "surface", order: 40, actionKey: "openChromeBrowser", visibility: { menu: true, palette: true } },
  { id: "figlet.open", label: "Open Figlet Banner", category: "tools", group: "surface", order: 50, actionKey: "openFigletBanner", visibility: { palette: true } },
  { id: "figlet.open_tools", label: "Figlet Banner", category: "tools", group: "surface", order: 50, actionKey: "openFigletBanner", visibility: { menu: true } },
  { id: "pattern.open", label: "Pattern Window", category: "tools", group: "surface", order: 60, actionKey: "openPatternWindow", visibility: { menu: true, palette: true } },
  { id: "orbit.open", label: "Orbit Window", category: "tools", group: "surface", order: 70, actionKey: "openOrbitWindow", visibility: { menu: true, palette: true } },
  { id: "glitch.open", label: "Glitch FX", category: "tools", group: "surface", order: 80, actionKey: "openGlitchWindow", visibility: { menu: true } },
  { id: "glitch.open_palette", label: "Open Glitch FX Window", category: "tools", group: "surface", order: 80, actionKey: "openGlitchWindow", visibility: { palette: true } },
  { id: "chat.open_transcript", label: "Chat Transcript", category: "tools", group: "surface", order: 90, actionKey: "openChatWindow", visibility: { menu: true, palette: true } },
  { id: "chat.open_wibwob_tools", label: "Wib&Wob Chat", category: "tools", group: "surface", order: 100, actionKey: "openWibWobChat", visibility: { menu: true } },
  { id: "agent.open_wibwob_tools", label: "Wib&Wob Agent", category: "tools", group: "surface", order: 110, actionKey: "openWibWobAgent", visibility: { menu: true } },
  { id: "companion.open", label: "Companion", category: "tools", group: "surface", order: 120, actionKey: "openCompanionWindow", visibility: { menu: true, palette: true } },
  { id: "workspace.open_manager", label: "Workspace Manager", category: "tools", group: "surface", order: 130, actionKey: "openWorkspaceManager", visibility: { menu: true, palette: true } },
  { id: "terminal.open_xterm_tools", label: "XTerm Shell", category: "tools", group: "surface", order: 140, actionKey: "openXTermShell", visibility: { menu: true, palette: true } },
  { id: "terminal.open_pi_tools", label: "Pi Terminal (Legacy)", category: "tools", group: "surface", order: 150, actionKey: "openPiChat", visibility: { menu: true, palette: true } },
  { id: "palette.open", label: "Command Palette", category: "tools", group: "inspect", order: 160, actionKey: "openCommandPalette", visibility: { menu: true } },
  { id: "inspector.open", label: "Open State Inspector", category: "tools", group: "inspect", order: 170, actionKey: "openStateInspector", visibility: { menu: true, palette: true } },
  { id: "workspace.save", label: "Save Workspace", category: "tools", group: "save", order: 180, actionKey: "saveWorkspace", visibility: { palette: true } },
  { id: "workspace.load", label: "Load Workspace", category: "tools", group: "save", order: 190, actionKey: "loadWorkspace", visibility: { palette: true } }
];

function byOrder(a: AppCommandDefinition, b: AppCommandDefinition): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}

export function listAppCommands(): AppCommandDefinition[] {
  return [...APP_COMMANDS];
}

export function createMenuConfigsFromCatalog(actions: AppMenuActions): MenuConfig[] {
  return MENU_DEFINITIONS.map((menu) => ({
    label: menu.label,
    key: menu.key,
    left: menu.left,
    items: APP_COMMANDS
      .filter((command) => command.category === menu.category && command.visibility.menu)
      .sort(byOrder)
      .map((command) => ({
        label: command.label,
        action: actions[command.actionKey]
      }))
  }));
}

export function createPaletteCommandsFromCatalog(actions: AppMenuActions): MenuItem[] {
  return APP_COMMANDS
    .filter((command) => command.visibility.palette)
    .sort(byOrder)
    .map((command) => ({
      label: command.label,
      action: actions[command.actionKey]
    }));
}
