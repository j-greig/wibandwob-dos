import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createTextViewer,
  createStatusBar,
} from "../../src/services/microapp-sdk.js";

const FRAMES = [
  "  .  .  .  .  .  .  .  .  .  .",
  "  .  .  .  .  /\\.  .  .  .  .",
  "  .  .  .  . /  \\ .  .  .  . ",
  "  .  .  .  ./    \\.  .  .  . ",
  "  .  .  .  /      \\_/\\.  .  .",
  "  .  .  . /         \\_/\\.  . ",
  "  .  .  ./              \\.  .",
  "  .  .  /                \\.  ",
  "  .  . /                  \\. ",
  "  .  ./                    \\.",
  "  .  /                      \\",
  "  . / .  .  .  .  .  .  .  .",
  "  ./  .  .  .  .  .  .  .  .",
  "  .  .  .  .  .  .  .  .  . ",
];

const BPM_LABEL = ["♥", "♡"];

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Heartbeat",
    description: "Open the ASCII heartbeat monitor",
    menu: [{ category: "demos", order: 80, label: "Heartbeat" }],
    palette: { order: 280, label: "Heartbeat" },
    action: () => openHeartbeat(host),
  });
}

function openHeartbeat(host: MicroappHost) {
  const win = host.createWindow({ title: "Heartbeat", width: 38, height: 10 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  const viewer = createTextViewer(win.body, {
    content: FRAMES[0],
    wrap: false,
    bottomOffset: 1,
  });

  const status = createStatusBar(win.body);

  let frame = 0;
  let beat = 0;
  const startTime = Date.now();

  createTimer(() => {
    frame = (frame + 1) % FRAMES.length;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    viewer.update({
      content: `\n ${FRAMES[frame]}\n\n ${BPM_LABEL[beat % 2]}  60 BPM`,
    });
    host.screen.render();
  }, 80, timers);

  createTimer(() => {
    beat++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    status.update({ left: ` uptime ${elapsed}s`, right: `60 BPM ` });
    host.screen.render();
  }, 1000, timers);

  win.setFocusTarget(viewer.element);

  win.describeState(() => ({
    summary: `Heartbeat — alive ${Math.floor((Date.now() - startTime) / 1000)}s`,
    bpm: 60,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    frame: frame % FRAMES.length,
    beat,
  }));

  win.captureText(() => `Heartbeat\n60 BPM\nuptime ${Math.floor((Date.now() - startTime) / 1000)}s`);

  win.onRestyle(() => {
    viewer.update({});
    status.update({});
  });

  win.onCleanup(() => {
    clearTimers(timers);
    viewer.destroy();
    status.destroy();
  });
}
