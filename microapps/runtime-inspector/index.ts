import blessed from "blessed";
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
  prevSnapshot?: RuntimeInspectionSnapshot;
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

function delta(current: number, previous: number | undefined): string {
  if (previous === undefined) return "";
  if (current > previous) return " ▲";
  if (current < previous) return " ▼";
  return "";
}

function fmtUptime(totalFrames: number, fps: number): string {
  const secs = fps > 0 ? Math.floor(totalFrames / fps) : 0;
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
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

  // ── Identity + Desktop (two-column layout) ──
  const colW = 58;
  const identLines: string[] = [];
  identLines.push(sectionHeader("IDENTITY", colW));
  identLines.push(kvLine("instance", `${app.instanceId ?? "?"}`, 12));
  identLines.push(kvLine("theme", app.theme ?? "-", 12));
  identLines.push(kvLine("api", app.controlApiBaseUrl ?? "-", 12));
  identLines.push(sectionFooter(colW));

  const deskLines: string[] = [];
  deskLines.push(sectionHeader("DESKTOP", colW));
  deskLines.push(kvLine("windows", String(s.state.windows.length), 12));
  deskLines.push(kvLine("focus", clip(`${focus.windowId ?? "—"} ${focus.title ?? ""}`.trimEnd(), 38), 12));
  deskLines.push(kvLine("menu", s.ui.menu.open ? `● ${s.ui.menu.label ?? "open"}` : "○ closed", 12));
  deskLines.push(kvLine("overlay", overlay ? clip(`${overlay.type}${overlay.label ? ` · ${overlay.label}` : ""}`, 38) : "—", 12));
  deskLines.push(kvLine("blocked", `${fmtBool(s.ui.blocked)} ${s.ui.blocked ? clip(fmtList(blockerLabels), 30) : ""}`, 12));
  deskLines.push(sectionFooter(colW));

  // Merge side by side
  const maxRows = Math.max(identLines.length, deskLines.length);
  for (let i = 0; i < maxRows; i++) {
    const left = (identLines[i] ?? "").padEnd(colW);
    const right = deskLines[i] ?? "";
    lines.push(`${left}  ${right}`);
  }
  lines.push("");

  // ── Health + Agent (two-column layout) ──
  const prev = state.prevSnapshot;
  const healthLines: string[] = [];
  healthLines.push(sectionHeader("HEALTH", colW));
  healthLines.push(kvLine("fps", `${s.stats.render.fps.toFixed(1)}${delta(s.stats.render.fps, prev?.stats.render.fps)}`, 12));
  healthLines.push(kvLine("frame", `${s.stats.render.avgFrameMs.toFixed(1)}ms${delta(s.stats.render.avgFrameMs, prev?.stats.render.avgFrameMs)}`, 12));
  const rssMax = Math.max(512, Math.ceil(s.stats.rssMb / 128) * 128);
  const heapMax = Math.max(256, Math.ceil(s.stats.heapUsedMb / 64) * 64);
  healthLines.push(kvLine("rss", `${s.stats.rssMb.toFixed(0)}/${rssMax}MB ${progressBar(s.stats.rssMb, rssMax, 18)}${delta(s.stats.rssMb, prev?.stats.rssMb)}`, 12));
  healthLines.push(kvLine("heap", `${s.stats.heapUsedMb.toFixed(0)}/${heapMax}MB ${progressBar(s.stats.heapUsedMb, heapMax, 18)}${delta(s.stats.heapUsedMb, prev?.stats.heapUsedMb)}`, 12));
  healthLines.push(sectionFooter(colW));

  const agentLines: string[] = [];
  agentLines.push(sectionHeader("WIB&WOB AGENT", colW));
  agentLines.push(kvLine("status", s.stats.agent.active ? "● ACTIVE" : "○ idle", 12));
  agentLines.push(kvLine("streaming", fmtBool(s.stats.agent.streaming), 12));
  agentLines.push(kvLine("messages", String(s.stats.agent.messageCount), 12));
  agentLines.push(kvLine("tools", String(s.stats.agent.toolRunCount), 12));
  agentLines.push(kvLine("scramble", `${s.scramble.status} · ${s.scramble.model}`, 12));
  agentLines.push(sectionFooter(colW));

  const maxRows2 = Math.max(healthLines.length, agentLines.length);
  for (let i = 0; i < maxRows2; i++) {
    const left = (healthLines[i] ?? "").padEnd(colW);
    const right = agentLines[i] ?? "";
    lines.push(`${left}  ${right}`);
  }
  lines.push("");

  // ── Windows (compact, top by z-order) ──
  const windows = s.state.windows.slice().sort((a, b) => b.zIndex - a.zIndex);
  const showCount = Math.min(windows.length, 8);
  lines.push(sectionHeader(`WINDOWS (${windows.length})${windows.length > showCount ? ` · top ${showCount}  →  Windows tab` : ""}`));
  lines.push(`│ ${"ID".padEnd(4)} ${"TYPE".padEnd(22)} ${"TITLE".padEnd(26)} ${"POS".padEnd(9)} ${"SIZE".padEnd(8)} Z`);
  lines.push(`│ ${"─".repeat(4)} ${"─".repeat(22)} ${"─".repeat(26)} ${"─".repeat(9)} ${"─".repeat(8)} ──`);
  for (let i = 0; i < showCount; i++) {
    const w = windows[i]!;
    const marker = w.focused ? "▸" : " ";
    const appType = clip(w.appType ?? w.kind, 22).padEnd(22);
    const title = clip(w.title, 26).padEnd(26);
    const pos = `@${w.left},${w.top}`.padEnd(9);
    const size = `${w.width}x${w.height}`.padEnd(8);
    lines.push(`│${marker}${String(w.id).padStart(3)} ${appType} ${title} ${pos} ${size} ${String(w.zIndex).padStart(2)}`);
  }
  lines.push(sectionFooter());
  lines.push("");

  // ── UI summary (one-liner) ──
  const menuStr = s.ui.menu.open ? `menu: ● ${s.ui.menu.label ?? "open"}` : "menu: ○";
  const overlayStr = overlay ? `overlay: ${overlay.type}` : "overlay: —";
  const blockerStr = s.ui.blocked ? `blocked: ● (${s.ui.blockers.length})` : "blocked: ○";
  lines.push(`  UI  ${menuStr}  ·  ${overlayStr}  ·  ${blockerStr}  →  Ui tab`);
  lines.push("");

  // ── Footer ──
  const winCount = s.state.windows.length;
  const uptime = fmtUptime(s.stats.render.totalFrames, s.stats.render.fps);
  // Dynamic status pulse
  let pulse = "nominal";
  if (s.stats.agent.active) pulse = "agent active";
  else if (s.stats.rssMb > 600) pulse = "high memory";
  else if (s.stats.render.fps < 2) pulse = "low fps";
  lines.push(`  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
  lines.push(`  ${winCount} wins · ${state.commands.length} cmds · up ${uptime} · ${pulse} · ${state.updatedAt}`);

  return lines.join("\n");
}

function renderUi(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "  ◌ Loading UI state…";
  const overlay = s.ui.overlay;
  const colW = 58;
  const lines: string[] = [];

  // ── Menu + Overlay (two-column) ──
  const menuLines: string[] = [];
  menuLines.push(sectionHeader("MENU", colW));
  menuLines.push(kvLine("open", fmtBool(s.ui.menu.open), 12));
  menuLines.push(kvLine("label", s.ui.menu.label ?? "—", 12));
  menuLines.push(sectionFooter(colW));

  const ovLines: string[] = [];
  ovLines.push(sectionHeader("OVERLAY", colW));
  ovLines.push(kvLine("type", overlay?.type ?? "—", 12));
  ovLines.push(kvLine("label", overlay?.label ?? "—", 12));
  ovLines.push(sectionFooter(colW));

  const maxR = Math.max(menuLines.length, ovLines.length);
  for (let i = 0; i < maxR; i++) {
    const left = (menuLines[i] ?? "").padEnd(colW);
    const right = ovLines[i] ?? "";
    lines.push(`${left}  ${right}`);
  }
  lines.push("");

  // ── Blockers (full width) ──
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
    const marker = w.focused ? "◆" : "·";
    const prefix = w.focused ? "▸" : " ";
    lines.push(`│${prefix}${String(w.id).padStart(3)}  ${appType} ${title} ${pos} ${size} ${String(w.zIndex).padStart(2)}  ${marker}`);
  }
  lines.push(sectionFooter());
  return lines.join("\n");
}

function renderCommands(commands: CommandListItem[]): string {
  if (commands.length === 0) return "  ◌ Loading commands…";
  const rows = commands.slice().sort((a, b) => a.id.localeCompare(b.id));
  const ready = rows.filter((c) => c.available).length;

  // Namespace summary
  const ns = new Map<string, number>();
  for (const c of rows) {
    const prefix = c.id.split(".").slice(0, -1).join(".") || c.id;
    ns.set(prefix, (ns.get(prefix) ?? 0) + 1);
  }
  const topNs = [...ns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const nsSummary = topNs.map(([k, v]) => `${k} ${v}`).join(" · ");

  const lines: string[] = [];
  lines.push(sectionHeader(`COMMANDS (${rows.length} total, ${ready} ready)`));
  lines.push(`│  ${nsSummary}`);
  lines.push(`│`);
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
  const colW = 58;

  const lines: string[] = [];

  // ── Render + Memory (two-column) ──
  const renderLines: string[] = [];
  renderLines.push(sectionHeader("RENDER", colW));
  renderLines.push(kvLine("fps", `${s.stats.render.fps.toFixed(1)}  ${sparkline(fpsVals)}`, 12));
  renderLines.push(kvLine("avg frame", `${s.stats.render.avgFrameMs.toFixed(1)}ms`, 12));
  renderLines.push(kvLine("frames", String(s.stats.render.totalFrames), 12));
  renderLines.push(sectionFooter(colW));

  const memLines: string[] = [];
  memLines.push(sectionHeader("MEMORY", colW));
  memLines.push(kvLine("rss", `${s.stats.rssMb.toFixed(0)}MB ${progressBar(s.stats.rssMb, 512, 18)}`, 12));
  memLines.push(kvLine("rss trend", sparkline(rssVals), 12));
  memLines.push(kvLine("heap", `${s.stats.heapUsedMb.toFixed(0)}MB ${progressBar(s.stats.heapUsedMb, 256, 18)}`, 12));
  memLines.push(kvLine("heap trend", sparkline(heapVals), 12));
  memLines.push(sectionFooter(colW));

  const maxR1 = Math.max(renderLines.length, memLines.length);
  for (let i = 0; i < maxR1; i++) {
    const left = (renderLines[i] ?? "").padEnd(colW);
    const right = memLines[i] ?? "";
    lines.push(`${left}  ${right}`);
  }
  lines.push("");

  // ── Agent + Scramble (two-column) ──
  const agentLines: string[] = [];
  agentLines.push(sectionHeader("WIB&WOB AGENT", colW));
  agentLines.push(kvLine("active", s.stats.agent.active ? "● ACTIVE" : "○ idle", 12));
  agentLines.push(kvLine("streaming", fmtBool(s.stats.agent.streaming), 12));
  agentLines.push(kvLine("messages", String(s.stats.agent.messageCount), 12));
  agentLines.push(kvLine("tool runs", String(s.stats.agent.toolRunCount), 12));
  agentLines.push(sectionFooter(colW));

  const scrLines: string[] = [];
  scrLines.push(sectionHeader("SCRAMBLE", colW));
  scrLines.push(kvLine("status", s.scramble.status, 12));
  scrLines.push(kvLine("model", s.scramble.model, 12));
  scrLines.push(kvLine("session", s.scramble.sessionId, 12));
  scrLines.push(sectionFooter(colW));

  const maxR2 = Math.max(agentLines.length, scrLines.length);
  for (let i = 0; i < maxR2; i++) {
    const left = (agentLines[i] ?? "").padEnd(colW);
    const right = scrLines[i] ?? "";
    lines.push(`${left}  ${right}`);
  }

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
    height: 58,
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

  const header = createHeaderBar(win.body, { left: "", height: 2 });

  const tabs = createTabs(win.body, {
    tabs: paneKeys.map((k) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), content: "" })),
    active: 0,
    bottomOffset: 2,
  });
  // Offset tabs below header
  (tabs.element as any).top = 2;

  const footer = createStatusBar(win.body, { height: 2 });

  // Tab underline rule — shows which tab is active with a positional marker
  const tabRule = blessed.box({
    parent: win.body,
    top: 3,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: "white", bg: undefined },
    content: "",
  });

  function renderTabRule() {
    const labels = paneKeys.map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    const parts: string[] = [];
    for (let i = 0; i < labels.length; i++) {
      const label = ` ${labels[i]} `;
      if (i === tabs.getActive()) {
        parts.push("▀".repeat(label.length));
      } else {
        parts.push(" ".repeat(label.length));
      }
      if (i < labels.length - 1) {
        parts.push(" ");
      }
    }
    tabRule.setContent(parts.join(""));
  }

  const scroll = createScrollView(win.body, {
    topOffset: 4,
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
    const winCount = state.snapshot?.state.windows.length ?? 0;
    const fps = state.snapshot?.stats.render.fps.toFixed(0) ?? "—";
    const snap = state.snapshot;
    const up = snap ? fmtUptime(snap.stats.render.totalFrames, snap.stats.render.fps) : "—";
    header.update({
      left: ` ${spin}  ${app?.instanceId ?? "?"}  ◆ ${winCount} wins  ${agentIcon}  ${fps} fps  up ${up}`,
      right: `${state.updatedAt} `,
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
    renderTabRule();
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
      state.prevSnapshot = state.snapshot;
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
    renderTabRule();
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
    tabRule.destroy();
    footer.destroy();
    scroll.destroy();
  });

  win.setFocusTarget(scroll.element);
  renderAll();
  void refresh();
}
