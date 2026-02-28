import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT, SPIKE_ROOT } from "../core/config.js";
import type { BackroomsChannel, BrowserEntry } from "../core/types.js";

export class BackroomsService {
  resolveLaunchMode(requestedMode?: BackroomsChannel["mode"]): "live" | "fake-live" {
    const raw = (requestedMode ?? process.env.WIBWOB_BACKROOMS_MODE ?? "auto").toString().trim().toLowerCase();
    if (raw === "fake-live") {
      return "fake-live";
    }
    return "live";
  }

  resolveBackroomsPath(): string {
    for (const candidate of [
      process.env.WIBWOB_BACKROOMS_PATH,
      path.resolve(REPO_ROOT, "..", "wibandwob-backrooms"),
      "../wibandwob-backrooms"
    ]) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return path.resolve(REPO_ROOT, "..", "wibandwob-backrooms");
  }

  resolveCliCommand(): { command: string; args: string[] } {
    const bunPath = process.env.BUN || "bun";
    return {
      command: bunPath,
      args: ["src/ui/cli-v3.ts"]
    };
  }

  collectPrimers(): BrowserEntry[] {
    const seen = new Map<string, BrowserEntry>();

    const scanDir = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) {
        return;
      }
      for (const name of fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b))) {
        if (!name.endsWith(".txt")) {
          continue;
        }
        const label = name.replace(/\.txt$/, "");
        seen.set(label, {
          label,
          filePath: path.join(dirPath, name)
        });
      }
    };

    const backroomsPath = this.resolveBackroomsPath();
    scanDir(path.join(backroomsPath, "primers"));

    // Higher-precedence WibWob primers overwrite bundled backrooms primers on basename collisions.
    for (const root of ["modules", "modules-private"] as const) {
      const modulesRoot = path.join(REPO_ROOT, root);
      if (!fs.existsSync(modulesRoot)) {
        continue;
      }
      for (const entry of fs.readdirSync(modulesRoot).sort((a, b) => a.localeCompare(b))) {
        scanDir(path.join(modulesRoot, entry, "primers"));
      }
    }

    return [...seen.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  collectPlaybackFiles(): BrowserEntry[] {
    const backroomsPath = this.resolveBackroomsPath();
    const entries: BrowserEntry[] = [];
    for (const dirPath of [path.join(backroomsPath, "art", "outputs"), path.join(backroomsPath, "outputs"), path.join(backroomsPath, "primers")]) {
      if (!fs.existsSync(dirPath)) {
        continue;
      }
      for (const name of fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b))) {
        if (!name.endsWith(".txt")) {
          continue;
        }
        entries.push({
          label: name.replace(/\.txt$/, ""),
          filePath: path.join(dirPath, name)
        });
      }
    }
    return entries;
  }

  prepareRunRoot(channel: BackroomsChannel): string {
    const runId = new Date().toISOString().replace(/[:.]/g, "-");
    const runRoot = path.join(SPIKE_ROOT, "scratch", "backrooms-runs", runId);
    const primersDir = path.join(runRoot, "primers");
    const outputsDir = path.join(runRoot, "outputs");
    const logsDir = path.join(runRoot, "logs");
    fs.mkdirSync(primersDir, { recursive: true });
    fs.mkdirSync(outputsDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    const allPrimers = this.collectPrimers();
    const byName = new Map(allPrimers.map((entry) => [entry.label, entry.filePath]));
    const backroomsPrimersDir = path.join(this.resolveBackroomsPath(), "primers");

    for (const entry of fs.readdirSync(backroomsPrimersDir).filter((name) => name.endsWith(".txt")).sort((a, b) => a.localeCompare(b))) {
      this.linkOrCopy(path.join(backroomsPrimersDir, entry), path.join(primersDir, entry));
    }

    for (const entry of allPrimers) {
      this.linkOrCopy(entry.filePath, path.join(primersDir, `${entry.label}.txt`));
    }

    for (const name of this.extractSpecificPrimerNames(channel.primers)) {
      const sourcePath = byName.get(name);
      if (!sourcePath) {
        continue;
      }
      this.linkOrCopy(sourcePath, path.join(primersDir, `${name}.txt`), true);
    }

    return runRoot;
  }

  buildCliArgs(channel: BackroomsChannel): string[] {
    const args = [
      ...this.resolveCliCommand().args,
      channel.theme,
      "--turns",
      String(channel.turns),
      "--model",
      channel.model,
      "--raw"
    ];

    if (channel.primers.trim()) {
      args.push("--primers", channel.primers.trim());
    }

    return args;
  }

  private extractSpecificPrimerNames(primersCsv: string): string[] {
    return primersCsv
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => !/^(none|random:\d+|dynamic:\d+|agentic:\d+|agentic:threshold:[\d.]+)$/i.test(value));
  }

  private linkOrCopy(sourcePath: string, targetPath: string, overwrite = false): void {
    if (overwrite && fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
    }
    if (!overwrite && fs.existsSync(targetPath)) {
      return;
    }
    try {
      fs.symlinkSync(sourcePath, targetPath);
    } catch {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  createLogPath(theme: string): string {
    const safeTheme = theme.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "backrooms";
    const dir = path.join(REPO_ROOT, "logs", "backrooms-tv");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(dir, `${stamp}_${safeTheme}.txt`);
  }

  sanitizeOutputChunk(chunk: string): string {
    return chunk
      .replace(/^\[dotenv@[^\n]*\n?/gm, "")
      .replace(/\r/g, "");
  }

  buildPlaybackStream(channel: BackroomsChannel, count = 3): { labels: string[]; lines: string[] } {
    const playbackFiles = this.selectPlaybackFiles(channel, count);
    if (playbackFiles.length === 0) {
      return { labels: [], lines: [] };
    }
    const lines = playbackFiles.flatMap((entry, index) => {
      const divider = [
        "",
        `+---------------- BACKROOMS ${count > 1 ? "SIMULATED" : "PLAYBACK"} ${index + 1}/${playbackFiles.length}: ${entry.label} ----------------+`,
        ""
      ];
      return divider.concat(fs.readFileSync(entry.filePath, "utf8").split("\n"));
    });
    return {
      labels: playbackFiles.map((entry) => entry.label),
      lines
    };
  }

  selectPlaybackFile(channel: BackroomsChannel): BrowserEntry | undefined {
    return this.selectPlaybackFiles(channel, 1)[0];
  }

  selectPlaybackFiles(channel: BackroomsChannel, count = 3): BrowserEntry[] {
    const files = this.collectPlaybackFiles();
    if (files.length === 0) {
      return [];
    }
    const query = `${channel.theme} ${channel.primers}`.toLowerCase();
    const scored = files.map((entry) => ({
      entry,
      score: query.split(/\s+/).filter(Boolean).reduce((total, token) => total + (entry.label.toLowerCase().includes(token) ? 1 : 0), 0)
    }));
    scored.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
    return scored.slice(0, Math.max(1, count)).map((item) => item.entry);
  }
}
