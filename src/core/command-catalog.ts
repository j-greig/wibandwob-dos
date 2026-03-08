/**
 * Single source of truth for user-visible command metadata.
 * Defines command ids, groups, menu/palette/context-menu placements,
 * and agent/API visibility flags. Projected into runtime structures
 * by command-registry.ts.
 */

import type { MenuConfig, MenuItem } from "./types.js";
import type { CapabilityKey } from "../services/capability-service.js";
import { capabilityService } from "../services/capability-service.js";

/** Controller action contract consumed by the command registry and catalog projections. */
export interface AppMenuActions {
  browsePrimers: () => void;
  openFileManager: () => void;
  openPrimerPrompt: (args?: Record<string, unknown>) => void;
  listPrimers: () => unknown;
  smearTextSurface: (args?: Record<string, unknown>) => unknown;
  openTextFile: (args?: Record<string, unknown>) => void;
  openEditor: () => void;
  saveFocusedEditor: () => void;
  saveAsFocusedEditor: () => void;
  saveWorkspaceAs: () => void;
  loadWorkspacePrompt: () => void;
  copyFocusedWindowText: () => void;
  exportFocusedWindowText: (args?: Record<string, unknown>) => void;
  openArtWindow: () => void;
  openContourWindow: () => void;
  openTerrainLab: () => void;
  openWibWobAgent: () => void;
  reloadAgentPrompt: () => void;
  quit: () => void;
  focusNextWindow: () => void;
  focusPreviousWindow: () => void;
  closeFocusedWindow: () => void;
  clearDesktop: () => void;
  toggleDesktopChrome: () => void;
  openBackroomsPrompt: () => void;
  openBackroomsTv: (args?: Record<string, unknown>) => void;
  openBackroomsLogBrowser: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
  toggleMaximizeFocused: (args?: Record<string, unknown>) => void;
  openGallery: () => void;
  openBrowserReader: (args?: Record<string, unknown>) => void;
  openChromeBrowser: (args?: Record<string, unknown>) => void;
  openFigletBanner: (args?: Record<string, unknown>) => void;
  openMusicPlayer: (args?: Record<string, unknown>) => void;
  openPatternWindow: () => void;
  openCompanionWindow: () => void;
  openWorkspaceManager: () => void;
  openCommandPalette: () => void;
  openStateInspector: () => void;
  saveWorkspace: (args?: Record<string, unknown>) => void;
  loadWorkspace: (args?: Record<string, unknown>) => void;
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
  // ── Plasma ─────────────────────────────────────────────
  openPlasmaWindow: (args?: Record<string, unknown>) => void;
  openPlasmaFromPrimer: (args?: Record<string, unknown>) => void;
  // ── Monster Cam ───────────────────────────────────────
  openMonsterCam: () => void;
  // ── Help ──────────────────────────────────────────────
  viewReadme: () => void;
}

/** Menu bucket — determines which top-level menu a command appears in. */
export type AppCommandCategory = "file" | "edit" | "view" | "window" | "applications" | "help";
/** Logical clustering within a category, used for future separators and adapters. */
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

/** Where a command appears in a top-level menu. Not executable on its own. */
export interface MenuPlacement {
  category: AppCommandCategory;
  order: number;
  label?: string;
}

/** Where a command appears in the command palette. Not executable on its own. */
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

/** Authored command definition — the static catalog shape before projection. */
export interface AppCommandDefinition {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: keyof AppMenuActions;
  requires?: CapabilityKey[];
  description?: string;
  multiInstance?: boolean;
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

/** Projected command descriptor — normalised shape consumed by registry, palette, and API. */
export interface AppCommandDescriptor {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: keyof AppMenuActions;
  requires?: CapabilityKey[];
  description?: string;
  multiInstance?: boolean;
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
    id: "primer.browse",
    label: "Browse Primers",
    description: "Open the primer browser to discover and preview primer files.",
    group: "browse",
    actionKey: "browsePrimers",
    menuPlacements: [{ category: "applications", order: 25 }],
    api: true,
    agent: true
  },
  {
    id: "finder.open",
    label: "Open File Manager",
    description: "Open the file manager browser.",
    group: "browse",
    actionKey: "openFileManager",
    menuPlacements: [{ category: "applications", order: 0 }],
    palettePlacement: { order: 10 },
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
  },
  // ── Finder commands — all require feature.file-manager ───────────────────
  {
    id: "finder.search",
    label: "Finder: Search Files",
    description: "Search file contents in the focused Finder window. Args: query (string), glob (string, optional e.g. '*.ts').",
    group: "browse",
    actionKey: "finderSearch",
    palettePlacement: { order: 11 },
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.navigate",
    label: "Finder: Go to Path",
    description: "Navigate the focused Finder to a directory. Args: path (string).",
    group: "browse",
    actionKey: "finderNavigate",
    palettePlacement: { order: 12 },
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.toggle_view",
    label: "Finder: Toggle List/Icon View",
    description: "Toggle between list and icon view in the focused Finder window.",
    group: "browse",
    actionKey: "finderToggleView",
    palettePlacement: { order: 13 },
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
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
    agent: true,
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.bookmark_path",
    label: "Finder: Bookmark Current Path",
    description: "Bookmark the current directory in the focused Finder for quick access.",
    group: "browse",
    actionKey: "finderBookmarkPath",
    palettePlacement: { order: 16 },
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.go_to_bookmark",
    label: "Finder: Go to Bookmark",
    description: "Navigate to a bookmarked path. Args: name (string).",
    group: "browse",
    actionKey: "finderGoToBookmark",
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.new_folder",
    label: "Finder: New Folder",
    description: "Create a new folder in the current Finder directory.",
    group: "browse",
    actionKey: "finderNewFolder",
    palettePlacement: { order: 17 },
    requires: ["feature.file-manager"],
  },
  {
    id: "finder.refresh",
    label: "Finder: Refresh",
    description: "Reload the directory listing in the focused Finder.",
    group: "browse",
    actionKey: "finderRefresh",
    palettePlacement: { order: 18 },
    api: true,
    agent: true,
    requires: ["feature.file-manager"],
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
    id: "primer.open",
    label: "Open Primer...",
    description: "Open a primer viewer. Args: filePath (string, absolute path). Optional: x, y, w, h (numbers for position/size — w,h default to recommended dimensions). Without args opens interactive file picker.",
    group: "open",
    actionKey: "openPrimerPrompt",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 20 }],
    contextMenu: { desktop: true, order: 10 },
    requires: ["feature.primer-open"],
    api: true,
    agent: true
  },
  {
    id: "primer.list",
    label: "List Primers",
    description: "List all available primers with content dimensions. Returns array of {name, lines, width, recommended_w, recommended_h, animated}.",
    group: "open",
    actionKey: "listPrimers",
    api: true,
    agent: true
  },
  {
    id: "text.smear",
    label: "Smear Text Surface",
    description: "Run scripts/smear.py on a file-backed text surface. Args: filePath (string, optional; defaults to focused file-backed primer/reader/editor), mode (wipe|shear|glitch|stretch, default wipe), width (number, optional), at/tile/skew/seed/intensity (mode-specific options), openAs (primer|reader, optional). Returns {ok, filePath, windowId, sourcePath, kind, mode}.",
    group: "edit",
    actionKey: "smearTextSurface",
    menuPlacements: [{ category: "edit", order: 35 }],
    palettePlacement: { order: 35 },
    contextMenu: { windowKinds: ["primer", "reader", "editor"], order: 35 },
    api: true,
    agent: true
  },
  {
    id: "editor.open",
    label: "Open Text File...",
    description: "Open a text file in the editor. Args: filePath (string), title (string, optional), initial (string, optional). Without args opens interactive file picker.",
    group: "open",
    actionKey: "openTextFile",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 30 }],
    contextMenu: { desktop: true, order: 20 },
    requires: ["feature.editor-open"],
    api: true,
    agent: true
  },
  {
    id: "editor.new",
    label: "New Editor",
    description: "Open a new empty text editor window.",
    group: "open",
    actionKey: "openEditor",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 40 }],
    api: true,
    agent: true
  },
  {
    id: "editor.save",
    label: "Save",
    group: "save",
    actionKey: "saveFocusedEditor",
    menuPlacements: [{ category: "file", order: 50 }],
    palettePlacement: { order: 50 },
    contextMenu: { windowKinds: ["editor"], order: 10 },
    requires: ["feature.editor-open"]
  },
  {
    id: "editor.save_as",
    label: "Save As...",
    group: "save",
    actionKey: "saveAsFocusedEditor",
    menuPlacements: [{ category: "file", order: 60 }],
    palettePlacement: { order: 60 },
    contextMenu: { windowKinds: ["editor"], order: 20 },
    requires: ["feature.editor-open"]
  },
  {
    id: "workspace.save_as",
    label: "Save Workspace...",
    group: "save",
    actionKey: "saveWorkspaceAs",
    menuPlacements: [{ category: "file", order: 70 }],
    palettePlacement: { order: 70 },
    requires: ["feature.workspace-persist"]
  },
  {
    id: "workspace.load",
    label: "Load Workspace...",
    group: "save",
    actionKey: "loadWorkspacePrompt",
    menuPlacements: [{ category: "file", order: 80 }],
    palettePlacement: { order: 80 },
    requires: ["feature.workspace-persist"]
  },
  // ── Edit ──────────────────────────────────────────────
  {
    id: "window.copy_text",
    label: "Copy Window Text",
    group: "edit",
    actionKey: "copyFocusedWindowText",
    menuPlacements: [{ category: "edit", order: 10 }],
    palettePlacement: { order: 200 },
    contextMenu: { windowKinds: ["editor", "primer", "chat", "browser", "reader", "gallery", "inspector", "companion", "backrooms"], order: 30 }
  },
  {
    id: "window.export_text",
    label: "Export Window Text...",
    description: "Export a window's text content to scratch/captures/. Args: id (number, window id), name (string, optional label). Without args exports the focused window.",
    group: "edit",
    actionKey: "exportFocusedWindowText",
    menuPlacements: [{ category: "edit", order: 20 }],
    palettePlacement: { order: 210 },
    api: true,
    agent: true
  },
  // ── Applications ─────────────────────────────────────
  {
    id: "chrome.open",
    label: "Open Chrome Browser",
    description: "Open a Chrome browser window for web content extraction. Args: url (string, optional). Without args opens to default page.",
    group: "open",
    actionKey: "openChromeBrowser",
    requires: ["bin.chrome"],
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 40 }],
    palettePlacement: { order: 110 },
    contextMenu: { desktop: true, order: 50 },
    api: true,
    agent: true
  },
  {
    id: "agent.open",
    label: "Open Wib&Wob Agent",
    description: "Open (or focus) the native Wib&Wob Agent chat window.",
    group: "open",
    actionKey: "openWibWobAgent",
    menuPlacements: [{ category: "applications", order: 120, label: "Wib&Wob Agent" }],
    palettePlacement: { order: 130 },
    contextMenu: { desktop: true, order: 70 },
    requires: ["feature.agent"],
    api: true,
    agent: true
  },
  {
    id: "agent.reload_prompt",
    label: "Reload Agent Prompt",
    description: "Re-read system prompt files from disk and hot-swap into the running agent session. No restart needed.",
    group: "system",
    actionKey: "reloadAgentPrompt",
    api: true,
    agent: true
  },
  {
    id: "monster_cam.open",
    label: "Monster Cam",
    description: "Open the Monster Cam window.",
    group: "open",
    actionKey: "openMonsterCam",
    requires: ["path.monster_cam.venv"],
    menuPlacements: [{ category: "applications", order: 150, label: "Monster Cam" }],
    palettePlacement: { order: 145 },
    contextMenu: { desktop: true, order: 80 },
    api: true,
    agent: true
  },
  {
    id: "theme.cycle",
    label: "Cycle Theme",
    description: "Cycle to the next theme variant.",
    group: "system",
    actionKey: "toggleTheme",
    menuPlacements: [{ category: "view", order: 30 }],
    palettePlacement: { order: 190 },
    api: true,
    agent: true
  },
  {
    id: "theme.choose",
    label: "Choose Theme...",
    description: "Open an interactive theme picker.",
    group: "system",
    actionKey: "chooseTheme",
    menuPlacements: [{ category: "view", order: 31 }],
    palettePlacement: { order: 191 },
    api: true,
    agent: true
  },
  {
    id: "theme.set",
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
    id: "desktop.clear-all",
    label: "Clear Desktop",
    description: "Close all windows except the Wib&Wob Agent. Use for silence cues in timelines.",
    group: "focus",
    actionKey: "clearDesktop",
    menuPlacements: [{ category: "window", order: 35 }],
    api: true,
    agent: false
  },
  {
    id: "desktop.toggle_chrome",
    label: "Toggle Chromeless Mode",
    description: "Hide/show the top menu bar and bottom status bar. Turns the desktop into a clean canvas — useful for screensaver/display mode. Right-click desktop to toggle.",
    group: "focus",
    actionKey: "toggleDesktopChrome",
    contextMenu: { desktop: true, order: 30 },
    palettePlacement: { order: 36, label: "Toggle Chromeless Mode" },
    api: true,
    agent: true,
  },

  {
    id: "backrooms.open",
    label: "Backrooms TV...",
    description: "Open Backrooms TV with an interactive channel picker.",
    group: "surface",
    actionKey: "openBackroomsPrompt",
    requires: ["path.backrooms.repo"],
    menuPlacements: [{ category: "applications", order: 10 }],
    palettePlacement: { order: 0 },
    contextMenu: { desktop: true, order: 30 },
    api: true,
    agent: true
  },

  {
    id: "backrooms.run",
    label: "Open Backrooms TV (with args)",
    group: "surface",
    actionKey: "openBackroomsTv",
    requires: ["path.backrooms.repo"],
    description: "Open a Backrooms TV channel directly. Args: theme (string), model (haiku|sonnet|opus), turns (number), mode (auto|live|fake-live).",
    multiInstance: true,
    menuPlacements: [],
    api: true,
    agent: true
  },
  {
    id: "backrooms_logs.open",
    label: "Backrooms Log Browser",
    group: "surface",
    actionKey: "openBackroomsLogBrowser",
    description: "Browse and preview backrooms TV log files. Two-pane view with list and live preview.",
    menuPlacements: [{ category: "applications", order: 20 }],
    palettePlacement: { order: 5 },
    requires: ["feature.backrooms-logs"],
    api: true,
    agent: true
  },

  {
    id: "window.tile",
    label: "Tile Windows",
    description: "Arrange all windows in a tiled grid layout.",
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
    description: "Arrange all windows in a cascading stack layout.",
    group: "layout",
    actionKey: "cascadeWindows",
    menuPlacements: [{ category: "window", order: 50 }],
    palettePlacement: { order: 20 },
    contextMenu: { desktop: true, order: 110 },
    api: true,
    agent: true
  },
  {
    id: "window.toggle_maximize",
    label: "Toggle Maximize",
    description: "Maximize a window or restore it. Args: windowId (number, optional — defaults to focused window).",
    group: "layout",
    actionKey: "toggleMaximizeFocused",
    menuPlacements: [{ category: "window", order: 35 }],
    palettePlacement: { order: 25 },
    api: true,
    agent: true
  },
  {
    id: "primer_gallery.open",
    label: "Open Gallery",
    description: "Open the primer gallery with tabbed categories and preview.",
    group: "surface",
    actionKey: "openGallery",
    menuPlacements: [{ category: "applications", order: 30 }],
    palettePlacement: { order: 20 },
    api: true,
    agent: true
  },
  {
    id: "document.open",
    label: "Document Reader",
    description: "Open a local file in the document reader. Args: filePath (string). Without args opens the default document.",
    group: "surface",
    actionKey: "openBrowserReader",
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 50 }],
    palettePlacement: { order: 30 },
    requires: ["feature.document-reader"],
    api: true,
    agent: true
  },
  {
    id: "art.open",
    label: "Open Generative Art Demo",
    description: "Open an animated generative art window.",
    group: "surface",
    actionKey: "openArtWindow",
    menuPlacements: [{ category: "applications", order: 60 }],
    api: true,
    agent: true
  },

  {
    id: "figlet.open",
    label: "Open Figlet Banner",
    description: "Open a FIGlet banner. Args: text (string), font (string, optional). Without args opens interactive prompt.",
    group: "surface",
    actionKey: "openFigletBanner",
    requires: ["bin.figlet"],
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 70, label: "Figlet Banner" }],
    palettePlacement: { order: 50, label: "Open Figlet Banner" },
    api: true,
    agent: true
  },
  {
    id: "pattern.open",
    label: "Pattern Window",
    description: "Open a pattern field window.",
    group: "surface",
    actionKey: "openPatternWindow",
    menuPlacements: [{ category: "applications", order: 80 }],
    palettePlacement: { order: 60 },
    api: true,
    agent: true
  },
  {
    id: "plasma.open",
    label: "Plasma Screensaver",
    description: "Open animated plasma colour-field screensaver. Args: mood (circuit|void|chaos|aurora|sunset|acid|deep-space|chrome), renderMode (plain|emoji|ansi).",
    group: "surface",
    actionKey: "openPlasmaWindow",
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 82 }],
    palettePlacement: { order: 52 },
    api: true,
    agent: true,
    requires: ["feature.resource-heavy"],
  },
  {
    id: "plasma.from-primer",
    label: "Plasma from Primer",
    description: "Open a plasma screensaver tuned to a primer file's mood. Args: filePath (string). Analyses the text and picks a matching plasma mood.",
    group: "surface",
    actionKey: "openPlasmaFromPrimer",
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 83 }],
    palettePlacement: { order: 53 },
    requires: ["feature.resource-heavy"],
    api: true,
    agent: true
  },
  {
    id: "contour.open",
    label: "Contour Studio",
    description: "Open animated contour map studio. Three modes: chaos (organic contours), order (binary grids), hybrid (mixed).",
    group: "surface",
    actionKey: "openContourWindow",
    menuPlacements: [{ category: "applications", order: 85 }],
    palettePlacement: { order: 55 },
    api: true,
    agent: true
  },
  {
    id: "terrain_lab.open",
    label: "Terrain Lab",
    description: "Contour map with info panel — demonstrates composable ContourPlayer embedding.",
    group: "surface",
    actionKey: "openTerrainLab",
    menuPlacements: [{ category: "applications", order: 86 }],
    palettePlacement: { order: 56 },
    api: true,
    agent: true
  },
  {
    id: "music-player.open",
    label: "Music Player",
    description: "Open the music player. Pass filePath to auto-load a track.",
    group: "surface",
    actionKey: "openMusicPlayer",
    menuPlacements: [{ category: "applications", order: 125 }],
    palettePlacement: { order: 115 },
    requires: ["feature.music-player"],
    api: true,
    agent: true
  },
  {
    id: "companion.open",
    label: "Companion",
    description: "Open Scramble the cat companion window.",
    group: "surface",
    actionKey: "openCompanionWindow",
    menuPlacements: [{ category: "applications", order: 130 }],
    palettePlacement: { order: 120 },
    api: true,
    agent: true,
    requires: ["feature.resource-heavy"],
  },
  {
    id: "workspace.manage",
    label: "Workspace Manager",
    description: "Open the workspace manager for saving and loading desktop layouts.",
    group: "surface",
    actionKey: "openWorkspaceManager",
    menuPlacements: [{ category: "window", order: 60 }],
    palettePlacement: { order: 120 },
    contextMenu: { desktop: true, order: 40 },
    api: true,
    agent: true
  },
  {
    id: "palette.open",
    label: "Command Palette",
    description: "Open the command palette for quick command access.",
    group: "inspect",
    actionKey: "openCommandPalette",
    menuPlacements: [{ category: "view", order: 10 }],
    api: true,
    agent: true
  },
  {
    id: "inspector.open",
    label: "Open State Inspector",
    description: "Open the live desktop state inspector.",
    group: "inspect",
    actionKey: "openStateInspector",
    menuPlacements: [{ category: "view", order: 20 }],
    palettePlacement: { order: 160 },
    api: true,
    agent: true
  },
  {
    id: "workspace.save",
    label: "Save Workspace",
    description: "Save the current workspace. Args: name (string). Without args saves to 'default'.",
    group: "save",
    actionKey: "saveWorkspace",
    palettePlacement: { order: 170 },
    api: true,
    agent: true
  },
  {
    id: "workspace.load_named",
    label: "Load Workspace",
    description: "Load a named workspace. Args: name (string). Without args loads 'default'.",
    group: "save",
    actionKey: "loadWorkspace",
    palettePlacement: { order: 180 },
    api: true,
    agent: true
  },
  // ── Help ──────────────────────────────────────────────
  {
    id: "readme.open",
    label: "View README",
    group: "surface",
    actionKey: "viewReadme",
    description: "Open the project README in a document reader window.",
    multiInstance: true,
    menuPlacements: [{ category: "help", order: 0 }],
    palettePlacement: { order: 200 },
    api: true,
    agent: true
  }
];

function byPlacementOrder(
  a: { order: number; label: string },
  b: { order: number; label: string },
): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}

/** Project static catalog data into normalised command descriptors. */
export function listAppCommands(): AppCommandDescriptor[] {
  return APP_COMMANDS.map((command) => ({
    id: command.id,
    label: command.label,
    group: command.group,
    actionKey: command.actionKey,
    requires: command.requires,
    description: command.description,
    multiInstance: command.multiInstance,
    menuPlacements: [...(command.menuPlacements ?? [])],
    palettePlacement: command.palettePlacement,
    contextMenu: command.contextMenu,
    api: command.api ?? false,
    agent: command.agent ?? false
  }));
}

/** Build runtime MenuConfig[] by projecting catalog commands into their menu placements. */
export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  const stripped = capabilityService.strippedMenuCommands();
  return MENU_DEFINITIONS.map((menu) => ({
    label: menu.label,
    key: menu.key,
    left: menu.left,
    items: listAppCommands()
      .filter((command) => capabilityService.isAvailable(command.requires).ok)
      .filter((command) => !stripped.has(command.id))
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

/** Build runtime palette items by projecting catalog commands with palettePlacement. */
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
