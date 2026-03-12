/**
 * Hello World — the simplest possible WibWob-DOS microapp.
 *
 * Opens a window with a responsive figlet "HELLO WORLD" banner.
 * The font downgrades as the window gets narrower:
 *   larry3d (XL) -> slant (L) -> small (M) -> smslant -> digital (S) -> CAPS (plain)
 *
 * Use this as a starting template for new microapps.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { responsiveFiglet } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Hello World Example",
    menu: [{ category: "demos", order: 40, label: "Hello World" }],
    palette: { order: 210, label: "Hello World" },
    action: () => {
      const win = host.createWindow({ title: "Hello World", width: 70, height: 20 });
      const content = blessed.box({
        parent: win.body,
        top: 0, left: 0, right: 0, bottom: 0,
        content: "",
        style: host.theme().body,
      });

      let lastBanner = "";

      function rerender() {
        const availWidth = Math.max(10, Number(content.width) || 40);
        lastBanner = responsiveFiglet("HELLO WORLD", availWidth);
        content.setContent(lastBanner);
        host.screen.render();
      }

      rerender();
      win.onResize(rerender);

      win.describeState(() => ({
        summary: "Hello World — responsive figlet banner microapp example.",
      }));
      win.captureText(() => lastBanner);
      win.onRestyle(() => { content.style = host.theme().body; });
      win.focus();
    },
  });
}
