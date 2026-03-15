import type { MicroappHost, MicroappSnapshotWindow } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createSplitView,
  createListPanel,
  createScrollView,
} from "../../src/services/microapp-sdk.js";

interface CommandEntry {
  id: string;
  label: string;
  args?: Record<string, unknown>;
}

interface RestoreArgs {
  _restore?: { selectedIndex?: number; log?: string[] };
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
  let selectedIndex = Math.max(0, Math.min(COMMANDS.length - 1, Number(args?._restore?.selectedIndex ?? 0)));
  let logLines = clipLog(args?._restore?.log?.map(String) ?? ["Command Lab ready."]);

  const win = host.createWindow({
    title: "Command Lab",
    width: 92,
    height: 28,
    left: 14,
    top: 4,
  });

  const header = createHeaderBar(win.body, { height: 2 });
  const split = createSplitView(win.body, {
    direction: "horizontal",
    ratio: 0.42,
    bottomOffset: 2,
  });
  (split.element as any).top = 2;

  const commandsList = createListPanel(split.first, {
    items: COMMANDS.map((e) => `${e.label}  (${e.id})`),
  });

  const logView = createScrollView(split.second, { content: logLines.join("\n") });
  const footer = createStatusBar(win.body, { height: 2 });

  function render() {
    const current = COMMANDS[selectedIndex];
    header.update({
      left: ` {bold}Command Lab{/bold}`,
      right: `${selectedIndex + 1}/${COMMANDS.length} · ${current?.id ?? "?"} `,
    });
    logView.update({ content: logLines.join("\n") });
    footer.update({ left: " Enter run · j/k move · q close" });
    host.screen.render();
  }

  async function runSelected() {
    const current = COMMANDS[selectedIndex];
    if (!current) return;
    const stamp = new Date().toLocaleTimeString();
    logLines = clipLog([...logLines, `[${stamp}] ${current.id}`]);
    render();
    try {
      const result = host.runGlobalCommand(current.id, current.args) as unknown;
      logLines = clipLog([...logLines, JSON.stringify(result ?? { ok: true })]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logLines = clipLog([...logLines, `error: ${msg}`]);
    }
    render();
  }

  commandsList.onSelect((index) => {
    selectedIndex = index;
    render();
    void runSelected();
  });

  win.setFocusTarget(commandsList.element);

  win.describeState(() => ({
    summary: `Command Lab · ${COMMANDS[selectedIndex]?.id ?? "none"} · ${logLines.length} log lines`,
    selectedIndex,
    selectedCommandId: COMMANDS[selectedIndex]?.id,
    log: logLines,
  }));

  win.captureText(() => [
    "Command Lab",
    ...COMMANDS.map((e, i) => `${i === selectedIndex ? ">" : " "} ${e.id}`),
    "",
    "Log",
    ...logLines,
  ].join("\n"));

  win.onRestyle(() => {
    header.update({});
    footer.update({});
    logView.update({});
    commandsList.update({ items: COMMANDS.map((e) => `${e.label}  (${e.id})`) });
    render();
  });

  win.onCleanup(() => {
    header.destroy();
    split.destroy();
    commandsList.destroy();
    logView.destroy();
    footer.destroy();
  });

  render();
}
