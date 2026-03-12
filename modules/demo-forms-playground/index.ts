/**
 * Forms Playground — E036 SDK component showcase.
 *
 * Tests: createButton, createCheckbox, createRadioGroup, createSelect,
 * createProgressBar, createSpinner, createKeyValuePanel, createLogView.
 * All composed via createStack.
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
  createKeyValuePanel,
  createLogView,
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
  const win = host.createWindow({ title: "Forms Playground", width: 60, height: 36 });

  // ── Section label helper ────────────────────────────────────────────
  function sectionLabel(text: string) {
    return blessed.box({
      parent: win.body, top: 0, left: 0, width: 0, height: 1,
      tags: false, content: ` ${text}`,
      style: { fg: host.theme().accent?.fg ?? "cyan", bg: host.theme().body.bg },
    });
  }
  const lblButtons   = sectionLabel("BUTTONS");
  const lblChecks    = sectionLabel("CHECKBOXES");
  const lblRadio     = sectionLabel("RADIO GROUP");
  const lblSelect    = sectionLabel("SELECT");
  const lblFeedback  = sectionLabel("FEEDBACK");
  const lblData      = sectionLabel("DATA DISPLAY");

  // ── Header ──────────────────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1, tags: false,
    content: " E036 Forms Playground — Tab/Space/Enter/Arrows",
    style: { fg: host.theme().body.bg, bg: host.theme().body.fg, bold: true },
  });

  // ── Controls ────────────────────────────────────────────────────────
  const timers = new Set<ReturnType<typeof setInterval>>();
  let clickCount = 0;

  // Log view (replaces ad-hoc logBox)
  const logView = createLogView({ maxEntries: 50, border: true, label: "Events" });
  logView.append("Forms Playground ready.");

  function log(msg: string) {
    logView.append(msg);
    host.screen.render();
  }

  const btn1 = createButton({
    label: "Click Me",
    onPress: () => { clickCount++; log(`Button pressed! (${clickCount}x)`); kvPanel.update({ entries: kvEntries() }); },
  });

  const btn2 = createButton({
    label: "Disabled",
    disabled: true,
    onPress: () => log("This should never fire"),
  });

  const cb1 = createCheckbox({
    label: "Enable sound",
    checked: true,
    onChange: (e) => { log(`Sound: ${e.value ? "ON" : "OFF"}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const cb2 = createCheckbox({
    label: "Dark mode",
    onChange: (e) => { log(`Dark mode: ${e.value ? "ON" : "OFF"}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const cb3 = createCheckbox({ label: "Disabled option", disabled: true });

  const radio = createRadioGroup({
    options: [
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
      { label: "Extra Large", value: "xl" },
    ],
    selected: "md",
    onChange: (e) => { log(`Size: ${e.value} (index ${e.index})`); kvPanel.update({ entries: kvEntries() }); },
  });

  const sel = createSelect({
    options: [
      { label: "Red", value: "red" },
      { label: "Green", value: "green" },
      { label: "Blue", value: "blue" },
      { label: "Yellow", value: "yellow" },
    ],
    placeholder: "Pick a colour",
    onChange: (e) => { log(`Colour: ${e.value}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const progress = createProgressBar({ value: 0, max: 100, label: "Progress" });
  const spinner = createSpinner({ label: "Processing..." });

  // Auto-increment progress
  let progressVal = 0;
  createTimer(() => {
    progressVal = (progressVal + 1) % 101;
    progress.update({ value: progressVal });
    if (progressVal === 100) {
      log("Progress complete!");
      progressVal = 0;
    }
  }, 200, timers);

  // Key-Value panel (live state summary)
  function kvEntries() {
    return [
      { key: "Clicks", value: String(clickCount) },
      { key: "Sound", value: cb1.checked() ? "ON" : "OFF" },
      { key: "Size", value: radio.selected() ?? "-" },
      { key: "Colour", value: sel.selected() ?? "-" },
    ];
  }
  const kvPanel = createKeyValuePanel({ entries: kvEntries(), border: true, label: "State" });

  // ── Layout ──────────────────────────────────────────────────────────
  const root = createStack(win.body, [
    { key: "header",      basis: 1,     part: createNodePart(headerBox) },
    { key: "lblBtn",      basis: 1,     part: createNodePart(lblButtons) },
    { key: "btn1",        basis: 1,     part: btn1 },
    { key: "btn2",        basis: 1,     part: btn2 },
    { key: "lblCb",       basis: 1,     part: createNodePart(lblChecks) },
    { key: "cb1",         basis: 1,     part: cb1 },
    { key: "cb2",         basis: 1,     part: cb2 },
    { key: "cb3",         basis: 1,     part: cb3 },
    { key: "lblRadio",    basis: 1,     part: createNodePart(lblRadio) },
    { key: "radio",       basis: 4,     part: radio },
    { key: "lblSel",      basis: 1,     part: createNodePart(lblSelect) },
    { key: "sel",         basis: 1,     part: sel },
    { key: "lblFb",       basis: 1,     part: createNodePart(lblFeedback) },
    { key: "progress",    basis: 1,     part: progress },
    { key: "spinner",     basis: 1,     part: spinner },
    { key: "lblData",     basis: 1,     part: createNodePart(lblData) },
    { key: "kv",          basis: 6,     part: kvPanel },
    { key: "log",         basis: "1fr", part: logView },
  ]);

  // ── Render + lifecycle ──────────────────────────────────────────────
  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const h = Math.max(1, Number(win.body.height) || 0);
    root.layout({ top: 0, left: 0, width: w, height: h });
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
    logEntries: logView.entries().length,
  }));

  win.captureText(() => [
    "Forms Playground — E036 SDK showcase",
    `Clicks: ${clickCount}`,
    `Sound: ${cb1.checked()}`,
    `Size: ${radio.selected()}`,
    `Colour: ${sel.selected()}`,
    "",
    ...logView.entries().slice(-10).map(e => e.text),
  ].join("\n"));

  win.onRestyle(() => {
    const t = host.theme();
    headerBox.style = { fg: t.body.bg, bg: t.body.fg, bold: true };
    for (const lbl of [lblButtons, lblChecks, lblRadio, lblSelect, lblFeedback, lblData]) {
      lbl.style = { fg: t.accent?.fg ?? "cyan", bg: t.body.bg };
    }
    root.restyle();
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    root.destroy();
  });

  win.focus();
}
