import blessed from "blessed";
import type { CommandListItem, MicroappHost, RuntimeInspectionSnapshot } from "../../src/services/microapp-sdk.js";
import {
  clearTimers,
  createNodePart,
  createRow,
  createStack,
  createTimer,
  fetchRuntimeCommands,
  fetchRuntimeInspection,
} from "../../src/services/microapp-sdk.js";

function clip(value: string, width: number): string {
  if (width <= 0) return "";
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
}

function formatSummary(snapshot: RuntimeInspectionSnapshot | undefined, commands: CommandListItem[], error?: string): string {
  if (!snapshot) {
    return [
      "Runtime Inspector",
      "",
      error ? `Error: ${error}` : "Loading runtime inspection…",
    ].join("\n");
  }
  const app = snapshot.state.app;
  const focus = snapshot.state.focus;
  const overlay = snapshot.ui.overlay;
  const render = snapshot.stats.render;
  const agent = snapshot.stats.agent;
  const blockerText = snapshot.ui.blockers.length > 0
    ? snapshot.ui.blockers.map((blocker) => blocker.label || blocker.type).join(", ")
    : "none";
  return [
    "Runtime Inspector",
    "",
    `instance: ${app.instanceLabel ? `${app.instanceLabel} · ` : ""}${app.instanceId ?? "?"}`,
    `theme: ${app.theme ?? "?"}`,
    `windows: ${snapshot.state.windows.length}`,
    `focus: ${focus.windowId ?? "none"} ${focus.title ?? ""}`.trimEnd(),
    `menu: ${snapshot.ui.menu.open ? snapshot.ui.menu.label ?? "open" : "closed"}`,
    `overlay: ${overlay ? `${overlay.type}${overlay.label ? ` · ${overlay.label}` : ""}` : "none"}`,
    `blocked: ${snapshot.ui.blocked ? "yes" : "no"} (${blockerText})`,
    `fps: ${render.fps.toFixed(1)} avg ${render.avgFrameMs.toFixed(1)}ms`,
    `memory: rss ${snapshot.stats.rssMb.toFixed(1)}MB heap ${snapshot.stats.heapUsedMb.toFixed(1)}MB`,
    `agent: ${agent.active ? "active" : "idle"} · streaming ${agent.streaming ? "yes" : "no"} · msgs ${agent.messageCount}`,
    `scramble: ${snapshot.scramble.status} · ${snapshot.scramble.model}`,
    `commands: ${commands.length}`,
    "",
    "Module inspection is intentionally thin in pass 1.",
    "Use commands + windows + state as the proof seam.",
  ].join("\n");
}

function formatWindows(snapshot: RuntimeInspectionSnapshot | undefined): string {
  if (!snapshot) return "Loading windows…";
  if (snapshot.state.windows.length === 0) return "No open windows.";
  return [
    "Windows",
    "",
    ...snapshot.state.windows.map((window) => {
      const marker = window.focused ? " *" : "";
      return `${String(window.id).padStart(3)} ${clip(window.appType ?? window.kind, 24).padEnd(24)} ${clip(window.title, 24).padEnd(24)} @${window.left},${window.top} ${window.width}x${window.height}${marker}`;
    }),
  ].join("\n");
}

function formatCommands(commands: CommandListItem[]): string {
  if (commands.length === 0) return "Loading commands…";
  const sample = commands
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 28);
  return [
    `Commands (${commands.length})`,
    "",
    ...sample.map((command) => `${clip(command.id, 34).padEnd(34)} ${command.available ? "ready" : "off"} ${command.label}`),
  ].join("\n");
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Runtime Inspector",
    description: "Open the runtime inspection proof microapp.",
    menu: [{ category: "applications", order: 165, label: "Runtime Inspector" }],
    palette: { order: 165, label: "Runtime Inspector" },
    action: () => openRuntimeInspector(host),
  });
}

function openRuntimeInspector(host: MicroappHost) {
  const win = host.createWindow({ title: "Runtime Inspector", width: 126, height: 34, left: 6, top: 3 });
  const timers = new Set<ReturnType<typeof setInterval>>();

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
    tags: true,
    style: host.theme().titleBarFocused ?? host.theme().body,
  });
  const main = blessed.box({ parent: root, style: host.theme().body });
  const footer = blessed.box({ parent: root, tags: true, style: host.theme().muted ?? host.theme().body });

  const summaryBox = blessed.box({
    parent: main,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    style: host.theme().body,
  });
  const windowsBox = blessed.box({
    parent: main,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    style: host.theme().body,
  });
  const commandsBox = blessed.box({
    parent: main,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    style: host.theme().body,
  });

  const rootLayout = createStack(root, [
    { key: "header", basis: 3, part: createNodePart(header) },
    { key: "main", basis: "1fr", part: createNodePart(main) },
    { key: "footer", basis: 2, part: createNodePart(footer) },
  ]);
  const mainLayout = createRow(main, [
    { key: "summary", basis: 38, part: createNodePart(summaryBox) },
    { key: "windows", basis: "1fr", part: createNodePart(windowsBox) },
    { key: "commands", basis: 44, part: createNodePart(commandsBox) },
  ], { gap: 1 });

  let snapshot: RuntimeInspectionSnapshot | undefined;
  let commands: CommandListItem[] = [];
  let lastError: string | undefined;
  let lastUpdated = "never";
  let refreshInFlight = false;

  function render() {
    const width = Math.max(1, Number(root.width) || Number(win.body.width) || 1);
    const height = Math.max(1, Number(root.height) || Number(win.body.height) || 1);
    rootLayout.layout({ top: 0, left: 0, width, height });
    mainLayout.layout({
      top: 0,
      left: 0,
      width: Math.max(1, Number(main.width) || width),
      height: Math.max(1, Number(main.height) || Math.max(1, height - 5)),
    });

    const instance = snapshot?.state.app.instanceId ?? "?";
    const focusLabel = snapshot?.state.focus.title ? clip(snapshot.state.focus.title, 40) : "none";
    header.setContent([
      "{bold}Runtime Inspector{/bold}",
      "",
      `instance ${instance} · focus ${focusLabel} · updated ${lastUpdated}`,
    ].join("\n"));
    summaryBox.setContent(formatSummary(snapshot, commands, lastError));
    windowsBox.setContent(formatWindows(snapshot));
    commandsBox.setContent(formatCommands(commands));
    footer.setContent(
      lastError
        ? `source: /runtime/inspection + /commands/list · error: ${lastError}`
        : "source: /runtime/inspection + /commands/list · refresh: 1s · module view deferred until /modules/list exists"
    );
    host.screen.render();
  }

  async function refresh() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const [inspectionPayload, commandsPayload] = await Promise.all([
        fetchRuntimeInspection(),
        fetchRuntimeCommands(),
      ]);
      snapshot = inspectionPayload.snapshot;
      commands = commandsPayload.commands;
      lastUpdated = new Date().toLocaleTimeString();
      lastError = undefined;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      refreshInFlight = false;
      render();
    }
  }

  createTimer(() => {
    void refresh();
  }, 1000, timers);

  win.onResize(render);
  win.onRestyle(() => {
    header.style = host.theme().titleBarFocused ?? host.theme().body;
    summaryBox.style = host.theme().body;
    windowsBox.style = host.theme().body;
    commandsBox.style = host.theme().body;
    footer.style = host.theme().muted ?? host.theme().body;
    rootLayout.restyle();
    mainLayout.restyle();
    render();
  });
  win.describeState(() => ({
    summary: `Runtime Inspector · ${snapshot?.state.windows.length ?? 0} windows · ${commands.length} commands`,
    instanceId: snapshot?.state.app.instanceId,
    blockerCount: snapshot?.ui.blockers.length ?? 0,
    commandCount: commands.length,
    focusedWindowId: snapshot?.state.focus.windowId,
  }));
  win.captureText(() => [
    header.getContent(),
    "",
    summaryBox.getContent(),
    "",
    windowsBox.getContent(),
    "",
    commandsBox.getContent(),
    "",
    footer.getContent(),
  ].join("\n"));
  win.onCleanup(() => {
    clearTimers(timers);
    rootLayout.destroy();
    mainLayout.destroy();
  });

  render();
  void refresh();
  win.focus();
}
