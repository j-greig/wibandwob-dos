import {
  createMenuConfigsFromCatalog,
  createPaletteCommandsFromCatalog,
  listAppCommands,
  type AppCommandCategory,
  type AppCommandDescriptor,
  type MenuContext,
} from "./command-catalog.js";
import type { AppMenuActions } from "./menu-config.js";
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

export class CommandRegistry {
  private readonly commands: AppCommandDescriptor[];

  constructor(private readonly actions: AppMenuActions) {
    this.commands = listAppCommands();
  }

  buildMenus(): MenuConfig[] {
    return createMenuConfigsFromCatalog(this.actions);
  }

  buildPalette(): MenuItem[] {
    return createPaletteCommandsFromCatalog(this.actions);
  }

  list(surface?: CommandSurface): CommandListItem[] {
    return this.commands
      .map((command) => ({
        id: command.id,
        label: command.label,
        group: command.group,
        description: command.description,
        surfaces: this.getSurfaces(command),
        menuCategories: [...new Set(command.menuPlacements.map((placement) => placement.category))]
      }))
      .filter((command) => (surface ? command.surfaces.includes(surface) : true));
  }

  run(id: string, args?: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
    const command = this.commands.find((candidate) => candidate.id === id);
    if (!command) {
      return { ok: false, error: `Unknown command: ${id}` };
    }
    const action = this.actions[command.actionKey] as (args?: Record<string, unknown>) => void;
    action(args);
    return { ok: true };
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
}
