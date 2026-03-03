import {
  createMenuConfigs,
  createPaletteCommands,
  listAppCommands,
  type AppCommandCategory,
  type AppCommandDescriptor,
  type AppMenuActions,
  type MenuContext,
  type MenuPlacement,
  type PalettePlacement,
} from "./command-catalog.js";
import type { MenuConfig, MenuItem } from "./types.js";

export type { MenuContext };
export type CommandSurface = "menu" | "palette" | "api" | "agent";

export interface CommandListItem {
  id: string;
  label: string;
  group: string;
  description?: string;
  surfaces: CommandSurface[];
  menuCategories: AppCommandCategory[];
}

export type CommandRunResult =
  | { ok: true; result?: unknown }
  | { ok: false; error: string };

/** Definition accepted by addDynamic(). Self-contained — no AppMenuActions key needed. */
export interface DynamicCommandDefinition {
  id: string;
  label: string;
  group?: string;
  description?: string;
  action: (args?: Record<string, unknown>) => void;
  multiInstance?: boolean;
  menuPlacements?: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  api?: boolean;
  agent?: boolean;
}

const LEGACY_COMMAND_ALIASES: Record<string, string> = {
  "file.browse_primers": "primer.browse",
  "file.open_file_manager": "finder.open",
  "file.open_primer_prompt": "primer.open",
  "file.open_text_file_prompt": "editor.open",
  "file.save": "editor.save",
  "file.save_as": "editor.save_as",
  "workspace.load_prompt": "workspace.load",
  "workspace.load": "workspace.load_named",
  "edit.copy_window_text": "window.copy_text",
  "edit.export_window_text": "window.export_text",
  "browser.open_chrome": "chrome.open",
  "agent.open_wibwob": "agent.open",
  "cam.open_monster_cam": "monster_cam.open",
  "app.toggle_theme": "theme.cycle",
  "app.choose_theme": "theme.choose",
  "app.set_theme": "theme.set",
  "backrooms.open_prompt": "backrooms.open",
  "backrooms.open": "backrooms.run",
  "backrooms.log_browser": "backrooms_logs.open",
  "gallery.open": "primer_gallery.open",
  "reader.open": "document.open",
  "art.open_window": "art.open",
  "workspace.open_manager": "workspace.manage",
  "help.view_readme": "readme.open",
};

export class CommandRegistry {
  private readonly commands: AppCommandDescriptor[];
  /** Dynamic commands registered by microapp modules at runtime. */
  private readonly dynamicCommands: DynamicCommandDefinition[] = [];

  constructor(private readonly actions: AppMenuActions) {
    this.commands = listAppCommands();
  }

  /**
   * Register a dynamic command (from a microapp module).
   * Appears in list(), run(), buildMenus(), buildPalette(), and agent/API surfaces.
   */
  addDynamic(def: DynamicCommandDefinition): void {
    this.dynamicCommands.push(def);
  }

  buildMenus(): MenuConfig[] {
    const menus = createMenuConfigs(this.actions);
    // Append dynamic commands to matching menu categories
    for (const dyn of this.dynamicCommands) {
      for (const placement of dyn.menuPlacements ?? []) {
        const menu = menus.find((m) => m.label.toLowerCase() === placement.category);
        if (menu) {
          menu.items.push({ label: placement.label ?? dyn.label, action: () => dyn.action() });
        }
      }
    }
    return menus;
  }

  buildPalette(): MenuItem[] {
    const items = createPaletteCommands(this.actions);
    for (const dyn of this.dynamicCommands) {
      if (dyn.palettePlacement) {
        items.push({ label: dyn.palettePlacement.label ?? dyn.label, action: () => dyn.action() });
      }
    }
    return items;
  }

  list(surface?: CommandSurface): CommandListItem[] {
    const builtIn = this.commands.map((command) => ({
      id: command.id,
      label: command.label,
      group: command.group,
      description: command.description,
      surfaces: this.getSurfaces(command),
      menuCategories: [...new Set(command.menuPlacements.map((placement) => placement.category))]
    }));

    const dynamic = this.dynamicCommands.map((dyn) => ({
      id: dyn.id,
      label: dyn.label,
      group: dyn.group ?? "surface",
      description: dyn.description,
      surfaces: this.getDynamicSurfaces(dyn),
      menuCategories: [...new Set((dyn.menuPlacements ?? []).map((p) => p.category))] as AppCommandCategory[],
    }));

    const all = [...builtIn, ...dynamic];
    return surface ? all.filter((cmd) => cmd.surfaces.includes(surface)) : all;
  }

  run(id: string, args?: Record<string, unknown>): CommandRunResult {
    const canonicalId = LEGACY_COMMAND_ALIASES[id] ?? id;
    // Check built-in commands first
    const command = this.commands.find((candidate) => candidate.id === canonicalId);
    if (command) {
      const action = this.actions[command.actionKey] as (args?: Record<string, unknown>) => unknown;
      const result = action(args);
      return result === undefined ? { ok: true } : { ok: true, result };
    }
    // Check dynamic commands
    const dyn = this.dynamicCommands.find((candidate) => candidate.id === canonicalId);
    if (dyn) {
      const result = dyn.action(args);
      return result === undefined ? { ok: true } : { ok: true, result };
    }
    return { ok: false, error: `Unknown command: ${id}` };
  }

  /** Return context-menu items for the given context, sorted by order. */
  contextMenuItems(ctx: MenuContext): MenuItem[] {
    return this.commands
      .filter((cmd) => {
        const cm = cmd.contextMenu;
        if (!cm) return false;
        const hasWindow = !!ctx.focusedWindow;
        // Desktop-level commands show when no window focused,
        // or when focused but no windowKinds restriction (global commands like tile/cascade)
        if (cm.desktop && !hasWindow) return true;
        if (cm.desktop && hasWindow && !cm.windowKinds) return true;
        // Window-kind-specific commands
        if (cm.windowKinds && hasWindow && cm.windowKinds.includes(ctx.focusedWindow!.kind)) {
          return true;
        }
        return false;
      })
      .filter((cmd) => {
        const cm = cmd.contextMenu!;
        return cm.enabled ? cm.enabled(ctx) : true;
      })
      .sort((a, b) => (a.contextMenu!.order ?? 0) - (b.contextMenu!.order ?? 0))
      .map((cmd) => ({
        label: cmd.contextMenu!.label ?? cmd.label,
        action: () => { this.run(cmd.id); }
      }));
  }

  createMenuItems(ids: string[]): MenuItem[] {
    return ids.flatMap((id) => {
      const command = this.commands.find((candidate) => candidate.id === id);
      if (!command) {
        return [];
      }
      return [{
        label: command.label,
        action: () => {
          this.run(command.id);
        }
      }];
    });
  }

  private getSurfaces(command: AppCommandDescriptor): CommandSurface[] {
    const surfaces = new Set<CommandSurface>();
    if (command.menuPlacements.length > 0) {
      surfaces.add("menu");
    }
    if (command.palettePlacement) {
      surfaces.add("palette");
    }
    if (command.api) {
      surfaces.add("api");
    }
    if (command.agent) {
      surfaces.add("agent");
    }
    return [...surfaces];
  }

  private getDynamicSurfaces(dyn: DynamicCommandDefinition): CommandSurface[] {
    const surfaces = new Set<CommandSurface>();
    if ((dyn.menuPlacements ?? []).length > 0) surfaces.add("menu");
    if (dyn.palettePlacement) surfaces.add("palette");
    if (dyn.api !== false) surfaces.add("api");
    if (dyn.agent !== false) surfaces.add("agent");
    return [...surfaces];
  }
}
