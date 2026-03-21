import os from "node:os";
import fs from "node:fs";
import { safeWriteFile } from "./core/safe-fs.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseAppFlags, printHelp } from "./core/cli.js";
import { createRuntimeNode } from "./runtime/runtime-node.js";
import { DATA_ROOT, ensureDirectoryExists } from "./core/config.js";

if (!process.env.TERM || process.env.TERM.includes("ghostty")) {
  process.env.TERM = "xterm-256color";
}

// Bulletproof stdin: if piped (not a TTY), reopen from /dev/tty so blessed
// can read keyboard input. Without this, `echo x | bun run start` crashes.
if (!process.stdin.isTTY) {
  try {
    const ttyFd = fs.openSync("/dev/tty", "r");
    const ttyStream = fs.createReadStream("", { fd: ttyFd });
    Object.defineProperty(process, "stdin", { value: ttyStream, writable: true });
    // @ts-expect-error — setRawMode exists on tty.ReadStream
    if (ttyStream.setRawMode) ttyStream.setRawMode(true);
  } catch {
    // /dev/tty not available (e.g. CI, Docker without tty) — proceed and hope for the best
  }
}
process.env.HOME = process.env.HOME || os.homedir();

const flags = parseAppFlags();

if (flags.help) {
  printHelp();
  process.exit(0);
}

/** Generate a short random instance ID (8 chars, URL-safe).
 * Uses first 8 chars of UUID for better collision resistance. */
function randomInstanceId(): string {
  // crypto.randomUUID() is available in Bun and Node 19+
  return crypto.randomUUID().slice(0, 8);
}

/** Derive a short display ID from instance ID (first 3 chars).
 * Used in TUI chrome for compact display. */
function deriveDisplayId(instanceId: string): string {
  return instanceId.slice(0, 3);
}

/** Get or generate instance ID.
 * Priority: WIBWOB_INSTANCE_ID env > generated
 * Validates format - must be non-empty and URL-safe. */
function resolveInstanceId(): string {
  const envId = process.env.WIBWOB_INSTANCE_ID?.trim();
  if (envId && envId.length > 0) {
    // Validate: alphanumeric + hyphens only for safety
    if (!/^[a-zA-Z0-9-]+$/.test(envId)) {
      throw new Error(`Invalid instance ID "${envId}" - must be alphanumeric with hyphens only`);
    }
    return envId;
  }
  return randomInstanceId();
}

const instanceLabel = process.env.WIBWOB_INSTANCE_LABEL?.trim() || undefined;
const instanceId = resolveInstanceId();
const instanceDisplayId = deriveDisplayId(instanceId);

// Ensure runtime data root exists before any file operations
ensureDirectoryExists(DATA_ROOT);

const runtimeNode = createRuntimeNode({ instanceLabel, instanceId, instanceDisplayId });
process.env.WIBWOB_INSTANCE_ID = runtimeNode.instanceId;
process.env.WIBWOB_API_BASE_URL = runtimeNode.apiBaseUrl;

// Set process title so `pkill wibwob-dos` works and ps output is readable.
// Include instance label + full instanceId so ps/htop and pkill match uniquely.
// e.g. "wibwob-dos-main-abc12345" — uses full ID for machine-facing discrimination.
// The TUI display uses short displayId for compactness.
process.title = [
  "wibwob-dos",
  instanceLabel,
  instanceId,
].filter(Boolean).join("-");

// Write PID file so agents can kill cleanly: kill $(cat scratch/wibwob.pid)
// Respects SCRATCH_DIR for dual-instance isolation.
fs.mkdirSync(runtimeNode.scratchBase, { recursive: true });
safeWriteFile(runtimeNode.pidPath, String(process.pid));

// Write boot-commit so reload-microapp.sh can detect host file changes since boot.
{
  try {
    const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    const commit = result.stdout?.trim() ?? "unknown";
    safeWriteFile(path.join(runtimeNode.scratchBase, "boot-commit"), commit);
  } catch { /* non-fatal — git may not be available */ }
}

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
// Socket + PID sidecar cleanup is handled by ControlApiService shutdown handlers.
// app.ts only cleans the global wibwob.pid and ghostty shader.
const cleanup = () => { removePid(); deactivateGhosttyShader(); };

process.once("exit", cleanup);
process.once("SIGTERM", () => { cleanup(); process.exit(0); });
process.once("SIGINT",  () => { cleanup(); process.exit(0); });

const { TsTuiMvpApp } = await import("./core/app-controller.js");

const app = new TsTuiMvpApp({ runtimeNode });

// SIGHUP = terminal died. Save workspace as orphan, then clean exit.
// Use instanceLabel if set, otherwise instanceDisplayId
const orphanLabel = runtimeNode.instanceLabel ?? runtimeNode.instanceDisplayId;
process.once("SIGHUP", () => {
  try {
    app.saveWorkspaceNamed(`orphan-${orphanLabel}`);
  } catch {}
  cleanup();
  process.exit(0);
});

await app.run();
