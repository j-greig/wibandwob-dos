/**
 * Single source of truth for user-visible command metadata.
 * Defines command ids, groups, menu/palette/context-menu placements,
 * and agent/API visibility flags. Projected into runtime structures
 * by command-registry.ts.
 */

import type { MenuConfig, MenuItem } from "./types.js";
import type {
  AppCommandCategory,
  AppCommandDefinition,
  AppCommandDescriptor,
  AppCommandGroup,
  ContextMenuPlacement,
  MenuContext,
  MenuPlacement,
  PalettePlacement,
} from "../domain/command-definition.js";
import { z } from "zod";

/** Controller action contract consumed by the command registry and catalog projections. */
export interface AppMenuActions {
  browsePrimers: () => void;
  openFileManager: () => void;
  openPrimerPrompt: (args?: Record<string, unknown>) => void;
  openPrimerPicker: () => unknown;
  listPrimers: () => unknown;
  smearTextSurface: (args?: Record<string, unknown>) => unknown;
  fxGlitch: (args?: Record<string, unknown>) => unknown;
  fxShear: (args?: Record<string, unknown>) => unknown;
  fxBreed: (args?: Record<string, unknown>) => unknown;
  fxFlip: (args?: Record<string, unknown>) => unknown;
  openTextFile: (args?: Record<string, unknown>) => void;
  openEditorPicker: () => unknown;
  openEditor: () => void;
  saveFocusedEditor: () => void;
  saveAsFocusedEditor: () => void;
  saveWorkspaceAs: () => void;
  loadWorkspacePrompt: () => void;
  copyFocusedWindowText: () => void;
  exportFocusedWindowText: (args?: Record<string, unknown>) => void;
  openTerrainLab: () => void;
  openWibWobAgent: () => void;
  reloadAgentPrompt: () => void;
  reloadMicroapps: () => unknown;
  quit: () => void;
  focusNextWindow: () => void;
  focusPreviousWindow: () => void;
  closeFocusedWindow: () => void;
  clearDesktop: (args?: Record<string, unknown>) => unknown;
  toggleDesktopChrome: () => void;
  openBackroomsPrompt: () => void;
  openBackroomsTv: (args?: Record<string, unknown>) => void;
  openBackroomsLogBrowser: () => void;
  backroomsPickerInfo: () => unknown;
  backroomsPickerSelect: (args?: Record<string, unknown>) => unknown;
  backroomsPickerConfirm: () => unknown;
  backroomsPickerCancel: () => unknown;
  tileWindows: () => void;
  cascadeWindows: () => void;
  toggleMaximizeFocused: (args?: Record<string, unknown>) => void;
  openGallery: () => void;
  openBrowserReader: (args?: Record<string, unknown>) => void;
  openChromeBrowser: (args?: Record<string, unknown>) => void;
  openMusicPlayer: (args?: Record<string, unknown>) => void;
  openSy2Chronicles: (args?: Record<string, unknown>) => void;
  openCompanionWindow: () => void;
  openScrambleSmol: () => void;
  openScrambleFloating: () => void;
  scrambleSay: (args?: Record<string, unknown>) => void;
  scrambleExpand: () => void;
  scramblePopOut: () => void;
  scramblePet: () => void;
  scrambleSleep: () => void;
  scrambleWake: () => void;
  scrambleMeow: () => void;
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
  openMarkdownViewer: (args?: Record<string, unknown>) => void;
  openMarkdownPicker: () => unknown;
  toggleMarkdownFiglet: () => void;
  // ── Monster Cam ───────────────────────────────────────
  openMonsterCam: () => void;
  // ── Window control (by id — agent/API use) ────────────
  closeWindowById: (args?: Record<string, unknown>) => void;
  setWindowChrome: (args?: Record<string, unknown>) => void;
  focusWindowById: (args?: Record<string, unknown>) => void;
  moveWindowById: (args?: Record<string, unknown>) => void;
  resizeWindowById: (args?: Record<string, unknown>) => void;
  // ── Canvas documents ───────────────────────────────────
  loadCanvas: (args?: Record<string, unknown>) => void;
  exportCanvas: (args?: Record<string, unknown>) => void;
  // ── Menu ──────────────────────────────────────────────
  closeMenus: () => void;
  // ── Overlay ───────────────────────────────────────────
  overlayConfirm: () => unknown;
  overlayCancel: () => unknown;
  overlaySelect: (args?: Record<string, unknown>) => unknown;
  overlayInfo: () => unknown;
  // ── Help ──────────────────────────────────────────────
  viewReadme: () => void;
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
  { category: "core", label: "Core Apps", key: "c", left: 31 },
  { category: "applications", label: "Applications", key: "a", left: 42 },
  { category: "demos", label: "Demos", key: "d", left: 57 },
  { category: "help", label: "Help", key: "h", left: 65 }
];

/**
 * ── Command ID Naming Canon ─────────────────────────────────────────
 *
 * Format:  <domain>.<verb>  or  <domain>.<noun>
 * Separator: dot between domain and action, kebab-case within segments.
 *
 * Legacy underscore IDs (e.g. window.close_focused) are kept for backward
 * compatibility. Kebab-case aliases are registered in LEGACY_COMMAND_ALIASES
 * in command-registry.ts so both forms work.
 *
 * Microapp commands are auto-prefixed: microapp.<microappId>.<commandId>
 *
 * Labels: use plain names, not "Open ..." prefix (majority convention).
 */
const APP_COMMANDS: AppCommandDefinition<keyof AppMenuActions>[] = [
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
    label: "File Manager",
    description: "Open the file manager browser.",
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
    description: "Toggle between list and icon view in the focused Finder window.",
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
    id: "primer.open",
    label: "Open Primer...",
    description: "Open a primer viewer. Menu use can open the file picker; API/agent callers should pass filePath. Optional: x, y, w, h for position and size.",
    group: "open",
    actionKey: "openPrimerPrompt",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 20 }],
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      filePath: z.string().optional().describe("Absolute path to the primer file"),
      x: z.number().optional().describe("Left position in columns"),
      y: z.number().optional().describe("Top position in rows"),
      w: z.number().optional().describe("Window width in columns"),
      h: z.number().optional().describe("Window height in rows"),
    })
  },
  {
    id: "primer.list",
    label: "List Primers",
    description: "List all available primers with content dimensions. Returns array of {name, lines, width, recommended_w, recommended_h, animated}.",
    group: "open",
    actionKey: "listPrimers",
    api: true,
    agent: true,
    returns: "json"
  },
  {
    id: "primer.picker.open",
    label: "Open Primer Picker",
    description: "Open the shared primer file-browser overlay intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.",
    group: "open",
    actionKey: "openPrimerPicker",
    palettePlacement: { order: 21 },
    api: true,
    agent: true,
    returns: "json",
  },
  {
    id: "text.smear",
    label: "Smear Surface",
    description: "Run scripts/smear.py on a file-backed text surface. Args: filePath (string, optional; defaults to focused file-backed primer/reader/editor), mode (wipe|shear|glitch|stretch, default wipe), width (number, optional), at/tile/skew/seed/intensity (mode-specific options), openAs (primer|reader, optional). Returns {ok, filePath, windowId, sourcePath, kind, mode}.",
    group: "edit",
    actionKey: "smearTextSurface",
    menuPlacements: [{ category: "edit", order: 35 }],
    palettePlacement: { order: 35 },
    contextMenu: { windowKinds: ["primer", "reader", "editor"], order: 35 },
    api: true,
    agent: true
  },
  // ── FX commands — shell-based text transforms ─────────
  {
    id: "fx.glitch",
    label: "FX: Glitch",
    description: "Glitch a text file. Args: filePath (string), intensity (number 0-1, default 0.5), seed (number, optional). Opens result as primer.",
    group: "edit",
    actionKey: "fxGlitch",
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      filePath: z.string().describe("Source text file path"),
      intensity: z.number().min(0).max(1).optional().describe("Glitch intensity 0-1"),
      seed: z.number().optional().describe("Random seed"),
    })
  },
  {
    id: "fx.shear",
    label: "FX: Shear",
    description: "Shear a text file diagonally. Args: filePath (string), skew (number, default 2). Opens result as primer.",
    group: "edit",
    actionKey: "fxShear",
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      filePath: z.string().describe("Source text file path"),
      skew: z.number().optional().describe("Shear displacement per row"),
    })
  },
  {
    id: "fx.breed",
    label: "FX: Breed",
    description: "Breed two text files at the character level. Args: file1 (string), file2 (string), mode (xor|density|blend|random|interleave, default xor), bias (number 0-1, default 0.5). Opens result as primer.",
    group: "edit",
    actionKey: "fxBreed",
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      file1: z.string().describe("First source file"),
      file2: z.string().describe("Second source file"),
      mode: z.enum(["xor", "density", "blend", "random", "interleave"]).optional().describe("Breed mode"),
      bias: z.number().min(0).max(1).optional().describe("Weight toward file2"),
    })
  },
  {
    id: "fx.flip",
    label: "FX: Flip",
    description: "Flip a text file. Args: filePath (string), direction (v|h|both, default v). Opens result as primer.",
    group: "edit",
    actionKey: "fxFlip",
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      filePath: z.string().describe("Source text file path"),
      direction: z.enum(["v", "h", "both"]).optional().describe("Flip direction"),
    })
  },
  {
    id: "editor.open",
    label: "Open Text File...",
    description: "Open a text file in the editor. Menu use can open the file picker; API/agent callers should pass filePath or create an unsaved buffer with title/initial.",
    group: "open",
    actionKey: "openTextFile",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 30 }],
    api: true,
    agent: true,
    params: z.object({
      filePath: z.string().optional().describe("Path to an existing or new text file"),
      title: z.string().optional().describe("Unsaved buffer title"),
      initial: z.string().optional().describe("Initial text for an unsaved buffer"),
    })
  },
  {
    id: "editor.picker.open",
    label: "Open Text File Picker",
    description: "Open the shared text-file browser overlay intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.",
    group: "open",
    actionKey: "openEditorPicker",
    palettePlacement: { order: 31 },
    api: true,
    agent: true,
    returns: "json",
  },
  {
    id: "markdown.open",
    label: "Open Markdown...",
    description: "Open a markdown file with figlet headings and syntax-highlighted code blocks. Menu use can open the markdown picker; API/agent callers should pass filePath.",
    group: "open",
    actionKey: "openMarkdownViewer",
    multiInstance: true,
    menuPlacements: [{ category: "file", order: 35 }],
    palettePlacement: { order: 32 },
    api: true,
    agent: true,
    params: z.object({
      filePath: z.string().optional().describe("Absolute path to a markdown file"),
    })
  },
  {
    id: "markdown.picker.open",
    label: "Open Markdown Picker",
    description: "Open the shared markdown picker intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.",
    group: "open",
    actionKey: "openMarkdownPicker",
    palettePlacement: { order: 33 },
    api: true,
    agent: true,
    returns: "json",
  },
  {
    id: "markdown.toggle_figlet",
    label: "Toggle Figlet Headings",
    description: "Toggle figlet/plain heading rendering in the focused markdown viewer.",
    group: "edit",
    actionKey: "toggleMarkdownFiglet",
    contextMenu: { windowKinds: ["reader"], order: 10 },
    palettePlacement: { order: 33 },
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
    menuPlacements: [{ category: "file", order: 40, appTypes: ["text-editor"] }],
    api: true,
    agent: true,
    returns: "json"
  },
  {
    id: "editor.save",
    label: "Save",
    group: "save",
    actionKey: "saveFocusedEditor",
    menuPlacements: [{ category: "file", order: 50, appTypes: ["text-editor"] }],
    palettePlacement: { order: 50 },
    contextMenu: { windowKinds: ["editor"], order: 10 }
  },
  {
    id: "editor.save_as",
    label: "Save As...",
    group: "save",
    actionKey: "saveAsFocusedEditor",
    menuPlacements: [{ category: "file", order: 60, appTypes: ["text-editor"] }],
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
    id: "workspace.load",
    label: "Load Workspace...",
    group: "save",
    actionKey: "loadWorkspacePrompt",
    menuPlacements: [{ category: "file", order: 80 }],
    palettePlacement: { order: 80 }
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
    id: "web-reader.open",
    label: "Web Browser",
    description: "Open a Chrome browser window for web content extraction. Args: url (string, optional). Without args opens to default page.",
    group: "open",
    actionKey: "openChromeBrowser",
    requires: ["bin.chrome"],
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 40 }],
    palettePlacement: { order: 110 },
    api: true,
    agent: true
  },
  {
    id: "agent.open",
    label: "Wib&Wob Chat",
    description: "Open (or focus) the native Wib&Wob Agent chat window.",
    group: "open",
    actionKey: "openWibWobAgent",
    menuPlacements: [{ category: "applications", order: 120, label: "Wib&Wob Chat", favourite: true }],
    palettePlacement: { order: 130 },
    api: true,
    agent: true
  },
  {
    id: "agent.reload_prompt",
    label: "Reload Agent Prompt",
    description: "Re-read system prompt files from disk and hot-swap into the running agent session. No restart needed.",
    group: "system",
    actionKey: "reloadAgentPrompt",
    menuPlacements: [{ category: "file", order: 190, appTypes: ["wibwob-agent"] }],
    api: true,
    agent: true
  },
  {
    id: "microapps.reload",
    label: "Reload Microapps",
    description: "Reload dynamic microapp modules from disk without restarting the shell.",
    group: "system",
    actionKey: "reloadMicroapps",
    menuPlacements: [{ category: "view", order: 95 }],
    palettePlacement: { order: 196 },
    api: true,
    agent: true,
    returns: "json",
  },
  {
    id: "monster-cam.open",
    label: "Monster Cam",
    description: "Open the Monster Cam window.",
    group: "open",
    actionKey: "openMonsterCam",
    requires: ["path.monster_cam.venv"],
    menuPlacements: [{ category: "applications", order: 150, label: "Monster Cam" }],
    palettePlacement: { order: 145 },
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
    contextMenu: { desktop: true, order: 10 },
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
    agent: true,
    returns: "json",
    params: z.object({
      name: z.string().describe("Theme name"),
    })
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
    id: "window.close",
    label: "Close Window",
    description: "Close a window by id. Args: { id: number }",
    group: "focus",
    actionKey: "closeWindowById",
    api: true,
    agent: true,
  },
  {
    id: "window.set_chrome",
    label: "Set Window Chrome",
    description: "Set window chrome mode. Args: { id: number, mode: 'standard' | 'none' }. Mode 'none' removes all borders, title bar, and shadow — pure floating content.",
    group: "focus",
    actionKey: "setWindowChrome",
    api: true,
    agent: true,
    returns: "void",
    params: z.object({
      id: z.number().describe("Window ID"),
      mode: z.enum(["standard", "none"]).describe("Chrome mode: standard (default) or none (frameless)"),
    })
  },
  {
    id: "window.focus",
    label: "Focus Window",
    description: "Focus a window by id. Args: { id: number }",
    group: "focus",
    actionKey: "focusWindowById",
    api: true,
    agent: true,
  },
  {
    id: "window.move",
    label: "Move Window",
    description: "Move a window by id. Args: { id: number, left: number, top: number }",
    group: "focus",
    actionKey: "moveWindowById",
    api: true,
    agent: true,
    returns: "void",
    params: z.object({
      id: z.number().describe("Window ID from GET /state"),
      left: z.number().describe("Absolute left coordinate"),
      top: z.number().describe("Absolute top coordinate"),
    })
  },
  {
    id: "window.resize",
    label: "Resize Window",
    description: "Resize a window by id. Args: { id: number, width: number, height: number }",
    group: "focus",
    actionKey: "resizeWindowById",
    api: true,
    agent: true,
    returns: "void",
    params: z.object({
      id: z.number().describe("Window ID from GET /state"),
      width: z.number().describe("New width in columns"),
      height: z.number().describe("New height in rows"),
    })
  },
  {
    id: "desktop.clear-all",
    label: "Clear Desktop",
    description: "Emergency escape hatch: cancel active overlays, close menus, and close all non-agent windows. Pass all=true to nuke every window.",
    group: "focus",
    actionKey: "clearDesktop",
    menuPlacements: [{ category: "window", order: 35 }],
    api: true,
    agent: true,
    returns: "json",
    params: z.object({
      all: z.boolean().optional().describe("Close every window, including chat/agent windows. Default false."),
    })
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
    id: "menu.close",
    label: "Close Menus",
    description: "Close any open dropdown menu (File, Edit, View, etc.) or popup context menu.",
    group: "focus",
    actionKey: "closeMenus",
    api: true,
    agent: true,
  },

  {
    id: "overlay.confirm",
    label: "Confirm Overlay",
    description: "Confirm the active modal overlay (equivalent to OK/Enter). Returns ok:false if no overlay is active.",
    group: "focus",
    actionKey: "overlayConfirm",
    api: true,
    agent: true,
  },

  {
    id: "overlay.cancel",
    label: "Cancel Overlay",
    description: "Cancel the active modal overlay (equivalent to Cancel/Escape). Returns ok:false if no overlay is active.",
    group: "focus",
    actionKey: "overlayCancel",
    api: true,
    agent: true,
  },

  {
    id: "overlay.select",
    label: "Select Overlay Index",
    description: "Select an item index in the active overlay when supported (browser/list/file-browser). Args: index (number).",
    group: "focus",
    actionKey: "overlaySelect",
    api: true,
    agent: true,
  },

  {
    id: "overlay.info",
    label: "Overlay Info",
    description: "Check if a modal overlay is active and its type. Returns { active: true/false, type? }.",
    group: "inspect",
    actionKey: "overlayInfo",
    api: true,
    agent: true,
  },

  {
    id: "backrooms.open",
    label: "Backrooms: Live TV",
    description: "Open Backrooms TV with an interactive channel picker.",
    group: "surface",
    actionKey: "openBackroomsPrompt",
    requires: ["path.backrooms.repo"],
    menuPlacements: [{ category: "applications", order: 10 }],
    palettePlacement: { order: 0 },
    api: true,
    agent: true
  },
  {
    id: "backrooms.picker.info",
    label: "Backrooms Picker Info",
    description: "Inspect Backrooms primer picker state (active, selected index, selected primers).",
    group: "inspect",
    actionKey: "backroomsPickerInfo",
    api: true,
    agent: true,
  },
  {
    id: "backrooms.picker.select",
    label: "Backrooms Picker Select",
    description: "Select an index in Backrooms primer picker. Args: index (number).",
    group: "focus",
    actionKey: "backroomsPickerSelect",
    api: true,
    agent: true,
  },
  {
    id: "backrooms.picker.confirm",
    label: "Backrooms Picker Confirm",
    description: "Confirm Backrooms primer picker and continue to run options prompts.",
    group: "focus",
    actionKey: "backroomsPickerConfirm",
    api: true,
    agent: true,
  },
  {
    id: "backrooms.picker.cancel",
    label: "Backrooms Picker Cancel",
    description: "Cancel and close Backrooms primer picker.",
    group: "focus",
    actionKey: "backroomsPickerCancel",
    api: true,
    agent: true,
  },
  {
    id: "backrooms_logs.open",
    label: "Backrooms: Log Browser",
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
    id: "primer-gallery.open",
    label: "Gallery",
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
    label: "Reader",
    description: "Open a local file in the document reader. Args: filePath (string). Without args opens the default document.",
    group: "surface",
    actionKey: "openBrowserReader",
    multiInstance: true,
    menuPlacements: [{ category: "applications", order: 50 }],
    palettePlacement: { order: 30 },
    api: true,
    agent: true
  },
  // ── Migrated to microapps (no backward compat shims) ──────────────
  // figlet.open, figlet.fonts     → microapp.wibwob.figlet.*
  // contour.open                  → microapp.wibwob.contour.open
  // plasma.open, plasma.from-primer → microapp.wibwob.plasma.*
  // pattern.open, art.open        → microapp.wibwob.generative.*
  {
    id: "terrain-lab.open",
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
    api: true,
    agent: true
  },
  {
    id: "microapp.wibwob.sy2chronicles.open",
    label: "§y² Chronicles",
    description: "Bridge command for the §y² Chronicles microapp dynamic opener.",
    group: "surface",
    actionKey: "openSy2Chronicles",
  },
  {
    id: "companion.open",
    label: "Scramble Chat",
    description: "Open Scramble the cat as a full floating window.",
    group: "surface",
    actionKey: "openScrambleFloating",
    menuPlacements: [{ category: "applications", order: 130, favourite: true }],
    palettePlacement: { order: 120 },
    api: true,
    agent: true
  },
  {
    id: "companion.smol",
    label: "Scramble: Popup",
    description: "Open Scramble as a smol popup anchored to the bottom-right corner.",
    group: "surface",
    actionKey: "openScrambleSmol",
    menuPlacements: [{ category: "applications", order: 131 }],
    palettePlacement: { order: 121 },
    api: true,
    agent: true
  },
  {
    id: "scramble.say",
    label: "Scramble: say",
    description: "Send a message to Scramble. Args: { text: string }",
    group: "surface",
    actionKey: "scrambleSay",
    api: true,
    agent: true
  },
  {
    id: "scramble.expand",
    label: "Scramble: expand/collapse",
    description: "Toggle Scramble popup between smol and tall.",
    group: "surface",
    actionKey: "scrambleExpand",
    api: true,
    agent: true
  },
  {
    id: "scramble.pop-out",
    label: "Scramble: pop out to floating",
    description: "Pop Scramble out of smol/tall popup into a full floating window.",
    group: "surface",
    actionKey: "scramblePopOut",
    api: true,
    agent: true
  },
  {
    id: "scramble.pet",
    label: "Scramble: pet",
    description: "Pet Scramble (/pet slash command — she allows it).",
    group: "surface",
    actionKey: "scramblePet",
    api: true,
    agent: true
  },
  {
    id: "scramble.sleep",
    label: "Scramble: sleep",
    description: "Put Scramble to sleep (/sleep — silences idle quips).",
    group: "surface",
    actionKey: "scrambleSleep",
    api: true,
    agent: true
  },
  {
    id: "scramble.wake",
    label: "Scramble: wake",
    description: "Wake Scramble up (/wake — re-enables responses).",
    group: "surface",
    actionKey: "scrambleWake",
    api: true,
    agent: true
  },
  {
    id: "scramble.meow",
    label: "Scramble: meow",
    description: "Make Scramble meow (/meow — no LLM call).",
    group: "surface",
    actionKey: "scrambleMeow",
    api: true,
    agent: true
  },
  {
    id: "workspace.manage",
    label: "Workspace Manager",
    description: "Open the workspace manager for saving and loading desktop layouts.",
    group: "surface",
    actionKey: "openWorkspaceManager",
    menuPlacements: [{ category: "window", order: 60 }],
    palettePlacement: { order: 120 },
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
    label: "State Inspector",
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
  // ── Canvas documents ───────────────────────────────────
  {
    id: "canvas.load",
    label: "Load Canvas",
    description: "Load a .canvas.yaml document. Args: filePath (string, absolute path to .canvas.yaml file).",
    group: "save",
    actionKey: "loadCanvas",
    palettePlacement: { order: 185 },
    api: true,
    agent: true
  },
  {
    id: "canvas.export",
    label: "Export Canvas",
    description: "Export current desktop to a .canvas.yaml file. Args: filePath (string), title (string, optional).",
    group: "save",
    actionKey: "exportCanvas",
    palettePlacement: { order: 186 },
    api: true,
    agent: true
  },
  // ── Help ──────────────────────────────────────────────
  {
    id: "readme.open",
    label: "README",
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
/** Look up a raw command definition by id (includes params schema). */
export function getCommandDefinition(id: string): AppCommandDefinition<keyof AppMenuActions> | undefined {
  return APP_COMMANDS.find((c) => c.id === id);
}

export function listAppCommands(): AppCommandDescriptor<keyof AppMenuActions>[] {
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
    agent: command.agent ?? false,
    returns: command.returns
  }));
}

/** Build runtime MenuConfig[] by projecting catalog commands into their menu placements. */
export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  return MENU_DEFINITIONS.map((menu) => ({
    label: menu.label,
    key: menu.key,
    left: menu.left,
    items: (() => {
      if (menu.category !== "applications") {
        return listAppCommands()
          .flatMap((command) =>
            command.menuPlacements
              .filter((placement) => placement.category === menu.category)
              .map((placement) => ({
                order: placement.order,
                label: placement.label ?? command.label,
                action: actions[command.actionKey],
                appTypes: placement.appTypes,
                separatorAfter: placement.separatorAfter,
                favourite: placement.favourite
              })),
          )
          .sort(byPlacementOrder)
          .reduce((acc, item) => {
            acc.push({
              label: item.label,
              action: item.action,
              ...(item.appTypes ? { appTypes: item.appTypes } : {})
            });
            if (item.separatorAfter) {
              acc.push({ label: "---separator---", action: () => {}, separator: true as const });
            }
            return acc;
          }, [] as MenuItem[]);
      }

      const allWithIds = listAppCommands()
        .flatMap((command) =>
          command.menuPlacements
            .filter((placement) => placement.category === "applications")
            .map((placement) => ({
              commandId: command.id,
              order: placement.order,
              label: placement.label ?? command.label,
              action: actions[command.actionKey],
              appTypes: placement.appTypes,
              favourite: placement.favourite,
            })),
        );

      const favourites = allWithIds.filter((item) => item.favourite).sort(byPlacementOrder);
      const rest = allWithIds.filter((item) => !item.favourite);

      const stripOpen = (s: string): string => s.replace(/^open\s+/i, "").toLowerCase();
      rest.sort((a, b) => stripOpen(a.label).localeCompare(stripOpen(b.label)));

      const toMenuItem = (item: typeof allWithIds[0]): MenuItem => ({
        label: item.label,
        action: item.action,
        ...(item.appTypes ? { appTypes: item.appTypes } : {}),
      });

      const result: MenuItem[] = favourites.map(toMenuItem);

      if (favourites.length > 0 && rest.length > 0) {
        result.push({ label: "---separator---", action: () => {}, separator: true as const });
      }

      result.push(...rest.map(toMenuItem));

      return result;
    })()
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
