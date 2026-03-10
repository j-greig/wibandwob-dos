import { theme } from "../core/theme/resolver.js";
import type { ChatMessageEntry, ToolRun } from "../core/types.js";

function escapeTagBraces(text: string): string {
  // Escape { and } that aren't blessed tags so they don't break rendering
  return text.replace(/\{(?!\/?(?:bold|underline|blink|inverse|invisible|[a-z]+-(?:fg|bg))(?:\}|-))/g, "\\{");
}

// Resolve agent palette from the active theme tokens at call time.
// Never cache these — theme() is cheap and we want live theme switching.
export function C() {
  const t = theme();
  return {
    pink: t.highlight.fg, // user labels, warm accent
    blue: t.accent.fg, // tool titles, borders
    lime: t.success.fg, // checkmarks, status lines
    muted: t.muted.fg, // dim tool arg text
    gray: t.body.fg, // main assistant text
    altBg: t.bodyAlt.bg, // tinted bg for non-human (session) messages
    altFg: t.bodyAlt.fg, // text on tinted bg
  };
}

// Kaomoji voice markers — replaces "Wib:" and "Wob:" in rendered text.
// Only used for non-haiku models (haiku struggles with kaomoji in output).
const WIB_FACE = "༼つ◕‿◕‿⚆༽つ";
const WOB_FACE = "༼つ⚆‿◕‿◕༽つ";

function applyVoiceMarkers(text: string, useKaomoji: boolean): string {
  if (!useKaomoji) return text;
  return text.replace(/^Wib:/gm, WIB_FACE).replace(/^Wob:/gm, WOB_FACE);
}

export function renderMessage(msg: ChatMessageEntry, useKaomoji: boolean): string {
  const c = C();
  if (msg.role === "user") {
    const label = msg.sender ?? "Human";
    // Strip <sender_info>...</sender_info> routing metadata from display
    const displayText = msg.text.replace(/<sender_info>[\s\S]*?<\/sender_info>\s*/g, "").trimEnd();
    const isSession = !!msg.sender && msg.sender !== "Human";
    if (isSession) {
      // Non-human messages get a tinted background to visually distinguish session-to-session comms
      return `{${c.altBg}-bg}{${c.pink}-fg}${label}:{/${c.pink}-fg} {${c.altFg}-fg}${escapeTagBraces(displayText)}{/${c.altFg}-fg}{/${c.altBg}-bg}`;
    }
    return `{${c.pink}-fg}${label}:{/${c.pink}-fg} {${c.gray}-fg}${escapeTagBraces(displayText)}{/${c.gray}-fg}`;
  }
  if (msg.role === "status") {
    const escaped = escapeTagBraces(msg.text);
    if (escaped.startsWith("[status]")) {
      return "";
    }
    if (escaped.startsWith("[tool]")) {
      const trimmed = escaped.replace(/^\s*\[tool\]\s*/, "");
      return `  {${c.blue}-fg}▸{/${c.blue}-fg} {${c.muted}-fg}${trimmed}{/${c.muted}-fg}`;
    }
    if (escaped.startsWith("[done]")) {
      let trimmed = escaped.replace(/^\s*\[done\]\s*/, "");
      // Shorten verbose tui_run_command tool results to single readable line
      // "run_command microapp.wibwob.foo.bar → tui_run_command → {json}" → "bar → ok"
      trimmed = trimmed.replace(/run_command\s+microapp\.wibwob\.\w+\.(\S+)\s*→\s*tui_run_command\s*→\s*/, "$1 → ");
      // Strip redundant ok wrappers from result
      trimmed = trimmed.replace(/\\?\{"ok":true,"result":\\?\{(.+?)\\?\}\s*\\?\}/, "{$1}");
      trimmed = trimmed.replace(/\\?\{"ok":true\}/, "ok");
      return `  {${c.lime}-fg}✓{/${c.lime}-fg} {${c.muted}-fg}${trimmed}{/${c.muted}-fg}`;
    }
    if (escaped.startsWith("[fail]")) {
      const trimmed = escaped.replace(/^\s*\[fail\]\s*/, "");
      return `  {${c.pink}-fg}✗ ${trimmed}{/${c.pink}-fg}`;
    }
    return `  {${c.lime}-fg}${escaped}{/${c.lime}-fg}`;
  }
  // Assistant text — Wib/Wob voices with kaomoji faces
  const text = msg.text || (msg.streaming ? "Wib: …\nWob: …" : "");
  return escapeTagBraces(applyVoiceMarkers(text, useKaomoji));
}

// ── Tool run rendering for collapsible blocks ─────────────────────────────────

function shortenToolResult(result: string): string {
  let s = result;
  // Shorten verbose tui_run_command tool results
  s = s.replace(/run_command\s+microapp\.wibwob\.\w+\.(\S+)\s*→\s*tui_run_command\s*→\s*/, "$1 → ");
  s = s.replace(/\\?\{"ok":true,"result":\\?\{(.+?)\\?\}\s*\\?\}/, "{$1}");
  s = s.replace(/\\?\{"ok":true\}/, "ok");
  if (s.length > 60) s = s.slice(0, 57) + "...";
  return s;
}

/** Render a ToolRun as summary + detail strings for a CollapsibleBlock. */
export function renderToolRun(run: ToolRun): { summary: string; detail: string; badge?: string } {
  const c = C();
  const total = run.tools.length;
  const done = run.tools.filter((t) => t.done).length;
  const errors = run.errorCount;

  // Summary line
  let summary: string;
  if (run.active) {
    const current = run.tools[run.tools.length - 1];
    summary = `  {${c.blue}-fg}⟳{/${c.blue}-fg} {${c.muted}-fg}${current?.name ?? "running"}… (${done}/${total}){/${c.muted}-fg}`;
  } else {
    const icon = errors > 0
      ? `{${c.pink}-fg}✗{/${c.pink}-fg}`
      : `{${c.lime}-fg}✓{/${c.lime}-fg}`;
    summary = `  ${icon} {${c.muted}-fg}${total} tool${total !== 1 ? "s" : ""} ran{/${c.muted}-fg}`;
  }

  // Badge for errors (always visible even when collapsed)
  const badge = errors > 0
    ? `{${c.pink}-fg}${errors} failed{/${c.pink}-fg}`
    : undefined;

  // Detail lines — one per tool
  const detailLines: string[] = [];
  for (const tool of run.tools) {
    if (!tool.done) {
      detailLines.push(`  {${c.blue}-fg}▸{/${c.blue}-fg} {${c.muted}-fg}${tool.args}{/${c.muted}-fg}`);
    } else if (tool.isError) {
      detailLines.push(`  {${c.pink}-fg}✗ ${escapeTagBraces(tool.name)}${tool.result ? ` — ${escapeTagBraces(tool.result)}` : ""}{/${c.pink}-fg}`);
    } else {
      const result = tool.result ? shortenToolResult(tool.result) : "";
      detailLines.push(`  {${c.lime}-fg}✓{/${c.lime}-fg} {${c.muted}-fg}${escapeTagBraces(tool.name)}${result ? ` → ${escapeTagBraces(result)}` : ""}{/${c.muted}-fg}`);
    }
  }

  return { summary, detail: detailLines.join("\n"), badge };
}

// ── Transcript block model ────────────────────────────────────────────────────

export type TranscriptBlock =
  | { type: "text"; key: string; content: string }
  | { type: "tool-run"; key: string; run: ToolRun; summary: string; detail: string; badge?: string };

/**
 * Build an ordered list of transcript blocks from messages + toolRuns.
 * Text messages become "text" blocks, tool status runs become "tool-run" blocks.
 * Adjacent status messages that belong to a ToolRun are absorbed into that run's block.
 */
export function buildTranscriptBlocks(
  messages: ChatMessageEntry[],
  toolRuns: ToolRun[],
  useKaomoji: boolean,
): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];

  // Build a set of message indices that are tool status lines, mapped to their ToolRun
  // We detect tool status runs by looking at consecutive status messages with [tool]/[done]/[fail] prefixes
  // and correlate with toolRuns by order.
  let toolRunIndex = 0;
  let i = 0;

  while (i < messages.length) {
    const m = messages[i];

    // Skip hidden status messages
    if (m.role === "status" && m.text.startsWith("[status]")) {
      i++;
      continue;
    }

    // Detect a run of tool status messages
    if (m.role === "status" && (m.text.startsWith("[tool]") || m.text.startsWith("[done]") || m.text.startsWith("[fail]"))) {
      // Consume all consecutive tool status messages
      const runStart = i;
      while (
        i < messages.length &&
        messages[i].role === "status" &&
        (messages[i].text.startsWith("[tool]") || messages[i].text.startsWith("[done]") || messages[i].text.startsWith("[fail]"))
      ) {
        i++;
      }

      // Match to a ToolRun if available
      const run = toolRuns[toolRunIndex];
      if (run) {
        const { summary, detail, badge } = renderToolRun(run);
        blocks.push({ type: "tool-run", key: `toolrun-${run.id}`, run, summary, detail, badge });
        toolRunIndex++;
      } else {
        // Fallback: render as plain text (legacy or unmatched tool lines)
        const fallbackLines: string[] = [];
        for (let j = runStart; j < i; j++) {
          const rendered = renderMessage(messages[j], useKaomoji);
          if (rendered) fallbackLines.push(rendered);
        }
        if (fallbackLines.length > 0) {
          blocks.push({ type: "text", key: `tool-fallback-${runStart}`, content: fallbackLines.join("\n") });
        }
      }
      continue;
    }

    // Non-tool status messages (compact, retry, etc.)
    if (m.role === "status") {
      const rendered = renderMessage(m, useKaomoji);
      if (rendered) {
        blocks.push({ type: "text", key: `status-${m.id}`, content: rendered });
      }
      i++;
      continue;
    }

    // User or assistant messages
    const rendered = renderMessage(m, useKaomoji);
    if (rendered) {
      blocks.push({ type: "text", key: `msg-${m.id}`, content: rendered });
    }
    i++;
  }

  return blocks;
}

// ── Legacy flat transcript (kept for backward compat / fallback) ──────────────

export function renderTranscript(messages: ChatMessageEntry[], useKaomoji: boolean): string {
  const visibleMessages = messages.filter((m) => !(m.role === "status" && m.text.startsWith("[status]")));
  if (visibleMessages.length === 0) return "";

  const lines: string[] = [];
  for (let i = 0; i < visibleMessages.length; i++) {
    const msg = visibleMessages[i];
    const prev = visibleMessages[i - 1];
    const rendered = renderMessage(msg, useKaomoji);
    if (!rendered) continue;
    // Blank line before user/assistant turns, not between tool status lines
    if (i > 0 && (msg.role !== "status" || prev?.role !== "status")) {
      lines.push("");
    }
    lines.push(rendered);
  }
  return lines.join("\n");
}
