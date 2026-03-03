/**
 * Module loader — discovers and loads modules from modules/ and modules-private/.
 *
 * Scans both directories for subdirectories containing module.json manifests.
 * Routes by manifest type:
 *   - "theme"    → dynamic-import theme.ts, register variant
 *   - "microapp" → (Phase 1) dynamic-import entry, call setup(host)
 *   - "content"  → no-op here (primer discovery handled by ContentService)
 *   - "prompt"   → no-op here (prompt files read directly by consumers)
 *   - "data"     → no-op here (data files read directly by consumers)
 *
 * Discovery order: directories sorted alphabetically by name.
 * Duplicate module ids fail-fast at load time.
 */

import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "../core/config.js";
import { registerExternalTheme } from "../core/theme/resolver.js";
import type { ThemeVariant } from "../core/theme/types.js";

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

/** Microapp-specific manifest fields (Phase 1). */
interface MicroappManifestConfig {
  id: string;
  title: string;
  description?: string;
  persist?: boolean;
  menu?: { category: string; order: number; label?: string }[];
  palette?: { order: number; label?: string };
  agent?: boolean;
  api?: boolean;
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

    // Find the exported ThemeVariant — accept default export or first named export
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
// Public API
// ---------------------------------------------------------------------------

/** Load all discovered modules. Call once at startup before workspace restore. */
export async function loadModules(): Promise<void> {
  const modules = discoverModules();
  const seenIds = new Set<string>();

  // Check for duplicate ids across microapp modules
  for (const mod of modules) {
    if (mod.manifest.type === "microapp" && mod.manifest.microapp?.id) {
      const id = mod.manifest.microapp.id;
      if (seenIds.has(id)) {
        throw new Error(`[module-loader] Duplicate microapp id "${id}" — found in ${mod.dir}. Fail-fast: remove the duplicate.`);
      }
      seenIds.add(id);
    }
  }

  // Load theme modules
  for (const mod of modules) {
    if (mod.manifest.type === "theme") {
      await loadThemeModule(mod);
    }
  }

  // Phase 1: microapp loading will go here
  // for (const mod of modules) {
  //   if (mod.manifest.type === "microapp") {
  //     await loadMicroappModule(mod);
  //   }
  // }
}
