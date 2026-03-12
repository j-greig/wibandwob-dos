import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";
import {
  createTimer,
  clearTimers,
  createStack,
  createNodePart,
} from "../../src/services/microapp-sdk.js";

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
    menu: [{ category: "demos", order: 80, label: "Heartbeat" }],
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
    top: 0, left: 1, width: 0, height: 1,
    content: FRAMES[0],
    style: { fg: "red", bg: host.theme().body.bg },
    tags: false,
  });

  // Spacer
  const spacer1 = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 1,
    style: host.theme().body,
  });

  // Heart icon + BPM label
  const heartBox = blessed.box({
    parent: win.body,
    top: 0, left: 1, width: 0, height: 1,
    content: "♡   60 BPM",
    style: { fg: "magenta", bg: host.theme().body.bg },
    tags: false,
  });

  // Spacer
  const spacer2 = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 1,
    style: host.theme().body,
  });

  // Uptime counter
  const uptimeBox = blessed.box({
    parent: win.body,
    top: 0, left: 1, width: 0, height: 1,
    content: "uptime  0s",
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  // Layout: vertical stack with spacers
  const root = createStack(win.body, [
    { key: "spacer-top", basis: 1,    part: createNodePart(blessed.box({ parent: win.body, style: host.theme().body })) },
    { key: "pulse",      basis: 1,    part: createNodePart(pulseBox) },
    { key: "s1",         basis: 1,    part: createNodePart(spacer1) },
    { key: "heart",      basis: 1,    part: createNodePart(heartBox) },
    { key: "s2",         basis: 1,    part: createNodePart(spacer2) },
    { key: "uptime",     basis: 1,    part: createNodePart(uptimeBox) },
    { key: "fill",       basis: "1fr", part: createNodePart(blessed.box({ parent: win.body, style: host.theme().body })) },
  ]);

  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const h = Math.max(1, Number(win.body.height) || 0);
    root.layout({ top: 0, left: 0, width: w, height: h });
    host.screen.render();
  }

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

  render();
  win.onResize(render);

  win.describeState(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    return {
      summary: `Heartbeat — alive ${uptime}s`,
      bpm: 60,
      uptime,
      frame: frame % FRAMES.length,
      beat,
    };
  });

  win.captureText(() => `Heartbeat\n60 BPM\nuptime ${Math.floor((Date.now() - startTime) / 1000)}s`);

  win.onRestyle(() => {
    const t = host.theme();
    pulseBox.style = { fg: "red", bg: t.body.bg };
    heartBox.style = { fg: "magenta", bg: t.body.bg };
    uptimeBox.style = t.muted
      ? { fg: t.muted.fg, bg: t.body.bg }
      : { fg: "grey", bg: t.body.bg };
    root.restyle();
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    root.destroy();
  });

  win.focus();
}
