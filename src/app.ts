import os from "node:os";

if (!process.env.TERM || process.env.TERM.includes("ghostty")) {
  process.env.TERM = "xterm-256color";
}
process.env.HOME = process.env.HOME || os.homedir();

const { TsTuiMvpApp } = await import("./core/app-controller.js");

new TsTuiMvpApp().run();
