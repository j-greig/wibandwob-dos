import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

const CANARY_BANNER = [
  "runtime reload canary",
  "",
  "greenfield microapp",
  "one window, one command, one state path",
].join("\n");

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open Runtime Reload Canary",
    description: "Open the greenfield runtime reload canary microapp.",
    menu: [{ category: "applications", order: 46, label: "Runtime Reload Canary" }],
    palette: { order: 216, label: "Runtime Reload Canary" },
    action: () => {
      const win = host.createWindow({
        title: "Runtime Reload Canary",
        width: 42,
        height: 11,
        left: 10,
        top: 4,
      });

      const content = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: false,
        content: CANARY_BANNER,
        style: host.theme().body,
      });

      win.describeState(() => ({
        summary: "Runtime reload canary — greenfield reload proof.",
        contentPreview: "runtime reload canary",
        variant: "greenfield",
      }));

      win.captureText(() => CANARY_BANNER);

      win.onRestyle(() => {
        content.style = host.theme().body;
      });

      win.focus();
    },
  });
}
