import type {
  CommandListItem,
  MicroappHost,
  RuntimeInspectionSnapshot,
} from "../../src/services/microapp-sdk.js";
import {
  clearTimers,
  createTimer,
  createHeaderBar,
  createStatusBar,
  createScrollView,
  createTabs,
  fetchRuntimeCommands,
  fetchRuntimeInspection,
  renderFiglet,
} from "../../src/services/microapp-sdk.js";

type PaneKey = "overview" | "ui" | "windows" | "commands" | "stats";

interface InspectorState {
  snapshot?: RuntimeInspectionSnapshot;
  commands: CommandListItem[];
  error?: string;
  updatedAt: string;
  refreshInFlight: boolean;
  fpsHistory: RingBuffer;
  rssHistory: RingBuffer;
  heapHistory: RingBuffer;
  frameHistory: RingBuffer;
  refreshCount: number;
}

function clip(value: string, width: number): string {
  if (width <= 0) return "";
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
}

function fmtBool(value: boolean): string {
  return value ? "●" : "○";
}

function fmtList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

// ── Visual helpers ────────────────────────────────────────────────────────

const SPARK = "▁▂▃▄▅▆▇█";
const BAR_FILL = "█";
const BAR_EMPTY = "░";

/** Rolling buffer for sparkline history */
class RingBuffer {
  private buf: number[];
  private pos = 0;
  private full = false;
  constructor(private size: number) { this.buf = new Array(size).fill(0); }
  push(v: number) { this.buf[this.pos] = v; this.pos = (this.pos + 1) % this.size; if (this.pos === 0) this.full = true; }
  values(): number[] {
    if (!this.full) return this.buf.slice(0, this.pos);
    return [...this.buf.slice(this.pos), ...this.buf.slice(0, this.pos)];
  }
}

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => SPARK[Math.min(Math.floor(((v - min) / range) * 7), 7)]).join("");
}

function progressBar(value: number, max: number, width: number): string {
  const ratio = Math.min(value / (max || 1), 1);
  const filled = Math.round(ratio * width);
  return BAR_FILL.repeat(filled) + BAR_EMPTY.repeat(width - filled);
}

function sectionHeader(title: string, width: number = 60): string {
  const pad = width - title.length - 4;
  return `┌─ ${title} ${"─".repeat(Math.max(0, pad))}┐`;
}

function sectionFooter(width: number = 60): string {
  return `└${"─".repeat(width - 2)}┘`;
}

function kvLine(key: string, value: string, keyWidth: number = 16): string {
  return `│  ${key.padEnd(keyWidth)} │ ${value}`;
}

function blankLine(): string {
  return "│";
}

const SPIN = ["◐", "◓", "◑", "◒"];
function spinChar(tick: number): string {
  return SPIN[tick % SPIN.length]!;
}

// ── Pane renderers ────────────────────────────────────────────────────────

function renderOverview(state: InspectorState): string {
  if (!state.snapshot) {
    return state.error
      ? `  ⚠ Error: ${state.error}`
      : "  ◌ Loading…";
  }
  const s = state.snapshot;
  const app = s.state.app;
  const focus = s.state.focus;
  const overlay = s.ui.overlay;
  const blockerLabels = s.ui.blockers.map((b) => b.label || b.type);

  const fpsVals = state.fpsHistory.values();
  const rssVals = state.rssHistory.values();
  const heapVals = state.heapHistory.values();

  const lines: string[] = [];

  // ── Figlet banner ──
  const banner = renderFiglet("INSPECT", "small");
  if (banner) {
    for (const line of banner.split("\n")) {
      if (line.trim()) lines.push(`  ${line}`);
    }
    lines.push("");
  }

  // ── Identity ──
  lines.push(sectionHeader("IDENTITY"));
  lines.push(kvLine("instance", `${app.instanceId ?? "?"} ${app.instanceLabel ? `(${app.instanceLabel})` : ""}`));
  lines.push(kvLine("theme", app.theme ?? "-"));
  lines.push(kvLine("api", app.controlApiBaseUrl ?? "-"));
  lines.push(sectionFooter());
  lines.push("");

  // ── Desktop ──
  lines.push(sectionHeader("DESKTOP"));
  lines.push(kvLine("windows", String(s.state.windows.length)));
  lines.push(kvLine("focus", `${focus.windowId ?? "—"} ${focus.title ?? ""}`.trimEnd()));
  lines.push(kvLine("menu", s.ui.menu.open ? `● ${s.ui.menu.label ?? "open"}` : "○ closed"));
  lines.push(kvLine("overlay", overlay ? `${overlay.type}${overlay.label ? ` · ${overlay.label}` : ""}` : "—"));
  lines.push(kvLine("blocked", `${fmtBool(s.ui.blocked)} ${s.ui.blocked ? fmtList(blockerLabels) : ""}`));
  lines.push(sectionFooter());
  lines.push("");

  // ── Health ──
  lines.push(sectionHeader("HEALTH"));
  lines.push(kvLine("fps", `${s.stats.render.fps.toFixed(1)}`));
  lines.push(kvLine("frame", `${s.stats.render.avgFrameMs.toFixed(1)}ms`));
  lines.push(kvLine("rss", `${s.stats.rssMb.toFixed(0)}MB  ${progressBar(s.stats.rssMb, 512, 24)}`));
  lines.push(kvLine("heap", `${s.stats.heapUsedMb.toFixed(0)}MB  ${progressBar(s.stats.heapUsedMb, 256, 24)}`));
  lines.push(sectionFooter());
  lines.push("");

  // ── Agent & Scramble ──
  lines.push(sectionHeader("AGENT"));
  lines.push(kvLine("status", s.stats.agent.active ? "● ACTIVE" : "○ idle"));
  lines.push(kvLine("streaming", fmtBool(s.stats.agent.streaming)));
  lines.push(kvLine("messages", String(s.stats.agent.messageCount)));
  lines.push(kvLine("tool runs", String(s.stats.agent.toolRunCount)));
  lines.push(kvLine("scramble", `${s.scramble.status} · ${s.scramble.model}`));
  lines.push(sectionFooter());
  lines.push("");

  // ── Footer ──
  lines.push(`  ${state.commands.length} commands  ·  ${state.updatedAt}`);

  return lines.join("\n");
}

function renderUi(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "  ◌ Loading UI state…";
  const overlay = s.ui.overlay;
  const lines: string[] = [];

  lines.push(sectionHeader("MENU"));
  lines.push(kvLine("open", fmtBool(s.ui.menu.open)));
  lines.push(kvLine("label", s.ui.menu.label ?? "—"));
  lines.push(sectionFooter());
  lines.push("");

  lines.push(sectionHeader("OVERLAY"));
  lines.push(kvLine("type", overlay?.type ?? "—"));
  lines.push(kvLine("label", overlay?.label ?? "—"));
  lines.push(sectionFooter());
  lines.push("");

  lines.push(sectionHeader("BLOCKERS"));
  lines.push(kvLine("blocked", `${fmtBool(s.ui.blocked)} ${s.ui.blockers.length > 0 ? `(${s.ui.blockers.length})` : ""}`));
  if (s.ui.blockers.length === 0) {
    lines.push(kvLine("", "none"));
  } else {
    for (const b of s.ui.blockers) {
      lines.push(kvLine("", `▸ ${b.type}${b.label ? ` · ${b.label}` : ""}`));
      if (b.escapeCommands?.length) lines.push(kvLine("  escape", b.escapeCommands.join(", ")));
      if (b.continueCommands?.length) lines.push(kvLine("  continue", b.continueCommands.join(", ")));
    }
  }
  lines.push(sectionFooter());

  return lines.join("\n");
}

function renderWindows(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "  ◌ Loading windows…";
  if (s.state.windows.length === 0) return "  No open windows.";
  const windows = s.state.windows.slice().sort((a, b) => a.zIndex - b.zIndex);
  const lines: string[] = [];
  lines.push(sectionHeader(`WINDOWS (${windows.length})`));
  lines.push(`│ ${"ID".padEnd(4)} ${"TYPE".padEnd(24)} ${"TITLE".padEnd(28)} ${"POS".padEnd(9)} ${"SIZE".padEnd(8)} ${"Z".padStart(2)}  F`);
  lines.push(`│ ${"─".repeat(4)} ${"─".repeat(24)} ${"─".repeat(28)} ${"─".repeat(9)} ${"─".repeat(8)} ${"──"}  ─`);
  for (const w of windows) {
    const appType = clip(w.appType ?? w.kind, 24).padEnd(24);
    const title = clip(w.title, 28).padEnd(28);
    const pos = `@${w.left},${w.top}`.padEnd(9);
    const size = `${w.width}x${w.height}`.padEnd(8);
    const focus = w.focused ? "◆" : "·";
    lines.push(`│ ${String(w.id).padStart(3)}  ${appType} ${title} ${pos} ${size} ${String(w.zIndex).padStart(2)}  ${focus}`);
  }
  lines.push(sectionFooter());
  return lines.join("\n");
}

function renderCommands(commands: CommandListItem[]): string {
  if (commands.length === 0) return "  ◌ Loading commands…";
  const rows = commands.slice().sort((a, b) => a.id.localeCompare(b.id));
  const ready = rows.filter((c) => c.available).length;
  const lines: string[] = [];
  lines.push(sectionHeader(`COMMANDS (${rows.length} total, ${ready} ready)`));
  lines.push(`│ ${"ID".padEnd(34)} ${"SURF".padEnd(12)} ${"AVAIL".padEnd(6)} LABEL`);
  lines.push(`│ ${"─".repeat(34)} ${"─".repeat(12)} ${"─".repeat(6)} ${"─".repeat(20)}`);
  for (const c of rows) {
    const surfaces = clip(c.surfaces.join(","), 12).padEnd(12);
    const avail = c.available ? "  ●  " : "  ○  ";
    lines.push(`│ ${clip(c.id, 34).padEnd(34)} ${surfaces} ${avail} ${c.label}`);
  }
  lines.push(sectionFooter());
  return lines.join("\n");
}

function renderStats(state: InspectorState): string {
  const s = state.snapshot;
  if (!s) return "  ◌ Loading stats…";

  const fpsVals = state.fpsHistory.values();
  const rssVals = state.rssHistory.values();
  const heapVals = state.heapHistory.values();

  const lines: string[] = [];

  lines.push(sectionHeader("RENDER"));
  lines.push(kvLine("fps", `${s.stats.render.fps.toFixed(1)}  ${sparkline(fpsVals)}`));
  lines.push(kvLine("avg frame", `${s.stats.render.avgFrameMs.toFixed(1)}ms`));
  lines.push(kvLine("total frames", String(s.stats.render.totalFrames)));
  lines.push(sectionFooter());
  lines.push("");

  lines.push(sectionHeader("MEMORY"));
  lines.push(kvLine("rss", `${s.stats.rssMb.toFixed(1)}MB  ${progressBar(s.stats.rssMb, 512, 24)}`));
  lines.push(kvLine("rss history", sparkline(rssVals)));
  lines.push(kvLine("heap", `${s.stats.heapUsedMb.toFixed(1)}MB  ${progressBar(s.stats.heapUsedMb, 256, 24)}`));
  lines.push(kvLine("heap history", sparkline(heapVals)));
  lines.push(sectionFooter());
  lines.push("");

  lines.push(sectionHeader("AGENT"));
  lines.push(kvLine("active", s.stats.agent.active ? "● ACTIVE" : "○ idle"));
  lines.push(kvLine("streaming", fmtBool(s.stats.agent.streaming)));
  lines.push(kvLine("messages", String(s.stats.agent.messageCount)));
  lines.push(kvLine("tool runs", String(s.stats.agent.toolRunCount)));
  lines.push(sectionFooter());
  lines.push("");

  lines.push(sectionHeader("SCRAMBLE"));
  lines.push(kvLine("status", s.scramble.status));
  lines.push(kvLine("model", s.scramble.model));
  lines.push(kvLine("session", s.scramble.sessionId));
  lines.push(sectionFooter());

  return lines.join("\n");
}

// ── Setup ─────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Runtime Inspector",
    description: "Open the runtime inspection microapp.",
    menu: [{ category: "applications", order: 165, label: "Runtime Inspector" }],
    palette: { order: 165, label: "Runtime Inspector" },
    action: () => openRuntimeInspector(host),
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return { activeTab: state.activeTab ?? "Overview" };
    },
    restore: () => {
      host.runCommand("open");
    },
  });
}

// ── Window ────────────────────────────────────────────────────────────────

function openRuntimeInspector(host: MicroappHost) {
  const win = host.createWindow({
    title: "Runtime Inspector",
    width: 132,
    height: 38,
    left: 6,
    top: 3,
  });

  const timers = new Set<ReturnType<typeof setInterval>>();
  const state: InspectorState = {
    commands: [],
    updatedAt: "never",
    refreshInFlight: false,
    fpsHistory: new RingBuffer(30),
    rssHistory: new RingBuffer(30),
    heapHistory: new RingBuffer(30),
    frameHistory: new RingBuffer(30),
    refreshCount: 0,
  };

  const paneKeys: PaneKey[] = ["overview", "ui", "windows", "commands", "stats"];
  const paneContent = new Map<PaneKey, string>();
  for (const k of paneKeys) paneContent.set(k, "Loading…");

  // ── SDK Handle components ──

  const header = createHeaderBar(win.body, { left: " Runtime Inspector", height: 2 });

  const tabs = createTabs(win.body, {
    tabs: paneKeys.map((k) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), content: "" })),
    active: 0,
    bottomOffset: 2,
  });
  // Offset tabs below header
  (tabs.element as any).top = 2;

  const footer = createStatusBar(win.body, { height: 2 });

  const scroll = createScrollView(win.body, {
    topOffset: 3,
    bottomOffset: 2,
    vi: true,
  });

  // ── Render ──

  function activeKey(): PaneKey {
    return paneKeys[tabs.getActive()] ?? "overview";
  }

  function updatePaneContent() {
    paneContent.set("overview", renderOverview(state));
    paneContent.set("ui", renderUi(state.snapshot));
    paneContent.set("windows", renderWindows(state.snapshot));
    paneContent.set("commands", renderCommands(state.commands));
    paneContent.set("stats", renderStats(state));
  }

  function renderChrome() {
    const app = state.snapshot?.state.app;
    const focus = state.snapshot?.state.focus;
    const spin = spinChar(state.refreshCount);
    const agentIcon = state.snapshot?.stats.agent.active ? "● AGENT" : "○ idle";
    header.update({
      left: ` {bold}Runtime Inspector{/bold}  ${spin}  ${app?.instanceId ?? "?"}  ◆ ${state.snapshot?.state.windows.length ?? 0} wins  ${agentIcon}`,
      right: `#${state.refreshCount} ${state.updatedAt} `,
    });
    const tabName = paneKeys[tabs.getActive()] ?? "overview";
    footer.update({
      left: ` tab ${tabs.getActive() + 1}/${paneKeys.length} · ${tabName}`,
      right: state.error
        ? `error: ${clip(state.error, 60)} `
        : "Tab/S-Tab switch · j/k scroll · r refresh ",
    });
  }

  function renderAll() {
    updatePaneContent();
    scroll.update({ content: paneContent.get(activeKey()) ?? "" });
    renderChrome();
    host.screen.render();
  }

  // ── Data fetch ──

  async function refresh() {
    if (state.refreshInFlight) return;
    state.refreshInFlight = true;
    try {
      const [inspectionPayload, commandsPayload] = await Promise.all([
        fetchRuntimeInspection(),
        fetchRuntimeCommands(),
      ]);
      state.snapshot = inspectionPayload.snapshot;
      state.commands = commandsPayload.commands;
      state.updatedAt = new Date().toLocaleTimeString();
      state.error = undefined;
      state.refreshCount++;
      // Push history for sparklines
      const snap = state.snapshot;
      if (snap) {
        state.fpsHistory.push(snap.stats.render.fps);
        state.rssHistory.push(snap.stats.rssMb);
        state.heapHistory.push(snap.stats.heapUsedMb);
        state.frameHistory.push(snap.stats.render.avgFrameMs);
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.refreshInFlight = false;
      renderAll();
    }
  }

  // ── Key bindings ──

  win.body.key(["tab"], () => {
    const next = (tabs.getActive() + 1) % paneKeys.length;
    tabs.update({ active: next });
    scroll.update({ content: paneContent.get(paneKeys[next]!) ?? "" });
    renderChrome();
    host.screen.render();
  });
  win.body.key(["S-tab"], () => {
    const prev = (tabs.getActive() + paneKeys.length - 1) % paneKeys.length;
    tabs.update({ active: prev });
    scroll.update({ content: paneContent.get(paneKeys[prev]!) ?? "" });
    renderChrome();
    host.screen.render();
  });
  for (let i = 1; i <= 5; i++) {
    win.body.key([String(i)], () => {
      tabs.update({ active: i - 1 });
      scroll.update({ content: paneContent.get(paneKeys[i - 1]!) ?? "" });
      renderChrome();
      host.screen.render();
    });
  }
  win.body.key(["r"], () => void refresh());
  win.body.key(["j", "down"], () => scroll.scrollTo((scroll.element as any).childBase + 1));
  win.body.key(["k", "up"], () => scroll.scrollTo(Math.max(0, (scroll.element as any).childBase - 1)));
  win.body.key(["pagedown"], () => scroll.scrollTo((scroll.element as any).childBase + 12));
  win.body.key(["pageup"], () => scroll.scrollTo(Math.max(0, (scroll.element as any).childBase - 12)));

  // ── Lifecycle ──

  tabs.onSwitch(() => {
    scroll.update({ content: paneContent.get(activeKey()) ?? "" });
    renderChrome();
    host.screen.render();
  });

  createTimer(() => void refresh(), 1000, timers);

  win.onResize(() => renderAll());
  win.onRestyle(() => {
    header.update({});
    footer.update({});
    scroll.update({ content: paneContent.get(activeKey()) ?? "" });
    renderAll();
  });

  win.describeState(() => ({
    summary: `Runtime Inspector · ${paneKeys[tabs.getActive()]} · ${state.snapshot?.state.windows.length ?? 0} windows · ${state.commands.length} commands`,
    activeTab: paneKeys[tabs.getActive()],
    instanceId: state.snapshot?.state.app.instanceId,
    blockerCount: state.snapshot?.ui.blockers.length ?? 0,
    commandCount: state.commands.length,
    focusedWindowId: state.snapshot?.state.focus.windowId,
  }));

  win.captureText(() => [
    `Runtime Inspector · ${activeKey()}`,
    "",
    paneContent.get(activeKey()) ?? "",
  ].join("\n"));

  win.onCleanup(() => {
    clearTimers(timers);
    header.destroy();
    tabs.destroy();
    footer.destroy();
    scroll.destroy();
  });

  win.setFocusTarget(scroll.element);
  renderAll();
  void refresh();
}
