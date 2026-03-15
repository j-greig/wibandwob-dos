import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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

// ─── Ghostty shader lifecycle ────────────────────────────────
// Activate configured shader on start, deactivate on exit.
// Set WIBWOB_GHOSTTY_SHADER env var to a shader name (e.g. "wibwob-crt")
// or leave unset to skip. Only runs from the canonical repo path.
const ghosttyShaderScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "ghostty-shader.sh");
const ghosttyShader = process.env.WIBWOB_GHOSTTY_SHADER;
// Detect Ghostty: TERM_PROGRAM may say "zed" or "tmux" if nested,
// so also check GHOSTTY_RESOURCES_DIR (always set by Ghostty) or allow force via env.
const isGhostty = (process.env.TERM_PROGRAM || "").toLowerCase().includes("ghostty")
  || !!process.env.GHOSTTY_RESOURCES_DIR
  || process.env.WIBWOB_GHOSTTY_FORCE === "1";

function activateGhosttyShader() {
  if (!ghosttyShader || !isGhostty) return;
  try {
    if (!fs.existsSync(ghosttyShaderScript)) return;
    spawnSync("bash", [ghosttyShaderScript, "on", ghosttyShader], { stdio: "ignore" });
  } catch {}
}
function deactivateGhosttyShader() {
  if (!ghosttyShader || !isGhostty) return;
  try {
    if (!fs.existsSync(ghosttyShaderScript)) return;
    spawnSync("bash", [ghosttyShaderScript, "off"], { stdio: "ignore" });
  } catch {}
}

activateGhosttyShader();

const removePid = () => { try { fs.unlinkSync(runtimeNode.pidPath); } catch {} };
const removeSocket = () => {
  try { fs.unlinkSync(path.join(runtimeNode.scratchBase, "instances", `${runtimeNode.instanceLabel}.sock`)); } catch {}
};
const cleanup = () => { removePid(); removeSocket(); deactivateGhosttyShader(); };

process.once("exit", cleanup);
process.once("SIGTERM", () => { cleanup(); process.exit(0); });
process.once("SIGINT",  () => { cleanup(); process.exit(0); });

const { TsTuiMvpApp } = await import("./core/app-controller.js");

const app = new TsTuiMvpApp({ runtimeNode });

// SIGHUP = terminal died. Save workspace as orphan, then clean exit.
process.once("SIGHUP", () => {
  try {
    app.saveWorkspaceNamed(`orphan-${runtimeNode.instanceLabel}`);
  } catch {}
  cleanup();
  process.exit(0);
});

await app.run();
