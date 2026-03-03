/**
 * wwdos-state.ts — project-local pi extension
 *
 * Injects a compact live WibWob-DOS desktop snapshot into the system prompt
 * before every agent turn. Agents always know what windows are open, what is
 * focused, and the current theme — without having to call the control API
 * themselves or paste large state dumps into chat.
 *
 * Requires the app to be running on port 8099. If the app is not running,
 * the injection is silently skipped (no noise, no errors).
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
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  details?: Record<string, unknown>;
}

interface AppState {
  windows?: WindowState[];
  app?: { theme?: string };
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

function formatState(state: AppState): string {
  const windows = state.windows ?? [];
  if (windows.length === 0) return "";

  const f = state.focus;
  const focusLabel = f ? `${f.windowId}:${f.kind}` : "none focused";
  const screen = state.screen;
  const desktop = screen ? `${screen.width}x${screen.height}` : "?";
  const theme = state.app?.theme ?? "?";

  const lines: string[] = [
    `## WibWob-DOS desktop — ${windows.length} window${windows.length === 1 ? "" : "s"} | focus: ${focusLabel} | theme: ${theme} | desktop: ${desktop}`,
  ];

  for (const w of windows) {
    const pos = w.left != null ? ` @${w.left},${w.top}` : "";
    const size = w.width != null ? ` ${w.width}x${w.height}` : "";
    const foc = w.focused ? " [focused]" : "";
    const type = w.appType ? `${w.kind}(${w.appType})` : w.kind;
    // surface useful detail fields for focused/microapp windows
    const d = w.details ?? {};
    const extras: string[] = [];
    if (d.mode) extras.push(`mode:${d.mode}`);
    if (d.voice) extras.push(`voice:${d.voice}`);
    if (d.currentTime) extras.push(`time:${d.currentTime}`);
    if (d.streaming !== undefined) extras.push(`streaming:${d.streaming}`);
    const detail = extras.length ? `  {${extras.join(", ")}}` : "";
    lines.push(`  ${String(w.id).padStart(2)}  ${type.padEnd(30)} ${w.title}${size}${pos}${foc}${detail}`);
  }

  lines.push(`Use ./scripts/screenshot-window.sh "<title>" to inspect any window visually.`);

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    const state = await fetchState();
    if (!state) return; // app not running — skip silently

    const snippet = formatState(state);
    if (!snippet) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + snippet,
    };
  });
}
