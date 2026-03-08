/**
 * DAW Studio — composable music production surface.
 *
 * Waveform + PianoRoll + StepMatrix + LevelMeter + Spectrum + Knobs + PatchCables.
 * All signal values simulated — no real audio, pure ASCII beauty.
 */

import type { MicroappHost } from "#sdk";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "DAW Studio",
    menu: [{ category: "applications", order: 65, label: "DAW Studio" }],
    palette: { order: 180 },
    action: () => {
      const win = host.createWindow({
        title: "DAW Studio",
        width: 80,
        height: 36,
      });

      // State
      let bpm = 120;
      let playing = false;
      let playhead = 0;
      let tick = 0;

      // Piano roll: 12 semitones x 16 bars
      const noteGrid: boolean[][] = Array.from({ length: 12 }, () =>
        Array.from({ length: 16 }, () => false)
      );
      // Seed a chord
      noteGrid[0][0] = true; noteGrid[0][4] = true; noteGrid[0][8] = true; noteGrid[0][12] = true;
      noteGrid[4][2] = true; noteGrid[4][6] = true; noteGrid[4][10] = true; noteGrid[4][14] = true;
      noteGrid[7][0] = true; noteGrid[7][4] = true; noteGrid[7][8] = true; noteGrid[7][12] = true;

      // Step matrix: 4 tracks x 16 steps
      const tracks = ["BD", "SD", "HH", "OH"];
      const stepGrid: boolean[][] = [
        [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
        [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
        [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
        [false,false,false,false,false,false,false,false,false,false,true,false,false,false,false,false],
      ];

      let reverb = 30;
      let cutoff = 80;
      let drive = 15;

      // Generate pseudo waveform
      function genWaveform(t: number): number[] {
        const samples: number[] = [];
        for (let i = 0; i < 60; i++) {
          const x = (i / 60) * Math.PI * 4 + t * 0.1;
          samples.push(
            Math.sin(x) * 0.5 +
            Math.sin(x * 2.3) * 0.25 +
            Math.sin(x * 0.7 + t * 0.05) * 0.2
          );
        }
        return samples;
      }

      // Generate spectrum bins
      function genSpectrum(t: number): number[] {
        const bins: number[] = [];
        for (let i = 0; i < 32; i++) {
          const base = Math.sin(i * 0.3 + t * 0.15) * 0.3 + 0.4;
          const noise = Math.sin(i * 7.3 + t * 0.7) * 0.15;
          bins.push(Math.max(0, Math.min(1, base + noise)));
        }
        return bins;
      }

      // Generate level
      function genLevel(t: number, ch: number): number {
        return Math.max(0, Math.min(1,
          0.5 + Math.sin(t * 0.2 + ch * 1.5) * 0.3 + Math.sin(t * 0.07) * 0.15
        ));
      }

      const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const TRACK_MARKS = ["●", "◆", "■", "▲"];

      function renderWaveform(samples: number[], w: number, h: number): string[] {
        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          let line = "";
          for (let col = 0; col < w; col++) {
            const idx = Math.floor((col / w) * samples.length);
            const v = samples[idx] ?? 0;
            const y = ((1 - v) / 2) * (h - 1);
            const cy = Math.round(y);
            if (cy === row) {
              const intensity = Math.abs(v);
              const bi = Math.round(intensity * (SPARK.length - 1));
              line += SPARK[bi];
            } else {
              line += row === Math.floor(h / 2) ? "·" : " ";
            }
          }
          lines.push(line);
        }
        return lines;
      }

      function renderSpectrum(bins: number[], w: number, h: number): string[] {
        const lines: string[] = [];
        for (let row = 0; row < h; row++) {
          let line = "";
          const threshold = 1 - ((row + 0.5) / h);
          for (let b = 0; b < bins.length && line.length < w; b++) {
            const val = bins[b] ?? 0;
            if (val >= threshold + (1 / h)) {
              line += "█";
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

      function renderLevelMeter(level: number, h: number): string[] {
        const lines: string[] = [];
        for (let y = 0; y < h; y++) {
          const pos = 1 - (y / (h - 1 || 1));
          if (pos <= level) {
            lines.push(pos > 0.85 ? "██" : pos > 0.65 ? "▓▓" : "██");
          } else {
            lines.push("░░");
          }
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
        const bodyW = (Number(win.body.width) || 78) - 2;
        const waveW = Math.max(20, bodyW - 6);
        const waveH = 5;

        const content: string[] = [];

        // Status bar
        const status = playing ? "▶ PLAYING" : "■ STOPPED";
        content.push(`  ${status}  BPM: ${bpm}  Step: ${(playhead + 1).toString().padStart(2)}/16`);
        content.push("  " + "─".repeat(Math.max(0, bodyW - 2)));

        // Waveform panel
        content.push("  ┌─ Waveform " + "─".repeat(Math.max(0, waveW - 14)) + "┐");
        const wave = renderWaveform(genWaveform(tick), waveW - 2, waveH);
        for (const line of wave) content.push("  │" + line.padEnd(waveW - 2).slice(0, waveW - 2) + "│");
        content.push("  └" + "─".repeat(waveW - 2) + "┘");

        // Piano roll
        content.push("  ┌─ Piano Roll " + "─".repeat(Math.max(0, 34 - 16)) + "┐");
        for (let s = 11; s >= 0; s--) {
          const label = NOTE_NAMES[s].padStart(3);
          let row = label + " ";
          for (let b = 0; b < 16; b++) {
            const on = noteGrid[s][b];
            const isHead = b === playhead && playing;
            row += on ? (isHead ? "▓" : "█") : (isHead ? "▒" : "·");
            row += " ";
          }
          content.push("  │" + row + "│");
        }
        content.push("  └" + "─".repeat(36) + "┘");

        // Step matrix + level meters side by side
        const stepW = 4 + 16 * 2;
        content.push("  ┌─ Steps " + "─".repeat(Math.max(0, stepW - 11)) + "┬─ Lvl ─┐");
        // Header
        let hdr = "    ";
        for (let s = 0; s < 16; s++) hdr += (s % 4 === 0 ? `${s + 1} `.slice(0, 2) : "· ");
        const lvlHdr = "       ";
        content.push("  │" + hdr + "│" + lvlHdr + "│");

        for (let tr = 0; tr < tracks.length; tr++) {
          let row = tracks[tr].padEnd(4);
          for (let s = 0; s < 16; s++) {
            const on = stepGrid[tr][s];
            const isHead = s === playhead && playing;
            row += on ? TRACK_MARKS[tr] + " " : (isHead ? "▒ " : "· ");
          }
          const lvl = genLevel(tick, tr);
          const meterFilled = Math.round(lvl * 5);
          const meter = "█".repeat(meterFilled) + "░".repeat(5 - meterFilled);
          content.push("  │" + row + "│ " + meter + " │");
        }
        content.push("  └" + "─".repeat(stepW) + "┴───────┘");

        // Knob row
        const knobs = [
          renderKnob(bpm, 60, 200, " BPM"),
          renderKnob(reverb, 0, 100, " Rev"),
          renderKnob(cutoff, 0, 127, " Cut"),
          renderKnob(drive, 0, 100, " Drv"),
        ];
        for (let row = 0; row < 4; row++) {
          content.push("  " + knobs.map(k => k[row]).join("  "));
        }

        // Spectrum
        const specW = Math.min(32, bodyW - 4);
        content.push("  ┌─ Spectrum " + "─".repeat(Math.max(0, specW - 14)) + "┐");
        const spec = renderSpectrum(genSpectrum(tick), specW - 2, 4);
        for (const line of spec) content.push("  │" + line + "│");
        content.push("  └" + "─".repeat(specW - 2) + "┘");

        // Controls
        content.push("  [space]play/pause  [↑↓]bpm  [e]xport  [q]uit");

        win.body.setContent(content.join("\n"));
        host.screen.render();
      }

      // Key bindings
      win.body.key(["space"], () => {
        playing = !playing;
        render();
      });
      win.body.key(["up"], () => {
        bpm = Math.min(300, bpm + 5);
        render();
      });
      win.body.key(["down"], () => {
        bpm = Math.max(30, bpm - 5);
        render();
      });
      win.body.key(["e"], async () => {
        const pattern = {
          bpm,
          notes: noteGrid,
          steps: stepGrid,
          tracks,
          reverb,
          cutoff,
          drive,
        };
        try {
          const Bun = globalThis as any;
          if (Bun.Bun?.write) {
            await Bun.Bun.write("scratch/daw-pattern.json", JSON.stringify(pattern, null, 2));
          }
        } catch { /* scratch dir may not exist */ }
        render();
      });
      win.body.key(["q", "escape"], () => win.close());
      win.onResize(render);

      // Animation loop
      const interval = setInterval(() => {
        tick++;
        if (playing) {
          playhead = (playhead + 1) % 16;
        }
        render();
      }, Math.round(60000 / bpm / 4));

      win.onCleanup(() => clearInterval(interval));

      render();

      win.describeState(() => ({
        summary: `DAW Studio — ${bpm} BPM, ${playing ? "playing" : "stopped"}, step ${playhead + 1}/16`,
        bpm,
        playing,
        playhead,
      }));
    },
  });
}
