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
  | "feature.resource-heavy";

export interface CapabilityStatus {
  ok: boolean;
  reason?: string;
  source: "probe" | "profile-force-on" | "profile-force-off";
  checkedAt: string;
}

export type CapabilitySnapshot = Record<CapabilityKey, CapabilityStatus>;
interface CapabilityProfilePolicy {
  forceOff: CapabilityKey[];
  forceOn: CapabilityKey[];
}

const CAPABILITY_KEYS: CapabilityKey[] = [
  "bin.figlet",
  "bin.chrome",
  "path.monster_cam.venv",
  "path.backrooms.repo",
  "env.anthropic_api_key",
  "feature.inference",
  "feature.resource-heavy",
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
      return { forceOff: [], forceOn: [] };
    }

    const here = path.dirname(new URL(import.meta.url).pathname);
    const candidates = [
      path.resolve(here, "..", "config", "capability-profiles", `${profileName}.json`),
      path.resolve(process.cwd(), "config", "capability-profiles", `${profileName}.json`),
    ];
    const profilePath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!profilePath) {
      console.warn(
        `[capability-service] WIBWOB_DEPLOY_PROFILE=${profileName} but no profile file found in: ${candidates.join(", ")}`,
      );
      return { forceOff: [], forceOn: [] };
    }

    try {
      const raw = fs.readFileSync(profilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CapabilityProfilePolicy>;
      return {
        forceOff: this.filterCapabilityKeys(parsed.forceOff),
        forceOn: this.filterCapabilityKeys(parsed.forceOn),
      };
    } catch (error) {
      console.warn(
        `[capability-service] Failed to parse capability profile at ${profilePath}: ${String(error)}`,
      );
      return { forceOff: [], forceOn: [] };
    }
  }

  private filterCapabilityKeys(keys: unknown): CapabilityKey[] {
    if (!Array.isArray(keys)) return [];
    return keys.filter((key): key is CapabilityKey => CAPABILITY_KEYS.includes(key as CapabilityKey));
  }
}

export const capabilityService = new CapabilityService();
