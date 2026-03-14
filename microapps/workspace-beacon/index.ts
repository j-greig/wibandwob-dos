import blessed from "blessed";
import type { MicroappHost, MicroappSnapshotWindow } from "../../src/services/microapp-sdk.js";

type BeaconStage = "seed" | "draft" | "review" | "ship";

interface BeaconState {
  note: string;
  stage: BeaconStage;
  pinned: boolean;
  updatedAt: string;
}

interface RestoreArgs {
  _restore?: Partial<BeaconState>;
}

const STAGES: BeaconStage[] = ["seed", "draft", "review", "ship"];
const DEFAULT_NOTE = "Name the current workspace intent so restore does not feel anonymous.";

let activeBeacon:
  | {
      updateNote: (note: string) => void;
      cycleStage: () => void;
      togglePinned: () => void;
    }
  | undefined;

function nowLabel(): string {
  return new Date().toLocaleTimeString();
}

function nextStage(stage: BeaconStage): BeaconStage {
  const index = STAGES.indexOf(stage);
  return STAGES[(index + 1) % STAGES.length] ?? "seed";
}

function sanitizeState(input?: Partial<BeaconState>): BeaconState {
  const requestedStage = input?.stage as BeaconStage | undefined;
  const stage = requestedStage && STAGES.includes(requestedStage)
    ? requestedStage
    : "seed";
  return {
    note: String(input?.note ?? DEFAULT_NOTE),
    stage,
    pinned: Boolean(input?.pinned),
    updatedAt: String(input?.updatedAt ?? nowLabel()),
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Workspace Beacon",
    description: "Open the workspace-aware beacon microapp.",
    menu: [{ category: "applications", order: 169, label: "Workspace Beacon" }],
    palette: { order: 169, label: "Workspace Beacon" },
    action: (args) => openWorkspaceBeacon(host, args as RestoreArgs | undefined),
  });

  host.registerCommand({
    id: "set-note",
    label: "Set Workspace Beacon Note",
    description: "Set the pinned workspace note for the open Workspace Beacon.",
    direct: true,
    action: (args) => {
      const note = String(args?.note ?? "");
      if (!activeBeacon) return { ok: false, error: "Workspace Beacon is not open." };
      activeBeacon.updateNote(note || DEFAULT_NOTE);
      return { ok: true, note: note || DEFAULT_NOTE };
    },
  });

  host.registerCommand({
    id: "cycle-stage",
    label: "Cycle Workspace Beacon Stage",
    description: "Advance the workspace stage marker for the open Workspace Beacon.",
    direct: true,
    action: () => {
      if (!activeBeacon) return { ok: false, error: "Workspace Beacon is not open." };
      activeBeacon.cycleStage();
      return { ok: true };
    },
  });

  host.registerCommand({
    id: "toggle-pin",
    label: "Toggle Workspace Beacon Pin",
    description: "Toggle whether the Workspace Beacon is marked as pinned.",
    direct: true,
    action: () => {
      if (!activeBeacon) return { ok: false, error: "Workspace Beacon is not open." };
      activeBeacon.togglePinned();
      return { ok: true };
    },
  });

  host.registerSnapshot({
    serialize: (window: MicroappSnapshotWindow) => {
      const state = window.describeState?.() ?? {};
      return {
        note: String(state.note ?? DEFAULT_NOTE),
        stage: String(state.stage ?? "seed"),
        pinned: Boolean(state.pinned),
        updatedAt: String(state.updatedAt ?? nowLabel()),
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", { _restore: payload });
    },
  });
}

function openWorkspaceBeacon(host: MicroappHost, args?: RestoreArgs) {
  let state = sanitizeState(args?._restore);
  const win = host.createWindow({
    title: "Workspace Beacon",
    width: 72,
    height: 18,
    left: 18,
    top: 8,
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
    height: 4,
    tags: true,
    style: host.theme().body,
  });

  const body = blessed.box({
    parent: root,
    top: 4,
    left: 0,
    right: 0,
    bottom: 2,
    tags: true,
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
    header.setContent([
      "{bold}Workspace Beacon{/bold}",
      `stage  ${state.stage}    pinned  ${state.pinned ? "yes" : "no"}`,
      `updated ${state.updatedAt}`,
      "",
    ].join("\n"));
    body.setContent([
      "{underline}Current note{/underline}",
      "",
      state.note,
      "",
      "{underline}Why it exists{/underline}",
      "A workspace restore should bring back human/agent intent, not just window geometry.",
    ].join("\n"));
    footer.setContent("e edit note · s cycle stage · p toggle pin · q close");
    host.screen.render();
  }

  function commit(next: Partial<BeaconState>) {
    state = {
      ...state,
      ...next,
      updatedAt: nowLabel(),
    };
    render();
  }

  activeBeacon = {
    updateNote(note) {
      commit({ note });
    },
    cycleStage() {
      commit({ stage: nextStage(state.stage) });
    },
    togglePinned() {
      commit({ pinned: !state.pinned });
    },
  };

  root.key(["e"], () => {
    host.promptValue("Workspace Beacon note", state.note, (value) => {
      activeBeacon?.updateNote(value.trim() || DEFAULT_NOTE);
    });
  });
  root.key(["s"], () => activeBeacon?.cycleStage());
  root.key(["p"], () => activeBeacon?.togglePinned());
  root.key(["q"], () => win.close());

  win.describeState(() => ({
    summary: `Workspace Beacon · ${state.stage} · ${state.pinned ? "pinned" : "floating"}`,
    note: state.note,
    stage: state.stage,
    pinned: state.pinned,
    updatedAt: state.updatedAt,
  }));
  win.captureText(() => [
    "Workspace Beacon",
    `stage: ${state.stage}`,
    `pinned: ${state.pinned ? "yes" : "no"}`,
    `updated: ${state.updatedAt}`,
    "",
    state.note,
  ].join("\n"));
  win.onRestyle(() => {
    root.style = host.theme().body;
    header.style = host.theme().body;
    body.style = host.theme().body;
    footer.style = host.theme().body;
    render();
  });
  win.onCleanup(() => {
    if (activeBeacon) {
      activeBeacon = undefined;
    }
  });
  render();
  win.focus();
}
