import type { MenuConfig, MenuItem } from "./types.js";

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
  openFigletBanner: (args?: Record<string, unknown>) => void;
  openPatternWindow: () => void;
  openCompanionWindow: () => void;
  openWorkspaceManager: () => void;
  openCommandPalette: () => void;
  openStateInspector: () => void;
  saveWorkspace: () => void;
  loadWorkspace: () => void;
  toggleTheme: () => void;
  chooseTheme: () => void;
  setTheme: (args?: Record<string, unknown>) => void;
  // ── Finder ────────────────────────────────────────────
  finderSearch: (args?: Record<string, unknown>) => void;
  finderNavigate: (args?: Record<string, unknown>) => void;
  finderToggleView: () => void;
  finderAdvancedSearch: (args?: Record<string, unknown>) => void;
  finderBookmarkPath: () => void;
  finderGoToBookmark: (args?: Record<string, unknown>) => void;
  finderNewFolder: () => void;
  finderRefresh: () => void;
  finderSortBy: (args?: Record<string, unknown>) => void;
  // ── Monster Cam ───────────────────────────────────────
  openMonsterCam: () => void;
  // ── Help ──────────────────────────────────────────────
  viewReadme: () => void;
}

export type AppCommandCategory = "file" | "edit" | "view" | "window" | "applications" | "help";
export type AppCommandGroup =
  | "browse"
  | "open"
  | "save"
  | "focus"
  | "layout"
  | "surface"
  | "edit"
  | "inspect"
  | "system";

export interface MenuPlacement {
  category: AppCommandCategory;
  order: number;
  label?: string;
}

export interface PalettePlacement {
  order: number;
  label?: string;
}

/** Context passed to context-menu visibility checks. */
export interface MenuContext {
  focusedWindow?: { kind: string; filePath?: string; title?: string };
  selection?: "file" | "url" | "none";
}

/** Coarse context-menu visibility. */
export interface ContextMenuPlacement {
  /** Show when these window kinds are focused. Empty/undefined = desktop only. */
  windowKinds?: string[];
  /** Show on desktop right-click (no window focused). */
  desktop?: boolean;
  /** Fine-grained check. Return false to hide even when coarse match passes. */
  enabled?: (ctx: MenuContext) => boolean;
  /** Override label in context menu. */
  label?: string;
  /** Sort order within context menu. */
  order?: number;
}

export interface AppCommandDefinition {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: keyof AppMenuActions;
  description?: string;
  menuPlacements?: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  contextMenu?: ContextMenuPlacement;
  api?: boolean;
  agent?: boolean;
}

interface MenuDefinition {
  category: AppCommandCategory;
  label: MenuConfig["label"];
  key: MenuConfig["key"];
  left: MenuConfig["left"];
}

export interface AppCommandDescriptor {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: keyof AppMenuActions;
  description?: string;
  menuPlacements: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  contextMenu?: ContextMenuPlacement;
  api: boolean;
  agent: boolean;
}

const MENU_DEFINITIONS: MenuDefinition[] = [
  { category: "file", label: "File", key: "f", left: 1 },
  { category: "edit", label: "Edit", key: "e", left: 8 },
  { category: "view", label: "View", key: "v", left: 15 },
  { category: "window", label: "Window", key: "w", left: 22 },
  { category: "applications", label: "Applications", key: "a", left: 31 },
  { category: "help", label: "Help", key: "h", left: 47 }
];

const APP_COMMANDS: AppCommandDefinition[] = [
  {
    id: "file.browse_primers",
    label: "Browse Primers",
    group: "browse",
    actionKey: "browsePrimers",
    menuPlacements: [{ category: "applications", order: 25 }]
  },
  {
    id: "file.open_file_manager",
    label: "Open File Manager",
    group: "browse",
    actionKey: "openFileManager",
    menuPlacements: [{ category: "applications", order: 0 }],
    palettePlacement: { order: 10 },
    api: true,
    agent: true
  },
  // ── Finder commands ──────────────────────────────────
  {
    id: "finder.search",
    label: "Finder: Search Files",
    description: "Search file contents in the focused Finder window. Args: query (string), glob (string, optional e.g. '*.ts').",
    group: "browse",
    actionKey: "finderSearch",
    palettePlacement: { order: 11 },
    api: true,
    agent: true
  },
  {
    id: "finder.navigate",
    label: "Finder: Go to Path",
    description: "Navigate the focused Finder to a directory. Args: path (string).",
    group: "browse",
    actionKey: "finderNavigate",
    palettePlacement: { order: 12 },
    api: true,
    agent: true
  },
  {
    id: "finder.toggle_view",
    label: "Finder: Toggle List/Icon View",
    group: "browse",
    actionKey: "finderToggleView",
    palettePlacement: { order: 13 },
    api: true,
    agent: true
  },
  // finder.toggle_hidden removed — dotfiles always shown
  {
    id: "finder.advanced_search",
    label: "Finder: Advanced Search (QMD)",
    description: "Semantic/keyword search via QMD in the focused Finder. Args: query (string), mode (lex|vec|hyde, optional). Requires QMD.",
    group: "browse",
    actionKey: "finderAdvancedSearch",
    palettePlacement: { order: 15 },
    api: true,
    agent: true
  },
  {
    id: "finder.bookmark_path",
    label: "Finder: Bookmark Current Path",
    description: "Bookmark the current directory in the focused Finder for quick access.",
    group: "browse",
    actionKey: "finderBookmarkPath",
    palettePlacement: { order: 16 }
  },
  {
    id: "finder.go_to_bookmark",
    label: "Finder: Go to Bookmark",
    description: "Navigate to a bookmarked path. Args: name (string).",
    group: "browse",
    actionKey: "finderGoToBookmark",
    api: true,
    agent: true
  },
  {
    id: "finder.new_folder",
    label: "Finder: New Folder",
    description: "Create a new folder in the current Finder directory.",
    group: "browse",
    actionKey: "finderNewFolder",
    palettePlacement: { order: 17 }
  },
  {
    id: "finder.refresh",
    label: "Finder: Refresh",
    description: "Reload the directory listing in the focused Finder.",
    group: "browse",
    actionKey: "finderRefresh",
    palettePlacement: { order: 18 },
    api: true,
    agent: true
  },
  {
    id: "finder.sort_by",
    label: "Finder: Sort By",
    description: "Change sort order. Args: field (name|size|modified|type).",
    group: "browse",
    actionKey: "finderSortBy",
    palettePlacement: { order: 19 },
    api: true,
    agent: true
  },
  {
    id: "file.open_primer_prompt",
    label: "Open Primer...",
    group: "open",
    actionKey: "openPrimerPrompt",
    menuPlacements: [{ category: "file", order: 20 }],
    contextMenu: { desktop: true, order: 10 }
  },
  {
    id: "file.open_text_file_prompt",
    label: "Open Text File...",
    group: "open",
    actionKey: "openTextFilePrompt",
    menuPlacements: [{ category: "file", order: 30 }],
    contextMenu: { desktop: true, order: 20 }
  },
  {
    id: "file.new_text_buffer",
    label: "New Editor",
    group: "open",
    actionKey: "openEditor",
    menuPlacements: [{ category: "file", order: 40 }]
  },
  {
    id: "file.save",
    label: "Save",
    group: "save",
    actionKey: "saveFocusedEditor",
    menuPlacements: [{ category: "file", order: 50 }],
    palettePlacement: { order: 50 },
    contextMenu: { windowKinds: ["editor"], order: 10 }
  },
  {
    id: "file.save_as",
    label: "Save As...",
    group: "save",
    actionKey: "saveAsFocusedEditor",
    menuPlacements: [{ category: "file", order: 60 }],
    palettePlacement: { order: 60 },
    contextMenu: { windowKinds: ["editor"], order: 20 }
  },
  {
    id: "workspace.save_as",
    label: "Save Workspace...",
    group: "save",
    actionKey: "saveWorkspaceAs",
    menuPlacements: [{ category: "file", order: 70 }],
    palettePlacement: { order: 70 }
  },
  {
    id: "workspace.load_prompt",
    label: "Load Workspace...",
    group: "save",
    actionKey: "loadWorkspacePrompt",
    menuPlacements: [{ category: "file", order: 80 }],
    palettePlacement: { order: 80 }
  },
  // ── Edit ──────────────────────────────────────────────
  {
    id: "edit.copy_window_text",
    label: "Copy Window Text",
    group: "edit",
    actionKey: "copyFocusedWindowText",
    menuPlacements: [{ category: "edit", order: 10 }],
    palettePlacement: { order: 200 },
    contextMenu: { windowKinds: ["editor", "primer", "chat", "browser", "reader", "gallery", "inspector", "companion", "backrooms"], order: 30 }
  },
  {
    id: "edit.export_window_text",
    label: "Export Window Text...",
    group: "edit",
    actionKey: "exportFocusedWindowText",
    menuPlacements: [{ category: "edit", order: 20 }],
    palettePlacement: { order: 210 }
  },
  // ── Applications ─────────────────────────────────────
  {
    id: "browser.open_chrome",
    label: "Open Chrome Browser",
    group: "open",
    actionKey: "openChromeBrowser",
    menuPlacements: [{ category: "applications", order: 40 }],
    palettePlacement: { order: 110 },
    contextMenu: { desktop: true, order: 50 },
    api: true,
    agent: true
  },
  {
    id: "agent.open_wibwob",
    label: "Open Wib&Wob Agent",
    group: "open",
    actionKey: "openWibWobAgent",
    menuPlacements: [{ category: "applications", order: 120, label: "Wib&Wob Agent" }],
    palettePlacement: { order: 130 },
    contextMenu: { desktop: true, order: 70 },
    api: true,
    agent: true
  },
  {
    id: "cam.open_monster_cam",
    label: "Monster Cam",
    group: "open",
    actionKey: "openMonsterCam",
    menuPlacements: [{ category: "applications", order: 150, label: "Monster Cam" }],
    palettePlacement: { order: 145 },
    contextMenu: { desktop: true, order: 80 },
    api: true,
    agent: true
  },
  {
    id: "app.toggle_theme",
    label: "Cycle Theme",
    group: "system",
    actionKey: "toggleTheme",
    menuPlacements: [{ category: "view", order: 30 }],
    palettePlacement: { order: 190 },
    api: true,
    agent: true
  },
  {
    id: "app.choose_theme",
    label: "Choose Theme...",
    group: "system",
    actionKey: "chooseTheme",
    menuPlacements: [{ category: "view", order: 31 }],
    palettePlacement: { order: 191 },
    api: true,
    agent: true
  },
  {
    id: "app.set_theme",
    label: "Set Theme",
    description: "Set theme by name. Args: name (wibwob-dark, wibwob-dark-nord, wibwob-dark-pastel, wibwob-phosphor, wibwob-light).",
    group: "system",
    actionKey: "setTheme",
    api: true,
    agent: true
  },
  {
    id: "app.quit",
    label: "Quit",
    group: "system",
    actionKey: "quit",
    menuPlacements: [{ category: "file", order: 190 }]
  },

  {
    id: "window.focus_next",
    label: "Focus Next Window",
    group: "focus",
    actionKey: "focusNextWindow",
    menuPlacements: [{ category: "window", order: 10 }]
  },
  {
    id: "window.focus_previous",
    label: "Focus Previous Window",
    group: "focus",
    actionKey: "focusPreviousWindow",
    menuPlacements: [{ category: "window", order: 20 }]
  },
  {
    id: "window.close_focused",
    label: "Close Focused Window",
    group: "focus",
    actionKey: "closeFocusedWindow",
    menuPlacements: [{ category: "window", order: 30 }]
  },

  {
    id: "backrooms.open_prompt",
    label: "Backrooms TV...",
    group: "surface",
    actionKey: "openBackroomsPrompt",
    menuPlacements: [{ category: "applications", order: 10 }],
    palettePlacement: { order: 0 },
    contextMenu: { desktop: true, order: 30 },
    api: true,
    agent: true
  },

  {
    id: "backrooms.open",
    label: "Open Backrooms TV (with args)",
    group: "surface",
    actionKey: "openBackroomsTv",
    description: "Open a Backrooms TV channel directly. Args: theme (string), model (haiku|sonnet|opus), turns (number), mode (auto|live|fake-live).",
    menuPlacements: [],
    api: true,
    agent: true
  },
  {
    id: "backrooms.log_browser",
    label: "Backrooms Log Browser",
    group: "surface",
    actionKey: "openBackroomsLogBrowser",
    description: "Browse and preview backrooms TV log files. Two-pane view with list and live preview.",
    menuPlacements: [{ category: "applications", order: 20 }],
    palettePlacement: { order: 5 },
    api: true,
    agent: true
  },

  {
    id: "window.tile",
    label: "Tile Windows",
    group: "layout",
    actionKey: "tileWindows",
    menuPlacements: [{ category: "window", order: 40 }],
    palettePlacement: { order: 10 },
    contextMenu: { desktop: true, order: 100 },
    api: true,
    agent: true
  },
  {
    id: "window.cascade",
    label: "Cascade Windows",
    group: "layout",
    actionKey: "cascadeWindows",
    menuPlacements: [{ category: "window", order: 50 }],
    palettePlacement: { order: 20 },
    contextMenu: { desktop: true, order: 110 },
    api: true,
    agent: true
  },
  {
    id: "gallery.open",
    label: "Open Gallery",
    group: "surface",
    actionKey: "openGallery",
    menuPlacements: [{ category: "applications", order: 30 }],
    palettePlacement: { order: 20 }
  },
  {
    id: "reader.open",
    label: "Document Reader",
    group: "surface",
    actionKey: "openBrowserReader",
    menuPlacements: [{ category: "applications", order: 50 }],
    palettePlacement: { order: 30 }
  },
  {
    id: "art.open_window",
    label: "Open Art",
    group: "surface",
    actionKey: "openArtWindow",
    menuPlacements: [{ category: "applications", order: 60 }]
  },

  {
    id: "figlet.open",
    label: "Open Figlet Banner",
    description: "Open a FIGlet banner. Args: text (string), font (string, optional). Without args opens interactive prompt.",
    group: "surface",
    actionKey: "openFigletBanner",
    menuPlacements: [{ category: "applications", order: 70, label: "Figlet Banner" }],
    palettePlacement: { order: 50, label: "Open Figlet Banner" },
    api: true,
    agent: true
  },
  {
    id: "pattern.open",
    label: "Pattern Window",
    group: "surface",
    actionKey: "openPatternWindow",
    menuPlacements: [{ category: "applications", order: 80 }],
    palettePlacement: { order: 60 }
  },
  {
    id: "companion.open",
    label: "Companion",
    group: "surface",
    actionKey: "openCompanionWindow",
    menuPlacements: [{ category: "applications", order: 130 }],
    palettePlacement: { order: 120 }
  },
  {
    id: "workspace.open_manager",
    label: "Workspace Manager",
    group: "surface",
    actionKey: "openWorkspaceManager",
    menuPlacements: [{ category: "window", order: 60 }],
    palettePlacement: { order: 120 },
    contextMenu: { desktop: true, order: 40 }
  },
  {
    id: "palette.open",
    label: "Command Palette",
    group: "inspect",
    actionKey: "openCommandPalette",
    menuPlacements: [{ category: "view", order: 10 }]
  },
  {
    id: "inspector.open",
    label: "Open State Inspector",
    group: "inspect",
    actionKey: "openStateInspector",
    menuPlacements: [{ category: "view", order: 20 }],
    palettePlacement: { order: 160 }
  },
  {
    id: "workspace.save",
    label: "Save Workspace",
    group: "save",
    actionKey: "saveWorkspace",
    palettePlacement: { order: 170 }
  },
  {
    id: "workspace.load",
    label: "Load Workspace",
    group: "save",
    actionKey: "loadWorkspace",
    palettePlacement: { order: 180 }
  },
  // ── Help ──────────────────────────────────────────────
  {
    id: "help.view_readme",
    label: "View README",
    group: "surface",
    actionKey: "viewReadme",
    description: "Open the project README in a document reader window.",
    menuPlacements: [{ category: "help", order: 0 }],
    palettePlacement: { order: 200 },
  }
];

function byPlacementOrder(
  a: { order: number; label: string },
  b: { order: number; label: string },
): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}

export function listAppCommands(): AppCommandDescriptor[] {
  return APP_COMMANDS.map((command) => ({
    id: command.id,
    label: command.label,
    group: command.group,
    actionKey: command.actionKey,
    description: command.description,
    menuPlacements: [...(command.menuPlacements ?? [])],
    palettePlacement: command.palettePlacement,
    contextMenu: command.contextMenu,
    api: command.api ?? false,
    agent: command.agent ?? false
  }));
}

export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  return MENU_DEFINITIONS.map((menu) => ({
    label: menu.label,
    key: menu.key,
    left: menu.left,
    items: listAppCommands()
      .flatMap((command) =>
        command.menuPlacements
          .filter((placement) => placement.category === menu.category)
          .map((placement) => ({
            order: placement.order,
            label: placement.label ?? command.label,
            action: actions[command.actionKey]
          })),
      )
      .sort(byPlacementOrder)
      .map(({ label, action }) => ({ label, action }))
  }));
}

export function createPaletteCommands(actions: AppMenuActions): MenuItem[] {
  return listAppCommands()
    .flatMap((command) =>
      command.palettePlacement
        ? [{
            order: command.palettePlacement.order,
            label: command.palettePlacement.label ?? command.label,
            action: actions[command.actionKey]
          }]
        : [],
    )
    .sort(byPlacementOrder)
    .map(({ label, action }) => ({ label, action }));
}
