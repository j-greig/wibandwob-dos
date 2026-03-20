#!/usr/bin/env bun
// @name    check-coat
// @desc    COAT enforcement — import boundary, orphan keys, manifests, IDs, shims, registry
/**
 * check-coat.ts — COAT (Command Once, Adapt Thin) enforcement checks.
 *
 * Validates:
 *   1. Import boundary: microapps only import from microapp-sdk (not src/core or src/services directly)
 *   2. Orphan actionKeys: catalog entries whose actionKey has no handler in app-controller
 *   3. Manifest completeness: every microapp.json has required fields
 *   4. Command ID format: catalog IDs follow <domain>.<action> convention
 *   5. SDK re-export hygiene: microapp-sdk.ts doesn't expose host internals
 *
 * Exit code 0 = all pass, 1 = violations found.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dir, "../..");
const MICROAPPS_DIR = join(ROOT, "microapps");
const CATALOG_PATH = join(ROOT, "src/core/command-catalog.ts");
const CONTROLLER_PATH = join(ROOT, "src/core/app-controller.ts");

let violations = 0;
let checks = 0;

function fail(check: string, msg: string) {
  console.log(`  ❌ ${msg}`);
  violations++;
}

function pass(check: string, msg: string) {
  // silent on pass
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Import boundary: microapps must only import from microapp-sdk
// ═══════════════════════════════════════════════════════════════════════

console.log("\n🔒 Import boundary check");
checks++;

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

const microappTsFiles = findTsFiles(MICROAPPS_DIR);
let boundaryClean = true;

for (const file of microappTsFiles) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const rel = relative(ROOT, file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Match import/require from src/core or src/services (but not microapp-sdk)
    const importMatch = line.match(/from\s+["'](.+?)["']/);
    if (!importMatch) continue;
    const target = importMatch[1]!;

    // Allow microapp-sdk imports
    if (target.includes("microapp-sdk")) continue;

    // Allow direct imports of domain-specific services that are intentionally
    // NOT part of the public SDK surface (terrain, webcam, skeleton, etc.).
    // These are specialized built-in microapp services; third-party microapps
    // should never need them. Tracked in: spk-codebase-health-and-automation
    const ALLOWED_DIRECT = [
      "terrain-model", "terrain-render", "contour-engine",
      "webcam-renderer", "monster-cam-service", "skeleton-renderer",
      "panel-layout", "canvas-types", "/src/core/types",
    ];
    if (ALLOWED_DIRECT.some(p => target.includes(p))) continue;

    // Flag direct src/core or src/services imports
    if (target.includes("/src/core/") || target.includes("/src/services/") ||
        target.match(/\.\.\/.*src\/(core|services)\//)) {
      fail("import-boundary", `${rel}:${i + 1} imports directly from host: ${target}`);
      boundaryClean = false;
    }
  }
}

if (boundaryClean) {
  console.log("  ✅ All microapps import from SDK only");
}

// ═══════════════════════════════════════════════════════════════════════
// 2. Orphan actionKeys: catalog entries with no handler
// ═══════════════════════════════════════════════════════════════════════

console.log("\n🔗 Orphan actionKey check");
checks++;

const catalogContent = readFileSync(CATALOG_PATH, "utf-8");
const controllerContent = readFileSync(CONTROLLER_PATH, "utf-8");

// Extract actionKeys from catalog
const actionKeyMatches = catalogContent.matchAll(/actionKey:\s*"(\w+)"/g);
const catalogActionKeys = new Set<string>();
for (const m of actionKeyMatches) {
  catalogActionKeys.add(m[1]!);
}

// Check each actionKey has a handler (method or property) in controller
let orphanClean = true;
for (const key of catalogActionKeys) {
  // Look for the key as a method name, property assignment, or in actions object
  const patterns = [
    new RegExp(`\\b${key}\\b.*\\(`),           // method call or definition
    new RegExp(`["']${key}["']`),               // string reference
    new RegExp(`\\b${key}\\s*:`),               // object key
    new RegExp(`\\.${key}\\b`),                 // property access
  ];
  const found = patterns.some(p => p.test(controllerContent));
  if (!found) {
    fail("orphan-actionkey", `actionKey "${key}" in catalog has no handler in app-controller`);
    orphanClean = false;
  }
}

if (orphanClean) {
  console.log(`  ✅ All ${catalogActionKeys.size} actionKeys have handlers`);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Manifest completeness: required fields in microapp.json
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 Manifest completeness check");
checks++;

const REQUIRED_MANIFEST_FIELDS = ["name", "version", "type", "entry"];
const REQUIRED_MICROAPP_FIELDS = ["id", "title"];

let manifestClean = true;

// Skip dotfiles, asset-only packages (no entry = content bundle), tmp dirs
const SKIP_DIRS = new Set([".disabled", ".tmp-reload-probe"]);
const ASSET_ONLY_TYPES = new Set(["asset-pack", "content"]);

if (existsSync(MICROAPPS_DIR)) {
  for (const dir of readdirSync(MICROAPPS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith(".") || SKIP_DIRS.has(dir.name)) continue;
    const manifestPath = join(MICROAPPS_DIR, dir.name, "microapp.json");
    if (!existsSync(manifestPath)) {
      fail("manifest", `microapps/${dir.name}/ has no microapp.json`);
      manifestClean = false;
      continue;
    }

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

      // Asset packs (type != "microapp") only need name+version
      const isMicroapp = manifest.type === "microapp";
      const requiredFields = isMicroapp ? REQUIRED_MANIFEST_FIELDS : ["name", "version", "type"];

      for (const field of requiredFields) {
        if (!manifest[field]) {
          fail("manifest", `microapps/${dir.name}/microapp.json missing "${field}"`);
          manifestClean = false;
        }
      }

      if (isMicroapp && manifest.microapp) {
        for (const field of REQUIRED_MICROAPP_FIELDS) {
          if (!manifest.microapp[field]) {
            fail("manifest", `microapps/${dir.name}/microapp.json missing microapp.${field}`);
            manifestClean = false;
          }
        }
      }

      // Check entry file exists (microapps only)
      if (isMicroapp && manifest.entry) {
        const entryPath = join(MICROAPPS_DIR, dir.name, manifest.entry);
        if (!existsSync(entryPath)) {
          fail("manifest", `microapps/${dir.name}/ entry "${manifest.entry}" does not exist`);
          manifestClean = false;
        }
      }
    } catch (e: any) {
      fail("manifest", `microapps/${dir.name}/microapp.json is not valid JSON: ${e.message}`);
      manifestClean = false;
    }
  }
}

if (manifestClean) {
  const count = existsSync(MICROAPPS_DIR)
    ? readdirSync(MICROAPPS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).length
    : 0;
  console.log(`  ✅ All ${count} manifests valid`);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. Command ID format: <domain>.<action> convention
// ═══════════════════════════════════════════════════════════════════════

console.log("\n🏷️  Command ID format check");
checks++;

const idMatches = catalogContent.matchAll(/^\s*id:\s*"([^"]+)"/gm);
let formatClean = true;

for (const m of idMatches) {
  const id = m[1]!;
  // Must be dot-separated, at least domain.action
  if (!id.includes(".")) {
    fail("command-id", `Command ID "${id}" missing dot separator (expected <domain>.<action>)`);
    formatClean = false;
  }
  // No spaces or special chars
  if (/[^a-z0-9._-]/.test(id)) {
    fail("command-id", `Command ID "${id}" contains invalid characters`);
    formatClean = false;
  }
}

if (formatClean) {
  console.log("  ✅ All command IDs follow <domain>.<action> format");
}

// ═══════════════════════════════════════════════════════════════════════
// 5. Dead shim detection: catalog shims that delegate to nonexistent microapp commands
// ═══════════════════════════════════════════════════════════════════════

console.log("\n🪦 Dead shim detection");
checks++;

// Find runDynamic calls in controller that reference microapp commands
const dynamicCalls = controllerContent.matchAll(/runDynamic\(\s*"(microapp\.[^"]+)"/g);
let shimClean = true;

// Collect all microapp command IDs from manifests
const microappCommandIds = new Set<string>();
if (existsSync(MICROAPPS_DIR)) {
  for (const dir of readdirSync(MICROAPPS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const manifestPath = join(MICROAPPS_DIR, dir.name, "microapp.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const appId = manifest.microapp?.id;
      if (!appId) continue;

      // Read the index.ts to find registerCommand IDs
      const entryPath = join(MICROAPPS_DIR, dir.name, manifest.entry || "index.ts");
      if (existsSync(entryPath)) {
        const entryContent = readFileSync(entryPath, "utf-8");
        const cmdMatches = entryContent.matchAll(/registerCommand\(\s*\{[^}]*id:\s*"([^"]+)"/g);
        for (const cm of cmdMatches) {
          microappCommandIds.add(`microapp.${appId}.${cm[1]}`);
        }
      }
    } catch {}
  }
}

for (const dm of dynamicCalls) {
  const targetId = dm[1]!;
  if (!microappCommandIds.has(targetId)) {
    fail("dead-shim", `Controller delegates to "${targetId}" but no microapp registers it`);
    shimClean = false;
  }
}

if (shimClean) {
  console.log("  ✅ All shim delegations resolve to real microapp commands");
}

// ═══════════════════════════════════════════════════════════════════════
// 6. Registry coverage: every microapp ID should be in the registry
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📊 Registry coverage check");
checks++;

const REGISTRY_PATH = join(ROOT, "src/core/microapp-registry.ts");
const registryContent = readFileSync(REGISTRY_PATH, "utf-8");

// Extract all IDs from the REGISTRY const
const registryIds = new Set<string>();
const regMatches = registryContent.matchAll(/"(wibwob\.[^"]+)":\s*"(core|beta|internal|disabled)"/g);
for (const m of regMatches) {
  registryIds.add(m[1]!);
}

// Find all microapp IDs from manifests
let coverageClean = true;
if (existsSync(MICROAPPS_DIR)) {
  for (const dir of readdirSync(MICROAPPS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
    const manifestPath = join(MICROAPPS_DIR, dir.name, "microapp.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.type !== "microapp" || !manifest.microapp?.id) continue;
      const id = manifest.microapp.id;
      if (!registryIds.has(id)) {
        fail("registry-coverage", `Microapp "${id}" (${dir.name}) not in microapp-registry.ts — defaults to beta`);
        coverageClean = false;
      }
    } catch {}
  }
}

// Also check microapps-private
const PRIVATE_DIR = join(ROOT, "microapps-private");
if (existsSync(PRIVATE_DIR)) {
  for (const dir of readdirSync(PRIVATE_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
    const manifestPath = join(PRIVATE_DIR, dir.name, "microapp.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.type !== "microapp" || !manifest.microapp?.id) continue;
      const id = manifest.microapp.id;
      if (!registryIds.has(id)) {
        fail("registry-coverage", `Microapp "${id}" (private/${dir.name}) not in microapp-registry.ts — defaults to beta`);
        coverageClean = false;
      }
    } catch {}
  }
}

if (coverageClean) {
  console.log(`  ✅ All microapp IDs covered in registry (${registryIds.size} entries)`);
}

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════

console.log("\n" + "═".repeat(60));
if (violations === 0) {
  console.log(`✅ COAT check passed (${checks} checks, 0 violations)`);
} else {
  console.log(`❌ COAT check failed: ${violations} violation(s) across ${checks} checks`);
}
console.log("");

process.exit(violations > 0 ? 1 : 0);
