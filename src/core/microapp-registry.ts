/**
 * microapp-registry.ts — Host-side microapp tier classification.
 *
 * COAT principle: the *host operator* decides visibility, not the microapp author.
 * Microapps declare capabilities (commands, manifest). The registry decides presentation.
 *
 * Tiers:
 *   core     — polished, always visible in menu/palette/API/agent
 *   beta     — functional, visible in palette + API, hidden from default menu
 *   internal — dev/demo only, visible only via API with explicit filter
 *   disabled — not loaded at all
 *
 * Unregistered microapps default to "beta" (safe default — visible but not promoted).
 */

export type MicroappTier = "core" | "beta" | "internal" | "disabled";

/**
 * Host-side tier assignments. Microapp ID → tier.
 * Only microapps that differ from the default ("beta") need entries.
 */
const REGISTRY: Record<string, MicroappTier> = {
  // ── Core: polished, always-on ──────────────────────────────────────
  "wibwob.figlet":             "core",
  "wibwob.command-lab":        "core",
  "wibwob.runtime-inspector":  "core",
  "wibwob.world":              "core",
  "wibwob.terminal":           "core",
  "wibwob.chatroom":           "core",
  "wibwob.pi-sessions":        "core",

  // ── Beta: functional, opt-in ───────────────────────────────────────
  "wibwob.plasma":             "beta",
  "wibwob.generative":         "beta",
  "wibwob.workspace-beacon":   "beta",
  "wibwob.poetry-clock":       "core",
  "wibwob.spore-clock":        "beta",
  "wibwob.starfield":          "beta",
  "wibwob.sy2chronicles":      "beta",
  "wibwob.tr808":              "beta",
  "wibwob.pd-player":          "beta",
  "wibwob.wiretext":           "beta",
  "wibwob.zine":               "core",
  "wibwob.terrarium":          "beta",
  "wibwob.tidepool":           "core",
  "wibwob.glitchbox":          "core",
  "wibwob.patchbay":           "core",
  "wibwob.forms-playground":   "core",
  "wibwob.slap-editor":        "beta",
  "wibwob.asciicker":          "beta",
  "wibwob.ansi-lab":           "core",
  "wibwob.symbient-twitter":   "beta",
  "wibwob.llm-orch-studio":    "beta",
  "wibwob.touchlab":           "beta",
  "wibwob.journal":            "core",
  "wibwob.notepad":            "core",
  "wibwob.monster-cam":        "beta",
  "wibwob.theattyr":           "beta",

  // ── Internal: dev/demo/test only ───────────────────────────────────
  "wibwob.demo-dashboards-v2":             "beta",
  "wibwob.layout-probe":                   "internal",
  "wibwob.heartbeat":                      "internal",
  "wibwob.file-manager":                     "core",
  "wibwob.sdk-showcase":                     "beta",
  "wibwob.data-dashboard":                  "internal",
  "wibwob.example.hello":                  "core",
  "wibwob.example.e026":                   "core",
  "wibwob.demo.layout-stress.codex":       "internal",
  "wibwob.layout-stress-test":          "core",

  // ── SDK dev documentation mapps ──────────────────────────────────
  "wibwob.click-counter":               "beta",
  "wibwob.pomodoro":                    "beta",
  "wibwob.dice-roller":                 "beta",
  "wibwob.md-preview":                  "beta",
  "wibwob.sys-monitor":                 "beta",
  "wibwob.color-palette":               "beta",
  "wibwob.ascii-studio":                "beta",
  "wibwob.chat-sim":                    "beta",
  "wibwob.kanban":                      "beta",
  "wibwob.step-seq":                    "beta",
  "wibwob.ascii-rain":                  "beta",
  "wibwob.word-counter":                "beta",
  "wibwob.habit-tracker":               "beta",
};

/** Default tier for microapps not listed in the registry. */
const DEFAULT_TIER: MicroappTier = "beta";

// ── External config (.wibwob/microapps.json) ─────────────────────────

/**
 * Tier overrides loaded from .wibwob/microapps.json at boot.
 * Entries here override both the hardcoded REGISTRY and the DEFAULT_TIER.
 * Format: { "<microapp-id>": "core" | "beta" | "internal" | "disabled" }
 */
let _externalConfig: Record<string, MicroappTier> = {};

/**
 * Load .wibwob/microapps.json as tier overrides for dev/third-party apps.
 * Call once at boot before loading microapps. Safe to call multiple times (idempotent).
 * Missing file is silently ignored (not an error).
 */
export function loadExternalMicroappConfig(configPath: string): void {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(configPath)) return;
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    // Validate tier values — silently skip invalid entries
    _externalConfig = {};
    for (const [id, tier] of Object.entries(parsed)) {
      if (["core", "beta", "internal", "disabled"].includes(tier)) {
        _externalConfig[id] = tier as MicroappTier;
      }
    }
  } catch {
    // Silently ignore parse errors — bad config should not prevent boot
  }
}

// ── Runtime overrides (workspace-level disable) ──────────────────────

let _disabledIds = new Set<string>();
let _disabledTiers = new Set<MicroappTier>();

/**
 * Get the tier for a microapp ID.
 * Returns "disabled" if the ID or its tier is in the disabled set.
 */
export function getMicroappTier(microappId: string): MicroappTier {
  if (_disabledIds.has(microappId)) return "disabled";
  // External config (.wibwob/microapps.json) overrides both REGISTRY and DEFAULT_TIER
  const tier = _externalConfig[microappId] ?? REGISTRY[microappId] ?? DEFAULT_TIER;
  if (_disabledTiers.has(tier)) return "disabled";
  return tier;
}

/**
 * Check if a microapp ID is explicitly registered in the hardcoded REGISTRY.
 * Used to log auto-discovered apps (those relying on DEFAULT_TIER).
 */
export function isMicroappInRegistry(microappId: string): boolean {
  return microappId in REGISTRY || microappId in _externalConfig;
}

/** Check if a microapp should be loaded (not disabled). */
export function isMicroappEnabled(microappId: string): boolean {
  return getMicroappTier(microappId) !== "disabled";
}

/**
 * Check if a microapp's commands should appear on a given surface.
 *
 *   menu:    core only (beta/internal hidden from default menus)
 *   palette: core + beta
 *   api:     core + beta (internal only with explicit filter)
 *   agent:   core + beta
 */
export function isTierVisibleOn(tier: MicroappTier, surface: "menu" | "palette" | "api" | "agent"): boolean {
  if (tier === "disabled") return false;
  switch (surface) {
    case "menu":    return tier === "core";
    case "palette": return tier === "core" || tier === "beta";
    case "api":     return tier === "core" || tier === "beta";
    case "agent":   return tier === "core" || tier === "beta";
  }
}

/**
 * Apply workspace-level overrides. Called during workspace restore.
 * Pass empty sets to clear overrides.
 */
function setDisabledOverrides(
  disabledIds: string[] = [],
  disabledTiers: MicroappTier[] = [],
): void {
  _disabledIds = new Set(disabledIds);
  _disabledTiers = new Set(disabledTiers);
}

/** Get current disabled overrides (for workspace save). */
function getDisabledOverrides(): { disabledIds: string[]; disabledTiers: MicroappTier[] } {
  return {
    disabledIds: [..._disabledIds],
    disabledTiers: [..._disabledTiers],
  };
}

/** Get all registry entries (for inspection/API). */
function getRegistryEntries(): Array<{ id: string; tier: MicroappTier }> {
  return Object.entries(REGISTRY).map(([id, tier]) => ({ id, tier }));
}

/** Get the full registry map (for check-coat and tooling). */
function getRegistry(): Readonly<Record<string, MicroappTier>> {
  return REGISTRY;
}
