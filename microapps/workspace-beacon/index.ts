import type { MicroappHost, MicroappSnapshotWindow } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  createRule,
} from "../../src/services/microapp-sdk.js";

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
const DEFAULT_NOTE = "Name the current workspace intent.";

const STAGE_STYLE: Record<BeaconStage, { label: string; bar: string }> = {
  seed:   { label: "SEED",   bar: "░" },
  draft:  { label: "DRAFT",  bar: "▒" },
  review: { label: "REVIEW", bar: "▓" },
  ship:   { label: "SHIP",   bar: "█" },
};

let activeBeacon:
  | { updateNote: (n: string) => void; cycleStage: () => void; togglePinned: () => void }
  | undefined;

function nowLabel(): string {
  return new Date().toLocaleTimeString();
}

function nextStage(s: BeaconStage): BeaconStage {
  return STAGES[(STAGES.indexOf(s) + 1) % STAGES.length] ?? "seed";
}

function sanitizeState(input?: Partial<BeaconState>): BeaconState {
  const req = input?.stage as BeaconStage | undefined;
  return {
    note: String(input?.note ?? DEFAULT_NOTE),
    stage: req && STAGES.includes(req) ? req : "seed",
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
    action: (args) => openBeacon(host, args as RestoreArgs | undefined),
  });

  host.registerCommand({
    id: "set-note",
    label: "Set Beacon Note",
    description: "Set the workspace note.",
    direct: true,
    action: (args) => {
      const note = String(args?.note ?? "");
      if (!activeBeacon) return { ok: false, error: "Not open." };
      activeBeacon.updateNote(note || DEFAULT_NOTE);
      return { ok: true, note: note || DEFAULT_NOTE };
    },
  });

  host.registerCommand({
    id: "cycle-stage",
    label: "Cycle Stage",
    direct: true,
    action: () => {
      if (!activeBeacon) return { ok: false, error: "Not open." };
      activeBeacon.cycleStage();
      return { ok: true };
    },
  });

  host.registerCommand({
    id: "toggle-pin",
    label: "Toggle Pin",
    direct: true,
    action: () => {
      if (!activeBeacon) return { ok: false, error: "Not open." };
      activeBeacon.togglePinned();
      return { ok: true };
    },
  });

  host.registerSnapshot({
    serialize: (window: MicroappSnapshotWindow) => {
      const s = window.describeState?.() ?? {};
      return { note: String(s.note ?? DEFAULT_NOTE), stage: String(s.stage ?? "seed"), pinned: Boolean(s.pinned), updatedAt: String(s.updatedAt ?? nowLabel()) };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", { _restore: payload });
    },
  });
}

function openBeacon(host: MicroappHost, args?: RestoreArgs) {
  let state = sanitizeState(args?._restore);
  const timers = new Set<ReturnType<typeof setInterval>>();

  const win = host.createWindow({
    title: "Workspace Beacon",
    width: 52,
    height: 18,
    left: 20,
    top: 6,
  });

  let pulse = false;

  const header = createHeaderBar(win.body, { height: 2 });
  const rule1 = createRule(win.body, { top: 2 });
  const noteView = createTextViewer(win.body, {
    content: "",
    wrap: true,
    bottomOffset: 2,
  });
  (noteView.element as any).top = 3;
  const status = createStatusBar(win.body, { height: 2 });

  function render() {
    const s = STAGE_STYLE[state.stage];
    const idx = STAGES.indexOf(state.stage);
    const dot = pulse ? "●" : "○";
    const pin = state.pinned ? " 📌" : "";
    const w = Math.max(1, Number(win.body.width) || 48);

    const segW = Math.floor((w - 4) / STAGES.length);
    const prog = STAGES.map((_, i) => {
      const ch = i <= idx ? s.bar : "·";
      return ch.repeat(segW);
    }).join(" ");

    header.update({
      left: `  ${dot}  ${s.label}${pin}`,
      right: `  ${prog}  `,
    });

    noteView.update({
      content: `  {bold}Note{/bold}\n  ${state.note}`,
    });

    status.update({
      left: `  ${state.updatedAt}`,
      right: "e edit  s stage  p pin  q close ",
    });

    host.screen.render();
  }

  createTimer(() => {
    pulse = !pulse;
    render();
  }, 1000, timers);

  function commit(next: Partial<BeaconState>) {
    state = { ...state, ...next, updatedAt: nowLabel() };
    render();
  }

  activeBeacon = {
    updateNote(n) { commit({ note: n }); },
    cycleStage() { commit({ stage: nextStage(state.stage) }); },
    togglePinned() { commit({ pinned: !state.pinned }); },
  };

  win.body.key(["e"], () => {
    host.promptValue("Beacon note", state.note, (v) => {
      activeBeacon?.updateNote(v.trim() || DEFAULT_NOTE);
    });
  });
  win.body.key(["s"], () => activeBeacon?.cycleStage());
  win.body.key(["p"], () => activeBeacon?.togglePinned());
  win.body.key(["q"], () => win.close());

  win.setFocusTarget(noteView.element);

  win.describeState(() => ({
    summary: `Beacon · ${state.stage} · ${state.pinned ? "pinned" : "floating"}`,
    note: state.note,
    stage: state.stage,
    pinned: state.pinned,
    updatedAt: state.updatedAt,
  }));

  win.captureText(() => [
    `Workspace Beacon`,
    `${STAGE_STYLE[state.stage].label}${state.pinned ? " 📌" : ""}`,
    state.note,
    state.updatedAt,
  ].join("\n"));

  win.onResize(render);
  win.onRestyle(() => {
    header.update({});
    status.update({});
    noteView.update({});
    render();
  });
  win.onCleanup(() => {
    clearTimers(timers);
    header.destroy();
    rule1.destroy();
    noteView.destroy();
    status.destroy();
    if (activeBeacon) activeBeacon = undefined;
  });

  render();
}
