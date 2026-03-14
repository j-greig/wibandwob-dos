import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { renderFiglet } from "../../src/services/microapp-sdk.js";
import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ── Types ───────────────────────────────────────────────────────────

type EntryKind = "note" | "observation" | "decision" | "discovery" | "question";

interface JournalEntry {
  peer: "human" | "agent" | "system";
  text: string;
  ts: string;
  kind?: EntryKind;
  tags?: string[];
  actor?: string; // peer provenance — who specifically (e.g. "claude", "james", "cron")
  referenceId?: number; // linked entry — index of referenced entry (0-based)
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
const KIND_ICON: Record<string, string> = {
  note: "░", observation: "◊", decision: "■", discovery: "★", question: "?",
};

function peerColor(peer: string, t: any): string {
  if (peer === "human") return t.body.fg || "white";
  if (peer === "agent") return t.selected?.fg || "#b48ead";
  return t.muted?.fg || "#555";
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function dayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    let breakAt = remaining.lastIndexOf(" ", width);
    if (breakAt <= 0) breakAt = width;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function formatDayDivider(dateStr: string, width: number, t: any): string {
  const muted = t.muted?.fg || "#555";
  const label = ` ${dateStr} `;
  const remaining = Math.max(0, width - label.length);
  const left = "━".repeat(Math.floor(remaining / 2));
  const right = "━".repeat(Math.ceil(remaining / 2));
  return `{${muted}-fg}${left}${label}${right}{/${muted}-fg}`;
}

function formatEntryLines(e: JournalEntry, t: any, maxTextW: number): string[] {
  const glyph = PEER_GLYPH[e.peer] || "·";
  const peerTag = PEER_LABEL[e.peer] || "???";
  const time = formatTime(e.ts);
  const rel = timeAgo(e.ts);
  const fg = peerColor(e.peer, t);
  const muted = t.muted?.fg || "#555";
  const accent = t.selected?.fg || "#b48ead";

  const kindIcon = e.kind ? (KIND_ICON[e.kind] || "░") + " " : "";
  const prefix = `  {${fg}-fg}${glyph}{/${fg}-fg} {${muted}-fg}${time} ${peerTag.padEnd(5)} ${rel.padEnd(7)}{/${muted}-fg}  ${kindIcon}`;
  // prefix visible length: ~25 + kind (2 if present)
  const prefixLen = 25 + (e.kind ? 2 : 0);
  const textW = Math.max(10, maxTextW - prefixLen);
  const wrapped = wrapText(e.text, textW);
  const indent = " ".repeat(prefixLen);

  const tagStr = e.tags && e.tags.length > 0
    ? `  {${accent}-fg}[${e.tags.map(tg => `#${tg}`).join(" ")}]{/${accent}-fg}`
    : "";
  const refStr = e.referenceId !== undefined
    ? `  {${muted}-fg}→ #${e.referenceId}{/${muted}-fg}`
    : "";

  const result = wrapped.map((line, i) =>
    i === 0 ? `${prefix}${line}` : `${indent}${line}`
  );
  // Append tags to last line
  if ((tagStr || refStr) && result.length > 0) {
    result[result.length - 1] += tagStr + refStr;
  }
  return result;
}

// ── Setup ───────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Journal",
    description: "Open the Symbient Journal.",
    menu: [{ category: "demos", order: 155, label: "Journal" }],
    palette: { order: 155, label: "Open Journal" },
    action: (args: any) => openJournal(host, args),
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return {
        filterByPeer: state.filterByPeer ?? "all",
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", {
        filterByPeer: payload?.filterByPeer,
      });
    },
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
      const kind = args?.kind as EntryKind | undefined;
      const tags = Array.isArray(args?.tags) ? args.tags.filter((t: any) => typeof t === "string") : undefined;
      const actor = typeof args?.actor === "string" ? args.actor : undefined;
      const referenceId = typeof args?.referenceId === "number" ? args.referenceId : undefined;
      const entry: JournalEntry = { peer, text, ts: new Date().toISOString(), kind, tags, actor, referenceId };
      appendEntry(journalPath(host), entry);
      return { ok: true, entry };
    },
  });

  host.registerCommand({
    id: "export-markdown",
    label: "Export Journal as Markdown",
    description: "Export the current journal as a .md file. Args: { journalName? }",
    direct: true,
    action: (args: any) => {
      const jName = args?.journalName || "journal";
      const fp = join(host.repoRoot, "scratch", `${jName}.jsonl`);
      const entries = loadEntries(fp);
      const mdLines = [`# Symbient Journal — ${jName}`, "", `> Exported ${new Date().toISOString()}`, ""];
      let lastDay = "";
      for (const e of entries) {
        const day = dayKey(e.ts);
        if (day !== lastDay) {
          mdLines.push(`## ${day}`, "");
          lastDay = day;
        }
        const time = formatTime(e.ts);
        const tag = PEER_LABEL[e.peer] || "???";
        mdLines.push(`- **${time}** \`${tag}\` ${e.text}`);
      }
      const exportMarkdown = mdLines.join("\n");
      const outPath = join(host.repoRoot, "scratch", `${jName}-export.md`);
      const dir = dirname(outPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(outPath, exportMarkdown);
      return { ok: true, path: outPath, entries: entries.length };
    },
  });

  host.registerCommand({
    id: "switch",
    label: "Switch Journal",
    description: "Switch to a different journal file. Args: { journalName }",
    direct: true,
    action: (args: any) => {
      const name = args?.journalName;
      if (!name || typeof name !== "string") {
        return { ok: false, error: "journalName is required" };
      }
      // Store preference — next open will use this
      return { ok: true, switchJournal: name, note: "Reopen journal to use new file" };
    },
  });

  host.registerCommand({
    id: "summarize",
    label: "Summarize Journal",
    description: "Return a summary of the current journal. Args: { journalName? }",
    direct: true,
    action: (args: any) => {
      const jName = args?.journalName || "journal";
      const fp = join(host.repoRoot, "scratch", `${jName}.jsonl`);
      const all = loadEntries(fp);
      const humans = all.filter(e => e.peer === "human").length;
      const agents = all.filter(e => e.peer === "agent").length;
      const days = new Set(all.map(e => dayKey(e.ts))).size;
      const kinds: Record<string, number> = {};
      for (const e of all) if (e.kind) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      const allTags = new Set(all.flatMap(e => e.tags || []));
      const last5 = all.slice(-5).map(e => ({ peer: e.peer, text: e.text, ts: e.ts }));
      return {
        ok: true,
        journalName: jName,
        totalEntries: all.length,
        peerBreakdown: { human: humans, agent: agents, system: all.length - humans - agents },
        days,
        kinds,
        tags: [...allTags],
        recentEntries: last5,
      };
    },
  });

  host.registerCommand({
    id: "ambient",
    label: "Journal Ambient",
    description: "Open a compact ambient view showing the last 3 entries.",
    action: () => openAmbient(host),
  });
}

function openAmbient(host: MicroappHost) {
  const fp = join(host.repoRoot, "scratch", "journal.jsonl");
  const win = host.createWindow({ title: "Journal ·", width: 50, height: 6 });
  const t = () => host.theme();

  const box = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 0,
    tags: true,
    style: t().body,
  });

  function render() {
    const entries = loadEntries(fp);
    const last3 = entries.slice(-3);
    const th = t();
    const muted = th.muted?.fg || "#555";
    const lines = last3.map(e => {
      const glyph = PEER_GLYPH[e.peer] || "·";
      const fg = peerColor(e.peer, th);
      const time = formatTime(e.ts);
      return `{${fg}-fg}${glyph}{/${fg}-fg} {${muted}-fg}${time}{/${muted}-fg} ${e.text}`;
    });
    if (lines.length === 0) lines.push(`{${muted}-fg}empty journal{/${muted}-fg}`);
    box.setContent(lines.join("\n"));
    host.screen.render();
  }

  render();
  // Refresh every 5s
  const timer = setInterval(render, 5000);

  win.describeState(() => ({ summary: "Journal ambient — last 3" }));
  win.captureText(() => box.getContent());
  win.onRestyle(() => { box.style = t().body; render(); });
  win.onCleanup(() => clearInterval(timer));
  win.focus();
}

function openJournal(host: MicroappHost, args?: Record<string, unknown>) {
  const geo = host.geometry;
  const winW = Math.max(80, Math.floor(geo.width * 0.95));
  const winH = Math.max(20, Math.floor(geo.height * 0.90));
  const winL = Math.max(0, Math.floor((geo.width - winW) / 2));
  const winT = Math.max(1, Math.floor((geo.height - winH) / 2));

  const journalName = (args?.journalName as string) || "journal";
  const fp = join(host.repoRoot, "scratch", `${journalName}.jsonl`);

  const win = host.createWindow({
    title: journalName === "journal" ? "Journal" : `Journal: ${journalName}`,
    width: winW, height: winH, left: winL, top: winT,
  });

  const t = () => host.theme();
  let entries = loadEntries(fp);
  let filterByPeer: "all" | "human" | "agent" | "system" = "all";
  let filterText = "";

  function filterEntries(): JournalEntry[] {
    return entries.filter(e => {
      if (filterByPeer !== "all" && e.peer !== filterByPeer) return false;
      if (filterText && !e.text.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }

  // ── Header: figlet + tagline ──────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body,
    top: 0, left: 1, right: 0, height: 7,
    tags: true,
    style: t().body,
  });

  // ── Separator ─────────────────────────────────────────────────
  const sepBox = blessed.box({
    parent: win.body,
    top: 7, left: 0, right: 0, height: 1,
    tags: true,
    style: t().body,
  });

  // ── Log ───────────────────────────────────────────────────────
  const logBox = blessed.box({
    parent: win.body,
    top: 8, left: 0, right: 0, bottom: 2,
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
    bottom: 0, left: 7, right: 0, height: 1,
    inputOnFocus: true,
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
  });

  const inputPrompt = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, width: 7, height: 1,
    tags: true,
    content: " {bold}▸{/bold} ",
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
  });

  // ── Keyboard nav ──────────────────────────────────────────────
  logBox.key(["j"], () => { logBox.scroll(1); host.screen.render(); });
  logBox.key(["k"], () => { logBox.scroll(-1); host.screen.render(); });
  logBox.key(["g"], () => { (logBox as any).scrollTo(0); host.screen.render(); });
  logBox.key(["S-g"], () => { logBox.setScrollPerc(100); host.screen.render(); });

  // ── Filter keys ───────────────────────────────────────────────
  // / = cycle peer filter: all → human → agent → system → all
  logBox.key(["/"], () => {
    const cycle: Array<typeof filterByPeer> = ["all", "human", "agent", "system"];
    const idx = cycle.indexOf(filterByPeer);
    filterByPeer = cycle[(idx + 1) % cycle.length]!;
    filterText = "";
    render();
  });

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const th = t();
    const muted = th.muted?.fg || "#555";
    const accent = th.selected?.fg || "#b48ead";

    // Header — bigger font at large breakpoints
    const font = w >= 80 ? "slant" : "small";
    let fig = "";
    try { fig = renderFiglet("JRNL", font); } catch { fig = "JRNL"; }
    const figLines = fig.split("\n").filter(l => l.trim());
    const tagline = `{${muted}-fg}symbient logbook // dual-authored record{/${muted}-fg}`;
    headerBox.setContent([...figLines, "", tagline].join("\n"));

    // Separator
    sepBox.setContent(`{${muted}-fg}${"━".repeat(w)}{/${muted}-fg}`);

    // Log
    const logW = Math.max(10, w - 2);
    const visible = filterEntries();
    const lines: string[] = [];

    // Filter indicator
    if (filterByPeer !== "all" || filterText) {
      const parts: string[] = [];
      if (filterByPeer !== "all") parts.push(`peer:${filterByPeer}`);
      if (filterText) parts.push(`"${filterText}"`);
      lines.push(`  {${accent}-fg}FILTER: ${parts.join(" + ")}{/${accent}-fg}  {${muted}-fg}(${visible.length}/${entries.length} shown, / to clear){/${muted}-fg}`);
      lines.push("");
    }

    let lastDay = "";
    let entryIdx = 0;
    for (const e of visible) {
      const day = dayKey(e.ts);
      if (day !== lastDay) {
        if (lastDay) lines.push("");
        lines.push(formatDayDivider(day, logW, th));
        lines.push("");
        lastDay = day;
      }
      const entryLines = formatEntryLines(e, th, logW);
      // Add muted line number gutter to first line
      const num = String(entryIdx).padStart(3);
      if (entryLines.length > 0) {
        entryLines[0] = `{${muted}-fg}${num}{/${muted}-fg}` + entryLines[0]!.slice(2); // replace leading 2 spaces
      }
      lines.push(...entryLines);
      entryIdx++;
    }
    if (lines.length === 0) {
      lines.push(`  {${muted}-fg}no entries yet. type below.{/${muted}-fg}`);
    }
    logBox.setContent(lines.join("\n"));
    logBox.setScrollPerc(100);

    // Status bar
    const humans = entries.filter(e => e.peer === "human").length;
    const agents = entries.filter(e => e.peer === "agent").length;
    const days = new Set(entries.map(e => dayKey(e.ts))).size;
    statusBar.setContent(
      `{${muted}-fg} ▸${humans} human  ▹${agents} agent  · ${entries.length} entries  ${days} day${days !== 1 ? "s" : ""}  │  j/k scroll  g/G jump{/${muted}-fg}`
    );

    host.screen.render();
  }

  function addEntry(text: string, peer: "human" | "agent" | "system" = "human", opts?: { kind?: EntryKind; tags?: string[]; actor?: string }) {
    const entry: JournalEntry = { peer, text, ts: new Date().toISOString(), ...opts };
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
  win.describeState(() => {
    const humans = entries.filter(e => e.peer === "human").length;
    const agents = entries.filter(e => e.peer === "agent").length;
    const systems = entries.filter(e => e.peer === "system").length;
    const last = entries.length > 0 ? entries[entries.length - 1]! : null;
    const peerBreakdown = { human: humans, agent: agents, system: systems };
    // mood heuristic: ratio of questions to decisions
    const questions = entries.filter(e => e.kind === "question").length;
    const decisions = entries.filter(e => e.kind === "decision").length;
    const mood = questions > decisions ? "curious" : decisions > 0 ? "decisive" : "observing";
    const stats = { entryCount: entries.length, peerBreakdown, mood };
    return {
      summary: `Journal — ${entries.length} entries`,
      lastEntry: last?.text ?? null,
      entryCount: entries.length,
      filterByPeer,
      journalName,
      peerBreakdown,
      mood,
      stats,
    };
  });

  win.captureText(() => entries.map(e => {
    const glyph = PEER_GLYPH[e.peer] || "·";
    return `${glyph} ${formatTime(e.ts)}  ${e.text}`;
  }).join("\n"));

  win.onRestyle(() => {
    const th = t();
    headerBox.style = th.body;
    sepBox.style = th.body;
    logBox.style = th.body;
    statusBar.style = { fg: th.muted?.fg || "#666", bg: th.body.bg };
    inputBox.style = { fg: th.body.fg, bg: th.selected?.bg || "#333" };
    inputPrompt.style = { fg: th.body.fg, bg: th.selected?.bg || "#333" };
    render();
  });

  win.onResize(() => render());
  win.onCleanup(() => {});

  render();
  win.focus();
}
