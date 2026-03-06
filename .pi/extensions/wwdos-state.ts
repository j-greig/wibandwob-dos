/**
 * wwdos-state.ts — project-local pi extension
 *
 * Injects a compact WibWob-DOS desktop snapshot into the system prompt
 * before every agent turn. Covers: app status, theme, desktop size,
 * and one line per window (name, kind, w×h, position).
 *
 * Map is NOT injected by default — call scripts/minimap.sh for spatial view.
 *
 * Fails silently if the app is not running on port 8099.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const API = "http://127.0.0.1:8099";
const TIMEOUT_MS = 400;

interface WindowState {
  id: number;
  kind: string;
  title: string;
  appType?: string;
  focused?: boolean;
  zIndex?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  details?: Record<string, unknown>;
}

interface AppState {
  windows?: WindowState[];
  app?: { theme?: string; sessionId?: string; instanceLabel?: string };
  screen?: { width: number; height: number };
  focus?: { windowId: number; kind: string; title: string };
}

async function fetchState(): Promise<AppState | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${API}/state`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as AppState;
  } catch {
    return null;
  }
}

function formatCompact(state: AppState): string {
  const windows = state.windows ?? [];
  const f = state.focus;
  const focusLabel = f ? `${f.windowId}:${f.title}` : "none";
  const screen = state.screen;
  const desktop = screen ? `${screen.width}x${screen.height}` : "?";
  const theme = state.app?.theme ?? "?";
  const sessionId = state.app?.sessionId;
  const instanceLabel = state.app?.instanceLabel;
  const identity = instanceLabel ? `${instanceLabel}·${sessionId}` : sessionId;
  const n = windows.length;

  const lines: string[] = [
    `WibWob-DOS  theme:${theme}  desktop:${desktop}  ${n} window${n === 1 ? "" : "s"}  focus:${focusLabel}${identity ? `  id:${identity}` : ""}`,
  ];

  for (const w of windows) {
    const x = w.left ?? "?";
    const y = w.top ?? "?";
    const ww = w.width ?? "?";
    const wh = w.height ?? "?";
    const foc = w.focused ? " ◀" : "";
    const kind = w.appType ?? w.kind;
    // surface a few meaningful detail fields inline, no contentPreview
    const d = w.details ?? {};
    const extras: string[] = [];
    if (d.mode) extras.push(`${d.mode}`);
    if (d.voice) extras.push(`${d.voice}`);
    if (d.font) extras.push(`font:${d.font}`);
    const detail = extras.length ? `  [${extras.join(" ")}]` : "";
    lines.push(
      `  ${String(w.id).padStart(2)}  ${kind.padEnd(24)} ${w.title.padEnd(22)} ${String(ww).padStart(3)}x${String(wh).padEnd(3)}  @${x},${y}${foc}${detail}`
    );
  }

  lines.push(`Spatial map: scripts/minimap.sh  ·  Overlaps + fix hints: scripts/overlap-check.sh`);

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    const state = await fetchState();
    if (!state) return; // app not running — skip silently

    const snippet = formatCompact(state);
    if (!snippet) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + snippet,
    };
  });
}
