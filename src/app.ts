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

// Set process title so `pkill wibwob-dos` works and ps output is readable.
// Include instance label so dual-instance is distinguishable: wibwob-dos-main, wibwob-dos-zuk
// Process title includes instance label + session ID so ps/htop and pkill match what you see in the TUI top-right.
// e.g. "wibwob-dos-main-jp9" — pkill wibwob-dos-jp9 kills exactly that session.
process.title = [
  "wibwob-dos",
  instanceLabel,
  sessionId,
].filter(Boolean).join("-");

// Write PID file so agents can kill cleanly: kill $(cat scratch/wibwob.pid)
// Respects SCRATCH_DIR for dual-instance isolation.
import fs from "node:fs";
import path from "node:path";
const scratchBase = process.env.SCRATCH_DIR
  ? path.resolve(process.env.SCRATCH_DIR)
  : path.join(process.cwd(), "scratch");
const pidFile = path.join(scratchBase, "wibwob.pid");
fs.mkdirSync(scratchBase, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid), "utf8");
const removePid = () => { try { fs.unlinkSync(pidFile); } catch {} };
process.once("exit", removePid);
process.once("SIGTERM", () => { removePid(); process.exit(0); });
process.once("SIGINT",  () => { removePid(); process.exit(0); });

const { TsTuiMvpApp } = await import("./core/app-controller.js");

await new TsTuiMvpApp({ instanceLabel, sessionId }).run();
