/**
 * wibwob-reload-screenshot.ts
 *
 * After every successful `reload-microapp.sh` bash call, automatically:
 *   1. Finds the Ghostty window via CGWindowList (display-agnostic)
 *   2. Captures exactly that window as a PNG via screencapture -l <windowID>
 *   3. Resizes to 1× via sips (halves dims, quarters file size)
 *   4. Fetches /state to get the reloaded window's describeState summary
 *   5. Injects [text: state summary] + [image: PNG] into the tool result
 *
 * The agent sees exactly what just rendered — no human needed in the loop.
 *
 * Commands:
 *   /wibwob-eyes        — show current status
 *   /wibwob-eyes off    — disable for this session
 *   /wibwob-eyes on     — re-enable
 *
 * macOS only. Graceful no-op on Linux/VPS.
 * Requires Screen Recording permission granted to VS Code / Cursor.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ────────────────────────────────────────────────────────────────────

const RELOAD_MARKER   = "reload-microapp.sh";
const SNAP_PATH       = "/tmp/wibwob-eyes-snap.png";
const RENDER_DELAY_MS = 700; // wait after reload's own 500ms sleep

// Repo root = 3 levels up from .pi/extensions/
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HELPER    = join(REPO_ROOT, "scripts/lib/find-ghostty-window");
const HELPER_C  = `${HELPER}.c`;
const API_BASE  = "http://127.0.0.1:8099";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return process.env["WIBWOB_EYES"] !== "0";
}

/** Ensure the CGWindowList helper binary is compiled. Returns true if ready. */
function ensureHelper(): boolean {
  if (existsSync(HELPER)) {
    // Verify it runs on this arch — Mach-O binaries are arch-specific
    const test = spawnSync(HELPER, [], { timeout: 1000 });
    if (test.status !== null && test.error?.message?.includes("Bad CPU type")) {
      // Wrong arch — recompile
    } else {
      return true;
    }
  }
  if (!existsSync(HELPER_C)) return false;
  // Build native arch for this machine
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const r = spawnSync(
    "cc",
    ["-arch", arch, "-framework", "CoreGraphics", "-framework", "CoreFoundation", HELPER_C, "-o", HELPER],
    { timeout: 10000 }
  );
  return r.status === 0 && existsSync(HELPER);
}

/** Get the CGWindowID of the frontmost Ghostty window. Returns null if not found. */
function ghosttyWindowId(): string | null {
  if (!ensureHelper()) return null;
  const r = spawnSync(HELPER, [], { encoding: "utf-8", timeout: 2000 });
  if (r.status !== 0) return null;
  const id = r.stdout.trim().split("\n")[0]?.split(" ")[0] ?? "";
  return id || null;
}

/** Capture the Ghostty window by CGWindowID. Display-agnostic, window-scoped. */
function captureGhosttyWindow(): boolean {
  if (existsSync(SNAP_PATH)) { try { unlinkSync(SNAP_PATH); } catch { /* ignore */ } }
  const winId = ghosttyWindowId();
  if (!winId) return false;
  const r = spawnSync("screencapture", ["-l", winId, "-x", SNAP_PATH], { timeout: 4000 });
  return r.status === 0 && existsSync(SNAP_PATH);
}

/** Resize captured PNG to 50% via sips (halves dimensions, quarters file size). */
function resizeSnap(): void {
  try {
    spawnSync("sips", ["--resampleHeightFactor", "0.5", SNAP_PATH], { timeout: 3000 });
  } catch { /* sips unavailable — skip resize */ }
}

/** Fetch /state, find the window matching appId, return its summary line. */
function fetchWindowSummary(appId: string): string {
  try {
    const out = execSync(`curl -sf --max-time 2 "${API_BASE}/state"`, {
      timeout: 3000,
      encoding: "utf-8",
    });
    const state = JSON.parse(out) as {
      windows: Array<{ id: number; title: string; appType: string; summary?: string }>;
    };
    const win = state.windows.find((w) => w.appType === appId);
    if (win) {
      return `[wibwob] ${win.title} (id:${win.id}) — ${win.summary ?? "no summary"}`;
    }
  } catch { /* API down or parse failed — image alone is still useful */ }
  return "";
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash") return;
    if (!isEnabled()) return;
    if (process.platform !== "darwin") return;

    const cmd = (event.input as { command?: string }).command ?? "";
    if (!cmd.includes(RELOAD_MARKER)) return;

    // Only fire on successful reload (script prints ✓ on success)
    const resultText = event.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    if (!resultText.includes("✓")) return;

    // Wait for blessed to finish rendering
    await new Promise((r) => setTimeout(r, RENDER_DELAY_MS));

    // Capture the Ghostty window
    if (!captureGhosttyWindow()) return; // Ghostty not found or screencapture failed

    // Resize to 1× to keep token cost low
    resizeSnap();

    // Read as base64
    let base64Data: string;
    try {
      base64Data = readFileSync(SNAP_PATH).toString("base64");
    } catch { return; }

    // Fetch semantic state summary for the reloaded microapp
    const idMatch = cmd.match(/reload-microapp\.sh\s+([\w.]+)/);
    const summary = idMatch?.[1] ? fetchWindowSummary(idMatch[1]) : "";

    // Inject state summary + image into the tool result
    return {
      content: [
        ...event.content,
        ...(summary ? [{ type: "text" as const, text: summary }] : []),
        { type: "image" as const, data: base64Data, mimeType: "image/png" },
      ],
    };
  });

  // ── Commands ────────────────────────────────────────────────────────────────

  pi.registerCommand("wibwob-eyes", {
    description: "Auto-screenshot after reload-microapp.sh. Usage: /wibwob-eyes [on|off]",
    handler: async (args, ctx) => {
      const arg = args?.trim().toLowerCase();
      if (arg === "off") {
        process.env["WIBWOB_EYES"] = "0";
        ctx.ui.notify("wibwob-eyes: disabled for this session", "info");
        return;
      }
      if (arg === "on") {
        process.env["WIBWOB_EYES"] = "1";
        ctx.ui.notify("wibwob-eyes: enabled", "info");
        return;
      }
      const status  = isEnabled() ? "on" : "off";
      const hasHelper = existsSync(HELPER);
      const winId   = hasHelper ? (ghosttyWindowId() ?? "not found") : "helper not built";
      ctx.ui.notify(
        `wibwob-eyes: ${status} · Ghostty window ${winId} · /wibwob-eyes on|off`,
        "info"
      );
    },
  });
}
