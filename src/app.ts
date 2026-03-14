import os from "node:os";
import fs from "node:fs";
import { parseAppFlags, printHelp } from "./core/cli.js";
import { createRuntimeNode } from "./runtime/runtime-node.js";

if (!process.env.TERM || process.env.TERM.includes("ghostty")) {
  process.env.TERM = "xterm-256color";
}
process.env.HOME = process.env.HOME || os.homedir();

const flags = parseAppFlags();

if (flags.help) {
  printHelp();
  process.exit(0);
}

function randomInstanceId(): string {
  return Math.random().toString(36).slice(2, 5).padEnd(3, "0");
}

const instanceLabel = process.env.WIBWOB_INSTANCE_LABEL?.trim() || undefined;
const instanceId = randomInstanceId();
const runtimeNode = createRuntimeNode({ instanceLabel, instanceId });
process.env.WIBWOB_INSTANCE_ID = runtimeNode.instanceId;
process.env.WIBWOB_API_BASE_URL = runtimeNode.apiBaseUrl;

// Set process title so `pkill wibwob-dos` works and ps output is readable.
// Include instance label so dual-instance is distinguishable: wibwob-dos-main, wibwob-dos-zuk
// Process title includes instance label + instance id so ps/htop and pkill match what you see in the TUI top-right.
// e.g. "wibwob-dos-main-jp9" — pkill wibwob-dos-jp9 kills exactly that runtime node.
process.title = [
  "wibwob-dos",
  instanceLabel,
  runtimeNode.instanceId,
].filter(Boolean).join("-");

// Write PID file so agents can kill cleanly: kill $(cat scratch/wibwob.pid)
// Respects SCRATCH_DIR for dual-instance isolation.
fs.mkdirSync(runtimeNode.scratchBase, { recursive: true });
fs.writeFileSync(runtimeNode.pidPath, String(process.pid), "utf8");
const removePid = () => { try { fs.unlinkSync(runtimeNode.pidPath); } catch {} };
process.once("exit", removePid);
process.once("SIGTERM", () => { removePid(); process.exit(0); });
process.once("SIGINT",  () => { removePid(); process.exit(0); });

const { TsTuiMvpApp } = await import("./core/app-controller.js");

await new TsTuiMvpApp({ runtimeNode }).run();
