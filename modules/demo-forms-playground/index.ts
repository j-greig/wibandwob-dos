/**
 * Forms Playground — E036 SDK component showcase.
 *
 * Two-column layout: left = interactive controls, right = data + feedback.
 * Tests every SDK form/data/feedback component in one window.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createStack,
  createRow,
  createNodePart,
  createTimer,
  clearTimers,
  createButton,
  createCheckbox,
  createRadioGroup,
  createSelect,
  createProgressBar,
  createSpinner,
  createToast,
  createFilterableList,
  createFormField,
  createTextArea,
  createKeyValuePanel,
  createLogView,
  createDataTable,
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
  const win = host.createWindow({ title: "Forms Playground", width: 100, height: 36 });

  // ── Helpers ─────────────────────────────────────────────────────────
  function sLabel(text: string) {
    return blessed.box({
      parent: win.body, top: 0, left: 0, width: 0, height: 1,
      tags: false, content: ` ${text}`,
      style: { fg: host.theme().accent?.fg ?? "cyan", bg: host.theme().body.bg },
    });
  }
  const allLabels: blessed.Widgets.BoxElement[] = [];
  function sl(text: string) { const b = sLabel(text); allLabels.push(b); return b; }

  const headerBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1, tags: false,
    content: " E036 Forms Playground",
    style: { fg: host.theme().body.bg, bg: host.theme().body.fg, bold: true },
  });

  // ── State ───────────────────────────────────────────────────────────
  const timers = new Set<ReturnType<typeof setInterval>>();
  let clickCount = 0;

  const logView = createLogView({ maxEntries: 50, border: true, label: "Events" });
  logView.append("Forms Playground ready.");
  function log(msg: string) { logView.append(msg); host.screen.render(); }

  // ── Left column: interactive controls ───────────────────────────────
  const btn1 = createButton({
    label: "Click Me",
    onPress: () => { clickCount++; log(`Button #${clickCount}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const severities = ["info", "success", "warning", "error"] as const;
  const btn2 = createButton({
    label: "Show Toast",
    onPress: () => {
      const sev = severities[clickCount % severities.length]!;
      createToast({ message: `Toast #${clickCount} (${sev})`, severity: sev, parent: win.body });
      log(`Toast: ${sev}`);
    },
  });

  const cb1 = createCheckbox({
    label: "Enable sound", checked: true,
    onChange: (e) => { log(`Sound: ${e.value ? "ON" : "OFF"}`); kvPanel.update({ entries: kvEntries() }); },
  });
  const cb2 = createCheckbox({
    label: "Dark mode",
    onChange: (e) => { log(`Dark: ${e.value ? "ON" : "OFF"}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const radio = createRadioGroup({
    options: [
      { label: "Small", value: "sm" }, { label: "Medium", value: "md" },
      { label: "Large", value: "lg" }, { label: "XL", value: "xl" },
    ],
    selected: "md",
    onChange: (e) => { log(`Size: ${e.value}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const sel = createSelect({
    options: [
      { label: "Red", value: "red" }, { label: "Green", value: "green" },
      { label: "Blue", value: "blue" }, { label: "Yellow", value: "yellow" },
    ],
    placeholder: "Pick colour",
    onChange: (e) => { log(`Colour: ${e.value}`); kvPanel.update({ entries: kvEntries() }); },
  });

  const filterList = createFilterableList({
    items: [
      { label: "Apple", value: "apple" }, { label: "Banana", value: "banana" },
      { label: "Cherry", value: "cherry" }, { label: "Dragonfruit", value: "dragon" },
      { label: "Elderberry", value: "elder" }, { label: "Fig", value: "fig" },
    ],
    placeholder: "Filter fruit...",
    onSelect: (e) => log(`Fruit: ${e.value}`),
  });

  const textArea = createTextArea({ placeholder: "Type notes...", rows: 3,
    onChange: (e) => log(`Text: ${e.value.length} chars`),
  });
  const formField = createFormField({ label: "Notes", help: "Free-form text", child: textArea });

  const leftCol = createStack(win.body, [
    { key: "lBtn",    basis: 1, part: createNodePart(sl("BUTTONS")) },
    { key: "btn1",    basis: 1, part: btn1 },
    { key: "btn2",    basis: 1, part: btn2 },
    { key: "lCb",     basis: 1, part: createNodePart(sl("CHECKBOXES")) },
    { key: "cb1",     basis: 1, part: cb1 },
    { key: "cb2",     basis: 1, part: cb2 },
    { key: "lRadio",  basis: 1, part: createNodePart(sl("RADIO")) },
    { key: "radio",   basis: 4, part: radio },
    { key: "lSel",    basis: 1, part: createNodePart(sl("SELECT")) },
    { key: "sel",     basis: 1, part: sel },
    { key: "lFilter", basis: 1, part: createNodePart(sl("FILTER LIST")) },
    { key: "filter",  basis: 4, part: filterList },
    { key: "lForm",   basis: 1, part: createNodePart(sl("FORM FIELD")) },
    { key: "form",    basis: 6, part: formField },
  ]);

  // ── Right column: data + feedback ───────────────────────────────────
  const dataTable = createDataTable({
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role", width: 10 },
      { key: "lvl", label: "Lvl", width: 4 },
    ],
    rows: [
      { name: "Alice", role: "Engineer", lvl: "5" },
      { name: "Bob", role: "Designer", lvl: "3" },
      { name: "Carol", role: "Manager", lvl: "7" },
      { name: "Dave", role: "Analyst", lvl: "4" },
      { name: "Eve", role: "Engineer", lvl: "6" },
    ],
    sortable: true,
    onSelect: (row) => log(`Row: ${row.name}`),
  });

  const progress = createProgressBar({ value: 0, max: 100, label: "Progress" });
  const spinner = createSpinner({ label: "Processing..." });

  let progressVal = 0;
  createTimer(() => {
    progressVal = (progressVal + 1) % 101;
    progress.update({ value: progressVal });
    if (progressVal === 100) { log("Progress done!"); progressVal = 0; }
  }, 200, timers);

  function kvEntries() {
    return [
      { key: "Clicks", value: String(clickCount) },
      { key: "Sound", value: cb1.checked() ? "ON" : "OFF" },
      { key: "Size", value: radio.selected() ?? "-" },
      { key: "Colour", value: sel.selected() ?? "-" },
    ];
  }
  const kvPanel = createKeyValuePanel({ entries: kvEntries(), border: true, label: "State" });

  const rightCol = createStack(win.body, [
    { key: "lTable",  basis: 1,     part: createNodePart(sl("TABLE")) },
    { key: "table",   basis: 8,     part: dataTable },
    { key: "lFb",     basis: 1,     part: createNodePart(sl("FEEDBACK")) },
    { key: "prog",    basis: 1,     part: progress },
    { key: "spin",    basis: 1,     part: spinner },
    { key: "lData",   basis: 1,     part: createNodePart(sl("STATE")) },
    { key: "kv",      basis: 6,     part: kvPanel },
    { key: "log",     basis: "1fr", part: logView },
  ]);

  // ── Two-column root ─────────────────────────────────────────────────
  const columns = createRow(win.body, [
    { key: "left",  basis: "1fr", part: leftCol },
    { key: "right", basis: "1fr", part: rightCol },
  ]);

  const root = createStack(win.body, [
    { key: "header", basis: 1,     part: createNodePart(headerBox) },
    { key: "cols",   basis: "1fr", part: columns },
  ]);

  // ── Lifecycle ───────────────────────────────────────────────────────
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
    clickCount, sound: cb1.checked(), size: radio.selected(),
    colour: sel.selected(), logEntries: logView.entries().length,
  }));

  win.captureText(() => [
    "Forms Playground — E036 SDK showcase",
    `Clicks: ${clickCount}  Sound: ${cb1.checked()}  Size: ${radio.selected()}  Colour: ${sel.selected()}`,
    "", ...logView.entries().slice(-10).map(e => e.text),
  ].join("\n"));

  win.onRestyle(() => {
    const t = host.theme();
    headerBox.style = { fg: t.body.bg, bg: t.body.fg, bold: true };
    for (const lbl of allLabels) lbl.style = { fg: t.accent?.fg ?? "cyan", bg: t.body.bg };
    root.restyle();
    host.screen.render();
  });

  win.onCleanup(() => { clearTimers(timers); root.destroy(); });
  win.focus();
}
