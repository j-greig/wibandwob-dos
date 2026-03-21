import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStatusBar } from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Click Counter";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Open a click counter. Press Space or Enter to increment, r to reset.",
    menu: [{ category: "demos", order: 200, label: APP_TITLE }],
    palette: { order: 200, label: `Open ${APP_TITLE}` },
    action: () => {
      let count = 0;

      const win = host.createWindow({ title: APP_TITLE, width: 40, height: 12 });

      const display = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 1,
        tags: true,
        content: "",
        align: "center" as const,
        valign: "middle" as const,
        style: host.theme().body,
      });

      const status = createStatusBar(win.body, {
        left: "space/enter: +1  r: reset",
        right: `count: ${count}`,
      });

      const render = () => {
        display.setContent(`{bold}${count}{/bold}`);
        status.update({ right: `count: ${count}` });
        host.screen.render();
      };

      display.key(["space", "enter"], () => {
        count++;
        render();
      });

      display.key(["r"], () => {
        count = 0;
        render();
      });

      win.describeState(() => ({
        summary: `Click Counter — count: ${count}`,
        count,
      }));

      win.captureText(() => `Count: ${count}`);

      win.onRestyle(() => {
        display.style = host.theme().body;
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        status.destroy();
      });

      win.setFocusTarget(display);
      win.focus();
      render();

      return { ok: true, windowId: win.id };
    },
  });
}
