/**
 * ASCII Visualizer — WinAMP-style music visualizer.
 *
 * Three modes: Spectrum, Oscilloscope, Waterfall.
 * LevelMeter strip, track info, EQ knobs, beat detection.
 * All at 24fps via pseudo signal math.
 */

import type { MicroappHost } from "#sdk";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "ASCII Visualizer",
    menu: [{ category: "applications", order: 75, label: "ASCII Visualizer" }],
    palette: { order: 190 },
    action: () => {
      const win = host.createWindow({
        title: "ASCII Visualizer",
        width: 72,
        height: 30,
      });

      type VisMode = "spectrum" | "oscilloscope" | "waterfall";
      let mode: VisMode = "spectrum";
      let tick = 0;
      let bass = 50, mid = 50, treble = 50, brightness = 70;
      let beatPattern = 0;
      const BEAT_NAMES = ["4/4", "SWING", "BREAK", "WALTZ"];
      const BEATS_PER_PATTERN = [4, 3, 2, 3];
      const bpm = 128;

      const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      const DENSITY = ["░", "▒", "▓", "█"];
      const MODES: VisMode[] = ["spectrum", "oscilloscope", "waterfall"];

      // Waterfall history buffer
      const waterfallRows: number[][] = [];

      function isBeat(t: number): boolean {
        const beatsPerSec = bpm / 60;
        const beatPhase = (t * beatsPerSec * (41 / 1000)) % BEATS_PER_PATTERN[beatPattern];
        return beatPhase < 0.15;
      }

      function genSignal(freq: number, t: number, amplitude: number): number {
        return Math.sin(freq * t * 0.01) * amplitude;
      }

      function genBins(t: number, count: number): number[] {
        const bins: number[] = [];
        const beat = isBeat(t);
        for (let i = 0; i < count; i++) {
          const freqNorm = i / count;
          // Bass emphasis
          let v = genSignal(1 + i * 0.5, t, 0.3) + 0.4;
          // EQ
          if (freqNorm < 0.25) v *= bass / 50;
          else if (freqNorm < 0.6) v *= mid / 50;
          else v *= treble / 50;
          // Beat boost
          if (beat && freqNorm < 0.3) v *= 1.5;
          // Noise
          v += genSignal(i * 7.3 + 100, t, 0.08);
          // Brightness
          v *= brightness / 70;
          bins.push(Math.max(0, Math.min(1, v)));
        }
        return bins;
      }

      function genWaveform(t: number, w: number): number[] {
        const samples: number[] = [];
        for (let i = 0; i < w; i++) {
          const x = (i / w) * Math.PI * 6 + t * 0.08;
          const v =
            Math.sin(x) * 0.4 * (bass / 50) +
            Math.sin(x * 2.7) * 0.25 * (mid / 50) +
            Math.sin(x * 5.1) * 0.15 * (treble / 50);
          samples.push(v * (brightness / 70));
        }
        return samples;
      }

      function renderSpectrum(t: number, w: number, h: number): string[] {
        const bins = genBins(t, w);
        const beat = isBeat(t);
        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          let line = "";
          const threshold = 1 - ((row + 0.5) / h);
          for (let b = 0; b < bins.length && line.length < w; b++) {
            const val = bins[b];
            if (val >= threshold + (1 / h)) {
              line += beat && val > 0.7 ? "▓" : "█";
            } else if (val >= threshold) {
              const frac = (val - threshold) * h;
              const idx = Math.round(frac * (SPARK.length - 1));
              line += SPARK[Math.max(0, Math.min(SPARK.length - 1, idx))];
            } else {
              line += " ";
            }
          }
          lines.push(line.padEnd(w).slice(0, w));
        }
        return lines;
      }

      function renderOscilloscope(t: number, w: number, h: number): string[] {
        const samples = genWaveform(t, w);
        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          let line = "";
          for (let col = 0; col < w; col++) {
            const v = samples[col];
            const y = ((1 - v) / 2) * (h - 1);
            const cy = Math.round(y);
            if (cy === row) {
              const bi = Math.round(Math.abs(v) * (SPARK.length - 1));
              line += SPARK[bi];
            } else if (row === Math.floor(h / 2)) {
              line += "·";
            } else {
              line += " ";
            }
          }
          lines.push(line);
        }
        return lines;
      }

      function renderWaterfall(t: number, w: number, h: number): string[] {
        // Add new row
        const bins = genBins(t, w);
        waterfallRows.unshift(bins);
        if (waterfallRows.length > h) waterfallRows.length = h;

        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          const rowData = waterfallRows[row];
          if (!rowData) {
            lines.push(" ".repeat(w));
            continue;
          }
          let line = "";
          for (let col = 0; col < w && col < rowData.length; col++) {
            const val = rowData[col];
            const idx = Math.round(val * (DENSITY.length - 1));
            line += DENSITY[Math.max(0, Math.min(DENSITY.length - 1, idx))];
          }
          lines.push(line.padEnd(w).slice(0, w));
        }
        return lines;
      }

      function renderKnobInline(value: number, label: string): string {
        const ratio = value / 100;
        const filled = Math.round(ratio * 6);
        return `${label}[${("━".repeat(filled) + "○" + "─".repeat(6 - filled))}]${String(value).padStart(3)}`;
      }

      function render() {
        const bodyW = (Number(win.body.width) || 70) - 2;
        const visW = Math.max(20, bodyW - 4);
        const visH = 12;
        const content: string[] = [];

        // Track info
        const beat = isBeat(tick);
        const trackInfo = beat ? "▸ SYNTHWAVE DREAMS — ░B░E░A░T░" : "  SYNTHWAVE DREAMS — 128 BPM";
        content.push(`  ${trackInfo}  [${BEAT_NAMES[beatPattern]}]`);

        // Mode tabs
        const tabs = MODES.map(m =>
          m === mode ? ` [${m.toUpperCase()}] ` : `  ${m.toUpperCase()}  `
        ).join("│");
        content.push("  " + tabs);
        content.push("  " + "─".repeat(Math.max(0, bodyW - 2)));

        // Visualizer
        let visLines: string[];
        if (mode === "spectrum") visLines = renderSpectrum(tick, visW, visH);
        else if (mode === "oscilloscope") visLines = renderOscilloscope(tick, visW, visH);
        else visLines = renderWaterfall(tick, visW, visH);

        for (const line of visLines) {
          content.push("  " + line);
        }

        content.push("  " + "─".repeat(Math.max(0, bodyW - 2)));

        // Stereo level meter
        const levelL = 0.5 + Math.sin(tick * 0.15) * 0.3 + (beat ? 0.15 : 0);
        const levelR = 0.5 + Math.sin(tick * 0.15 + 0.5) * 0.3 + (beat ? 0.15 : 0);
        const meterW = Math.max(10, bodyW - 10);
        const lFilled = Math.round(Math.min(1, levelL) * meterW);
        const rFilled = Math.round(Math.min(1, levelR) * meterW);
        content.push(`  L ${"█".repeat(lFilled)}${"░".repeat(meterW - lFilled)}`);
        content.push(`  R ${"█".repeat(rFilled)}${"░".repeat(meterW - rFilled)}`);

        // EQ knobs
        content.push(`  ${renderKnobInline(bass, "Bass  ")}  ${renderKnobInline(mid, "Mid   ")}  ${renderKnobInline(treble, "Treble")}`);
        content.push(`  ${renderKnobInline(brightness, "Bright")}   Beat: ${BEAT_NAMES[beatPattern]}`);

        // Controls
        content.push("  [Tab]mode  [b]eat  [↑↓]bright  [1]bass  [2]mid  [3]treble  [q]uit");

        win.body.setContent(content.join("\n"));
        host.screen.render();
      }

      win.body.key(["tab"], () => {
        const idx = MODES.indexOf(mode);
        mode = MODES[(idx + 1) % MODES.length];
        render();
      });
      win.body.key(["b"], () => {
        beatPattern = (beatPattern + 1) % BEAT_NAMES.length;
        render();
      });
      win.body.key(["up"], () => { brightness = Math.min(100, brightness + 5); render(); });
      win.body.key(["down"], () => { brightness = Math.max(0, brightness - 5); render(); });
      win.body.key(["1"], () => { bass = bass >= 100 ? 10 : bass + 10; render(); });
      win.body.key(["2"], () => { mid = mid >= 100 ? 10 : mid + 10; render(); });
      win.body.key(["3"], () => { treble = treble >= 100 ? 10 : treble + 10; render(); });
      win.body.key(["q", "escape"], () => win.close());
      win.onResize(render);

      render();
      // 24fps
      const timer = setInterval(() => { tick++; render(); }, 41);
      win.onCleanup(() => clearInterval(timer));

      win.describeState(() => ({
        summary: `ASCII Visualizer — ${mode}, ${BEAT_NAMES[beatPattern]}, brightness ${brightness}%`,
        mode,
        beatPattern: BEAT_NAMES[beatPattern],
        brightness,
        bass,
        mid,
        treble,
      }));
    },
  });
}
