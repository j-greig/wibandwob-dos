import os from "node:os";
import { parseAppFlags, printHelp } from "./core/cli.js";

if (!process.env.TERM || process.env.TERM.includes("ghostty")) {
  process.env.TERM = "xterm-256color";
}
process.env.HOME = process.env.HOME || os.homedir();

const flags = parseAppFlags();

if (flags.help) {
  printHelp();
  process.exit(0);
}

const { TsTuiMvpApp } = await import("./core/app-controller.js");

await new TsTuiMvpApp().run();
