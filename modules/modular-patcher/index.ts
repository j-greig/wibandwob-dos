/**
 * Modular Patcher — VCV Rack / MaxMSP style modular synth UI.
 *
 * 6 module nodes (OSC, ENV, LFO, FILTER, MIX, OUT) with knobs, meters,
 * waveform previews, and PatchCable connections. All pseudo audio.
 */

import type { MicroappHost } from "#sdk";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Modular Patcher",
    menu: [{ category: "applications", order: 72, label: "Modular Patcher" }],
    palette: { order: 187 },
    action: () => {
      const win = host.createWindow({
        title: "Modular Patcher",
        width: 80,
        height: 38,
      });

      let playing = false;
      let tick = 0;

      // Module state
      const modules = {
        OSC: { freq: 440, detune: 0, waveType: 0 },  // 0=sin, 1=sq, 2=saw
        ENV: { attack: 10, decay: 30, sustain: 70, release: 40 },
        LFO: { rate: 2, depth: 50 },
        FILTER: { cutoff: 80, resonance: 30, type: 0 },  // 0=LP, 1=HP, 2=BP
        MIX: { ch1: 80, ch2: 60, ch3: 40, ch4: 20, master: 90 },
        OUT: { level: 0 },
      };

      // Patch cables
      const cables: Array<{ from: string; to: string }> = [
        { from: "OSC:out", to: "FILTER:in" },
        { from: "LFO:out", to: "OSC:fm" },
        { from: "ENV:out", to: "FILTER:mod" },
        { from: "FILTER:out", to: "MIX:ch1" },
        { from: "MIX:out", to: "OUT:in" },
      ];

      const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      const FILTER_TYPES = ["LP", "HP", "BP"];
      const WAVE_NAMES = ["SIN", "SQR", "SAW"];

      function genOscWave(t: number, w: number): string {
        let line = "";
        for (let i = 0; i < w; i++) {
          const x = (i / w) * Math.PI * 4 + t * 0.1;
          let v: number;
          if (modules.OSC.waveType === 0) v = Math.sin(x + modules.OSC.detune * 0.01);
          else if (modules.OSC.waveType === 1) v = Math.sign(Math.sin(x));
          else v = ((x % (Math.PI * 2)) / Math.PI) - 1;
          const idx = Math.round(((v + 1) / 2) * (SPARK.length - 1));
          line += SPARK[Math.max(0, Math.min(SPARK.length - 1, idx))];
        }
        return line;
      }

      function genLFOWave(t: number, w: number): string {
        let line = "";
        for (let i = 0; i < w; i++) {
          const x = (i / w) * Math.PI * 2 + t * modules.LFO.rate * 0.02;
          const v = Math.sin(x) * (modules.LFO.depth / 100);
          const idx = Math.round(((v + 1) / 2) * (SPARK.length - 1));
          line += SPARK[Math.max(0, Math.min(SPARK.length - 1, idx))];
        }
        return line;
      }

      function genEnvShape(t: number, w: number): string {
        let line = "";
        const a = modules.ENV.attack / 100;
        const d = modules.ENV.decay / 100;
        const s = modules.ENV.sustain / 100;
        const r = modules.ENV.release / 100;
        for (let i = 0; i < w; i++) {
          const pos = i / w;
          let v: number;
          if (pos < a) v = pos / (a || 0.01);
          else if (pos < a + d) v = 1 - ((pos - a) / (d || 0.01)) * (1 - s);
          else if (pos < 1 - r) v = s;
          else v = s * (1 - (pos - (1 - r)) / (r || 0.01));
          v = Math.max(0, Math.min(1, v));
          const idx = Math.round(v * (SPARK.length - 1));
          line += SPARK[idx];
        }
        return line;
      }

      function renderKnobSmall(value: number, min: number, max: number, label: string): string {
        const ratio = (value - min) / ((max - min) || 1);
        const filled = Math.round(ratio * 4);
        const arc = "━".repeat(filled) + "○" + "─".repeat(4 - filled);
        return `${label}(${arc})${String(Math.round(value)).padStart(3)}`;
      }

      function renderLevel(level: number, h: number): string[] {
        const lines: string[] = [];
        for (let y = 0; y < h; y++) {
          const pos = 1 - (y / (h - 1 || 1));
          lines.push(pos <= level ? "██" : "░░");
        }
        return lines;
      }

      function renderCable(from: string, to: string): string {
        return `  ◉ ${from} ─────── ${to} ◉`;
      }

      function render() {
        const content: string[] = [];
        const status = playing ? "▶ RUNNING" : "■ PAUSED";
        content.push(`  ${status}   [p]lay  [q]uit`);
        content.push("  " + "═".repeat(72));

        // OSC module
        content.push("  ┌── OSC ──────────────────────┐  ┌── ENV ──────────────────────┐");
        content.push(`  │ ${renderKnobSmall(modules.OSC.freq, 20, 2000, "Hz ")}           │  │ ${renderKnobSmall(modules.ENV.attack, 0, 100, "A  ")}           │`);
        content.push(`  │ ${renderKnobSmall(modules.OSC.detune, -50, 50, "Dt ")}           │  │ ${renderKnobSmall(modules.ENV.decay, 0, 100, "D  ")}           │`);
        const oscWave = genOscWave(playing ? tick : 0, 20);
        const envShape = genEnvShape(tick, 20);
        content.push(`  │ Wave: ${WAVE_NAMES[modules.OSC.waveType]}  ${oscWave.slice(0, 14)}  │  │ ${renderKnobSmall(modules.ENV.sustain, 0, 100, "S  ")}           │`);
        content.push(`  │ out:◉  fm:◉                  │  │ ${renderKnobSmall(modules.ENV.release, 0, 100, "R  ")}           │`);
        content.push(`  └──────────────────────────────┘  │ Shape: ${envShape.slice(0, 18)}     │`);
        content.push(`                                    │ out:◉                       │`);
        content.push(`                                    └──────────────────────────────┘`);

        // LFO + FILTER
        content.push("  ┌── LFO ──────────────────────┐  ┌── FILTER ────────────────────┐");
        const lfoWave = genLFOWave(playing ? tick : 0, 16);
        content.push(`  │ ${renderKnobSmall(modules.LFO.rate, 0.1, 20, "Rt ")}           │  │ ${renderKnobSmall(modules.FILTER.cutoff, 0, 127, "Cut")}           │`);
        content.push(`  │ ${renderKnobSmall(modules.LFO.depth, 0, 100, "Dp ")}           │  │ ${renderKnobSmall(modules.FILTER.resonance, 0, 100, "Res")}           │`);
        content.push(`  │ Wave: ${lfoWave.slice(0, 18)}      │  │ Type: [${FILTER_TYPES[modules.FILTER.type]}]                  │`);
        content.push(`  │ out:◉                        │  │ in:◉  mod:◉  out:◉          │`);
        content.push(`  └──────────────────────────────┘  └──────────────────────────────┘`);

        // MIX + OUT
        const mixLevels = [modules.MIX.ch1, modules.MIX.ch2, modules.MIX.ch3, modules.MIX.ch4];
        const meterH = 4;

        content.push("  ┌── MIX ──────────────────────┐  ┌── OUT ──────────────────────┐");

        // MIX channel meters and OUT level side by side
        const mixMeters = mixLevels.map(l => renderLevel(l / 100, meterH));
        const masterMeter = renderLevel(modules.MIX.master / 100, meterH);
        const outLevel = playing ? (0.5 + Math.sin(tick * 0.1) * 0.3) * (modules.MIX.master / 100) : 0;
        const outMeter = renderLevel(outLevel, meterH);

        for (let row = 0; row < meterH; row++) {
          const mixRow = mixMeters.map(m => m[row]).join(" ");
          content.push(`  │ ${mixRow}  M:${masterMeter[row]}              │  │ Level: ${outMeter[row]}                    │`);
        }
        content.push(`  │ 1  2  3  4   Mst             │  │ ${renderKnobSmall(Math.round(outLevel * 100), 0, 100, "dB ")}           │`);

        // Output waveform
        const outWave = playing ? genOscWave(tick, 24) : "─".repeat(24);
        content.push(`  │ in:◉◉◉◉  out:◉              │  │ Waveform: ${outWave.slice(0, 18)}   │`);
        content.push(`  └──────────────────────────────┘  │ in:◉                        │`);
        content.push(`                                    └──────────────────────────────┘`);

        // Patch cables
        content.push("  ┌── Patch Bay " + "─".repeat(56) + "┐");
        for (const cable of cables) {
          content.push("  │" + renderCable(cable.from, cable.to).padEnd(70) + "│");
        }
        content.push("  └" + "─".repeat(72) + "┘");

        win.body.setContent(content.join("\n"));
        host.screen.render();
      }

      win.body.key(["p"], () => { playing = !playing; render(); });
      win.body.key(["q", "escape"], () => win.close());
      win.onResize(render);

      render();
      const timer = setInterval(() => {
        if (playing) tick++;
        render();
      }, 80);
      win.onCleanup(() => clearInterval(timer));

      win.describeState(() => ({
        summary: `Modular Patcher — ${playing ? "running" : "paused"}, ${cables.length} cables`,
        playing,
        cables: cables.length,
        oscFreq: modules.OSC.freq,
        filterType: FILTER_TYPES[modules.FILTER.type],
      }));
    },
  });
}
