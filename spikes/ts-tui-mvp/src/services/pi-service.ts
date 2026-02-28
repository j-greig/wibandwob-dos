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
  private resolvePiPackageJson(): string {
    return path.join(SPIKE_ROOT, "node_modules", "@mariozechner", "pi-coding-agent", "package.json");
  }

  resolvePiBinary(): string {
    const binaryName = process.platform === "win32" ? "pi.cmd" : "pi";
    return path.join(SPIKE_ROOT, "node_modules", ".bin", binaryName);
  }

  isAvailable(): boolean {
    return fs.existsSync(this.resolvePiBinary());
  }

  private getInstalledVersion(): string {
    try {
      const raw = fs.readFileSync(this.resolvePiPackageJson(), "utf8");
      const parsed = JSON.parse(raw) as { version?: string };
      return parsed.version ?? "0.0.0";
    } catch {
      return "0.0.0";
    }
  }

  private ensureAgentHome(): void {
    fs.mkdirSync(PI_AGENT_HOME, { recursive: true });
    fs.writeFileSync(
      path.join(PI_AGENT_HOME, "settings.json"),
      `${JSON.stringify({
        quietStartup: true,
        collapseChangelog: true,
        lastChangelogVersion: this.getInstalledVersion(),
        theme: "wibwob-tv",
        terminal: { showImages: false }
      }, null, 2)}\n`,
      "utf8"
    );
  }

  createLaunchConfig(cwd: string, baseEnv: Record<string, string>): PiLaunchConfig {
    this.ensureAgentHome();

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
        HOME: baseEnv.HOME || process.env.HOME || PI_AGENT_HOME,
        PI_CODING_AGENT_DIR: PI_AGENT_HOME,
        PI_SKIP_VERSION_CHECK: "1"
      },
      description: `Pi coding agent running in ${cwd}`
    };
  }

  createChatPromptConfig(cwd: string, baseEnv: Record<string, string>, sessionFile: string, message: string): PiLaunchConfig {
    const launch = this.createLaunchConfig(cwd, baseEnv);
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    return {
      ...launch,
      args: [
        ...launch.args,
        "--session",
        sessionFile,
        "-p",
        message
      ],
      description: "Wib&Wob Chat powered by pi print mode with persistent session state."
    };
  }
}
