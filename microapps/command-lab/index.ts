import blessed from "blessed";
import type { MicroappHost, MicroappSnapshotWindow } from "../../src/services/microapp-sdk.js";
import { createScrollbar } from "../../src/services/microapp-sdk.js";

interface CommandEntry {
  id: string;
  label: string;
  args?: Record<string, unknown>;
}

interface RestoreArgs {
  _restore?: {
    selectedIndex?: number;
    log?: string[];
  };
}

const COMMANDS: CommandEntry[] = [
  { id: "window.tile", label: "Tile Windows" },
  { id: "window.cascade", label: "Cascade Windows" },
  { id: "theme.cycle", label: "Cycle Theme" },
  { id: "editor.new", label: "Open Editor" },
  { id: "figlet.open", label: "Open Figlet", args: { text: "COMMAND LAB", font: "mini" } },
  { id: "inspector.open", label: "Open State Inspector" },
  { id: "microapp.wibwob.runtime-inspector.open", label: "Open Runtime Inspector" },
];

function clipLog(lines: string[]): string[] {
  return lines.slice(-18);
}

function listStyle(host: MicroappHost) {
  return {
    ...host.theme().body,
    item: { ...host.theme().body },
    selected: {
      fg: "black",
      bg: "white",
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Command Lab",
    description: "Open a proof microapp for shared runtime command execution.",
    menu: [{ category: "applications", order: 168, label: "Command Lab" }],
    palette: { order: 168, label: "Command Lab" },
    action: (args) => openCommandLab(host, args as RestoreArgs | undefined),
  });

  host.registerSnapshot({
    serialize: (window: MicroappSnapshotWindow) => {
      const state = window.describeState?.() ?? {};
      return {
        selectedIndex: Number(state.selectedIndex ?? 0),
        log: Array.isArray(state.log) ? state.log.slice(-12) : [],
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", { _restore: payload });
    },
  });
}

function openCommandLab(host: MicroappHost, args?: RestoreArgs) {
  const selected = Math.max(0, Math.min(COMMANDS.length - 1, Number(args?._restore?.selectedIndex ?? 0)));
  let selectedIndex = selected;
  let logLines = clipLog(args?._restore?.log?.map(String) ?? ["Command Lab ready."]);

  const win = host.createWindow({
    title: "Command Lab",
    width: 92,
    height: 28,
    left: 14,
    top: 4,
  });

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

  const commandsList = blessed.list({
    parent: root,
    top: 2,
    left: 0,
    width: "42%",
    bottom: 2,
    keys: true,
    mouse: true,
    vi: true,
    items: COMMANDS.map((entry) => `${entry.label}  {gray-fg}${entry.id}{/gray-fg}`),
    tags: true,
    scrollbar: createScrollbar(),
    style: listStyle(host),
  });

  const logBox = blessed.box({
    parent: root,
    top: 2,
    left: "42%",
    right: 0,
    bottom: 2,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: createScrollbar(),
    style: host.theme().body,
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

  function render() {
    const current = COMMANDS[selectedIndex];
    header.setContent([
      "{bold}Command Lab{/bold}",
      `selected ${selectedIndex + 1}/${COMMANDS.length} · ${current.id}`,
    ].join("\n"));
    logBox.setContent(logLines.join("\n"));
    footer.setContent("Enter run · j/k move · g/G top/bottom log · q close");
    commandsList.select(selectedIndex);
    host.screen.render();
  }

  async function runSelected() {
    const current = COMMANDS[selectedIndex];
    const stamp = new Date().toLocaleTimeString();
    logLines = clipLog([...logLines, `[${stamp}] ${current.id}`]);
    render();
    try {
      const result = host.runGlobalCommand(current.id, current.args) as unknown;
      logLines = clipLog([...logLines, JSON.stringify(result ?? { ok: true })]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logLines = clipLog([...logLines, `error: ${message}`]);
    }
    render();
  }

  commandsList.on("select item", () => {
    selectedIndex = commandsList.selected;
    render();
  });
  commandsList.key(["enter"], () => {
    void runSelected();
  });
  commandsList.key(["j", "down"], () => {
    selectedIndex = Math.min(COMMANDS.length - 1, selectedIndex + 1);
    render();
  });
  commandsList.key(["k", "up"], () => {
    selectedIndex = Math.max(0, selectedIndex - 1);
    render();
  });
  logBox.key(["g"], () => {
    logBox.setScroll(0);
    host.screen.render();
  });
  logBox.key(["G"], () => {
    logBox.setScroll(Math.max(0, logBox.getScrollHeight() - (Number(logBox.height) || 0)));
    host.screen.render();
  });
  root.key(["q"], () => {
    win.close();
  });

  win.describeState(() => ({
    summary: `Command Lab · ${COMMANDS[selectedIndex]?.id ?? "none"} · ${logLines.length} log lines`,
    selectedIndex,
    selectedCommandId: COMMANDS[selectedIndex]?.id,
    log: logLines,
  }));
  win.captureText(() => [
    header.getContent(),
    "",
    "Commands",
    ...COMMANDS.map((entry, index) => `${index === selectedIndex ? ">" : " "} ${entry.id}`),
    "",
    "Log",
    ...logLines,
  ].join("\n"));
  win.onRestyle(() => {
    root.style = host.theme().body;
    header.style = host.theme().body;
    logBox.style = host.theme().body;
    footer.style = host.theme().body;
    commandsList.style = listStyle(host);
    render();
  });
  win.onCleanup(() => {});
  win.setFocusTarget(commandsList);
  render();
}
