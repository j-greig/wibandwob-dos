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
  { category: "tools", label: "Tools", key: "t", left: 31 }
];

const APP_COMMANDS: AppCommandDefinition[] = [
  {
    id: "file.browse_primers",
    label: "Browse Primers",
    group: "browse",
    actionKey: "browsePrimers",
    menuPlacements: [{ category: "file", order: 0 }]
  },
  {
    id: "file.open_file_manager",
    label: "Open File Manager",
    group: "browse",
    actionKey: "openFileManager",
    menuPlacements: [
      { category: "file", order: 10 },
      { category: "window", order: 40 },
      { category: "tools", order: 20, label: "File Manager" }
    ],
    palettePlacement: { order: 10 },
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
    label: "New Text Buffer",
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
  {
    id: "file.open_art_window",
    label: "Open Art Window",
    group: "open",
    actionKey: "openArtWindow",
    menuPlacements: [{ category: "file", order: 90 }]
  },
  {
    id: "terminal.open_legacy",
    label: "Open Terminal",
    group: "open",
    actionKey: "openTerminal",
    menuPlacements: [{ category: "file", order: 100 }],
    palettePlacement: { order: 100 }
  },
  {
    id: "terminal.open_xterm",
    label: "Open XTerm Shell",
    group: "open",
    actionKey: "openXTermShell",
    menuPlacements: [
      { category: "file", order: 110 },
      { category: "tools", order: 140, label: "XTerm Shell" }
    ],
    palettePlacement: { order: 110 },
    contextMenu: { desktop: true, order: 50 },
    api: true,
    agent: true
  },
  {
    id: "browser.open_chrome",
    label: "Open Chrome Browser",
    group: "open",
    actionKey: "openChromeBrowser",
    menuPlacements: [
      { category: "file", order: 120 },
      { category: "window", order: 60 },
      { category: "tools", order: 40, label: "Chrome Browser" }
    ],
    palettePlacement: { order: 120 },
    contextMenu: { desktop: true, order: 60 },
    api: true,
    agent: true
  },
  {
    id: "chat.open_wibwob",
    label: "Open Wib&Wob Chat",
    group: "open",
    actionKey: "openWibWobChat",
    menuPlacements: [
      { category: "file", order: 130 },
      { category: "tools", order: 100, label: "Wib&Wob Chat" }
    ],
    palettePlacement: { order: 130 },
    contextMenu: { desktop: true, order: 70 },
    api: true,
    agent: true
  },
  {
    id: "agent.open_wibwob",
    label: "Open Wib&Wob Agent",
    group: "open",
    actionKey: "openWibWobAgent",
    menuPlacements: [
      { category: "file", order: 140 },
      { category: "tools", order: 110, label: "Wib&Wob Agent" }
    ],
    palettePlacement: { order: 140 },
    contextMenu: { desktop: true, order: 80 },
    api: true,
    agent: true
  },
  {
    id: "terminal.open_pi_legacy",
    label: "Open Pi Terminal (Legacy)",
    group: "open",
    actionKey: "openPiChat",
    menuPlacements: [
      { category: "file", order: 150 },
      { category: "tools", order: 150, label: "Pi Terminal (Legacy)" }
    ],
    palettePlacement: { order: 150 },
    contextMenu: { desktop: true, order: 90 }
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
    menuPlacements: [{ category: "edit", order: 10 }]
  },
  {
    id: "window.focus_previous",
    label: "Focus Previous Window",
    group: "focus",
    actionKey: "focusPreviousWindow",
    menuPlacements: [{ category: "edit", order: 20 }]
  },
  {
    id: "window.close_focused",
    label: "Close Focused Window",
    group: "focus",
    actionKey: "closeFocusedWindow",
    menuPlacements: [{ category: "edit", order: 30 }]
  },

  {
    id: "backrooms.open_prompt",
    label: "Backrooms TV...",
    group: "surface",
    actionKey: "openBackroomsPrompt",
    menuPlacements: [
      { category: "view", order: 10 },
      { category: "tools", order: 0, label: "Backrooms TV" }
    ],
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
    menuPlacements: [
      { category: "view", order: 20 },
      { category: "tools", order: 5, label: "Backrooms Logs" }
    ],
    palettePlacement: { order: 5 },
    api: true,
    agent: true
  },

  {
    id: "window.tile",
    label: "Tile Windows",
    group: "layout",
    actionKey: "tileWindows",
    menuPlacements: [{ category: "window", order: 10 }],
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
    menuPlacements: [{ category: "window", order: 20 }],
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
    menuPlacements: [
      { category: "window", order: 30 },
      { category: "tools", order: 10, label: "Primer Gallery" }
    ],
    palettePlacement: { order: 20 }
  },
  {
    id: "reader.open",
    label: "Open Browser",
    group: "surface",
    actionKey: "openBrowserReader",
    menuPlacements: [
      { category: "window", order: 50 },
      { category: "tools", order: 30, label: "Browser Reader" }
    ],
    palettePlacement: { order: 30 }
  },
  {
    id: "art.open_window",
    label: "Open Art",
    group: "surface",
    actionKey: "openArtWindow",
    menuPlacements: [{ category: "window", order: 70 }]
  },

  {
    id: "figlet.open",
    label: "Open Figlet Banner",
    group: "surface",
    actionKey: "openFigletBanner",
    menuPlacements: [{ category: "tools", order: 50, label: "Figlet Banner" }],
    palettePlacement: { order: 50, label: "Open Figlet Banner" }
  },
  {
    id: "pattern.open",
    label: "Pattern Window",
    group: "surface",
    actionKey: "openPatternWindow",
    menuPlacements: [{ category: "tools", order: 60 }],
    palettePlacement: { order: 60 }
  },
  {
    id: "orbit.open",
    label: "Orbit Window",
    group: "surface",
    actionKey: "openOrbitWindow",
    menuPlacements: [{ category: "tools", order: 70 }],
    palettePlacement: { order: 70 }
  },
  {
    id: "glitch.open",
    label: "Glitch FX",
    group: "surface",
    actionKey: "openGlitchWindow",
    menuPlacements: [{ category: "tools", order: 80 }],
    palettePlacement: { order: 80, label: "Open Glitch FX Window" }
  },
  {
    id: "chat.open_transcript",
    label: "Chat Transcript",
    group: "surface",
    actionKey: "openChatWindow",
    menuPlacements: [{ category: "tools", order: 90 }],
    palettePlacement: { order: 90 }
  },
  {
    id: "companion.open",
    label: "Companion",
    group: "surface",
    actionKey: "openCompanionWindow",
    menuPlacements: [{ category: "tools", order: 120 }],
    palettePlacement: { order: 120 }
  },
  {
    id: "workspace.open_manager",
    label: "Workspace Manager",
    group: "surface",
    actionKey: "openWorkspaceManager",
    menuPlacements: [{ category: "tools", order: 130 }],
    palettePlacement: { order: 130 },
    contextMenu: { desktop: true, order: 40 }
  },
  {
    id: "palette.open",
    label: "Command Palette",
    group: "inspect",
    actionKey: "openCommandPalette",
    menuPlacements: [{ category: "tools", order: 160 }]
  },
  {
    id: "inspector.open",
    label: "Open State Inspector",
    group: "inspect",
    actionKey: "openStateInspector",
    menuPlacements: [{ category: "tools", order: 170 }],
    palettePlacement: { order: 170 }
  },
  {
    id: "workspace.save",
    label: "Save Workspace",
    group: "save",
    actionKey: "saveWorkspace",
    palettePlacement: { order: 180 }
  },
  {
    id: "workspace.load",
    label: "Load Workspace",
    group: "save",
    actionKey: "loadWorkspace",
    palettePlacement: { order: 190 }
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

export function createMenuConfigsFromCatalog(actions: AppMenuActions): MenuConfig[] {
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

export function createPaletteCommandsFromCatalog(actions: AppMenuActions): MenuItem[] {
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
