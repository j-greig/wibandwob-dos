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
} from "../../src/services/microapp-sdk.js";

type PaneKey = "overview" | "ui" | "windows" | "commands" | "stats";

interface InspectorState {
  snapshot?: RuntimeInspectionSnapshot;
  commands: CommandListItem[];
  error?: string;
  updatedAt: string;
  refreshInFlight: boolean;
}

function clip(value: string, width: number): string {
  if (width <= 0) return "";
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
}

function fmtBool(value: boolean): string {
  return value ? "yes" : "no";
}

function fmtList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

// ── Pane renderers ────────────────────────────────────────────────────────

function renderOverview(state: InspectorState): string {
  if (!state.snapshot) {
    return state.error ? `Runtime Inspector\n\nError: ${state.error}` : "Runtime Inspector\n\nLoading…";
  }
  const s = state.snapshot;
  const app = s.state.app;
  const focus = s.state.focus;
  const overlay = s.ui.overlay;
  const blockerLabels = s.ui.blockers.map((b) => b.label || b.type);
  return [
    "Runtime Inspector",
    "",
    "Identity",
    `  instanceId      ${app.instanceId ?? "?"}`,
    `  instanceLabel   ${app.instanceLabel ?? "-"}`,
    `  theme           ${app.theme ?? "-"}`,
    `  api             ${app.controlApiBaseUrl ?? "-"}`,
    "",
    "Desktop",
    `  windows         ${s.state.windows.length}`,
    `  focus           ${focus.windowId ?? "none"} ${focus.title ?? ""}`.trimEnd(),
    `  menu            ${s.ui.menu.open ? s.ui.menu.label ?? "open" : "closed"}`,
    `  overlay         ${overlay ? `${overlay.type}${overlay.label ? ` · ${overlay.label}` : ""}` : "none"}`,
    `  blocked         ${fmtBool(s.ui.blocked)}`,
    `  blockers        ${fmtList(blockerLabels)}`,
    "",
    "Health",
    `  render fps      ${s.stats.render.fps.toFixed(1)}`,
    `  avg frame       ${s.stats.render.avgFrameMs.toFixed(1)}ms`,
    `  rss             ${s.stats.rssMb.toFixed(1)}MB`,
    `  heap            ${s.stats.heapUsedMb.toFixed(1)}MB`,
    `  agent           ${s.stats.agent.active ? "active" : "idle"}`,
    `  scramble        ${s.scramble.status} · ${s.scramble.model}`,
    "",
    `Commands visible: ${state.commands.length}`,
    `Updated: ${state.updatedAt}`,
  ].join("\n");
}

function renderUi(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "Loading UI state…";
  const overlay = s.ui.overlay;
  const lines = [
    "UI State",
    "",
    `menu.open     ${fmtBool(s.ui.menu.open)}`,
    `menu.label    ${s.ui.menu.label ?? "-"}`,
    `overlay.type  ${overlay?.type ?? "-"}`,
    `overlay.label ${overlay?.label ?? "-"}`,
    `blocked       ${fmtBool(s.ui.blocked)}`,
    "",
    "Blockers",
  ];
  if (s.ui.blockers.length === 0) {
    lines.push("  none");
  } else {
    for (const b of s.ui.blockers) {
      lines.push(`  - ${b.type}${b.label ? ` · ${b.label}` : ""}`);
      if (b.escapeCommands?.length) lines.push(`      escape: ${b.escapeCommands.join(", ")}`);
      if (b.continueCommands?.length) lines.push(`      continue: ${b.continueCommands.join(", ")}`);
    }
  }
  return lines.join("\n");
}

function renderWindows(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "Loading windows…";
  if (s.state.windows.length === 0) return "No open windows.";
  const windows = s.state.windows.slice().sort((a, b) => a.zIndex - b.zIndex);
  return [
    "Windows",
    "",
    " id  type                     title                          pos       size     z  f",
    ...windows.map((w) => {
      const appType = clip(w.appType ?? w.kind, 24).padEnd(24);
      const title = clip(w.title, 30).padEnd(30);
      const pos = `@${w.left},${w.top}`.padEnd(9);
      const size = `${w.width}x${w.height}`.padEnd(8);
      return `${String(w.id).padStart(3)}  ${appType} ${title} ${pos} ${size} ${String(w.zIndex).padStart(2)}  ${w.focused ? "*" : "-"}`;
    }),
  ].join("\n");
}

function renderCommands(commands: CommandListItem[]): string {
  if (commands.length === 0) return "Loading commands…";
  const rows = commands.slice().sort((a, b) => a.id.localeCompare(b.id));
  return [
    `Commands (${rows.length})`,
    "",
    " id                                 surf         availability  label",
    ...rows.map((c) => {
      const surfaces = clip(c.surfaces.join(","), 12).padEnd(12);
      const availability = (c.available ? "ready" : "off").padEnd(12);
      return ` ${clip(c.id, 34).padEnd(34)} ${surfaces} ${availability} ${c.label}`;
    }),
  ].join("\n");
}

function renderStats(s: RuntimeInspectionSnapshot | undefined): string {
  if (!s) return "Loading stats…";
  return [
    "Runtime Stats",
    "",
    "Render",
    `  fps              ${s.stats.render.fps.toFixed(1)}`,
    `  avgFrameMs       ${s.stats.render.avgFrameMs.toFixed(1)}`,
    `  totalFrames      ${s.stats.render.totalFrames}`,
    "",
    "Memory",
    `  rssMb            ${s.stats.rssMb.toFixed(1)}`,
    `  heapUsedMb       ${s.stats.heapUsedMb.toFixed(1)}`,
    "",
    "Agent",
    `  active           ${fmtBool(s.stats.agent.active)}`,
    `  streaming        ${fmtBool(s.stats.agent.streaming)}`,
    `  messageCount     ${s.stats.agent.messageCount}`,
    `  toolRunCount     ${s.stats.agent.toolRunCount}`,
    "",
    "Scramble",
    `  status           ${s.scramble.status}`,
    `  model            ${s.scramble.model}`,
    `  sessionId        ${s.scramble.sessionId}`,
  ].join("\n");
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
    paneContent.set("stats", renderStats(state.snapshot));
  }

  function renderChrome() {
    const app = state.snapshot?.state.app;
    const focus = state.snapshot?.state.focus;
    header.update({
      left: ` {bold}Runtime Inspector{/bold}  instance ${app?.instanceId ?? "?"} · windows ${state.snapshot?.state.windows.length ?? 0} · focus ${clip(focus?.title ?? "none", 40)}`,
      right: `updated ${state.updatedAt} `,
    });
    const tabName = paneKeys[tabs.getActive()] ?? "overview";
    footer.update({
      left: ` tab ${tabs.getActive() + 1}/${paneKeys.length} · ${tabName}`,
      right: state.error
        ? `error: ${clip(state.error, 60)} `
        : "1-5 switch · Tab next · j/k scroll · r refresh ",
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
