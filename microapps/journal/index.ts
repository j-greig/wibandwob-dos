import blessed from "blessed";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { MicroappHost, WindowHandle } from "../../src/services/microapp-sdk.js";
import { renderFiglet, renderMarkdown, PLAIN_HEADING_CONFIG } from "../../src/services/microapp-sdk.js";

// ── Types ───────────────────────────────────────────────────────
type EntryKind = "note" | "observation" | "decision" | "discovery" | "question";
type Peer = "human" | "agent" | "system";
type Mode = "list" | "read" | "edit";
type ViewMode = "journal" | "sessions";

// ── Session log types ───────────────────────────────────────────
interface SessionSummary {
  filename: string;
  date: string;         // ISO
  sessionId: string;    // UUID prefix
  messageCount: number;
  firstUserMsg: string; // preview
}

interface SessionMessage {
  role: string;         // user | assistant
  text: string;         // first text block content
  toolCalls: string[];  // tool names
  toolResults: string[]; // one-line summaries
}

interface JournalEntry {
  id: string;
  title: string;
  body: string;
  peer: Peer;
  kind: EntryKind;
  tags: string[];
  actor?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  referenceId?: string;
}

// ── Constants ───────────────────────────────────────────────────
const KIND_ICON: Record<EntryKind, string> = {
  note: "░", observation: "◊", decision: "■", discovery: "★", question: "?",
};
const PEER_GLYPH: Record<Peer, string> = { human: "▸", agent: "▹", system: "·" };

// ── Storage ─────────────────────────────────────────────────────
function entriesDir(host: MicroappHost): string {
  const dir = join(host.repoRoot, "scratch", "journal-v2", "entries");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function saveEntry(host: MicroappHost, entry: JournalEntry): void {
  const dir = entriesDir(host);
  writeFileSync(join(dir, `${entry.id}.json`), JSON.stringify(entry, null, 2));
}

function loadEntry(host: MicroappHost, id: string): JournalEntry | null {
  const fp = join(entriesDir(host), `${id}.json`);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, "utf-8")); } catch { return null; }
}

function loadAllEntries(host: MicroappHost): JournalEntry[] {
  const dir = entriesDir(host);
  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  const entries: JournalEntry[] = [];
  for (const f of files) {
    try {
      const e = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      if (e && e.id) entries.push(e);
    } catch { /* skip corrupt */ }
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function deleteEntryFile(host: MicroappHost, id: string): boolean {
  const fp = join(entriesDir(host), `${id}.json`);
  if (existsSync(fp)) { unlinkSync(fp); return true; }
  return false;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Helpers ─────────────────────────────────────────────────────
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

// ANSI helpers for detailBox (tags:false — uses raw ANSI, not blessed tags)
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  fg: (color: string) => {
    // Handle 6-char hex
    let h = color.replace("#", "");
    // Expand 3-char hex: #555 → 555555
    if (/^[0-9a-fA-F]{3}$/.test(h)) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (/^[0-9a-fA-F]{6}$/.test(h)) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `\x1b[38;2;${r};${g};${b}m`;
    }
    // Named colors — fallback to dim
    return "\x1b[2m";
  },
};

// Detect if text has markdown features worth rendering
function hasMarkdown(text: string): boolean {
  return /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^```|^\s*>\s|^---$|^\*\*|^__/m.test(text);
}

function renderBody(text: string, width: number): string[] {
  if (hasMarkdown(text)) {
    return renderMarkdown(text, width, { headingConfig: PLAIN_HEADING_CONFIG, paddingX: 1 });
  }
  return wrapText(text, width - 2).map(l => `  ${l}`);
}

function wrapText(text: string, width: number): string[] {
  if (width < 5) width = 5;
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.length <= width) { lines.push(raw); continue; }
    let remaining = raw;
    while (remaining.length > width) {
      let cut = remaining.lastIndexOf(" ", width);
      if (cut < width * 0.3) cut = width;
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) lines.push(remaining);
  }
  return lines;
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

function peerColor(peer: Peer, th: any): string {
  if (peer === "agent") return th.selected?.fg || "#b48ead";
  if (peer === "human") return th.body?.fg || "#d8dee9";
  return th.muted?.fg || "#555";
}

// ── Setup ───────────────────────────────────────────────────────
export default function setup(host: MicroappHost) {

  // ── Commands ──────────────────────────────────────────────────
  host.registerCommand({
    id: "open",
    label: "Journal",
    description: "Open the Symbient Journal v2.",
    menu: [{ category: "demos", order: 155, label: "Journal" }],
    palette: { order: 155, label: "Open Journal" },
    action: () => openJournal(host),
  });

  host.registerCommand({
    id: "create",
    label: "Create Journal Entry",
    description: "Create a new journal entry. Args: { title, body?, peer?, kind?, tags? }",
    direct: true,
    action: (args: any) => {
      if (!args?.title) return { ok: false, error: "title is required" };
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: genId(),
        title: args.title,
        body: args.body || "",
        peer: ["human", "agent", "system"].includes(args?.peer) ? args.peer : "human",
        kind: args?.kind || "note",
        tags: Array.isArray(args?.tags) ? args.tags : [],
        actor: args?.actor,
        createdAt: now,
        updatedAt: now,
      };
      saveEntry(host, entry);
      if (_liveRefresh) _liveRefresh();
      return { ok: true, entry };
    },
  });

  host.registerCommand({
    id: "read",
    label: "Read Journal Entry",
    description: "Read a journal entry by id. Args: { id }",
    direct: true,
    action: (args: any) => {
      if (!args?.id) return { ok: false, error: "id is required" };
      const entry = loadEntry(host, args.id);
      if (!entry) return { ok: false, error: "entry not found" };
      return { ok: true, entry };
    },
  });

  host.registerCommand({
    id: "update",
    label: "Update Journal Entry",
    description: "Update a journal entry. Args: { id, title?, body?, kind?, tags? }",
    direct: true,
    action: (args: any) => {
      if (!args?.id) return { ok: false, error: "id is required" };
      const entry = loadEntry(host, args.id);
      if (!entry) return { ok: false, error: "entry not found" };
      if (args.title) entry.title = args.title;
      if (args.body !== undefined) entry.body = args.body;
      if (args.kind) entry.kind = args.kind;
      if (args.tags) entry.tags = args.tags;
      entry.updatedAt = new Date().toISOString();
      saveEntry(host, entry);
      if (_liveRefresh) _liveRefresh();
      return { ok: true, entry };
    },
  });

  host.registerCommand({
    id: "list",
    label: "List Journal Entries",
    description: "List journal entries. Args: { peer?, kind?, tag?, search?, limit? }",
    direct: true,
    action: (args: any) => {
      let entries = loadAllEntries(host);
      if (args?.peer) entries = entries.filter(e => e.peer === args.peer);
      if (args?.kind) entries = entries.filter(e => e.kind === args.kind);
      if (args?.tag) entries = entries.filter(e => e.tags?.includes(args.tag));
      if (args?.search) {
        const q = args.search.toLowerCase();
        entries = entries.filter(e =>
          e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)
        );
      }
      const limit = args?.limit || 50;
      return {
        ok: true,
        total: entries.length,
        entries: entries.slice(0, limit).map(e => ({
          id: e.id, title: e.title, peer: e.peer, kind: e.kind,
          tags: e.tags, createdAt: e.createdAt, updatedAt: e.updatedAt,
          preview: e.body.slice(0, 100),
        })),
      };
    },
  });

  host.registerCommand({
    id: "delete",
    label: "Delete Journal Entry",
    description: "Delete a journal entry. Args: { id }",
    direct: true,
    action: (args: any) => {
      if (!args?.id) return { ok: false, error: "id is required" };
      const ok = deleteEntryFile(host, args.id);
      if (_liveRefresh) _liveRefresh();
      return { ok, error: ok ? undefined : "entry not found" };
    },
  });

  host.registerCommand({
    id: "export-markdown",
    label: "Export Journal as Markdown",
    description: "Export all entries as markdown file.",
    direct: true,
    action: () => {
      const entries = loadAllEntries(host);
      const lines = ["# Symbient Journal Export", "", `> ${entries.length} entries`, ""];
      for (const e of entries) {
        const icon = KIND_ICON[e.kind] || "░";
        lines.push(`## ${icon} ${e.title}`);
        lines.push(`*${e.peer}* · ${e.kind} · ${new Date(e.createdAt).toLocaleDateString()}`);
        if (e.tags.length) lines.push(`Tags: ${e.tags.map(t => `#${t}`).join(" ")}`);
        lines.push("");
        lines.push(e.body || "(empty)");
        lines.push("", "---", "");
      }
      const fp = join(host.repoRoot, "scratch", "journal-v2-export.md");
      writeFileSync(fp, lines.join("\n"));
      return { ok: true, path: fp, entries: entries.length };
    },
  });

  host.registerCommand({
    id: "import-legacy",
    label: "Import v1 Journal Entries",
    description: "Import entries from the v1 journal.jsonl format.",
    direct: true,
    action: () => {
      const fp = join(host.repoRoot, "scratch", "journal.jsonl");
      if (!existsSync(fp)) return { ok: false, error: "No v1 journal found" };
      const lines = readFileSync(fp, "utf-8").trim().split("\n");
      let imported = 0;
      for (const line of lines) {
        try {
          const old = JSON.parse(line);
          const now = old.ts || new Date().toISOString();
          const entry: JournalEntry = {
            id: genId(),
            title: (old.text || "").slice(0, 80) || "Untitled",
            body: old.text || "",
            peer: old.peer || "human",
            kind: old.kind || "note",
            tags: old.tags || [],
            actor: old.actor,
            createdAt: now,
            updatedAt: now,
            referenceId: old.referenceId !== undefined ? String(old.referenceId) : undefined,
          };
          saveEntry(host, entry);
          imported++;
        } catch { /* skip */ }
      }
      if (_liveRefresh) _liveRefresh();
      return { ok: true, imported };
    },
  });

  // Session commands (only if ~/.pi exists)
  if (PI_EXISTS) {
    host.registerCommand({
      id: "sessions",
      label: "List Pi Sessions",
      description: "List recent pi agent sessions for this repo.",
      direct: true,
      action: (args) => {
        const limit = (args?.limit as number) || 20;
        const sessions = listSessions(limit);
        return {
          ok: true,
          count: sessions.length,
          sessions: sessions.map(s => ({
            filename: s.filename,
            date: s.date,
            sessionId: s.sessionId,
            messageCount: s.messageCount,
            firstUserMsg: s.firstUserMsg,
          })),
        };
      },
    });

    host.registerCommand({
      id: "session.read",
      label: "Read Pi Session",
      description: "Read a specific pi agent session by filename.",
      direct: true,
      action: (args) => {
        const filename = args?.filename as string;
        if (!filename) return { ok: false, error: "filename required" };
        const messages = readSession(filename);
        return {
          ok: true,
          messageCount: messages.length,
          messages: messages.map(m => ({
            role: m.role,
            text: m.text?.slice(0, 500),
            toolCalls: m.toolCalls,
          })),
        };
      },
    });
  }

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return { mode: state.mode, selectedId: state.selectedId, viewMode: state.viewMode };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", payload);
    },
  });
}

// ── Session log helpers ──────────────────────────────────────────
const PI_DIR = join(process.env.HOME || "", ".pi");
const PI_EXISTS = existsSync(PI_DIR);

function sessionsDir(): string {
  const cwd = process.cwd();
  const encoded = "--" + cwd.replace(/^\//, "").replace(/\//g, "-") + "--";
  return join(PI_DIR, "agent", "sessions", encoded);
}

function listSessions(limit = 50): SessionSummary[] {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter(f => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(f => {
    const match = f.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-\d+Z_([a-f0-9-]+)\.jsonl$/);
    const date = match ? `${match[1]}T${match[2]}:${match[3]}:${match[4]}Z` : "";
    const sessionId = match ? match[5]!.slice(0, 8) : f.slice(0, 8);

    // Count messages and get first user message (lazy — read line by line)
    let msgCount = 0;
    let firstUserMsg = "";
    try {
      const content = readFileSync(join(dir, f), "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const d = JSON.parse(line);
          if (d.type === "message") {
            msgCount++;
            if (!firstUserMsg) {
              const msg = d.message || {};
              if (msg.role === "user") {
                const blocks = Array.isArray(msg.content) ? msg.content : [];
                const textBlock = blocks.find((b: any) => b.type === "text");
                if (textBlock) firstUserMsg = textBlock.text?.slice(0, 80) || "";
              }
            }
          }
        } catch { /* skip bad line */ }
      }
    } catch { /* skip unreadable file */ }

    return { filename: f, date, sessionId, messageCount: msgCount, firstUserMsg };
  });
}

function readSession(filename: string): SessionMessage[] {
  const fp = join(sessionsDir(), filename);
  if (!existsSync(fp)) return [];
  const messages: SessionMessage[] = [];
  try {
    const content = readFileSync(fp, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        if (d.type !== "message") continue;
        const msg = d.message || {};
        const role = msg.role || "unknown";
        const blocks = Array.isArray(msg.content) ? msg.content : [];

        let text = "";
        const toolCalls: string[] = [];
        const toolResults: string[] = [];

        for (const b of blocks) {
          if (b.type === "text" && !text) text = b.text || "";
          if (b.type === "toolCall") toolCalls.push(b.name || b.toolName || "tool");
          if (b.type === "toolResult") {
            const preview = (b.text || b.content?.[0]?.text || "").slice(0, 60);
            toolResults.push(preview);
          }
        }

        // Skip empty tool results with no visible content
        if (role === "toolResult" && !text && toolResults.length === 0) continue;

        messages.push({ role, text, toolCalls, toolResults });
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return messages;
}

// ── Live refresh callback ───────────────────────────────────────
let _liveRefresh: (() => void) | null = null;

// ── Window ──────────────────────────────────────────────────────
function openJournal(host: MicroappHost, args?: Record<string, unknown>) {
  const t = () => host.theme();
  const sw = (host.screen as any).width || 169;
  const sh = (host.screen as any).height || 44;
  const win = host.createWindow({
    title: "Journal",
    width: Math.floor(sw * 0.95),
    height: Math.floor(sh * 0.95),
  });

  let mode: Mode = "list";
  let viewMode: ViewMode = "journal";
  let entries: JournalEntry[] = [];
  let selectedIdx = 0;
  let sessions: SessionSummary[] = [];
  let sessionIdx = 0;
  let sessionMessages: SessionMessage[] = [];
  let selectedEntry: JournalEntry | null = null;
  let editTitle = "";
  let editBody = "";
  let editKind: EntryKind = "note";
  let editTags: string[] = [];
  let editingId: string | null = null; // null = new entry
  let searchQuery = "";
  let deleteConfirm = false;
  type SortMode = "updatedAt" | "createdAt" | "title";
  let sortBy: SortMode = "updatedAt";
  const SORT_CYCLE: SortMode[] = ["updatedAt", "createdAt", "title"];
  const SORT_LABEL: Record<SortMode, string> = { updatedAt: "↓updated", createdAt: "↓created", title: "↓title" };

  // ── UI Elements ───────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, height: 7,
    tags: true, style: t().body,
  });

  const sepBox = blessed.box({
    parent: win.body,
    top: 7, left: 0, right: 0, height: 1,
    tags: true, style: t().body,
  });

  const contentBox = blessed.box({
    parent: win.body,
    top: 8, left: 0, right: 0, bottom: 2,
    tags: true, style: t().body,
  });

  // List pane (left or full width)
  const listBox = blessed.list({
    parent: contentBox,
    top: 0, left: 0, bottom: 0,
    width: "100%",
    tags: true,
    mouse: true,
    keys: false, // we handle keys ourselves
    scrollable: true,
    scrollbar: { ch: "│", style: { fg: t().muted?.fg || "#555" } },
    style: {
      ...t().body,
      selected: { bg: t().selected?.bg || "#333", fg: t().selected?.fg || "#fff" },
    },
  } as any);

  // Vertical separator between panes
  const paneSep = blessed.box({
    parent: contentBox,
    top: 0, bottom: 0, width: 1,
    left: 0, // positioned dynamically
    tags: true,
    style: { fg: t().muted?.fg || "#555", bg: t().body.bg },
    hidden: true,
  });

  // Detail/body pane (right or full width, used in read and edit modes)
  const detailBox = blessed.box({
    parent: contentBox,
    top: 0, left: 0, right: 0, bottom: 0,
    tags: false,
    scrollable: true,
    mouse: true,
    scrollbar: { ch: "│", style: { fg: t().muted?.fg || "#555" } },
    style: t().body,
    hidden: true,
  });

  // Edit area (textarea for body editing)
  const editArea = blessed.textarea({
    parent: contentBox,
    top: 3, left: 1, right: 1, bottom: 0,
    inputOnFocus: false,
    keys: true,
    mouse: true,
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
    hidden: true,
  } as any);

  // Title label for edit mode
  const titleLabelBox = blessed.box({
    parent: contentBox,
    top: 0, left: 2, width: 8, height: 1,
    tags: true,
    content: `Title:`,
    style: { fg: t().muted?.fg || "#555", bg: t().body.bg },
    hidden: true,
  });

  // Title input for editing
  const titleInput = blessed.textbox({
    parent: contentBox,
    top: 0, left: 1, right: 1, height: 1,
    inputOnFocus: false,
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
    hidden: true,
  } as any);

  // Kind selector label
  const kindLabel = blessed.box({
    parent: contentBox,
    top: 1, left: 1, right: 1, height: 1,
    tags: true,
    style: t().body,
    hidden: true,
  });

  const statusBar = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    tags: true,
    style: { fg: t().muted?.fg || "#666", bg: t().body.bg },
  });

  const commandBar = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    tags: true,
    style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
  });

  // ── Refresh entries ───────────────────────────────────────────
  function refresh() {
    let all = loadAllEntries(host);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      all = all.filter(e =>
        e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q) ||
        e.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    // Sort
    if (sortBy === "title") {
      all.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "createdAt") {
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    entries = all;
    if (selectedIdx >= entries.length) selectedIdx = Math.max(0, entries.length - 1);
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const th = t();
    const muted = th.muted?.fg || "#555";
    const accent = th.selected?.fg || "#b48ead";
    const w = (win.body as any).width || 80;

    // Header
    const font = w >= 80 ? "slant" : "small";
    let fig = "";
    try { fig = renderFiglet("JRNL", font); } catch { fig = "JRNL"; }
    const figLines = fig.split("\n").filter((l: string) => l.trim());

    // Dynamic mood based on entry kinds
    const questions = entries.filter(e => e.kind === "question").length;
    const decisions = entries.filter(e => e.kind === "decision").length;
    const discoveries = entries.filter(e => e.kind === "discovery").length;
    const moodWord = questions > decisions && questions > discoveries ? "curious"
      : discoveries > decisions ? "exploring"
      : decisions > 0 ? "decisive"
      : entries.length > 20 ? "productive"
      : entries.length > 0 ? "beginning"
      : "empty";
    const humans = entries.filter(e => e.peer === "human").length;
    const agents = entries.filter(e => e.peer === "agent").length;
    const ratio = humans > 0 && agents > 0 ? "symbient" : humans > 0 ? "human-led" : agents > 0 ? "agent-led" : "quiet";

    const tagline = viewMode === "sessions"
      ? `{${muted}-fg}session archaeology // ${sessions.length} pi sessions · ${PI_EXISTS ? "~/.pi" : "no pi"}{/${muted}-fg}`
      : `{${muted}-fg}symbient logbook // ${ratio} · mood: ${moodWord} · ${entries.length} entries{/${muted}-fg}`;
    headerBox.setContent([...figLines, "", tagline].join("\n"));

    // Separator
    const sepW = Math.max(0, w - 4);
    sepBox.setContent(`{${muted}-fg}${"━".repeat(sepW)}{/${muted}-fg}`);

    if (mode === "list") {
      renderListMode(th, muted, accent, w);
    } else if (mode === "read") {
      renderReadMode(th, muted, accent, w);
    } else if (mode === "edit") {
      renderEditMode(th, muted, accent, w);
    }

    host.screen.render();
  }

  function renderSessionList(muted: string, accent: string, w: number) {
    const twoPane = w >= 120;

    // Build session list items
    const items: string[] = [];
    const maxW = twoPane ? Math.floor(w * 0.30) - 8 : w - 8;
    for (const s of sessions) {
      const dateStr = s.date ? new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?";
      const timeStr = s.date ? new Date(s.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
      const preview = truncate(s.firstUserMsg || "(no user message)", maxW - 25);
      items.push(` {${muted}-fg}${dateStr} ${timeStr}{/${muted}-fg} {${accent}-fg}${s.sessionId}{/${accent}-fg} ${preview}`);
    }
    if (items.length === 0) {
      items.push(`  {${muted}-fg}no pi sessions found{/${muted}-fg}`);
    }
    rendering = true;
    listBox.setItems(items as any);
    if (items.length > 0) listBox.select(Math.min(sessionIdx, items.length - 1));
    rendering = false;

    // Preview: show session detail if two-pane
    if (twoPane && sessions.length > 0) {
      const s = sessions[sessionIdx];
      if (s) {
        const previewW = w - Math.floor(w * 0.32) - 6;
        const dim = ANSI.fg(muted);
        const hi = ANSI.fg(accent);

        // Lazy-load messages for selected session
        if (sessionMessages.length === 0 || true) {
          sessionMessages = readSession(s.filename);
        }

        const lines: string[] = [
          "",
          `  ${ANSI.bold}Session ${s.sessionId}${ANSI.reset}`,
          `  ${dim}${s.date ? new Date(s.date).toLocaleString() : "?"} · ${s.messageCount} messages${ANSI.reset}`,
          `  ${dim}${"─".repeat(Math.max(10, previewW - 4))}${ANSI.reset}`,
          "",
        ];

        for (const msg of sessionMessages.slice(0, 30)) {
          const roleColor = msg.role === "user" ? hi : msg.role === "assistant" ? ANSI.fg(muted) : dim;
          const roleLabel = msg.role === "user" ? "▸ human" : msg.role === "assistant" ? "▹ agent" : `· ${msg.role}`;
          if (msg.text) {
            lines.push(`  ${roleColor}${roleLabel}${ANSI.reset}`);
            const wrapped = renderMarkdown(msg.text.slice(0, 500), previewW - 4, {
              headingConfig: PLAIN_HEADING_CONFIG,
              paddingX: 4,
            });
            lines.push(...wrapped);
            lines.push("");
          }
          if (msg.toolCalls.length > 0) {
            lines.push(`  ${dim}  🔧 ${msg.toolCalls.join(", ")}${ANSI.reset}`);
          }
        }

        detailBox.setContent(lines.join("\n"));
        (detailBox as any).scrollTo(0);
      }
    }

    // Status + command bars for session mode
    statusBar.setContent(
      `{${muted}-fg} [SESSIONS]  ${sessions.length} sessions  ${PI_EXISTS ? "~/.pi found" : ""}{/${muted}-fg}`
    );
    commandBar.setContent(
      `{${muted}-fg} ${sessionIdx + 1}/${sessions.length}  Enter view  S journal  j/k nav  g/G jump{/${muted}-fg}`
    );
  }

  function renderListMode(th: any, muted: string, accent: string, w: number) {
    // Show list, hide detail/edit
    listBox.show();
    detailBox.hide();
    editArea.hide();
    titleInput.hide();
    titleLabelBox.hide();
    kindLabel.hide();

    // Session view mode
    if (viewMode === "sessions") {
      const twoPane = w >= 120;
      if (twoPane) {
        const listW = Math.floor(w * 0.30);
        listBox.width = listW;
        paneSep.left = listW;
        paneSep.show();
        const sepH = (contentBox as any).height || 20;
        paneSep.setContent(("│\n").repeat(sepH).trim());
        detailBox.left = listW + 1;
        detailBox.width = w - listW - 2;
        detailBox.show();
      } else {
        listBox.width = "100%" as any;
        paneSep.hide();
      }
      renderSessionList(muted, accent, w);
      return;
    }

    // Determine layout: two-pane if wide enough
    const twoPane = w >= 120;

    if (twoPane) {
      const listW = Math.floor(w * 0.30);
      listBox.width = listW;
      paneSep.left = listW;
      paneSep.show();
      const sepH = (contentBox as any).height || 20;
      paneSep.setContent(("│\n").repeat(sepH).trim());
      detailBox.left = listW + 1;
      detailBox.width = w - listW - 2;
      detailBox.show();
    } else {
      listBox.width = "100%" as any;
      paneSep.hide();
      detailBox.hide();
    }

    // Build list items with date group headers and index mapping
    const items: string[] = [];
    const entryIndexMap: number[] = []; // entryIndexMap[visualIdx] → entryIdx or -1 for headers
    const maxTitleW = twoPane ? Math.floor(w * 0.30) - 12 : w - 14;

    function dateGroup(iso: string): string {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }

    let lastGroup = "";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      const sortField = sortBy === "createdAt" ? e.createdAt : e.updatedAt;
      const group = dateGroup(sortField);
      if (group !== lastGroup) {
        lastGroup = group;
        items.push(`{${muted}-fg}─ ${group} ─{/${muted}-fg}`);
        entryIndexMap.push(-1); // header
      }
      const icon = KIND_ICON[e.kind] || "░";
      const fg = peerColor(e.peer, th);
      const age = timeAgo(e.updatedAt);
      const title = truncate(e.title, maxTitleW);
      const tagStr = e.tags.length > 0 ? ` {${accent}-fg}${e.tags.map(t => `#${t}`).join(" ")}{/${accent}-fg}` : "";
      items.push(`${icon} ${title}  {${muted}-fg}${age}{/${muted}-fg}${tagStr}`);
      entryIndexMap.push(i);
    }
    if (items.length === 0) {
      items.push(`{${muted}-fg}no entries yet — press n to create{/${muted}-fg}`);
      entryIndexMap.push(-1);
    }

    // Find the visual index for the current selectedIdx
    let visualIdx = entryIndexMap.indexOf(selectedIdx);
    if (visualIdx < 0) visualIdx = entryIndexMap.findIndex(i => i >= 0); // first entry

    rendering = true;
    listBox.setItems(items as any);
    if (visualIdx >= 0) listBox.select(visualIdx);
    rendering = false;

    // Store the index map for selection handlers
    (listBox as any)._entryIndexMap = entryIndexMap;

    // Preview pane (two-pane mode)
    if (twoPane && entries.length === 0) {
      const dim = ANSI.fg(muted);
      detailBox.setContent(
        `\n\n\n  ${dim}no entries yet\n\n  press n to create your first entry${ANSI.reset}`
      );
    } else if (twoPane && entries.length > 0) {
      const e = entries[selectedIdx];
      if (e) {
        const previewW = w - Math.floor(w * 0.32) - 6;
        const ruleW = Math.max(10, previewW - 2);
        const dim = ANSI.fg(muted);
        const hi = ANSI.fg(accent);
        const icon = KIND_ICON[e.kind] || "░";
        const bodyLines = renderBody(e.body || "(empty)", previewW);
        const header = [
          "",
          `  ${ANSI.bold}${icon} ${e.title}${ANSI.reset}`,
          `  ${dim}${PEER_GLYPH[e.peer]} ${e.peer} · ${e.kind} · ${timeAgo(e.createdAt)}${ANSI.reset}`,
          e.tags.length ? `  ${hi}${e.tags.map(t => `#${t}`).join(" ")}${ANSI.reset}` : null,
          `  ${dim}${"─".repeat(ruleW)}${ANSI.reset}`,
          "",
          ...bodyLines,
        ].filter((l): l is string => l !== null);
        detailBox.setContent(header.join("\n"));
        (detailBox as any).scrollTo(0);
      }
    }

    // Status + command bars
    const searchHint = searchQuery ? `  SEARCH:"${searchQuery}"` : "";
    const hCount = entries.filter(e => e.peer === "human").length;
    const aCount = entries.filter(e => e.peer === "agent").length;
    const kindCounts = entries.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {} as Record<string, number>);
    const kindStr = Object.entries(kindCounts).map(([k, v]) => `${KIND_ICON[k as EntryKind] || "░"}${v}`).join(" ");
    statusBar.setContent(
      `{${muted}-fg} [LIST]  ${entries.length} entries  ${SORT_LABEL[sortBy]}  ${kindStr}  ▸${hCount} ▹${aCount}${searchHint}{/${muted}-fg}`
    );

    if (deleteConfirm) {
      commandBar.setContent(` {red-fg}Delete "${entries[selectedIdx]?.title}"? y/n{/red-fg}`);
    } else {
      const pos = entries.length > 0 ? `${selectedIdx + 1}/${entries.length}` : "—";
      commandBar.setContent(
        `{${muted}-fg} ${pos}  Enter open  n new  e edit  d del  / search  s sort  g/G jump{/${muted}-fg}`
      );
    }
  }

  function renderReadMode(th: any, muted: string, accent: string, w: number) {
    listBox.hide();
    detailBox.show();
    editArea.hide();
    titleInput.hide();
    titleLabelBox.hide();
    kindLabel.hide();
    detailBox.left = 0;
    detailBox.width = "100%" as any;

    if (!selectedEntry) { setMode("list"); return; }
    const e = selectedEntry;
    const bodyW = Math.max(20, w - 8);
    const ruleW = Math.max(10, bodyW);
    const icon = KIND_ICON[e.kind] || "░";
    const dim = ANSI.fg(muted);
    const hi = ANSI.fg(accent);
    const bodyLines = renderBody(e.body || "(empty)", bodyW);

    const content = [
      "",
      `  ${ANSI.bold}${icon} ${e.title}${ANSI.reset}`,
      "",
      `  ${dim}${PEER_GLYPH[e.peer]} ${e.peer} · ${e.kind} · created ${timeAgo(e.createdAt)} · updated ${timeAgo(e.updatedAt)}${ANSI.reset}`,
      e.tags.length ? `  ${hi}${e.tags.map(t => `#${t}`).join(" ")}${ANSI.reset}` : null,
      `  ${dim}${"─".repeat(ruleW)}${ANSI.reset}`,
      "",
      ...bodyLines,
    ].filter((l): l is string => l !== null);

    detailBox.setContent(content.join("\n"));
    (detailBox as any).scrollTo(0);

    statusBar.setContent(`{${muted}-fg} [READ]  ${e.title}{/${muted}-fg}`);
    commandBar.setContent(`{${muted}-fg} Esc/q back  e edit  d delete{/${muted}-fg}`);
  }

  function renderEditMode(th: any, muted: string, accent: string, w: number) {
    listBox.hide();
    detailBox.hide();
    paneSep.hide();
    titleLabelBox.show();
    titleLabelBox.setContent(`{${muted}-fg}Title:{/${muted}-fg}`);
    titleInput.show();
    kindLabel.show();
    editArea.show();

    titleInput.left = 10;
    titleInput.right = 2;
    titleInput.top = 0;
    kindLabel.left = 2;
    kindLabel.right = 2;
    kindLabel.top = 2;
    editArea.left = 2;
    editArea.right = 2;
    editArea.top = 4;

    const ruleW = Math.max(10, w - 8);
    kindLabel.setContent(
      `{${muted}-fg}${"─".repeat(ruleW)}\n` +
      `Kind: ${editKind}  │  Tags: ${editTags.length ? editTags.map(t => `#${t}`).join(" ") : "(none)"}  │  Tab: title↔body{/${muted}-fg}`
    );
    kindLabel.height = 2;

    const modeLabel = editingId ? "EDIT" : "NEW";
    statusBar.setContent(`{${muted}-fg} [${modeLabel}]  ${editTitle || "untitled"}{/${muted}-fg}`);
    commandBar.setContent(`{${muted}-fg} Ctrl-S save  Esc cancel  Tab switch title↔body{/${muted}-fg}`);
  }

  // ── Mode transitions ─────────────────────────────────────────
  function setMode(newMode: Mode) {
    mode = newMode;
    deleteConfirm = false;
    render();
  }

  function openEntry(idx: number) {
    if (idx < 0 || idx >= entries.length) return;
    selectedEntry = entries[idx];
    setMode("read");
    win.setFocusTarget(detailBox);
    detailBox.focus();
  }

  function startEdit(entry?: JournalEntry) {
    if (entry) {
      editingId = entry.id;
      editTitle = entry.title;
      editBody = entry.body;
      editKind = entry.kind;
      editTags = [...entry.tags];
    } else {
      editingId = null;
      editTitle = "";
      editBody = "";
      editKind = "note";
      editTags = [];
    }
    setMode("edit");
    // Set values and start editing title first
    titleInput.setValue(editTitle);
    editArea.setValue(editBody);
    titleInput.readInput();
  }

  function saveEdit() {
    editTitle = titleInput.getValue().trim() || "Untitled";
    editBody = editArea.getValue();
    const now = new Date().toISOString();

    if (editingId) {
      // Update existing
      const entry = loadEntry(host, editingId);
      if (entry) {
        entry.title = editTitle;
        entry.body = editBody;
        entry.kind = editKind;
        entry.tags = editTags;
        entry.updatedAt = now;
        saveEntry(host, entry);
      }
    } else {
      // Create new
      const entry: JournalEntry = {
        id: genId(),
        title: editTitle,
        body: editBody,
        peer: "human",
        kind: editKind,
        tags: editTags,
        createdAt: now,
        updatedAt: now,
      };
      saveEntry(host, entry);
    }
    refresh();
    setMode("list");
    listBox.focus();
  }

  function doDelete() {
    if (mode === "list" && entries[selectedIdx]) {
      deleteEntryFile(host, entries[selectedIdx].id);
      refresh();
      render();
    } else if (mode === "read" && selectedEntry) {
      deleteEntryFile(host, selectedEntry.id);
      refresh();
      setMode("list");
    }
    deleteConfirm = false;
    listBox.focus();
  }

  // ── Key bindings: LIST mode ───────────────────────────────────
  let rendering = false;
  listBox.on("select item", (_item: any, idx: number) => {
    if (rendering) return; // avoid recursion from setItems
    if (viewMode === "sessions") {
      sessionIdx = idx;
      sessionMessages = [];
    } else {
      // Use index map to skip headers
      const map = (listBox as any)._entryIndexMap as number[] | undefined;
      if (map && map[idx] !== undefined) {
        if (map[idx] === -1) return; // header row — ignore
        selectedIdx = map[idx]!;
      } else {
        selectedIdx = idx;
      }
    }
    render();
  });

  // Mouse click to select list item
  listBox.on("click", () => {
    if (mode === "list") {
      const idx = (listBox as any).selected ?? 0;
      const map = (listBox as any)._entryIndexMap as number[] | undefined;
      if (map && map[idx] !== undefined && map[idx] !== -1) {
        selectedIdx = map[idx]!;
      }
      render();
    }
  });

  // Double-click to open (simulated via rapid click)
  let lastClickTime = 0;
  listBox.on("click", () => {
    const now = Date.now();
    if (now - lastClickTime < 400 && mode === "list") {
      openEntry(selectedIdx);
    }
    lastClickTime = now;
  });

  listBox.key(["j", "down"], () => {
    if (mode !== "list") return;
    if (viewMode === "sessions") {
      sessionIdx = Math.min(sessionIdx + 1, sessions.length - 1);
      sessionMessages = [];
    } else {
      selectedIdx = Math.min(selectedIdx + 1, entries.length - 1);
    }
    render();
  });

  listBox.key(["k", "up"], () => {
    if (mode !== "list") return;
    if (viewMode === "sessions") {
      sessionIdx = Math.max(sessionIdx - 1, 0);
      sessionMessages = [];
    } else {
      selectedIdx = Math.max(selectedIdx - 1, 0);
    }
    render();
  });

  listBox.key(["g", "home"], () => {
    if (mode !== "list") return;
    if (viewMode === "sessions") { sessionIdx = 0; sessionMessages = []; }
    else { selectedIdx = 0; }
    render();
  });

  listBox.key(["S-g", "end"], () => {
    if (mode !== "list") return;
    if (viewMode === "sessions") { sessionIdx = Math.max(0, sessions.length - 1); sessionMessages = []; }
    else { selectedIdx = Math.max(0, entries.length - 1); }
    render();
  });

  listBox.key(["s"], () => {
    if (mode !== "list") return;
    if (viewMode === "sessions") return; // s only sorts in journal mode
    const idx = SORT_CYCLE.indexOf(sortBy);
    sortBy = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]!;
    refresh();
    render();
  });

  listBox.key(["S-s"], () => {
    if (mode !== "list") return;
    if (!PI_EXISTS) return;
    if (viewMode === "journal") {
      viewMode = "sessions";
      sessions = listSessions();
      sessionIdx = 0;
      sessionMessages = [];
    } else {
      viewMode = "journal";
    }
    refresh();
    render();
  });

  listBox.key(["enter"], () => {
    if (mode !== "list") return;
    if (deleteConfirm) return;
    if (viewMode === "sessions") {
      // In session mode, Enter opens the session in read mode (full conversation)
      const s = sessions[sessionIdx];
      if (s) {
        sessionMessages = readSession(s.filename);
        setMode("read");
        // Render session detail in read mode
        const w = (contentBox as any).width || 160;
        const muted = host.theme().muted?.fg || "#555";
        const accent = host.theme().selected?.fg || "#b48ead";
        const dim = ANSI.fg(muted);
        const hi = ANSI.fg(accent);
        const bodyW = Math.max(20, w - 8);

        const lines: string[] = [
          "",
          `  ${ANSI.bold}Session ${s.sessionId}${ANSI.reset}`,
          `  ${dim}${s.date ? new Date(s.date).toLocaleString() : "?"} · ${s.messageCount} messages${ANSI.reset}`,
          `  ${dim}${"─".repeat(Math.max(10, bodyW - 4))}${ANSI.reset}`,
          "",
        ];

        for (const msg of sessionMessages) {
          const roleColor = msg.role === "user" ? hi : dim;
          const roleLabel = msg.role === "user" ? "▸ human" : msg.role === "assistant" ? "▹ agent" : `· ${msg.role}`;
          if (msg.text) {
            lines.push(`  ${roleColor}${roleLabel}${ANSI.reset}`);
            const wrapped = renderMarkdown(msg.text.slice(0, 2000), bodyW - 4, {
              headingConfig: PLAIN_HEADING_CONFIG,
              paddingX: 4,
            });
            lines.push(...wrapped);
            lines.push("");
          }
          if (msg.toolCalls.length > 0) {
            lines.push(`  ${dim}  🔧 ${msg.toolCalls.join(", ")}${ANSI.reset}`);
          }
        }

        detailBox.setContent(lines.join("\n"));
        (detailBox as any).scrollTo(0);
        statusBar.setContent(`{${muted}-fg} [SESSION]  ${s.sessionId} · ${s.messageCount} msgs{/${muted}-fg}`);
        commandBar.setContent(`{${muted}-fg} Esc/q back  j/k scroll{/${muted}-fg}`);
      }
      return;
    }
    openEntry(selectedIdx);
  });

  listBox.key(["n"], () => {
    if (mode !== "list") return;
    if (deleteConfirm) { deleteConfirm = false; render(); return; }
    startEdit();
  });

  listBox.key(["e"], () => {
    if (mode !== "list") return;
    if (deleteConfirm) { deleteConfirm = false; render(); return; }
    if (entries[selectedIdx]) startEdit(entries[selectedIdx]);
  });

  listBox.key(["d"], () => {
    if (mode !== "list") return;
    if (deleteConfirm) {
      deleteConfirm = false;
      render();
      return;
    }
    if (entries[selectedIdx]) {
      deleteConfirm = true;
      render();
    }
  });

  listBox.key(["y"], () => {
    if (deleteConfirm) doDelete();
  });

  listBox.key(["/"], () => {
    if (mode !== "list") return;
    // Simple inline search — prompt via command bar
    commandBar.setContent(" Search: ");
    const searchInput = blessed.textbox({
      parent: win.body,
      bottom: 0, left: 9, right: 0, height: 1,
      inputOnFocus: true,
      style: { fg: t().body.fg, bg: t().selected?.bg || "#333" },
    } as any);
    searchInput.focus();
    searchInput.readInput();
    searchInput.on("submit", (val: string) => {
      searchQuery = (val || "").trim();
      searchInput.destroy();
      refresh();
      render();
      listBox.focus();
    });
    searchInput.key(["escape"], () => {
      searchInput.destroy();
      render();
      listBox.focus();
    });
  });

  listBox.key(["escape"], () => {
    if (deleteConfirm) { deleteConfirm = false; render(); return; }
    if (searchQuery) { searchQuery = ""; refresh(); render(); return; }
  });

  // ── Key bindings: READ mode ───────────────────────────────────
  detailBox.key(["escape", "q"], () => {
    if (mode !== "read") return;
    setMode("list");
    win.setFocusTarget(listBox);
    listBox.focus();
  });

  detailBox.key(["e"], () => {
    if (mode !== "read" || !selectedEntry) return;
    startEdit(selectedEntry);
  });

  detailBox.key(["d"], () => {
    if (mode !== "read") return;
    deleteConfirm = true;
    render();
  });

  detailBox.key(["y"], () => {
    if (mode === "read" && deleteConfirm) doDelete();
  });

  detailBox.key(["n"], () => {
    if (mode === "read" && deleteConfirm) { deleteConfirm = false; render(); return; }
  });

  detailBox.key(["j", "down"], () => { detailBox.scroll(1); host.screen.render(); });
  detailBox.key(["k", "up"], () => { detailBox.scroll(-1); host.screen.render(); });

  // ── Key bindings: EDIT mode ───────────────────────────────────
  titleInput.on("submit", () => {
    editTitle = titleInput.getValue();
    editArea.focus();
    editArea.readInput();
  });

  titleInput.key(["tab"], () => {
    editTitle = titleInput.getValue();
    editArea.focus();
    editArea.readInput();
  });

  titleInput.key(["escape"], () => {
    setMode(editingId ? "read" : "list");
    if (mode === "list") listBox.focus();
    else detailBox.focus();
  });

  editArea.key(["C-s"], () => {
    saveEdit();
  });

  editArea.key(["tab"], () => {
    editBody = editArea.getValue();
    titleInput.focus();
    titleInput.readInput();
  });

  editArea.key(["escape"], () => {
    setMode(editingId ? "read" : "list");
    if (mode === "list") listBox.focus();
    else detailBox.focus();
  });

  // ── Lifecycle ─────────────────────────────────────────────────
  win.describeState(() => {
    const all = loadAllEntries(host);
    const peerBreakdown: Record<string, number> = {};
    const kindBreakdown: Record<string, number> = {};
    for (const e of all) {
      peerBreakdown[e.peer] = (peerBreakdown[e.peer] || 0) + 1;
      kindBreakdown[e.kind] = (kindBreakdown[e.kind] || 0) + 1;
    }
    const allTags = [...new Set(all.flatMap(e => e.tags))];
    return {
      summary: `Journal — ${all.length} entries, mode: ${mode}, view: journal`,
      mode,
      viewMode: "journal" as const,
      sortBy,
      entryCount: all.length,
      selectedId: selectedEntry?.id ?? entries[selectedIdx]?.id ?? null,
      selectedTitle: selectedEntry?.title ?? entries[selectedIdx]?.title ?? null,
      searchQuery: searchQuery || null,
      peerBreakdown,
      kindBreakdown,
      tags: allTags,
      recentEntries: all.slice(0, 5).map(e => ({
        id: e.id, title: e.title, peer: e.peer, kind: e.kind,
        tags: e.tags, updatedAt: e.updatedAt,
        preview: e.body.slice(0, 120),
      })),
      // When reading an entry, include its full content for agent visibility
      currentEntry: (mode === "read" && selectedEntry) ? {
        id: selectedEntry.id, title: selectedEntry.title,
        body: selectedEntry.body, peer: selectedEntry.peer,
        kind: selectedEntry.kind, tags: selectedEntry.tags,
      } : null,
      availableCommands: [
        "journal.open", "journal.create", "journal.read",
        "journal.update", "journal.list", "journal.delete",
        "journal.export-markdown", "journal.import-legacy",
      ],
    };
  });

  win.onRestyle(() => {
    const th = t();
    headerBox.style = th.body;
    sepBox.style = th.body;
    contentBox.style = th.body;
    listBox.style = { ...th.body, selected: { bg: th.selected?.bg || "#333", fg: th.selected?.fg || "#fff" } };
    detailBox.style = th.body;
    statusBar.style = { fg: th.muted?.fg || "#666", bg: th.body.bg };
    commandBar.style = { fg: th.body.fg, bg: th.selected?.bg || "#333" };
    render();
  });

  win.onResize(() => render());

  _liveRefresh = () => { refresh(); render(); };
  win.onCleanup(() => { _liveRefresh = null; });

  // ── Init ──────────────────────────────────────────────────────
  refresh();
  render();
  win.setFocusTarget(listBox);
  listBox.focus();
  win.focus();
}
