/**
 * Signal Scanner — fake radio/signal scanning surface.
 *
 * Spectrum sweep, 8 channel rows with LevelMeter + Waveform + Badge,
 * main tuned channel waveform, knobs for scan/squelch/gain,
 * StepMatrix as signal-event log. All deterministic pseudo-random.
 */

import type { MicroappHost } from "#sdk";

// Seeded pseudo-random for reproducibility
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Signal Scanner",
    menu: [{ category: "applications", order: 70, label: "Signal Scanner" }],
    palette: { order: 185 },
    action: () => {
      const win = host.createWindow({
        title: "Signal Scanner",
        width: 78,
        height: 34,
      });

      const rng = mulberry32(42);
      let tick = 0;
      let scanSpeed = 50;
      let squelch = 30;
      let gain = 70;
      let tunedChannel = 0;

      const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

      // 8 channels with drifting frequencies
      const channels = Array.from({ length: 8 }, (_, i) => ({
        freq: 88.1 + i * 12.5 + rng() * 5,
        baseStrength: rng() * 0.7 + 0.1,
        drift: rng() * 0.02,
        phase: rng() * Math.PI * 2,
      }));

      // Signal event log: 8 channels x 16 timesteps
      const eventLog: boolean[][] = Array.from({ length: 8 }, () =>
        Array.from({ length: 16 }, () => false)
      );

      function channelLevel(ch: number, t: number): number {
        const c = channels[ch];
        const base = c.baseStrength + Math.sin(t * c.drift + c.phase) * 0.2;
        const noise = Math.sin(t * 0.7 + ch * 3.1) * 0.1;
        return Math.max(0, Math.min(1, (base + noise) * (gain / 100)));
      }

      function channelStatus(level: number): string {
        if (level > squelch / 100 + 0.3) return "LOCK";
        if (level > squelch / 100) return "CARRIER";
        return "NOISE";
      }

      function genWaveform(ch: number, t: number): number[] {
        const samples: number[] = [];
        const c = channels[ch];
        const waveType = ch % 3; // sine, square, sawtooth
        for (let i = 0; i < 40; i++) {
          const x = (i / 40) * Math.PI * 4 + t * 0.1 + c.phase;
          let v: number;
          if (waveType === 0) v = Math.sin(x);
          else if (waveType === 1) v = Math.sign(Math.sin(x));
          else v = ((x % (Math.PI * 2)) / Math.PI) - 1;
          samples.push(v * channelLevel(ch, t));
        }
        return samples;
      }

      function renderMiniWave(samples: number[], w: number): string {
        return samples.slice(0, w).map(v => {
          const idx = Math.round(((v + 1) / 2) * (SPARK.length - 1));
          return SPARK[Math.max(0, Math.min(SPARK.length - 1, idx))];
        }).join("");
      }

      function renderSpectrum(t: number, w: number, h: number): string[] {
        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          let line = "";
          const threshold = 1 - ((row + 0.5) / h);
          for (let col = 0; col < w; col++) {
            const freq = col / w;
            const val = Math.max(0, Math.min(1,
              Math.sin(freq * 10 + t * 0.15 * (scanSpeed / 50)) * 0.3 + 0.3 +
              Math.sin(freq * 30 + t * 0.05) * 0.15 +
              // Signal peaks at channel frequencies
              channels.reduce((sum, ch, i) => {
                const chPos = i / 8;
                const dist = Math.abs(freq - chPos);
                return sum + (dist < 0.05 ? channelLevel(i, t) * (1 - dist / 0.05) * 0.4 : 0);
              }, 0)
            ));
            if (val >= threshold + (1 / h)) line += "█";
            else if (val >= threshold) {
              const frac = (val - threshold) * h;
              const idx = Math.round(frac * (SPARK.length - 1));
              line += SPARK[Math.max(0, Math.min(SPARK.length - 1, idx))];
            } else line += " ";
          }
          lines.push(line);
        }
        return lines;
      }

      function renderKnob(value: number, min: number, max: number, label: string): string[] {
        const ratio = (value - min) / ((max - min) || 1);
        const filled = Math.round(ratio * 6);
        const arc = "━".repeat(filled) + "○" + "─".repeat(6 - filled);
        return [
          `╭${arc}╮`,
          `│ ${String(Math.round(value)).padStart(4)} │`,
          `╰───────╯`,
          ` ${label}`,
        ];
      }

      function render() {
        const bodyW = (Number(win.body.width) || 76) - 2;
        const content: string[] = [];

        content.push("  ┌─ Frequency Sweep " + "─".repeat(Math.max(0, bodyW - 22)) + "┐");
        const specW = Math.max(20, bodyW - 4);
        const spec = renderSpectrum(tick, specW, 4);
        for (const line of spec) content.push("  │ " + line.padEnd(specW).slice(0, specW) + " │");
        content.push("  └" + "─".repeat(bodyW - 2) + "┘");

        // Channel rows
        content.push("  CH  FREQ    LEVEL    WAVEFORM         STATUS");
        content.push("  " + "─".repeat(Math.max(0, bodyW - 2)));
        for (let ch = 0; ch < 8; ch++) {
          const level = channelLevel(ch, tick);
          const status = channelStatus(level);
          const meterFilled = Math.round(level * 8);
          const meter = "█".repeat(meterFilled) + "░".repeat(8 - meterFilled);
          const wave = renderMiniWave(genWaveform(ch, tick), 12);
          const marker = ch === tunedChannel ? "▸" : " ";
          const freq = channels[ch].freq.toFixed(1).padStart(6);
          const badge = status === "LOCK" ? "[LOCK]" : status === "CARRIER" ? "[CARR]" : "[NOIS]";
          content.push(`  ${marker}${ch + 1} ${freq}MHz ${meter}  ${wave}  ${badge}`);

          // Update event log
          if (tick % 4 === 0) {
            eventLog[ch].shift();
            eventLog[ch].push(level > squelch / 100);
          }
        }

        // Tuned channel large waveform
        content.push("");
        content.push(`  ┌─ Tuned: CH${tunedChannel + 1} ${channels[tunedChannel].freq.toFixed(1)}MHz ` + "─".repeat(Math.max(0, bodyW - 30)) + "┐");
        const tunedWave = genWaveform(tunedChannel, tick);
        const waveW = Math.max(10, bodyW - 6);
        for (let row = 0; row < 3; row++) {
          let line = "";
          for (let col = 0; col < waveW; col++) {
            const idx = Math.floor((col / waveW) * tunedWave.length);
            const v = tunedWave[idx] ?? 0;
            const y = ((1 - v) / 2) * 2;
            if (Math.round(y) === row) {
              const bi = Math.round(Math.abs(v) * (SPARK.length - 1));
              line += SPARK[bi];
            } else {
              line += row === 1 ? "·" : " ";
            }
          }
          content.push("  │ " + line.padEnd(waveW).slice(0, waveW) + " │");
        }
        content.push("  └" + "─".repeat(bodyW - 2) + "┘");

        // Signal event log as step matrix
        content.push("  ┌─ Signal Log " + "─".repeat(Math.max(0, 34 - 16)) + "┐");
        for (let ch = 0; ch < 8; ch++) {
          let row = `CH${ch + 1} `;
          for (let s = 0; s < 16; s++) {
            row += eventLog[ch][s] ? "■ " : "· ";
          }
          content.push("  │" + row + "│");
        }
        content.push("  └" + "─".repeat(36) + "┘");

        // Knobs
        const knobs = [
          renderKnob(scanSpeed, 10, 100, "Scan"),
          renderKnob(squelch, 0, 100, "Sqlc"),
          renderKnob(gain, 0, 100, "Gain"),
        ];
        for (let row = 0; row < 4; row++) {
          content.push("  " + knobs.map(k => k[row]).join("  "));
        }

        content.push("  [1-8]tune  [↑↓]gain  [s]can speed  [q]uit");

        win.body.setContent(content.join("\n"));
        host.screen.render();
      }

      win.body.key(["1","2","3","4","5","6","7","8"], (_ch: any, key: any) => {
        tunedChannel = parseInt(key.name || key.ch || "1") - 1;
        if (tunedChannel < 0 || tunedChannel > 7) tunedChannel = 0;
        render();
      });
      win.body.key(["up"], () => { gain = Math.min(100, gain + 5); render(); });
      win.body.key(["down"], () => { gain = Math.max(0, gain - 5); render(); });
      win.body.key(["s"], () => { scanSpeed = scanSpeed >= 90 ? 10 : scanSpeed + 20; render(); });
      win.body.key(["q", "escape"], () => win.close());
      win.onResize(render);

      render();
      const timer = setInterval(() => { tick++; render(); }, 120);
      win.onCleanup(() => clearInterval(timer));

      win.describeState(() => ({
        summary: `Signal Scanner — CH${tunedChannel + 1} ${channels[tunedChannel].freq.toFixed(1)}MHz, gain ${gain}%`,
        tunedChannel,
        gain,
        scanSpeed,
        squelch,
      }));
    },
  });
}
