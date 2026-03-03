/**
 * Hello World — the simplest possible WibWob-DOS microapp.
 *
 * Opens a window with a figlet "HELLO WORLD" banner.
 * Use this as a starting template for new microapps.
 */

import { spawnSync } from "node:child_process";

interface MicroappHost {
  createWindow(init: { title: string; width?: number; height?: number }): {
    body: any;
    onCleanup(fn: () => void): void;
    onRestyle(fn: () => void): void;
    describeState(fn: () => Record<string, unknown>): void;
    captureText(fn: () => string): void;
    focus(): void;
  };
  registerCommand(def: {
    id: string;
    label: string;
    action: () => void;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
  }): void;
  readonly theme: () => { body: Record<string, unknown> };
}

function renderFiglet(text: string, font: string): string {
  const result = spawnSync("figlet", ["-f", font, text], { encoding: "utf8" });
  if (result.status === 0) return result.stdout;
  // Fallback if figlet or font not available
  return `\n  ${text}\n`;
}

export default function setup(host: MicroappHost) {
  const banner = renderFiglet("HELLO WORLD", "larry3d");
  const lines = banner.split("\n");
  const width = Math.max(40, ...lines.map(l => l.length)) + 4;
  const height = lines.length + 3;

  host.registerCommand({
    id: "open",
    label: "Hello World Example",
    menu: [{ category: "applications", order: 40, label: "Hello World" }],
    palette: { order: 210, label: "Hello World" },
    action: () => {
      const blessed = require("blessed");
      const win = host.createWindow({ title: "Hello World", width, height });

      const content = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        content: banner,
        style: host.theme().body,
      });

      win.describeState(() => ({
        summary: "Hello World — figlet banner microapp example.",
      }));

      win.captureText(() => banner);

      win.onRestyle(() => {
        content.style = host.theme().body;
      });

      win.onCleanup(() => {});

      win.focus();
    },
  });
}
