/**
 * Hello World — the simplest possible WibWob-DOS microapp.
 *
 * Opens a window with a responsive figlet "HELLO WORLD" banner.
 * The font downgrades as the window gets narrower:
 *   larry3d (XL) -> slant (L) -> small (M) -> smslant -> digital (S) -> CAPS (plain)
 *
 * When the window is large enough, Wib & Wob appear in the bottom-right.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { responsiveFiglet } from "../../src/services/microapp-sdk.js";

const WIBWOB_ART = [
  "    /\\_____/\\   /\\_____/\\",
  "   /  o   o  \\ /  o   o  \\",
  "  ( ==  ^  == \u2573 ==  ^  == )",
  "   )                     (",
  "  (                       )",
  " ( (  ) (  )  ( (  ) (  )  )",
  "(__(_W)I(B_)__(__(_W)O(B_)__)",
];
const ART_W = Math.max(...WIBWOB_ART.map(l => l.length));
const ART_H = WIBWOB_ART.length;

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Hello World Example",
    menu: [{ category: "demos", order: 40, label: "Hello World" }],
    palette: { order: 210, label: "Hello World" },
    action: () => {
      const win = host.createWindow({ title: "Hello World", width: 70, height: 20 });

      // Banner fills the window, art floats on top at bottom-right
      const banner = blessed.box({
        parent: win.body,
        top: 0, left: 0, right: 0, bottom: 0,
        content: "",
        style: host.theme().body,
      });

      const art = blessed.box({
        parent: win.body,
        width: ART_W,
        height: ART_H,
        bottom: 0,
        right: 1,
        content: WIBWOB_ART.join("\n"),
        style: host.theme().body,
      });
      art.hide();

      let lastBanner = "";
      let artVisible = false;

      function rerender() {
        const w = Math.max(10, Number(win.body.width) || 40);
        const h = Math.max(5, Number(win.body.height) || 15);

        lastBanner = responsiveFiglet("HELLO WORLD", w);
        banner.setContent(lastBanner);

        // Show art when there is room below the banner and beside it
        const bannerLines = lastBanner.split("\n").length;
        const roomBelow = h - bannerLines >= ART_H;
        const roomBeside = w >= ART_W + 4;
        artVisible = roomBelow && roomBeside;

        if (artVisible) {
          art.show();
        } else {
          art.hide();
        }
        host.screen.render();
      }

      rerender();
      win.onResize(rerender);

      win.describeState(() => ({
        summary: "Hello World — responsive figlet banner microapp example.",
        artVisible,
      }));

      win.captureText(() => {
        if (!artVisible) return lastBanner;
        return lastBanner + "\n\n" + WIBWOB_ART.join("\n");
      });

      win.onRestyle(() => {
        banner.style = host.theme().body;
        art.style = host.theme().body;
      });

      win.focus();
    },
  });
}
