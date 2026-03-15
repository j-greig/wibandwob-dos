import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";

export default function setup(host: MicroappHost) {
  // ── Pattern Field ──
  host.registerCommand({
    id: "pattern",
    label: "Pattern Field",
    description: "Open a pattern field window.",
    action: () => openAnimated("Pattern Field", patternGenerator, 8),
    palette: { order: 60, label: "Pattern Field" },
    menu: [{ category: "applications", order: 80, label: "Pattern Field" }],
    direct: true,
  });

  // ── Generative Art ──
  host.registerCommand({
    id: "art",
    label: "Generative Art",
    description: "Open an animated generative art window.",
    action: () => openAnimated("Generative Art", artGenerator, 10),
    palette: { order: 61, label: "Generative Art" },
    menu: [{ category: "demos", order: 60, label: "Generative Art" }],
    direct: true,
  });

  function patternGenerator(tick: number, width: number, height: number): string {
    const glyphs = ["░", "▒", "▓", "█"];
    const rows: string[] = [];
    for (let y = 0; y < height; y += 1) {
      let row = "";
      for (let x = 0; x < width; x += 1) {
        row += glyphs[Math.abs((x + y + tick) % glyphs.length)];
      }
      rows.push(row);
    }
    return rows.join("\n");
  }

  function artGenerator(tick: number, width: number, height: number): string {
    const palette = " .:-=+*#%@";
    const rows: string[] = [];
    for (let y = 0; y < height; y += 1) {
      let row = "";
      for (let x = 0; x < width; x += 1) {
        const waveA = Math.sin((x + tick) / 5);
        const waveB = Math.cos((y - tick) / 4);
        const orbit = Math.sin((x + y + tick) / 7);
        const value = (waveA + waveB + orbit + 3) / 6;
        row += palette[Math.min(palette.length - 1, Math.max(0, Math.floor(value * palette.length)))];
      }
      rows.push(row);
    }
    return rows.join("\n");
  }

  function openAnimated(
    title: string,
    generator: (tick: number, w: number, h: number) => string,
    fps: number,
  ) {
    const win = host.createWindow({ title, width: 80, height: 30 });
    const timers = new Set<ReturnType<typeof setInterval>>();

    const canvas = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      style: host.theme().body,
    });

    let tick = 0;

    const render = () => {
      const w = Math.max(12, Number(canvas.width) || 40);
      const h = Math.max(6, Number(canvas.height) || 15);
      canvas.setContent(generator(tick, w, h));
      tick += 1;
      host.screen.render();
    };

    createTimer(render, Math.round(1000 / fps), timers);

    win.describeState(() => ({
      summary: `Animated ${title} window.`,
      appType: title.toLowerCase().replace(/\s+/g, "-"),
      contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
      tick,
    }));

    win.captureText(() => canvas.getContent());

    win.onRestyle(() => {
      canvas.style = host.theme().body;
      host.screen.render();
    });

    win.onCleanup(() => clearTimers(timers));
    win.setFocusTarget(canvas);
    win.focus();
  }
}
