import {
  createMenuConfigs,
  createPaletteCommands,
  listAppCommands,
  getCommandDefinition,
  type AppMenuActions,
} from "./command-catalog.js";
import type {
  AppCommandCategory,
  AppCommandDescriptor,
  MenuContext,
  MenuPlacement,
  PalettePlacement,
} from "../domain/command-definition.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { MenuConfig, MenuItem } from "./types.js";
import { log } from "../services/app-logger.js";
import { capabilityService, type CapabilityKey } from "../services/capability-service.js";

export type { MenuContext };
export type CommandSurface = "menu" | "palette" | "api" | "agent";

export interface CommandListItem {
  id: string;
  label: string;
  group: string;
  description?: string;
  surfaces: CommandSurface[];
  menuCategories: AppCommandCategory[];
  available: boolean;
  missingCapabilities?: CapabilityKey[];
  returns?: "json" | "text" | "void";
  params?: Record<string, unknown>;
}

export type CommandRunResult =
  | ({ ok: true; result?: unknown } & Record<string, unknown>)
  | ({ ok: false; error: string } & Record<string, unknown>);

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
  "browser.open_chrome": "web-reader.open",
  "agent.open_wibwob": "agent.open",
  "cam.open_monster_cam": "monster-cam.open",
  "backrooms.open_prompt": "backrooms.open",
  "backrooms.run": "backrooms.open",
  "backrooms.log_browser": "backrooms_logs.open",
  "gallery.open": "primer-gallery.open",
  "reader.open": "document.open",
  "art.open_window": "art.open",
  "workspace.open_manager": "workspace.manage",
  "help.view_readme": "readme.open",
  // ── Kebab-case aliases for underscore command IDs ──
  "agent.reload-prompt": "agent.reload_prompt",
  "backrooms-logs.open": "backrooms_logs.open",
  "desktop.toggle-chrome": "desktop.toggle_chrome",
  "editor.save-as": "editor.save_as",
  "finder.advanced-search": "finder.advanced_search",
  "finder.bookmark-path": "finder.bookmark_path",
  "finder.go-to-bookmark": "finder.go_to_bookmark",
  "finder.new-folder": "finder.new_folder",
  "finder.sort-by": "finder.sort_by",
  "finder.toggle-view": "finder.toggle_view",
  "markdown.toggle-figlet": "markdown.toggle_figlet",
  "window.close-focused": "window.close_focused",
  "window.copy-text": "window.copy_text",
  "window.export-text": "window.export_text",
  "window.focus-next": "window.focus_next",
  "window.focus-previous": "window.focus_previous",
  "window.toggle-maximize": "window.toggle_maximize",
  "workspace.load-named": "workspace.load_named",
  "workspace.save-as": "workspace.save_as",
};

/**
 * Returns the value unchanged if it is safely JSON-serialisable (plain object,
 * array, primitive), otherwise returns undefined. This prevents cyclic-structure
 * errors when command actions return live window objects.
 */
function safeSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t !== "object" && t !== "function") return undefined;
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return undefined;
  }
}

function isCommandRunResultLike(value: unknown): value is CommandRunResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.ok === true) {
    return true;
  }
  return candidate.ok === false && typeof candidate.error === "string";
}

function normalizeActionResult(result: unknown): CommandRunResult {
  if (result === undefined) {
    return { ok: true };
  }
  if (isCommandRunResultLike(result)) {
    return result;
  }
  return { ok: true, result: safeSerializable(result) };
}

export class CommandRegistry {
  private readonly commands: AppCommandDescriptor<keyof AppMenuActions>[];
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

  clearDynamicCommands(predicate?: (command: DynamicCommandDefinition) => boolean): number {
    const before = this.dynamicCommands.length;
    if (!predicate) {
      this.dynamicCommands.length = 0;
      return before;
    }
    let writeIndex = 0;
    for (const command of this.dynamicCommands) {
      if (!predicate(command)) {
        this.dynamicCommands[writeIndex++] = command;
      }
    }
    this.dynamicCommands.length = writeIndex;
    return before - writeIndex;
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

  list(surface?: CommandSurface, opts?: { includeUnavailable?: boolean }): CommandListItem[] {
    const builtIn = this.commands.map((command) => {
      const availability = capabilityService.isAvailable(command.requires);
      const def = getCommandDefinition(command.id);
      let params: Record<string, unknown> | undefined;
      if (def?.params) {
        try { params = zodToJsonSchema(def.params, { target: "openApi3" }) as Record<string, unknown>; } catch { /* skip */ }
      }
      return {
        id: command.id,
        label: command.label,
        group: command.group,
        description: command.description,
        surfaces: this.getSurfaces(command),
        menuCategories: [...new Set(command.menuPlacements.map((placement) => placement.category))],
        available: availability.ok,
        missingCapabilities: availability.ok ? undefined : availability.missing,
        returns: def?.returns,
        params,
      };
    });

    const dynamic = this.dynamicCommands.map((dyn) => ({
      id: dyn.id,
      label: dyn.label,
      group: dyn.group ?? "surface",
      description: dyn.description,
      surfaces: this.getDynamicSurfaces(dyn),
      menuCategories: [...new Set((dyn.menuPlacements ?? []).map((p) => p.category))] as AppCommandCategory[],
      available: true,
    }));

    const all = [...builtIn, ...dynamic];
    const forSurface = surface ? all.filter((cmd) => cmd.surfaces.includes(surface)) : all;
    return opts?.includeUnavailable ? forSurface : forSurface.filter((cmd) => cmd.available);
  }

  run(id: string, args?: Record<string, unknown>): CommandRunResult {
    const canonicalId = LEGACY_COMMAND_ALIASES[id] ?? id;
    const argsStr = args && Object.keys(args).length > 0
      ? " " + Object.entries(args).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ")
      : "";
    // Check built-in commands first
    const command = this.commands.find((candidate) => candidate.id === canonicalId);
    if (command) {
      const availability = capabilityService.isAvailable(command.requires);
      if (!availability.ok) {
        const missing = availability.missing.join(", ");
        log.cmd(`${canonicalId}${argsStr} → unavailable (${missing})`);
        return {
          ok: false,
          error: `Command unavailable: ${canonicalId} (missing: ${missing})`,
        };
      }
      const action = this.actions[command.actionKey] as (args?: Record<string, unknown>) => unknown;
      const result = action(args);
      log.cmd(`${canonicalId}${argsStr} → ok`);
      return normalizeActionResult(result);
    }
    // Check dynamic commands
    const dyn = this.dynamicCommands.find((candidate) => candidate.id === canonicalId);
    if (dyn) {
      const result = dyn.action(args);
      log.cmd(`${canonicalId}${argsStr} → ok`);
      return normalizeActionResult(result);
    }
    log.cmd(`${canonicalId}${argsStr} → unknown command`);
    return { ok: false, error: `Unknown command: ${id}` };
  }

  /** Execute only a dynamic command by id, bypassing built-in command ids. */
  runDynamic(id: string, args?: Record<string, unknown>): CommandRunResult {
    const dyn = this.dynamicCommands.find((candidate) => candidate.id === id);
    if (!dyn) {
      return { ok: false, error: `Unknown dynamic command: ${id}` };
    }
    const result = dyn.action(args);
    return normalizeActionResult(result);
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

  private getSurfaces(command: AppCommandDescriptor<keyof AppMenuActions>): CommandSurface[] {
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
