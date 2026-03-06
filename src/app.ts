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

function randomSessionId(): string {
  return Math.random().toString(36).slice(2, 5).padEnd(3, "0");
}

const instanceLabel = process.env.WIBWOB_INSTANCE_LABEL?.trim() || undefined;
const sessionId = randomSessionId();
process.env.WIBWOB_SESSION_ID = sessionId;

const { TsTuiMvpApp } = await import("./core/app-controller.js");

await new TsTuiMvpApp({ instanceLabel, sessionId }).run();
