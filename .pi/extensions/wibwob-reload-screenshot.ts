/**
 * wibwob-reload-screenshot.ts
 *
 * After every successful `reload-microapp.sh` bash call, automatically:
 *   1. Captures the Ghostty display as a PNG (auto-detects which display on first run)
 *   2. Resizes to 1× (halves dims, quarters file size) via sips
 *   3. Fetches /state to get the reloaded window's describeState summary
 *   4. Injects [text: state summary] + [image: PNG] into the tool result
 *
 * The agent sees exactly what just rendered — no human needed.
 *
 * Commands:
 *   /wibwob-eyes         — show current status + display number
 *   /wibwob-eyes off     — disable for this session
 *   /wibwob-eyes on      — re-enable
 *   /wibwob-eyes detect  — re-run display detection and cache result
 *
 * Display detection: on first run, captures each display 1-4 in turn, checks
 * whether the menu bar pixel row contains a dark bar (macOS menu bar bg) and
 * reads a PNG pixel near the top-left. Whichever display has Ghostty as the
 * active app (menu bar shows Ghostty) is cached to .pi/extensions/.wibwob-eyes-display.
 *
 * macOS only. Graceful no-op on Linux/VPS.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// ── Config ────────────────────────────────────────────────────────────────────

const RELOAD_MARKER   = "reload-microapp.sh";
const SNAP_PATH       = "/tmp/wibwob-eyes-snap.png";
const DISPLAY_CACHE   = join(import.meta.dirname, ".wibwob-eyes-display");
const API_BASE        = "http://127.0.0.1:8099";
const RENDER_DELAY_MS = 700;   // wait after reload's own 500ms sleep
const MAX_DISPLAYS    = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return process.env["WIBWOB_EYES"] !== "0";
}

function cachedDisplay(): number | null {
  try {
    if (existsSync(DISPLAY_CACHE)) {
      const n = parseInt(readFileSync(DISPLAY_CACHE, "utf-8").trim(), 10);
      return isNaN(n) ? null : n;
    }
  } catch { /* ignore */ }
  return null;
}

function saveDisplay(n: number): void {
  try { writeFileSync(DISPLAY_CACHE, String(n)); } catch { /* ignore */ }
}

/** Capture display N to SNAP_PATH. Returns true on success. */
function captureDisplay(n: number): boolean {
  if (existsSync(SNAP_PATH)) { try { unlinkSync(SNAP_PATH); } catch { /* ignore */ } }
  const r = spawnSync("screencapture", ["-x", `-D`, String(n), "-t", "png", SNAP_PATH], {
    timeout: 4000,
  });
  return r.status === 0 && existsSync(SNAP_PATH);
}

/**
 * Check whether the captured PNG looks like it has Ghostty in the menu bar.
 * Reads the PNG using osascript (avoids needing node image libs) — asks
 * whether the menu bar text at the top-left contains "Ghostty".
 * Falls back to a pixel heuristic if osascript fails.
 */
function captureHasGhostty(): boolean {
  try {
    // Use sips to read image dimensions first — if tiny, skip
    const sipsOut = spawnSync("sips", ["--getProperty", "pixelWidth", "--getProperty", "pixelHeight", SNAP_PATH], {
      encoding: "utf-8", timeout: 2000,
    });
    if (sipsOut.status !== 0) return false;

    // Use screencapture's own output — ask osascript to read the app name from
    // the running app that owns the frontmost window on that display
    // Simpler: use system_profiler or just check which app is active
    const activeApp = spawnSync("osascript", [
      "-e", `tell application "System Events" to get name of first process whose frontmost is true`
    ], { encoding: "utf-8", timeout: 2000 });

    if (activeApp.status === 0) {
      const name = activeApp.stdout.trim().toLowerCase();
      return name.includes("ghostty");
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Auto-detect which display has the frontmost Ghostty window.
 * Strategy: ask macOS which display Ghostty's front window is on via AppleScript.
 * Falls back to trying each display and checking content.
 */
function detectGhosttyDisplay(): number {
  // Primary: ask Ghostty directly via AppleScript which display it's on
  try {
    const r = spawnSync("osascript", ["-e", `
tell application "Ghostty"
  set w to front window
  set b to bounds of w
  -- bounds = {left, top, right, bottom} in screen coordinates
  -- Return left edge — we'll figure out display from x coordinate
  return item 1 of b
end tell
    `], { encoding: "utf-8", timeout: 3000 });

    if (r.status === 0) {
      const windowLeft = parseInt(r.stdout.trim(), 10);
      if (!isNaN(windowLeft)) {
        // Get display info — displays are laid out horizontally
        // Try each display, capture it, and check if Ghostty is visible
        for (let d = 1; d <= MAX_DISPLAYS; d++) {
          if (!captureDisplay(d)) continue;

          // Check if this capture has a dark terminal look — sample centre pixel
          // A WibWob-DOS terminal will be very dark (~0-30 RGB)
          // The wallpaper is orange/gradient, VS Code is light/dark grey
          try {
            const sipsInfo = spawnSync("sips", [
              "--getProperty", "pixelWidth", "--getProperty", "pixelHeight", SNAP_PATH
            ], { encoding: "utf-8", timeout: 2000 });

            const wMatch = sipsInfo.stdout.match(/pixelWidth:\s*(\d+)/);
            const hMatch = sipsInfo.stdout.match(/pixelHeight:\s*(\d+)/);
            if (!wMatch || !hMatch) continue;

            const imgW = parseInt(wMatch[1]!, 10);
            const imgH = parseInt(hMatch[1]!, 10);

            // Convert PNG to raw RGBA via sips (to a temp ppm)
            const tmpPpm = SNAP_PATH + ".ppm";
            const conv = spawnSync("sips", ["-s", "format", "ppm", SNAP_PATH, "--out", tmpPpm], {
              timeout: 5000,
            });

            if (conv.status !== 0 || !existsSync(tmpPpm)) { try { unlinkSync(tmpPpm); } catch { /* ignore */ } continue; }

            // Read PPM — header is "P6\nW H\n255\n" then raw RGB bytes
            const ppmData = readFileSync(tmpPpm);
            let headerEnd = 0;
            let newlines = 0;
            for (let i = 0; i < ppmData.length; i++) {
              if (ppmData[i] === 0x0a) { // newline
                newlines++;
                if (newlines === 3) { headerEnd = i + 1; break; }
              }
            }

            // Sample the menu bar area (row 5, col 50) and a mid-screen pixel
            // Menu bar on macOS is ~24px tall at 1×, ~48px at 2×
            const sampleRow = 10;
            const sampleCol = Math.floor(imgW * 0.25); // left quarter
            const idx = (sampleRow * imgW + sampleCol) * 3 + headerEnd;
            if (idx + 2 >= ppmData.length) continue;
            const r2 = ppmData[idx]!, g2 = ppmData[idx+1]!, b2 = ppmData[idx+2]!;

            // Menu bar is very dark on dark mode (~30,30,30), light on light mode (~240,240,240)
            // Wallpaper orange: r>180, g<150, b<80
            const isDark = r2 < 60 && g2 < 60 && b2 < 60;
            const isLight = r2 > 200 && g2 > 200 && b2 > 200;
            const isWallpaper = r2 > 150 && g2 < 150;

            try { unlinkSync(tmpPpm); } catch { /* ignore */ }
            if (isWallpaper) continue; // definitely just the desktop

            // Also check the body of the screen — a terminal should be very dark
            const bodyRow = Math.floor(imgH * 0.5);
            const bodyCol = Math.floor(imgW * 0.5);
            const bodyIdx = (bodyRow * imgW + bodyCol) * 3 + headerEnd;
            if (bodyIdx + 2 >= ppmData.length) continue;
            const br = ppmData[bodyIdx]!, bg2 = ppmData[bodyIdx+1]!, bb = ppmData[bodyIdx+2]!;
            const bodyIsDark = br < 50 && bg2 < 50 && bb < 50;

            if (bodyIsDark) {
              // High confidence: dark terminal body = Ghostty with WibWob-DOS
              saveDisplay(d);
              return d;
            }
          } catch { /* pixel check failed — try next display */ }
        }
      }
    }
  } catch { /* AppleScript failed */ }

  // Last resort: try display 1, then 2
  for (const d of [1, 2, 3]) {
    if (captureDisplay(d)) {
      saveDisplay(d);
      return d;
    }
  }

  return 1; // give up, assume 1
}

/** Resize captured PNG to 50% via sips (halves dimensions, quarters file size). */
function resizeSnap(): void {
  try {
    spawnSync("sips", ["--resampleHeightFactor", "0.5", SNAP_PATH], { timeout: 3000 });
  } catch { /* sips unavailable — skip */ }
}

/** Fetch /state, find the window matching appId, return its summary. */
function fetchWindowSummary(appId: string): string {
  try {
    const out = execSync(
      `curl -sf --max-time 2 "${API_BASE}/state"`,
      { timeout: 3000, encoding: "utf-8" }
    );
    const state = JSON.parse(out) as {
      windows: Array<{ id: number; title: string; appType: string; summary?: string }>;
    };
    const win = state.windows.find((w) => w.appType === appId);
    if (win) {
      return `[wibwob] ${win.title} (id:${win.id}) — ${win.summary ?? "no summary"}`;
    }
  } catch { /* API down or parse failed */ }
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

    // Only fire on successful reload
    const resultText = event.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    if (!resultText.includes("✓")) return;

    // Wait for blessed to finish rendering
    await new Promise((r) => setTimeout(r, RENDER_DELAY_MS));

    // Resolve display — use cache, else detect
    let display = cachedDisplay();
    if (display === null) {
      display = detectGhosttyDisplay();
    }

    // Capture
    if (!captureDisplay(display)) {
      // Cache miss or display moved — re-detect once
      display = detectGhosttyDisplay();
      if (!captureDisplay(display)) return; // give up silently
    }

    // Resize to 1×
    resizeSnap();

    // Read as base64
    let base64Data: string;
    try {
      base64Data = readFileSync(SNAP_PATH).toString("base64");
    } catch { return; }

    // State summary
    const idMatch = cmd.match(/reload-microapp\.sh\s+([\w.]+)/);
    const summary = idMatch?.[1] ? fetchWindowSummary(idMatch[1]) : "";

    // Inject into result
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
    description: "Auto-screenshot after reload-microapp.sh. Usage: /wibwob-eyes [on|off|detect]",
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

      if (arg === "detect") {
        ctx.ui.notify("wibwob-eyes: detecting Ghostty display...", "info");
        const d = detectGhosttyDisplay();
        ctx.ui.notify(`wibwob-eyes: Ghostty found on display ${d} (cached)`, "info");
        return;
      }

      // Status
      const status = isEnabled() ? "on" : "off";
      const display = cachedDisplay();
      const displayStr = display ? `display ${display}` : "display not yet detected";
      ctx.ui.notify(
        `wibwob-eyes: ${status} · ${displayStr} · /wibwob-eyes on|off|detect`,
        "info"
      );
    },
  });
}
