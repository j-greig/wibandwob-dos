import type { MicroappHost } from "../../src/services/microapp-sdk.js";

/**
 * Hello World — the simplest possible microapp.
 * Teaches: createWindow, describeState, captureText, onCleanup.
 */
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open Hello World",
    description: "Open a minimal greeting window.",
    action: () => {
      const win = host.createWindow({
        title: "Hello World",
        width: 40,
        height: 10,
      });

      const message = "Hello from WibWob-DOS!";
      win.body.setContent(`\n  ${message}`);

      win.captureText(() => message);
      win.describeState(() => ({
        appType: "wibwob.example.hello",
        message,
      }));

      return { ok: true, windowId: win.id };
    },
  });
}
