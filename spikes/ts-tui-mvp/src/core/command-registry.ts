import {
  createMenuConfigsFromCatalog,
  createPaletteCommandsFromCatalog,
  listAppCommands,
  type AppCommandCategory,
  type AppCommandDescriptor,
} from "./command-catalog.js";
import type { AppMenuActions } from "./menu-config.js";
import type { MenuConfig, MenuItem } from "./types.js";

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
