/**
 * Module Runtime Service — tracks lifecycle of loaded modules.
 *
 * Sits on top of module-loader. After loadModules() runs, this service
 * discovers what was loaded and tracks status, owned windows, commands.
 * Provides /modules/list, /modules/unload, /modules/reload.
 */

import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "../core/config.js";
import type { MicroappHostDeps } from "./module-loader.js";
import { loadThemes } from "./module-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleStatus = "loaded" | "error" | "unloaded";

export interface ModuleInfo {
  name: string;
  version: string;
  type: string;
  status: ModuleStatus;
  loadedAt: string | null;
  error?: string;
  commands: string[];
  windowIds: number[];
}

interface ModuleManifest {
  name: string;
  version: string;
  description: string;
  type: "content" | "prompt" | "theme" | "microapp" | "data";
  entry?: string;
  microapp?: {
    id: string;
    title: string;
    description?: string;
    multiInstance?: boolean;
    persist?: boolean;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
    agent?: boolean;
    api?: boolean;
  };
}

interface DiscoveredModule {
  dir: string;
  manifest: ModuleManifest;
}

interface TrackedModule {
  discovered: DiscoveredModule;
  status: ModuleStatus;
  loadedAt: string | null;
  error?: string;
  commands: string[];
  windowIds: number[];
}

// ---------------------------------------------------------------------------
// Discovery (mirrors module-loader)
// ---------------------------------------------------------------------------

const MODULE_DIRS = ["modules", "modules-private"] as const;

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
        if (!manifest.name || !manifest.type) continue;
        found.push({ dir: path.join(rootPath, name), manifest });
      } catch {
        // skip invalid manifests
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ModuleRuntimeService {
  private tracked = new Map<string, TrackedModule>();
  private deps?: MicroappHostDeps;
  private devMode = false;
  private watcher?: fs.FSWatcher;

  /**
   * Initialize tracking from already-discovered modules.
   * Call AFTER loadModules() has run — this scans discovered manifests
   * and marks microapps as loaded (since loadModules succeeded).
   */
  initFromDiscovery(deps: MicroappHostDeps): void {
    this.deps = deps;
    this.devMode = process.env.DEV === "true" || process.argv.includes("--dev");

    const modules = discoverModules();
    const now = new Date().toISOString();

    for (const mod of modules) {
      if (mod.manifest.type !== "microapp") continue;
      const config = mod.manifest.microapp;
      if (!config?.id) continue;

      // Find commands registered by this module
      const prefix = `microapp.${config.id}.`;
      const registeredCommands: string[] = [];
      try {
        const allCmds = deps.commands.list("api");
        for (const cmd of allCmds) {
          if (cmd.id.startsWith(prefix)) {
            registeredCommands.push(cmd.id);
          }
        }
      } catch {
        // command listing might not be available yet
      }

      this.tracked.set(mod.manifest.name, {
        discovered: mod,
        status: registeredCommands.length > 0 ? "loaded" : "loaded",
        loadedAt: now,
        commands: registeredCommands,
        windowIds: [],
      });
    }

    if (this.devMode) {
      this.startFileWatch();
    }
  }

  /** List all tracked modules for /modules/list */
  list(): ModuleInfo[] {
    return Array.from(this.tracked.values()).map(t => ({
      name: t.discovered.manifest.name,
      version: t.discovered.manifest.version || "0.0.0",
      type: t.discovered.manifest.type,
      status: t.status,
      loadedAt: t.loadedAt,
      error: t.error,
      commands: t.commands,
      windowIds: t.windowIds,
    }));
  }

  /** Unload a module: close windows, remove commands */
  unload(name: string): { ok: boolean; error?: string } {
    const tracked = this.tracked.get(name);
    if (!tracked) return { ok: false, error: "not found" };
    if (tracked.status === "unloaded") return { ok: true };

    // Close owned windows
    if (this.deps) {
      for (const winId of [...tracked.windowIds]) {
        try { this.deps.windowManager.closeWindow(winId); } catch { /* already closed */ }
      }
    }

    // Remove registered commands
    if (this.deps) {
      for (const cmdId of tracked.commands) {
        try { this.deps.commands.removeDynamic(cmdId); } catch { /* already removed */ }
      }
    }

    tracked.status = "unloaded";
    tracked.windowIds = [];
    tracked.commands = [];
    console.log(`[module-runtime] Unloaded: ${name}`);
    return { ok: true };
  }

  /** Reload a module: unload, re-import from disk, re-run setup */
  async reload(name: string): Promise<{ ok: boolean; error?: string }> {
    const tracked = this.tracked.get(name);
    if (!tracked) return { ok: false, error: "not found" };
    if (!this.deps) return { ok: false, error: "no deps available" };

    // Unload first
    this.unload(name);

    // Re-discover to get fresh manifest
    const modules = discoverModules();
    const fresh = modules.find(m => m.manifest.name === name);
    if (!fresh) return { ok: false, error: "module not found on disk" };

    const config = fresh.manifest.microapp;
    if (!config?.id || !config?.title) return { ok: false, error: "invalid microapp config" };

    const entry = fresh.manifest.entry ?? "index.ts";
    const entryPath = path.join(fresh.dir, entry);
    if (!fs.existsSync(entryPath)) return { ok: false, error: `entry file not found: ${entry}` };

    try {
      // Cache-bust import
      const imported = await import(`${entryPath}?t=${Date.now()}`);
      const setup = imported.default;
      if (typeof setup !== "function") return { ok: false, error: "no default export setup function" };

      // Re-use existing loadMicroapps flow by importing module-loader
      const { loadMicroappSingle } = await import("./module-loader.js");
      await loadMicroappSingle(fresh, this.deps);

      // Update tracking
      const prefix = `microapp.${config.id}.`;
      const cmds: string[] = [];
      try {
        for (const cmd of this.deps.commands.list("api")) {
          if (cmd.id.startsWith(prefix)) cmds.push(cmd.id);
        }
      } catch { /* ignore */ }

      this.tracked.set(name, {
        discovered: fresh,
        status: "loaded",
        loadedAt: new Date().toISOString(),
        commands: cmds,
        windowIds: [],
      });

      console.log(`[module-runtime] Reloaded: ${config.id}`);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.tracked.set(name, {
        discovered: fresh,
        status: "error",
        loadedAt: null,
        error: msg,
        commands: [],
        windowIds: [],
      });
      return { ok: false, error: msg };
    }
  }

  /** File watcher for dev mode auto-reload */
  private startFileWatch(): void {
    const modulesDir = path.join(APP_ROOT, "modules");
    if (!fs.existsSync(modulesDir)) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();

    this.watcher = fs.watch(modulesDir, { recursive: true }, (_event, filename) => {
      if (!filename || !filename.endsWith(".ts")) return;

      const parts = filename.split(path.sep);
      if (parts.length < 1) return;
      const moduleDirName = parts[0];

      for (const [name, tracked] of this.tracked) {
        if (tracked.discovered.dir.endsWith(moduleDirName)) {
          pending.add(name);
          break;
        }
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        for (const name of pending) {
          console.log(`[module-watch] reloading ${name}`);
          await this.reload(name);
        }
        pending.clear();
      }, 500);
    });
  }

  stop(): void {
    this.watcher?.close();
  }
}
