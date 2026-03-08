/**
 * Terrain Studio — contour terrain editor.
 *
 * Gauge sliders for parameters, preset list, real-time contour preview,
 * export to primer. SplitPane layout: controls left, preview right.
 */

import type { MicroappHost } from "#sdk";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
} from "#sdk";

type ContourMode = "chaos" | "order" | "hybrid";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Terrain Studio",
    menu: [{ category: "applications", order: 60, label: "Terrain Studio" }],
    palette: { order: 171 },
    action: () => {
      const win = host.createWindow({
        title: "Terrain Studio",
        width: 80,
        height: 28,
      });

      let scale = 50;
      let octaves = 4;
      let persistence = 50;
      let selectedPreset = 0;
      let mode: ContourMode = "hybrid";
      let seed = Math.floor(Math.random() * 100000);

      const presets = terrainNames.map((name, i) => ({ name, idx: i }));

      // Contour player for live preview
      let player: ReturnType<typeof createContourPlayer> | null = null;
      let previewContent = "";

      function gaugeBar(value: number, max: number, width: number): string {
        const ratio = Math.min(1, value / max);
        const filled = Math.round(ratio * width);
        return `▕${"▓".repeat(filled)}${"░".repeat(width - filled)}▏ ${value}`;
      }

      function render() {
        const innerW = Number(win.body.width) || 80;
        const innerH = Number(win.body.height) || 24;
        const controlW = Math.min(30, Math.floor(innerW * 0.4));
        const previewW = innerW - controlW - 1;

        // Controls panel
        const controls = [
          "═══ Controls ═══",
          "",
          `Scale:       ${gaugeBar(scale, 100, 12)}`,
          `Octaves:     ${gaugeBar(octaves, 8, 12)}`,
          `Persistence: ${gaugeBar(persistence, 100, 12)}`,
          "",
          `Mode: ${mode}`,
          `Seed: ${seed}`,
          "",
          "═══ Presets ═══",
          ...presets.map((p, i) =>
            `${i === selectedPreset ? "▸ " : "  "}${p.name}`
          ),
          "",
          "[s]cale [o]ctaves [p]ersistence",
          "[m]ode [n]ew-seed [e]xport",
          "[↑↓]preset [q]uit",
        ];

        // Preview panel
        const previewLines = previewContent.split("\n");

        // Compose side-by-side
        const lines: string[] = [];
        const maxLines = Math.max(controls.length, previewLines.length, innerH);
        for (let i = 0; i < maxLines; i++) {
          const left = (controls[i] ?? "").padEnd(controlW).slice(0, controlW);
          const right = (previewLines[i] ?? "").slice(0, previewW);
          lines.push(`${left}│${right}`);
        }

        win.body.setContent(lines.join("\n"));
        host.screen.render();
      }

      function startPreview() {
        if (player) player.stop();
        player = createContourPlayer({
          mode,
          seed,
          terrainIdx: presets[selectedPreset]?.idx ?? 0,
          nLevels: Math.max(2, Math.floor(octaves * 1.5)),
          fps: 6,
          getViewport: () => readNodeViewport(win.body, {
            minWidth: 20, minHeight: 8,
            fallbackWidth: 40, fallbackHeight: 16,
          }),
          onFrame: (content) => {
            previewContent = content;
            render();
          },
        });
        player.start();
      }

      // Key bindings
      win.body.key(["s"], () => { scale = (scale + 10) % 110; render(); });
      win.body.key(["o"], () => { octaves = (octaves % 8) + 1; startPreview(); });
      win.body.key(["p"], () => { persistence = (persistence + 10) % 110; render(); });
      win.body.key(["m"], () => {
        const modes: ContourMode[] = ["chaos", "order", "hybrid"];
        mode = modes[(modes.indexOf(mode) + 1) % modes.length];
        startPreview();
      });
      win.body.key(["n"], () => { seed = Math.floor(Math.random() * 100000); startPreview(); });
      win.body.key(["up", "k"], () => {
        if (selectedPreset > 0) selectedPreset--;
        startPreview();
      });
      win.body.key(["down", "j"], () => {
        if (selectedPreset < presets.length - 1) selectedPreset++;
        startPreview();
      });
      win.body.key(["q", "escape"], () => win.close());

      win.onResize(render);
      win.onCleanup(() => { if (player) player.stop(); });

      startPreview();

      win.describeState(() => ({
        summary: `Terrain Studio — ${presets[selectedPreset]?.name ?? "unknown"} (${mode})`,
        scale,
        octaves,
        persistence,
        mode,
        seed,
        preset: presets[selectedPreset]?.name,
      }));
    },
  });
}
