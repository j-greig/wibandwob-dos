import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";

// Pulse waveform frames — a heartbeat spike cycling through
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

const BPM_LABEL = ["♥  ", "♡  "];

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Heartbeat",
    description: "Open the ASCII heartbeat monitor",
    menu: [{ category: "applications", order: 80, label: "Heartbeat" }],
    palette: { order: 280, label: "Heartbeat" },
    action: () => openHeartbeat(host),
  });
}

function openHeartbeat(host: MicroappHost) {
  const win = host.createWindow({ title: "Heartbeat", width: 38, height: 10 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  // Pulse display
  const pulseBox = blessed.box({
    parent: win.body,
    top: 1,
    left: 1,
    width: "100%-2",
    height: 1,
    content: FRAMES[0],
    style: { fg: "red", bg: host.theme().body.bg },
    tags: false,
  });

  // Heart icon + BPM label
  const heartBox = blessed.box({
    parent: win.body,
    top: 3,
    left: 1,
    width: "100%-2",
    height: 1,
    content: "♡   60 BPM",
    style: { fg: "magenta", bg: host.theme().body.bg },
    tags: false,
  });

  // Uptime counter
  const uptimeBox = blessed.box({
    parent: win.body,
    top: 5,
    left: 1,
    width: "100%-2",
    height: 1,
    content: "uptime  0s",
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  let frame = 0;
  let beat = 0;
  let startTime = Date.now();

  // Fast frame tick — animates the waveform
  createTimer(() => {
    frame = (frame + 1) % FRAMES.length;
    pulseBox.setContent(FRAMES[frame]);
    host.screen.render();
  }, 80, timers);

  // Slow beat tick — 1 Hz heartbeat
  createTimer(() => {
    beat++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    heartBox.setContent(`${BPM_LABEL[beat % 2]}  60 BPM`);
    uptimeBox.setContent(`uptime  ${elapsed}s`);
    host.screen.render();
  }, 1000, timers);

  win.describeState(() => ({
    summary: `Heartbeat — alive ${Math.floor((Date.now() - startTime) / 1000)}s`,
  }));

  win.captureText(() => `Heartbeat\n60 BPM\nuptime ${Math.floor((Date.now() - startTime) / 1000)}s`);

  win.onRestyle(() => {
    const t = host.theme();
    pulseBox.style = { fg: "red", bg: t.body.bg };
    heartBox.style = { fg: "magenta", bg: t.body.bg };
    uptimeBox.style = t.muted
      ? { fg: t.muted.fg, bg: t.body.bg }
      : { fg: "grey", bg: t.body.bg };
    host.screen.render();
  });

  win.onCleanup(() => clearTimers(timers));

  win.focus();
}
