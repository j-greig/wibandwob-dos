/**
 * Hello World — the simplest possible WibWob-DOS microapp.
 *
 * Opens a window with a figlet "HELLO WORLD" banner.
 * Use this as a starting template for new microapps.
 */

import blessed from "blessed";
import { spawnSync } from "node:child_process";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

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

      win.focus();
    },
  });
}
