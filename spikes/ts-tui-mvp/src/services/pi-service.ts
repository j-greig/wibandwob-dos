import fs from "node:fs";
import path from "node:path";

import { PI_AGENT_HOME, SPIKE_PI_APPEND_SYSTEM_PATH, SPIKE_PI_THEME_PATH, SPIKE_ROOT } from "../core/config.js";

export interface PiLaunchConfig {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  description: string;
}

export class PiService {
  resolvePiBinary(): string {
    const binaryName = process.platform === "win32" ? "pi.cmd" : "pi";
    return path.join(SPIKE_ROOT, "node_modules", ".bin", binaryName);
  }

  isAvailable(): boolean {
    return fs.existsSync(this.resolvePiBinary());
  }

  createLaunchConfig(cwd: string, baseEnv: Record<string, string>): PiLaunchConfig {
    const piHome = PI_AGENT_HOME;
    fs.mkdirSync(piHome, { recursive: true });

    return {
      command: this.resolvePiBinary(),
      args: [
        "--append-system-prompt",
        SPIKE_PI_APPEND_SYSTEM_PATH,
        "--theme",
        SPIKE_PI_THEME_PATH
      ],
      cwd,
      env: {
        ...baseEnv,
        HOME: baseEnv.HOME || process.env.HOME || piHome,
        PI_CODING_AGENT_DIR: piHome
      },
      description: `Pi coding agent running in ${cwd}`
    };
  }
}
