/**
 * Microapp loader — discovers and loads microapps from microapps/ and
 * microapps-private/.
 *
 * Scans both directories for subdirectories containing microapp.json manifests.
 * Routes by manifest type:
 *   - "theme"    → dynamic-import theme.ts, register variant
 *   - "microapp" → dynamic-import entry, call setup(host)
 *   - "content"  → no-op here (primer discovery handled by ContentService)
 *   - "prompt"   → no-op here (prompt files read directly by consumers)
 *   - "data"     → no-op here (data files read directly by consumers)
 *
 * Discovery order: directories sorted alphabetically by name.
 * Duplicate microapp ids fail-fast at load time.
 */

import blessed from "blessed";
import fs from "node:fs";
import { safeReadFile, safeWriteFile } from "../core/safe-fs.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "../core/config.js";
import { registerExternalTheme } from "../core/theme/resolver.js";
import { theme } from "../core/theme/resolver.js";
import { log } from "./app-logger.js";
import { clearDynamicSnapshots, registerDynamicSnapshot } from "../core/snapshot-registry.js";
import { getMicroappTier, isMicroappEnabled, isMicroappInRegistry, isTierVisibleOn, loadExternalMicroappConfig } from "../core/microapp-registry.js";
import { captureError } from "../core/error-buffer.js";
import type { SnapshotHandler } from "../core/snapshot-registry.js";
import type { ThemeVariant, ThemeTokens } from "../core/theme/types.js";
import type { AppType, WindowRecord, WindowSnapshot, WindowStateDetails } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WindowFacade } from "../core/window-facade.js";
import type { CommandRegistry, DynamicCommandDefinition } from "../core/command-registry.js";
import type { MenuPlacement, PalettePlacement } from "../domain/command-definition.js";
import {
  createStack, createRow,
  createHeaderBar, createLayoutStatusBar, createTextBlock,
  createRule, createFigletDisplay, createAnimatedPanel,
  createLayoutButtonBar, applyRect,
} from "../core/ui-parts.js";
import type {
  MicroappHost,
  MicroappHostDeps,
  MicroappStateDetails,
  MicroappWindowHandle,
} from "../sdk/microapp-host.js";

export type {
  MicroappHost,
  MicroappHostDeps,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
  MicroappStateDetails,
  WorldChatHostAccess,
  Rect,
  LayoutPart,
  FlexChild,
  GridChild,
} from "../sdk/microapp-host.js";

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface MicroappManifest {
  name: string;
  version: string;
  description: string;
  type: "content" | "prompt" | "theme" | "microapp" | "data";
  entry?: string;
  provides?: Record<string, string>;
  dev?: MicroappDevConfig;
  microapp?: MicroappManifestConfig;
}

interface MicroappDevConfig {
  watch?: string[];
  reopenCommand?: string;
  reopenArgs?: Record<string, unknown>;
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
// MicroappHost implementation
// ---------------------------------------------------------------------------

function createMicroappHost(
  manifest: MicroappManifestConfig,
  deps: MicroappHostDeps,
  sourceDirName?: string,
): MicroappHost {
  const { screen, windowManager, commands, geometry, focusOrCreate, worldChat } = deps;
  const microappId = manifest.id;

  const host: MicroappHost = {
    createWindow(init) {
      const frame = windowManager.createFrame(init.title, "microapp");
      frame.microappId = microappId;

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

      // Default describeState — microapp should override via handle.describeState()
      frame.describeState = () => ({
        appType: microappId,
        summary: manifest.title,
      });

      // Registration is intentionally delayed until after createWindow() returns.
      // Ordering guarantee: microapps get one synchronous setup pass to attach
      // describeState, cleanup, onRestyle, refresh, and focus target before the
      // first registerWindow() call triggers state sync and focus side effects.
      // Prefer a microtask over setTimeout(0): same guarantee, less event-loop drift.
      let registered = false;
      const ensureRegistered = () => {
        if (registered) return;
        registered = true;
        windowManager.registerWindow(frame);
        frame.focus();
      };
      queueMicrotask(ensureRegistered);

      const handle: MicroappWindowHandle = {
        get id() { return frame.id; },
        get body() { return frame.body; },

        onCleanup(fn) { frame.cleanup = fn; },
        onRestyle(fn) { frame.onRestyle = fn; },
        onResize(fn) { frame.refresh = fn; },
        onInput(fn) { frame.writeInput = fn; },
        captureText(fn) { frame.captureText = fn; },

        describeState(fn) {
          frame.describeState = (): WindowStateDetails => {
            const details = fn();
            return { ...details, appType: microappId };
          };
        },

        focus() {
          ensureRegistered();
          frame.focus();
        },
        close() { windowManager.closeWindow(frame.id); },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK widget may be any blessed element subtype
        setFocusTarget(widget) { frame.setFocusTarget(widget as any); },
        setTitle(title) {
          frame.title = title;
          if (frame.titleBar) frame.titleBar.setContent(` ${title} `);
        },
        registerClickable(node, label) {
          // Store directly on the frame record — window may not be registered in window-manager yet
          if (!frame.clickables) frame.clickables = [];
          frame.clickables = frame.clickables.filter((c) => c.label !== label);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK widget may be any blessed element subtype
          frame.clickables.push({ label, node: node as any });
        },
      };

      return handle;
    },

    registerCommand(def) {
      const fullId = `microapp.${microappId}.${def.id}`;
      const multiInstance = def.multiInstance ?? manifest.multiInstance ?? false;
      const tier = getMicroappTier(microappId);

      // Tier-based visibility filtering:
      //   menu:    core only
      //   palette: core + beta
      //   api:     core + beta
      //   agent:   core + beta
      const showMenu    = isTierVisibleOn(tier, "menu");
      const showPalette = isTierVisibleOn(tier, "palette");
      const showApi     = isTierVisibleOn(tier, "api");
      const showAgent   = isTierVisibleOn(tier, "agent");

      const isDemoMicroapp = Boolean(
        (sourceDirName && sourceDirName.startsWith("demo-"))
        || microappId.includes(".demo.")
        || microappId.includes("-demo")
      );

      const resolveMenuCategory = (requested: string): MenuPlacement["category"] => {
        if (tier !== "core") return requested as MenuPlacement["category"];
        // Host decides promotion buckets. For core-tier microapps:
        // - demo-* go to Demos menu
        // - non-demo app entries go to Core Apps
        // - explicit non-app categories preserved
        if (requested === "demos" || (requested === "applications" && isDemoMicroapp)) {
          return "demos";
        }
        if (requested === "applications") {
          return "core";
        }
        return requested as MenuPlacement["category"];
      };

      const dynDef: DynamicCommandDefinition = {
        id: fullId,
        label: def.label,
        description: def.description,
        action: def.direct ? def.action : (args) => {
          const focusResult = focusOrCreate(microappId, () => def.action(args), multiInstance);
          if (focusResult.focused) return { ok: true, focused: true };
          return { ok: true };
        },
        multiInstance,
        menuPlacements: (showMenu && Array.isArray(def.menu)) ? def.menu.map(m => ({
          category: resolveMenuCategory(m.category),
          order: m.order,
          label: m.label,
        })) : undefined,
        palettePlacement: (showPalette && def.palette && typeof def.palette === "object") ? {
          order: def.palette.order,
          label: def.palette.label,
        } : undefined,
        api: showApi && (manifest.api !== false),
        agent: showAgent && (manifest.agent !== false),
        tier,
      };
      commands.addDynamic(dynDef);
    },

    registerSnapshot(handlers) {
      const snapshotHandler: SnapshotHandler = {
        serialize: handlers.serialize,
        restore: (snapshot, payload, _actions) => {
          handlers.restore(snapshot, payload);
          return undefined; // dynamic microapps don't return the window yet
        },
      };
      registerDynamicSnapshot(microappId, snapshotHandler);
    },

    registerTheme(variant) {
      registerExternalTheme(variant);
    },

    runCommand(localId, args) {
      const fullId = localId.startsWith("microapp.")
        ? localId
        : `microapp.${microappId}.${localId}`;
      commands.run(fullId, args);
    },

    runGlobalCommand(id, args) {
      commands.run(id, args);
    },

    screen,
    geometry,
    theme,
    windows: windowManager,
    worldChat,

    ui: {
      createStack,
      createRow,
      createHeaderBar,
      createStatusBar: createLayoutStatusBar,
      createLayoutStatusBar, // legacy alias
      createTextBlock,
      createRule,
      createFigletDisplay,
      createAnimatedPanel,
      createButtonBar: createLayoutButtonBar,
      createLayoutButtonBar, // legacy alias
      applyRect,
    },

    pickFile(label, startDir, onSelect, options) {
      if (!deps.overlays) {
        log.err(`[${microappId}] pickFile unavailable — overlays not provided`);
        return;
      }
      deps.overlays.openFileBrowserPrompt(label, startDir, onSelect, options);
    },

    flash(message) {
      if (!deps.overlays) {
        log.err(`[${microappId}] flash unavailable — overlays not provided`);
        return;
      }
      deps.overlays.flash(message);
    },

    promptValue(label, defaultValue, onSubmit) {
      if (!deps.overlays) {
        log.err(`[${microappId}] promptValue unavailable — overlays not provided`);
        return;
      }
      deps.overlays.openValuePrompt(label, defaultValue, onSubmit);
    },

    repoRoot: deps.repoRoot ?? APP_ROOT,
  };

  return host;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const MICROAPP_DIRS = ["microapps", "microapps-private"] as const;

interface DiscoveredMicroapp {
  dir: string;
  manifest: MicroappManifest;
}

function discoverMicroapps(): DiscoveredMicroapp[] {
  const found: DiscoveredMicroapp[] = [];

  for (const root of MICROAPP_DIRS) {
    const rootPath = path.join(APP_ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    for (const name of entries) {
      const manifestPath = path.join(rootPath, name, "microapp.json");
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const raw = safeReadFile(manifestPath);
        if (!raw) continue;
        const manifest = JSON.parse(raw) as MicroappManifest;

        if (!manifest.name || !manifest.type) {
          log.err(`[microapp-loader] Invalid manifest in ${root}/${name} — missing name or type, skipping`);
          continue;
        }

        found.push({ dir: path.join(rootPath, name), manifest });
      } catch (err) {
        log.err(`[microapp-loader] Failed to parse ${manifestPath}: ${err}`);
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Theme loading
// ---------------------------------------------------------------------------

async function loadThemeMicroapp(mod: DiscoveredMicroapp): Promise<void> {
  const entry = mod.manifest.entry ?? "theme.ts";
  const entryPath = path.join(mod.dir, entry);

  if (!fs.existsSync(entryPath)) {
    log.err(`[microapp-loader] Theme microapp ${mod.manifest.name} missing entry ${entry}`);
    return;
  }

  try {
    const imported = await import(pathToFileURL(entryPath).href);

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
      log.err(`[microapp-loader] Theme microapp ${mod.manifest.name} does not export a ThemeVariant`);
      return;
    }

    registerExternalTheme(variant);
    log.app(`[microapp-loader] Loaded theme: ${variant.name} (from ${mod.manifest.name})`);
  } catch (err) {
    log.err(`[microapp-loader] Failed to load theme microapp ${mod.manifest.name}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Microapp loading
// ---------------------------------------------------------------------------

async function loadMicroappModule(mod: DiscoveredMicroapp, deps: MicroappHostDeps): Promise<void> {
  const config = mod.manifest.microapp;
  if (!config?.id || !config?.title) {
    log.err(`[microapp-loader] Microapp ${mod.manifest.name} missing id or title in microapp config`);
    return;
  }

  // ── Registry gate: skip disabled microapps ──
  if (!isMicroappEnabled(config.id)) {
    log.app(`[microapp-loader] Skipped disabled microapp: ${config.id}`);
    return;
  }

  // Log auto-registered microapps (not in hardcoded registry or external config)
  if (!isMicroappInRegistry(config.id)) {
    log.app(`[loader] auto-registered ${config.id} at beta tier`);
  }

  const entry = mod.manifest.entry ?? "index.ts";
  const entryPath = path.join(mod.dir, entry);

  if (!fs.existsSync(entryPath)) {
    log.err(`[microapp-loader] Microapp ${mod.manifest.name} missing entry ${entry}`);
    return;
  }

  try {
    // Bun ignores query-string cache busters on dynamic import().
    // Clear require.cache first so the next import() gets fresh compiled code.
    try { delete require.cache[require.resolve(entryPath)]; } catch {}
    const imported = await import(`${pathToFileURL(entryPath).href}?reload=${Date.now()}`);
    const setup = imported.default;

    if (typeof setup !== "function") {
      log.err(`[microapp-loader] Microapp ${mod.manifest.name} does not default-export a setup function`);
      return;
    }

    const microappId = config.id;
    const host = createMicroappHost(config, deps, path.basename(mod.dir));
    try {
      setup(host);
    } catch (err) {
      captureError(err, microappId, "setup");
      throw err; // re-throw so the outer catch can still log
    }
    log.app(`[microapp-loader] Loaded microapp: ${microappId} (from ${mod.manifest.name})`);
  } catch (err) {
    log.err(`[microapp-loader] Failed to load microapp ${mod.manifest.name}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load theme microapps. Call once at startup before workspace restore.
 * Does not require app context — themes are static data.
 */
export async function loadThemes(): Promise<void> {
  const microapps = discoverMicroapps();
  for (const mod of microapps) {
    if (mod.manifest.type === "theme") {
      await loadThemeMicroapp(mod);
    }
  }
}

/**
 * Load microapps. Call after app construction (needs WindowManager,
 * CommandRegistry, etc.) but before workspace restore.
 */
export async function loadRuntimeMicroapps(deps: MicroappHostDeps): Promise<void> {
  // Load external tier config (.wibwob/microapps.json) before any microapps are evaluated
  const externalConfigPath = path.join(APP_ROOT, ".wibwob", "microapps.json");
  loadExternalMicroappConfig(externalConfigPath);

  const microapps = discoverMicroapps();
  const seenIds = new Set<string>();

  // Fail-fast on duplicate ids
  for (const mod of microapps) {
    if (mod.manifest.type === "microapp" && mod.manifest.microapp?.id) {
      const id = mod.manifest.microapp.id;
      if (seenIds.has(id)) {
        throw new Error(`[microapp-loader] Duplicate microapp id "${id}" — found in ${mod.dir}`);
      }
      seenIds.add(id);
    }
  }

  for (const mod of microapps) {
    if (mod.manifest.type === "microapp") {
      await loadMicroappModule(mod, deps);
    }
  }
}

export async function reloadMicroapps(deps: MicroappHostDeps): Promise<{ reloaded: number; clearedCommands: number; clearedSnapshots: number }> {
  const clearedCommands = deps.commands.clearDynamicCommands((command) => command.id.startsWith("microapp."));
  const clearedSnapshots = clearDynamicSnapshots();
  await loadRuntimeMicroapps(deps);
  const reloaded = deps.commands.list().filter((command) => command.id.startsWith("microapp.")).length;
  return { reloaded, clearedCommands, clearedSnapshots };
}

/**
 * Load all external microapps. Convenience wrapper for the two-phase approach.
 * If deps are not provided, only themes are loaded.
 */
export async function loadMicroapps(deps?: MicroappHostDeps): Promise<void> {
  await loadThemes();
  if (deps) {
    await loadRuntimeMicroapps(deps);
  }
}
