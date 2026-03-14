import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStack, createNodePart } from "../../src/services/microapp-sdk.js";
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface JournalEntry {
  peer: "human" | "agent" | "system";
  text: string;
  ts: string; // ISO timestamp
}

function journalPath(host: MicroappHost): string {
  return join(host.repoRoot, "scratch", "journal.jsonl");
}

function loadEntries(path: string): JournalEntry[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
  const entries: JournalEntry[] = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch {}
  }
  return entries;
}

function appendEntry(path: string, entry: JournalEntry) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

function formatEntry(e: JournalEntry): string {
  const tag = e.peer === "human" ? "[H]" : e.peer === "agent" ? "[A]" : "[S]";
  const time = new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${tag} ${time}  ${e.text}`;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Journal",
    description: "Open the Symbient Journal.",
    menu: [{ category: "demos", order: 155, label: "Journal" }],
    palette: { order: 155, label: "Open Journal" },
    action: () => openJournal(host),
  });
}

function openJournal(host: MicroappHost) {
  const win = host.createWindow({ title: "Journal", width: 72, height: 24 });
  const t = () => host.theme();
  const fp = journalPath(host);
  let entries = loadEntries(fp);

  // --- log view ---
  const logBox = blessed.box({
    parent: win.body,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: { ch: "│", style: { fg: t().muted.fg } },
    style: t().body,
  });

  // --- input line ---
  const inputBox = blessed.textbox({
    parent: win.body,
    height: 1,
    inputOnFocus: true,
    style: {
      fg: t().body.fg,
      bg: t().selected.bg,
    },
  });

  // --- layout ---
  const logPart = createNodePart(logBox);
  const inputPart = createNodePart(inputBox);
  const root = createStack(win.body, [
    { key: "log", basis: "1fr", part: logPart },
    { key: "input", basis: 1, part: inputPart },
  ]);

  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const h = Math.max(1, Number(win.body.height) || 0);
    root.layout({ top: 0, left: 0, width: w, height: h });

    const lines = entries.map(formatEntry);
    logBox.setContent(lines.join("\n"));
    logBox.setScrollPerc(100);
    host.screen.render();
  }

  function addEntry(text: string, peer: "human" | "agent" | "system" = "human") {
    const entry: JournalEntry = { peer, text, ts: new Date().toISOString() };
    entries.push(entry);
    appendEntry(fp, entry);
    render();
  }

  // --- input handling ---
  inputBox.on("submit", (value: string) => {
    const trimmed = (value || "").trim();
    if (trimmed) addEntry(trimmed, "human");
    inputBox.clearValue();
    inputBox.focus();
  });

  // system entry on open
  if (entries.length === 0) {
    addEntry("Journal created.", "system");
  } else {
    addEntry("Session started.", "system");
  }

  win.setFocusTarget(inputBox);

  // --- lifecycle hooks ---
  win.describeState(() => ({
    summary: `Journal — ${entries.length} entries`,
    lastEntry: entries.length > 0 ? entries[entries.length - 1]!.text : null,
    entryCount: entries.length,
  }));

  win.captureText(() => entries.map(formatEntry).join("\n"));

  win.onRestyle(() => {
    logBox.style = t().body;
    inputBox.style = { fg: t().body.fg, bg: t().selected.bg };
    render();
  });

  win.onResize(() => render());

  win.onCleanup(() => {
    root.destroy();
  });

  render();
  win.focus();
}
