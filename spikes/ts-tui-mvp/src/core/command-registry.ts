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
        surfaces: this.getSurfaces(command),
        menuCategories: [...new Set(command.menuPlacements.map((placement) => placement.category))]
      }))
      .filter((command) => (surface ? command.surfaces.includes(surface) : true));
  }

  run(id: string): { ok: true } | { ok: false; error: string } {
    const command = this.commands.find((candidate) => candidate.id === id);
    if (!command) {
      return { ok: false, error: `Unknown command: ${id}` };
    }
    this.actions[command.actionKey]();
    return { ok: true };
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
