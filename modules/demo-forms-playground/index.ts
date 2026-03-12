/**
 * Forms Playground — E036 SDK component showcase.
 *
 * Tests: createButton, createCheckbox, createRadioGroup, createSelect,
 * createProgressBar, createSpinner. All composed via createStack.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createStack,
  createNodePart,
  createTimer,
  clearTimers,
  createButton,
  createCheckbox,
  createRadioGroup,
  createSelect,
  createProgressBar,
  createSpinner,
} from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Forms Playground",
    description: "E036 SDK form controls showcase",
    menu: [{ category: "demos", order: 95, label: "Forms Playground" }],
    palette: { order: 295, label: "Forms Playground" },
    action: () => openPlayground(host),
  });
}

function openPlayground(host: MicroappHost) {
  const win = host.createWindow({ title: "Forms Playground", width: 60, height: 30 });

  // ── Status log ──────────────────────────────────────────────────────
  const logBox = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 0,
    scrollable: true, alwaysScroll: true, mouse: true,
    tags: false,
    border: "line",
    label: " Event Log ",
    style: { ...host.theme().body, border: { fg: host.theme().muted.fg } },
  });
  const events: string[] = ["Forms Playground ready."];

  function log(msg: string) {
    events.push(msg);
    if (events.length > 50) events.shift();
    logBox.setContent(events.join("\n"));
    logBox.setScrollPerc(100);
    host.screen.render();
  }

  // ── Header ──────────────────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " E036 Forms Playground — Tab between controls, Space/Enter to activate",
    style: { fg: "white", bg: "black", bold: true },
  });

  // ── Section labels ──────────────────────────────────────────────────
  const btnLabel = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " BUTTONS",
    style: { fg: "cyan", bg: "black" },
  });

  const cbLabel = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " CHECKBOXES",
    style: { fg: "cyan", bg: "black" },
  });

  const radioLabel = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " RADIO GROUP",
    style: { fg: "cyan", bg: "black" },
  });

  const selectLabel = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " SELECT",
    style: { fg: "cyan", bg: "black" },
  });

  const feedbackLabel = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    content: " FEEDBACK",
    style: { fg: "cyan", bg: "black" },
  });

  // ── Controls ────────────────────────────────────────────────────────

  const timers = new Set<ReturnType<typeof setInterval>>();
  let clickCount = 0;

  const btn1 = createButton({
    label: "Click Me",
    onPress: () => { clickCount++; log(`Button pressed! (${clickCount}x)`); },
  });

  const btn2 = createButton({
    label: "Disabled",
    disabled: true,
    onPress: () => log("This should never fire"),
  });

  const cb1 = createCheckbox({
    label: "Enable sound",
    checked: true,
    onChange: (e) => log(`Sound: ${e.value ? "ON" : "OFF"}`),
  });

  const cb2 = createCheckbox({
    label: "Dark mode",
    onChange: (e) => log(`Dark mode: ${e.value ? "ON" : "OFF"}`),
  });

  const cb3 = createCheckbox({
    label: "Disabled option",
    disabled: true,
  });

  const radio = createRadioGroup({
    options: [
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
      { label: "Extra Large", value: "xl" },
    ],
    selected: "md",
    onChange: (e) => log(`Size: ${e.value} (index ${e.index})`),
  });

  const sel = createSelect({
    options: [
      { label: "Red", value: "red" },
      { label: "Green", value: "green" },
      { label: "Blue", value: "blue" },
      { label: "Yellow", value: "yellow" },
    ],
    placeholder: "Pick a colour",
    onChange: (e) => log(`Colour: ${e.value}`),
  });

  const progress = createProgressBar({ value: 0, max: 100, label: "Progress" });
  const spinner = createSpinner({ label: "Processing..." });

  // Auto-increment progress for demo
  let progressVal = 0;
  createTimer(() => {
    progressVal = (progressVal + 1) % 101;
    progress.update({ value: progressVal });
    if (progressVal === 100) {
      log("Progress complete!");
      progressVal = 0;
    }
  }, 200, timers);

  // ── Layout ──────────────────────────────────────────────────────────

  const root = createStack(win.body, [
    { key: "header",      basis: 1,     part: createNodePart(headerBox) },
    { key: "btnLabel",    basis: 1,     part: createNodePart(btnLabel) },
    { key: "btn1",        basis: 1,     part: btn1 },
    { key: "btn2",        basis: 1,     part: btn2 },
    { key: "cbLabel",     basis: 1,     part: createNodePart(cbLabel) },
    { key: "cb1",         basis: 1,     part: cb1 },
    { key: "cb2",         basis: 1,     part: cb2 },
    { key: "cb3",         basis: 1,     part: cb3 },
    { key: "radioLabel",  basis: 1,     part: createNodePart(radioLabel) },
    { key: "radio",       basis: 4,     part: radio },
    { key: "selectLabel", basis: 1,     part: createNodePart(selectLabel) },
    { key: "sel",         basis: 1,     part: sel },
    { key: "fbLabel",     basis: 1,     part: createNodePart(feedbackLabel) },
    { key: "progress",    basis: 1,     part: progress },
    { key: "spinner",     basis: 1,     part: spinner },
    { key: "log",         basis: "1fr", part: createNodePart(logBox) },
  ]);

  // ── Render + lifecycle ──────────────────────────────────────────────

  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const h = Math.max(1, Number(win.body.height) || 0);
    root.layout({ top: 0, left: 0, width: w, height: h });
    logBox.setContent(events.join("\n"));
    logBox.setScrollPerc(100);
    host.screen.render();
  }

  render();
  win.onResize(render);

  win.describeState(() => ({
    summary: `Forms Playground: ${clickCount} clicks`,
    clickCount,
    sound: cb1.checked(),
    size: radio.selected(),
    colour: sel.selected(),
  }));

  win.captureText(() => [
    "Forms Playground — E036 SDK showcase",
    `Clicks: ${clickCount}`,
    `Sound: ${cb1.checked()}`,
    `Size: ${radio.selected()}`,
    `Colour: ${sel.selected()}`,
    "", ...events.slice(-10),
  ].join("\n"));

  win.onRestyle(() => {
    const t = host.theme();
    headerBox.style = { fg: "white", bg: "black", bold: true };
    btnLabel.style = { fg: "cyan", bg: "black" };
    cbLabel.style = { fg: "cyan", bg: "black" };
    radioLabel.style = { fg: "cyan", bg: "black" };
    selectLabel.style = { fg: "cyan", bg: "black" };
    feedbackLabel.style = { fg: "cyan", bg: "black" };
    logBox.style = { ...t.body, border: { fg: t.muted.fg } };
    root.restyle();
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    root.destroy();
  });

  win.focus();
}
