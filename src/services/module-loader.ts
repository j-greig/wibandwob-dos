/**
 * Module loader — discovers and loads modules from modules/ and modules-private/.
 *
 * Scans both directories for subdirectories containing module.json manifests.
 * Routes by manifest type:
 *   - "theme"    → dynamic-import theme.ts, register variant
 *   - "microapp" → dynamic-import entry, call setup(host)
 *   - "content"  → no-op here (primer discovery handled by ContentService)
 *   - "prompt"   → no-op here (prompt files read directly by consumers)
 *   - "data"     → no-op here (data files read directly by consumers)
 *
 * Discovery order: directories sorted alphabetically by name.
 * Duplicate module ids fail-fast at load time.
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "../core/config.js";
import { registerExternalTheme } from "../core/theme/resolver.js";
import { theme } from "../core/theme/resolver.js";
import { registerDynamicSnapshot } from "../core/snapshot-registry.js";
import type { SnapshotHandler } from "../core/snapshot-registry.js";
import type { ThemeVariant, ThemeTokens } from "../core/theme/types.js";
import type { AppType, WindowRecord, WindowSnapshot, WindowStateDetails } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WindowFacade } from "../core/window-facade.js";
import type { CommandRegistry, DynamicCommandDefinition } from "../core/command-registry.js";
import type { MenuPlacement, PalettePlacement } from "../core/command-catalog.js";

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface ModuleManifest {
  name: string;
  version: string;
  description: string;
  type: "content" | "prompt" | "theme" | "microapp" | "data";
  entry?: string;
  provides?: Record<string, string>;
  microapp?: MicroappManifestConfig;
}

/** Microapp-specific manifest fields. */
interface MicroappManifestConfig {
  id: string;
  title: string;
  description?: string;
  multiInstance?: boolean;
  persist?: boolean;
  menu?: { category: string; order: number; label?: string }[];
  palette?: { order: number; label?: string };
  agent?: boolean;
  api?: boolean;
}

// ---------------------------------------------------------------------------
// MicroappHost — the API surface a microapp's setup() function receives.
// ---------------------------------------------------------------------------

export interface MicroappHost {
  createWindow(init: {
    title: string;
    width?: number;
    height?: number;
    left?: number;
    top?: number;
  }): MicroappWindowHandle;

  registerCommand(def: {
    id: string;
    label: string;
    description?: string;
    action: (args?: Record<string, unknown>) => void;
    multiInstance?: boolean;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
  }): void;

  registerSnapshot(handlers: {
    serialize: (window: WindowRecord) => Record<string, unknown> | undefined;
    restore: (snapshot: WindowSnapshot, payload: Record<string, unknown>) => void;
  }): void;

  registerTheme(variant: ThemeVariant): void;

  runCommand(localId: string, args?: Record<string, unknown>): void;

  readonly screen: blessed.Widgets.Screen;
  readonly geometry: { width: number; height: number; cellAspect: number };
  readonly theme: () => ThemeTokens;
  readonly windows: WindowFacade;
}

export interface MicroappWindowHandle {
  readonly id: number;
  readonly body: blessed.Widgets.BoxElement;

  onCleanup(fn: () => void): void;
  onRestyle(fn: () => void): void;
  onInput(fn: (input: string) => void): void;
  describeState(fn: () => MicroappStateDetails): void;
  captureText(fn: () => string): void;

  focus(): void;
  close(): void;
}

interface MicroappStateDetails {
  summary?: string;
  contentPreview?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// MicroappHost dependencies — provided by app-controller.ts
// ---------------------------------------------------------------------------

export interface MicroappHostDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  commands: CommandRegistry;
  geometry: { width: number; height: number; cellAspect: number };
  focusOrCreate: (appType: string, createFn: () => void, multiInstance?: boolean) => void;
}

// ---------------------------------------------------------------------------
// MicroappHost implementation
// ---------------------------------------------------------------------------

function createMicroappHost(
  manifest: MicroappManifestConfig,
  deps: MicroappHostDeps
): MicroappHost {
  const { screen, windowManager, commands, geometry, focusOrCreate } = deps;
  const moduleId = manifest.id;

  const host: MicroappHost = {
    createWindow(init) {
      const frame = windowManager.createFrame(init.title, "microapp");
      frame.microappId = moduleId;

      // Apply optional geometry
      if (init.width) frame.frame.width = init.width;
      if (init.height) frame.frame.height = init.height;
      if (init.left !== undefined) frame.frame.left = init.left;
      if (init.top !== undefined) frame.frame.top = init.top;
      // Resize shadow to match
      if (frame.shadow) {
        if (init.width) frame.shadow.width = init.width;
        if (init.height) frame.shadow.height = init.height;
      }

      // Default describeState — microapp should override via handle
      frame.describeState = () => ({
        appType: moduleId,
        summary: manifest.title,
      });

      windowManager.registerWindow(frame);
      frame.focus();

      const handle: MicroappWindowHandle = {
        get id() { return frame.id; },
        get body() { return frame.body; },

        onCleanup(fn) { frame.cleanup = fn; },
        onRestyle(fn) { frame.onRestyle = fn; },
        onInput(fn) { frame.writeInput = fn; },
        captureText(fn) { frame.captureText = fn; },

        describeState(fn) {
          frame.describeState = (): WindowStateDetails => {
            const details = fn();
            return { ...details, appType: moduleId };
          };
        },

        focus() { frame.focus(); },
        close() { windowManager.closeWindow(frame.id); },
      };

      return handle;
    },

    registerCommand(def) {
      const fullId = `microapp.${moduleId}.${def.id}`;
      const multiInstance = def.multiInstance ?? manifest.multiInstance ?? false;
      const dynDef: DynamicCommandDefinition = {
        id: fullId,
        label: def.label,
        description: def.description,
        action: (args) => focusOrCreate(moduleId, () => def.action(args), multiInstance),
        multiInstance,
        menuPlacements: def.menu?.map(m => ({
          category: m.category as MenuPlacement["category"],
          order: m.order,
          label: m.label,
        })),
        palettePlacement: def.palette ? {
          order: def.palette.order,
          label: def.palette.label,
        } : undefined,
        api: manifest.api !== false,
        agent: manifest.agent !== false,
      };
      commands.addDynamic(dynDef);
    },

    registerSnapshot(handlers) {
      const snapshotHandler: SnapshotHandler = {
        serialize: handlers.serialize,
        restore: (snapshot, payload, _actions) => {
          handlers.restore(snapshot, payload);
        },
      };
      registerDynamicSnapshot(moduleId, snapshotHandler);
    },

    registerTheme(variant) {
      registerExternalTheme(variant);
    },

    runCommand(localId, args) {
      const fullId = `microapp.${moduleId}.${localId}`;
      commands.run(fullId, args);
    },

    screen,
    geometry,
    theme,
    windows: windowManager,
  };

  return host;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const MODULE_DIRS = ["modules", "modules-private"] as const;

interface DiscoveredModule {
  dir: string;
  manifest: ModuleManifest;
}

function discoverModules(): DiscoveredModule[] {
  const found: DiscoveredModule[] = [];

  for (const root of MODULE_DIRS) {
    const rootPath = path.join(APP_ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    for (const name of entries) {
      const manifestPath = path.join(rootPath, name, "module.json");
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const raw = fs.readFileSync(manifestPath, "utf8");
        const manifest = JSON.parse(raw) as ModuleManifest;

        if (!manifest.name || !manifest.type) {
          console.warn(`[module-loader] Invalid manifest in ${root}/${name} — missing name or type, skipping`);
          continue;
        }

        found.push({ dir: path.join(rootPath, name), manifest });
      } catch (err) {
        console.warn(`[module-loader] Failed to parse ${manifestPath}: ${err}`);
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Theme loading
// ---------------------------------------------------------------------------

async function loadThemeModule(mod: DiscoveredModule): Promise<void> {
  const entry = mod.manifest.entry ?? "theme.ts";
  const entryPath = path.join(mod.dir, entry);

  if (!fs.existsSync(entryPath)) {
    console.warn(`[module-loader] Theme module ${mod.manifest.name} missing entry ${entry}`);
    return;
  }

  try {
    const imported = await import(entryPath);

    let variant: ThemeVariant | undefined;

    if (imported.default && typeof imported.default === "object" && imported.default.name && imported.default.tokens) {
      variant = imported.default as ThemeVariant;
    } else {
      for (const key of Object.keys(imported)) {
        const val = imported[key];
        if (val && typeof val === "object" && val.name && val.tokens) {
          variant = val as ThemeVariant;
          break;
        }
      }
    }

    if (!variant) {
      console.warn(`[module-loader] Theme module ${mod.manifest.name} does not export a ThemeVariant`);
      return;
    }

    registerExternalTheme(variant);
    console.log(`[module-loader] Loaded theme: ${variant.name} (from ${mod.manifest.name})`);
  } catch (err) {
    console.warn(`[module-loader] Failed to load theme ${mod.manifest.name}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Microapp loading
// ---------------------------------------------------------------------------

async function loadMicroappModule(mod: DiscoveredModule, deps: MicroappHostDeps): Promise<void> {
  const config = mod.manifest.microapp;
  if (!config?.id || !config?.title) {
    console.warn(`[module-loader] Microapp ${mod.manifest.name} missing id or title in microapp config`);
    return;
  }

  const entry = mod.manifest.entry ?? "index.ts";
  const entryPath = path.join(mod.dir, entry);

  if (!fs.existsSync(entryPath)) {
    console.warn(`[module-loader] Microapp ${mod.manifest.name} missing entry ${entry}`);
    return;
  }

  try {
    const imported = await import(entryPath);
    const setup = imported.default;

    if (typeof setup !== "function") {
      console.warn(`[module-loader] Microapp ${mod.manifest.name} does not default-export a setup function`);
      return;
    }

    const host = createMicroappHost(config, deps);
    setup(host);
    console.log(`[module-loader] Loaded microapp: ${config.id} (from ${mod.manifest.name})`);
  } catch (err) {
    console.warn(`[module-loader] Failed to load microapp ${mod.manifest.name}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load theme modules. Call once at startup before workspace restore.
 * Does not require app context — themes are static data.
 */
export async function loadThemes(): Promise<void> {
  const modules = discoverModules();
  for (const mod of modules) {
    if (mod.manifest.type === "theme") {
      await loadThemeModule(mod);
    }
  }
}

/**
 * Load microapp modules. Call after app construction (needs WindowManager,
 * CommandRegistry, etc.) but before workspace restore.
 */
export async function loadMicroapps(deps: MicroappHostDeps): Promise<void> {
  const modules = discoverModules();
  const seenIds = new Set<string>();

  // Fail-fast on duplicate ids
  for (const mod of modules) {
    if (mod.manifest.type === "microapp" && mod.manifest.microapp?.id) {
      const id = mod.manifest.microapp.id;
      if (seenIds.has(id)) {
        throw new Error(`[module-loader] Duplicate microapp id "${id}" — found in ${mod.dir}`);
      }
      seenIds.add(id);
    }
  }

  for (const mod of modules) {
    if (mod.manifest.type === "microapp") {
      await loadMicroappModule(mod, deps);
    }
  }
}

/**
 * Load all modules. Convenience wrapper for the two-phase approach.
 * If deps not provided, only themes are loaded (backward compat).
 */
export async function loadModules(deps?: MicroappHostDeps): Promise<void> {
  await loadThemes();
  if (deps) {
    await loadMicroapps(deps);
  }
}
