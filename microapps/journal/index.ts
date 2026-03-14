import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { renderFiglet } from "../../src/services/microapp-sdk.js";
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ── Types ───────────────────────────────────────────────────────────

interface JournalEntry {
  peer: "human" | "agent" | "system";
  text: string;
  ts: string;
}

// ── Data ────────────────────────────────────────────────────────────

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

// ── Formatting ──────────────────────────────────────────────────────

const PEER_GLYPH = { human: "▸", agent: "▹", system: "·" } as const;
const PEER_LABEL = { human: "HUMAN", agent: "AGENT", system: "SYS" } as const;

function peerColor(peer: string, t: any): string {
  if (peer === "human") return t.body.fg || "white";
  if (peer === "agent") return t.selected?.fg || "#b48ead";
  return t.muted?.fg || "#555";
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function dayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function formatDayDivider(dateStr: string, width: number, t: any): string {
  const muted = t.muted?.fg || "#555";
  const label = ` ${dateStr} `;
  const remaining = Math.max(0, width - label.length);
  const left = "━".repeat(Math.floor(remaining / 2));
  const right = "━".repeat(Math.ceil(remaining / 2));
  return `{${muted}-fg}${left}${label}${right}{/${muted}-fg}`;
}

function formatEntryLine(e: JournalEntry, t: any): string {
  const glyph = PEER_GLYPH[e.peer] || "·";
  const tag = PEER_LABEL[e.peer] || "???";
  const time = formatTime(e.ts);
  const fg = peerColor(e.peer, t);
  const muted = t.muted?.fg || "#555";
  return `  {${fg}-fg}${glyph}{/${fg}-fg} {${muted}-fg}${time} ${tag.padEnd(5)}{/${muted}-fg}  ${e.text}`;
}

// ── Setup ───────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Journal",
    description: "Open the Symbient Journal.",
    menu: [{ category: "demos", order: 155, label: "Journal" }],
    palette: { order: 155, label: "Open Journal" },
    action: () => openJournal(host),
  });

  host.registerCommand({
    id: "append",
    label: "Append to Journal",
    description: "Append an entry to the journal. Args: { text, peer? }",
    direct: true,
    action: (args: any) => {
      const text = args?.text;
      if (!text || typeof text !== "string") {
        return { ok: false, error: "text is required" };
      }
      const peer = (args?.peer === "agent" || args?.peer === "system") ? args.peer : "human";
      const entry: JournalEntry = { peer, text, ts: new Date().toISOString() };
      appendEntry(journalPath(host), entry);
      return { ok: true, entry };
    },
  });
}

function openJournal(host: MicroappHost) {
  const geo = host.geometry;
  const winW = Math.max(80, Math.floor(geo.width * 0.95));
  const winH = Math.max(20, Math.floor(geo.height * 0.90));
  const winL = Math.max(0, Math.floor((geo.width - winW) / 2));
  const winT = Math.max(1, Math.floor((geo.height - winH) / 2));

  const win = host.createWindow({
    title: "Journal",
    width: winW, height: winH, left: winL, top: winT,
  });

  const t = () => host.theme();
  const fp = journalPath(host);
  let entries = loadEntries(fp);

  // ── Header ────────────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, height: 3,
    tags: true,
    style: t().body,
  });

  // ── Log ───────────────────────────────────────────────────────
  const logBox = blessed.box({
    parent: win.body,
    top: 3, left: 0, right: 0, bottom: 2,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: { ch: "│", style: { fg: t().muted?.fg || "#555" } },
    style: t().body,
  });

  // ── Status bar ────────────────────────────────────────────────
  const statusBar = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    tags: true,
    style: { fg: t().muted?.fg || "#666", bg: t().body.bg },
  });

  // ── Input ─────────────────────────────────────────────────────
  const inputBox = blessed.textbox({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    inputOnFocus: true,
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
  });

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const th = t();
    const muted = th.muted?.fg || "#555";
    const accent = th.selected?.fg || "#b48ead";

    // Header
    let fig = "";
    try { fig = renderFiglet("JRNL", "small"); } catch { fig = "JRNL"; }
    const figLines = fig.split("\n").filter(l => l.trim()).slice(0, 2);
    const tagline = `{${muted}-fg}symbient logbook // dual-authored record{/${muted}-fg}`;
    headerBox.setContent([...figLines, tagline].join("\n"));

    // Log
    const logW = Math.max(10, w - 4);
    const lines: string[] = [];
    let lastDay = "";
    for (const e of entries) {
      const day = dayKey(e.ts);
      if (day !== lastDay) {
        if (lastDay) lines.push("");
        lines.push(formatDayDivider(day, logW, th));
        lines.push("");
        lastDay = day;
      }
      lines.push(formatEntryLine(e, th));
    }
    if (lines.length === 0) {
      lines.push(`  {${muted}-fg}no entries yet. type below.{/${muted}-fg}`);
    }
    logBox.setContent(lines.join("\n"));
    logBox.setScrollPerc(100);

    // Status bar
    const humans = entries.filter(e => e.peer === "human").length;
    const agents = entries.filter(e => e.peer === "agent").length;
    statusBar.setContent(
      `{${muted}-fg} ▸${humans} human  ▹${agents} agent  · ${entries.length} total{/${muted}-fg}`
    );

    host.screen.render();
  }

  function addEntry(text: string, peer: "human" | "agent" | "system" = "human") {
    const entry: JournalEntry = { peer, text, ts: new Date().toISOString() };
    entries.push(entry);
    appendEntry(fp, entry);
    render();
  }

  // ── Input handling ────────────────────────────────────────────
  inputBox.on("submit", (value: string) => {
    const trimmed = (value || "").trim();
    if (trimmed) addEntry(trimmed, "human");
    inputBox.clearValue();
    inputBox.focus();
  });

  if (entries.length === 0) {
    addEntry("journal initialised", "system");
  } else {
    addEntry("session resumed", "system");
  }

  win.setFocusTarget(inputBox);

  // ── Lifecycle ─────────────────────────────────────────────────
  win.describeState(() => ({
    summary: `Journal — ${entries.length} entries`,
    lastEntry: entries.length > 0 ? entries[entries.length - 1]!.text : null,
    entryCount: entries.length,
  }));

  win.captureText(() => entries.map(e => {
    const glyph = PEER_GLYPH[e.peer] || "·";
    return `${glyph} ${formatTime(e.ts)}  ${e.text}`;
  }).join("\n"));

  win.onRestyle(() => {
    const th = t();
    headerBox.style = th.body;
    logBox.style = th.body;
    statusBar.style = { fg: th.muted?.fg || "#666", bg: th.body.bg };
    inputBox.style = { fg: th.body.fg, bg: th.selected?.bg || "#333" };
    render();
  });

  win.onResize(() => render());
  win.onCleanup(() => {});

  render();
  win.focus();
}
