import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { BackroomsService } from "./backrooms-service.js";
import { findChromeExecutablePath } from "./chrome-browser-service.js";

export type CapabilityKey =
  | "bin.figlet"
  | "bin.chrome"
  | "path.monster_cam.venv"
  | "path.backrooms.repo"
  | "env.anthropic_api_key"
  /** Inference-required apps (agent, poetry clock). Probes ANTHROPIC_API_KEY. */
  | "feature.inference"
  /** Resource-heavy apps (plasma, companion). Always probes true — gate via profile forceOff. */
  | "feature.resource-heavy"
  /** File manager — disabled in hosted profiles (no filesystem jail). Always probes true; gate via forceOff. */
  | "feature.file-manager";

export interface CapabilityStatus {
  ok: boolean;
  reason?: string;
  source: "probe" | "profile-force-on" | "profile-force-off";
  checkedAt: string;
}

export type CapabilitySnapshot = Record<CapabilityKey, CapabilityStatus>;
export interface MenuStrip {
  id: string;
  reason: string;
}

interface CapabilityProfilePolicy {
  forceOff: CapabilityKey[];
  forceOn: CapabilityKey[];
  stripMenuFrom: MenuStrip[];
}

const CAPABILITY_KEYS: CapabilityKey[] = [
  "bin.figlet",
  "bin.chrome",
  "path.monster_cam.venv",
  "path.backrooms.repo",
  "env.anthropic_api_key",
  "feature.inference",
  "feature.resource-heavy",
  "feature.file-manager",
];

function buildStatus(ok: boolean, reason?: string): CapabilityStatus {
  return {
    ok,
    reason,
    source: "probe",
    checkedAt: new Date().toISOString(),
  };
}

export class CapabilityService {
  private _snapshot: CapabilitySnapshot | null = null;
  private readonly backrooms = new BackroomsService();

  probe(): CapabilitySnapshot {
    if (this._snapshot) {
      return this._snapshot;
    }
    const policy = this.loadProfilePolicy();

    const figletVersion = spawnSync("figlet", ["--version"], { stdio: "ignore" });
    const figletWhich = spawnSync("which", ["figlet"], { stdio: "ignore" });
    const hasFiglet = figletVersion.status === 0 || figletWhich.status === 0;

    const chromePath = findChromeExecutablePath();
    const hasChrome = !!chromePath;

    const monsterCamVenvPath = path.resolve(process.cwd(), "assets", "mediapipe-venv", "bin", "python");
    const hasMonsterCamVenv = fs.existsSync(monsterCamVenvPath);

    const backroomsPath = this.backrooms.resolveBackroomsPath();
    const hasBackroomsPath = fs.existsSync(backroomsPath);

    const hasAnthropicApiKey = !!process.env.ANTHROPIC_API_KEY;

    const snapshot: CapabilitySnapshot = {
      "bin.figlet": buildStatus(hasFiglet, hasFiglet ? undefined : "figlet not found on PATH"),
      "bin.chrome": buildStatus(hasChrome, hasChrome ? undefined : "chrome/chromium executable not found"),
      "path.monster_cam.venv": buildStatus(
        hasMonsterCamVenv,
        hasMonsterCamVenv ? undefined : `missing ${monsterCamVenvPath}`,
      ),
      "path.backrooms.repo": buildStatus(
        hasBackroomsPath,
        hasBackroomsPath ? undefined : `missing ${backroomsPath}`,
      ),
      "env.anthropic_api_key": buildStatus(
        hasAnthropicApiKey,
        hasAnthropicApiKey ? undefined : "ANTHROPIC_API_KEY is not set",
      ),
      // Tier gates — probe infers from env; profiles can override via forceOff/forceOn.
      "feature.inference": buildStatus(
        hasAnthropicApiKey,
        hasAnthropicApiKey ? undefined : "Inference features require ANTHROPIC_API_KEY",
      ),
      // Resource-heavy (plasma, companion) probes true — gate via profile forceOff in lower tiers.
      "feature.resource-heavy": buildStatus(true),
      // File manager probes true — disabled in hosted profiles via forceOff (no filesystem jail).
      "feature.file-manager": buildStatus(true),
    };
    const checkedAt = new Date().toISOString();
    for (const key of policy.forceOn) {
      snapshot[key] = {
        ok: true,
        source: "profile-force-on",
        checkedAt,
      };
    }
    for (const key of policy.forceOff) {
      snapshot[key] = {
        ok: false,
        reason: "disabled by profile",
        source: "profile-force-off",
        checkedAt,
      };
    }

    this._snapshot = snapshot;

    return this._snapshot;
  }

  snapshot(): CapabilitySnapshot {
    return this._snapshot ?? this.probe();
  }

  strippedMenuCommands(): Set<string> {
    return new Set(this.loadProfilePolicy().stripMenuFrom.map((s) => s.id));
  }

  isAvailable(requires?: CapabilityKey[]): { ok: boolean; missing: CapabilityKey[] } {
    if (!requires || requires.length === 0) {
      return { ok: true, missing: [] };
    }
    const current = this.snapshot();
    const missing = requires.filter((key) => !current[key]?.ok);
    return { ok: missing.length === 0, missing };
  }

  private loadProfilePolicy(): CapabilityProfilePolicy {
    const profileName = process.env.WIBWOB_DEPLOY_PROFILE?.trim();
    if (!profileName) {
      return { forceOff: [], forceOn: [], stripMenuFrom: [] };
    }

    const here = path.dirname(new URL(import.meta.url).pathname);
    const candidates = [
      path.resolve(here, "..", "config", "capability-profiles", `${profileName}.json`),
      path.resolve(process.cwd(), "config", "capability-profiles", `${profileName}.json`),
    ];
    const profilePath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!profilePath) {
      // Fail-closed: explicit profile requested but not found — crash startup rather
      // than silently enabling all capabilities (which defeats the profile entirely).
      throw new Error(
        `[capability-service] FATAL: WIBWOB_DEPLOY_PROFILE=${profileName} but no profile file found.\n` +
        `  Searched:\n${candidates.map((c) => `    ${c}`).join("\n")}\n` +
        `  Create the profile file or unset WIBWOB_DEPLOY_PROFILE to run with no profile.`,
      );
    }

    try {
      const raw = fs.readFileSync(profilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CapabilityProfilePolicy>;
      console.log(`[capability-service] profile loaded: ${profileName} (${profilePath})`);
      const strips = Array.isArray(parsed.stripMenuFrom) ? parsed.stripMenuFrom : [];
      if (strips.length) {
        console.log(`[capability-service] stripMenuFrom: ${strips.map((s) => `${s.id} (${s.reason})`).join(", ")}`);
      }
      return {
        forceOff: this.filterCapabilityKeys(parsed.forceOff),
        forceOn: this.filterCapabilityKeys(parsed.forceOn),
        stripMenuFrom: strips,
      };
    } catch (error) {
      // Fail-closed: profile found but unreadable/invalid JSON — crash rather than open.
      throw new Error(
        `[capability-service] FATAL: Failed to load capability profile '${profileName}' at ${profilePath}: ${String(error)}\n` +
        `  Fix the profile file or unset WIBWOB_DEPLOY_PROFILE.`,
      );
    }
  }

  private filterCapabilityKeys(keys: unknown): CapabilityKey[] {
    if (!Array.isArray(keys)) return [];
    return keys.filter((key): key is CapabilityKey => CAPABILITY_KEYS.includes(key as CapabilityKey));
  }
}

export const capabilityService = new CapabilityService();
