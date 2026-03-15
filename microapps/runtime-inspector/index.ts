import blessed from "blessed";
import type {
  CommandListItem,
  MicroappHost,
  RuntimeInspectionSnapshot,
  TabDef,
} from "../../src/services/microapp-sdk.js";
import {
  clearTimers,
  createScrollbar,
  createTabs,
  createTimer,
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

function renderOverview(state: InspectorState): string {
  if (!state.snapshot) {
    return state.error ? `Runtime Inspector\n\nError: ${state.error}` : "Runtime Inspector\n\nLoading…";
  }
  const snapshot = state.snapshot;
  const app = snapshot.state.app;
  const focus = snapshot.state.focus;
  const overlay = snapshot.ui.overlay;
  const blockerLabels = snapshot.ui.blockers.map((blocker) => blocker.label || blocker.type);
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
    `  windows         ${snapshot.state.windows.length}`,
    `  focus           ${focus.windowId ?? "none"} ${focus.title ?? ""}`.trimEnd(),
    `  menu            ${snapshot.ui.menu.open ? snapshot.ui.menu.label ?? "open" : "closed"}`,
    `  overlay         ${overlay ? `${overlay.type}${overlay.label ? ` · ${overlay.label}` : ""}` : "none"}`,
    `  blocked         ${fmtBool(snapshot.ui.blocked)}`,
    `  blockers        ${fmtList(blockerLabels)}`,
    "",
    "Health",
    `  render fps      ${snapshot.stats.render.fps.toFixed(1)}`,
    `  avg frame       ${snapshot.stats.render.avgFrameMs.toFixed(1)}ms`,
    `  rss             ${snapshot.stats.rssMb.toFixed(1)}MB`,
    `  heap            ${snapshot.stats.heapUsedMb.toFixed(1)}MB`,
    `  agent           ${snapshot.stats.agent.active ? "active" : "idle"}`,
    `  scramble        ${snapshot.scramble.status} · ${snapshot.scramble.model}`,
    "",
    `Commands visible: ${state.commands.length}`,
    `Updated: ${state.updatedAt}`,
  ].join("\n");
}

function renderUi(snapshot: RuntimeInspectionSnapshot | undefined): string {
  if (!snapshot) return "Loading UI state…";
  const overlay = snapshot.ui.overlay;
  const lines = [
    "UI State",
    "",
    `menu.open     ${fmtBool(snapshot.ui.menu.open)}`,
    `menu.label    ${snapshot.ui.menu.label ?? "-"}`,
    `overlay.type  ${overlay?.type ?? "-"}`,
    `overlay.label ${overlay?.label ?? "-"}`,
    `blocked       ${fmtBool(snapshot.ui.blocked)}`,
    "",
    "Blockers",
  ];

  if (snapshot.ui.blockers.length === 0) {
    lines.push("  none");
  } else {
    for (const blocker of snapshot.ui.blockers) {
      lines.push(`  - ${blocker.type}${blocker.label ? ` · ${blocker.label}` : ""}`);
      if (blocker.escapeCommands?.length) {
        lines.push(`      escape: ${blocker.escapeCommands.join(", ")}`);
      }
      if (blocker.continueCommands?.length) {
        lines.push(`      continue: ${blocker.continueCommands.join(", ")}`);
      }
    }
  }

  return lines.join("\n");
}

function renderWindows(snapshot: RuntimeInspectionSnapshot | undefined): string {
  if (!snapshot) return "Loading windows…";
  if (snapshot.state.windows.length === 0) return "No open windows.";
  const windows = snapshot.state.windows.slice().sort((a, b) => a.zIndex - b.zIndex);
  return [
    "Windows",
    "",
    " id  type                     title                          pos       size     z  f",
    ...windows.map((window) => {
      const appType = clip(window.appType ?? window.kind, 24).padEnd(24);
      const title = clip(window.title, 30).padEnd(30);
      const pos = `@${window.left},${window.top}`.padEnd(9);
      const size = `${window.width}x${window.height}`.padEnd(8);
      return `${String(window.id).padStart(3)}  ${appType} ${title} ${pos} ${size} ${String(window.zIndex).padStart(2)}  ${window.focused ? "*" : "-"}`;
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
    ...rows.map((command) => {
      const surfaces = clip(command.surfaces.join(","), 12).padEnd(12);
      const availability = (command.available ? "ready" : "off").padEnd(12);
      return ` ${clip(command.id, 34).padEnd(34)} ${surfaces} ${availability} ${command.label}`;
    }),
  ].join("\n");
}

function renderStats(snapshot: RuntimeInspectionSnapshot | undefined): string {
  if (!snapshot) return "Loading stats…";
  const render = snapshot.stats.render;
  const agent = snapshot.stats.agent;
  const scramble = snapshot.scramble;
  return [
    "Runtime Stats",
    "",
    "Render",
    `  fps              ${render.fps.toFixed(1)}`,
    `  avgFrameMs       ${render.avgFrameMs.toFixed(1)}`,
    `  totalFrames      ${render.totalFrames}`,
    "",
    "Memory",
    `  rssMb            ${snapshot.stats.rssMb.toFixed(1)}`,
    `  heapUsedMb       ${snapshot.stats.heapUsedMb.toFixed(1)}`,
    "",
    "Agent",
    `  active           ${fmtBool(agent.active)}`,
    `  streaming        ${fmtBool(agent.streaming)}`,
    `  messageCount     ${agent.messageCount}`,
    `  toolRunCount     ${agent.toolRunCount}`,
    "",
    "Scramble",
    `  status           ${scramble.status}`,
    `  model            ${scramble.model}`,
    `  sessionId        ${scramble.sessionId}`,
  ].join("\n");
}

function createScrollPane(parent: blessed.Widgets.BoxElement, themeFn: MicroappHost["theme"]) {
  return blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: createScrollbar(),
    style: themeFn().body,
  });
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Runtime Inspector",
    description: "Open the runtime inspection microapp.",
    menu: [{ category: "applications", order: 165, label: "Runtime Inspector" }],
    palette: { order: 165, label: "Runtime Inspector" },
    action: () => openRuntimeInspector(host),
  });

  // ── Workspace snapshot — COAT workspace seam ──
  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return {
        activeTab: state.activeTab ?? "Overview",
      };
    },
    restore: (_snapshot, _payload) => {
      host.runCommand("open");
    },
  });
}

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
  const panes = new Map<PaneKey, blessed.Widgets.BoxElement>();
  const paneOrder: PaneKey[] = ["overview", "ui", "windows", "commands", "stats"];

  const root = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: host.theme().body,
  });
  const header = blessed.box({
    parent: root,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    tags: true,
    style: host.theme().body,
  });
  const tabsHost = blessed.box({
    parent: root,
    top: 2,
    left: 0,
    right: 0,
    bottom: 2,
    style: host.theme().body,
    keys: true,
    mouse: true,
  });
  const footer = blessed.box({
    parent: root,
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    tags: true,
    style: host.theme().body,
  });

  const tabDefs: Array<TabDef & { key: PaneKey }> = [
    { key: "overview", name: "Overview", build: (parent) => panes.set("overview", createScrollPane(parent, host.theme)) },
    { key: "ui", name: "UI", build: (parent) => panes.set("ui", createScrollPane(parent, host.theme)) },
    { key: "windows", name: "Windows", build: (parent) => panes.set("windows", createScrollPane(parent, host.theme)) },
    { key: "commands", name: "Commands", build: (parent) => panes.set("commands", createScrollPane(parent, host.theme)) },
    { key: "stats", name: "Stats", build: (parent) => panes.set("stats", createScrollPane(parent, host.theme)) },
  ];

  const tabs = createTabs(tabsHost, tabDefs);

  function activeKey(): PaneKey {
    return tabDefs[tabs.active]?.key ?? "overview";
  }

  function activePane(): blessed.Widgets.BoxElement | undefined {
    return panes.get(activeKey());
  }

  function updatePaneContent() {
    panes.get("overview")?.setContent(renderOverview(state));
    panes.get("ui")?.setContent(renderUi(state.snapshot));
    panes.get("windows")?.setContent(renderWindows(state.snapshot));
    panes.get("commands")?.setContent(renderCommands(state.commands));
    panes.get("stats")?.setContent(renderStats(state.snapshot));
  }

  function renderChrome() {
    const app = state.snapshot?.state.app;
    const focus = state.snapshot?.state.focus;
    header.setContent([
      "{bold}Runtime Inspector{/bold}",
      `instance ${app?.instanceId ?? "?"} · windows ${state.snapshot?.state.windows.length ?? 0} · focus ${clip(focus?.title ?? "none", 48)} · updated ${state.updatedAt}`,
    ].join("\n"));
    footer.setContent([
      `tab ${tabs.active + 1}/${tabDefs.length} · ${tabDefs[tabs.active]?.name ?? "Overview"} · source: /runtime/inspection + /commands/list`,
      state.error
        ? `error: ${state.error}`
        : "keys: 1-5 switch · Tab next · Shift-Tab prev · j/k or PgUp/PgDn scroll · g/G top/bottom · r refresh",
    ].join("\n"));
  }

  function renderAll() {
    updatePaneContent();
    renderChrome();
    host.screen.render();
  }

  function focusActivePane() {
    activePane()?.focus();
  }

  function scrollActive(delta: number) {
    const pane = activePane();
    if (!pane) return;
    pane.scroll(delta);
    host.screen.render();
  }

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
      focusActivePane();
    }
  }

  root.key(["tab"], () => {
    tabs.switchTo((tabs.active + 1) % tabDefs.length);
  });
  root.key(["S-tab"], () => {
    tabs.switchTo((tabs.active + tabDefs.length - 1) % tabDefs.length);
  });
  root.key(["r"], () => {
    void refresh();
  });
  root.key(["j", "down"], () => scrollActive(1));
  root.key(["k", "up"], () => scrollActive(-1));
  root.key(["pagedown"], () => scrollActive(12));
  root.key(["pageup"], () => scrollActive(-12));
  root.key(["g"], () => {
    activePane()?.setScroll(0);
    host.screen.render();
  });
  root.key(["G"], () => {
    const pane = activePane();
    if (!pane) return;
    pane.setScroll(Math.max(0, pane.getScrollHeight() - (Number(pane.height) || 0)));
    host.screen.render();
  });

  tabs.onSwitch(() => {
    renderChrome();
    focusActivePane();
    host.screen.render();
  });

  createTimer(() => {
    void refresh();
  }, 1000, timers);

  win.onResize(() => {
    renderAll();
    focusActivePane();
  });
  win.onRestyle(() => {
    root.style = host.theme().body;
    header.style = host.theme().body;
    tabsHost.style = host.theme().body;
    footer.style = host.theme().body;
    for (const pane of panes.values()) {
      pane.style = host.theme().body;
    }
    tabs.renderBar();
    renderAll();
  });
  win.describeState(() => ({
    summary: `Runtime Inspector · ${tabDefs[tabs.active]?.name ?? "Overview"} · ${state.snapshot?.state.windows.length ?? 0} windows · ${state.commands.length} commands`,
    activeTab: tabDefs[tabs.active]?.name ?? "Overview",
    instanceId: state.snapshot?.state.app.instanceId,
    blockerCount: state.snapshot?.ui.blockers.length ?? 0,
    commandCount: state.commands.length,
    focusedWindowId: state.snapshot?.state.focus.windowId,
  }));
  win.captureText(() => {
    const pane = activePane();
    return [
      header.getContent(),
      "",
      pane?.getContent() ?? "",
      "",
      footer.getContent(),
    ].join("\n");
  });
  win.onCleanup(() => {
    clearTimers(timers);
    tabs.destroy();
  });

  renderAll();
  void refresh();
  win.setFocusTarget(root);
  focusActivePane();
}
