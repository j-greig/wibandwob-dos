import { theme } from "../core/theme/resolver.js";
import type { ChatMessageEntry } from "../core/types.js";

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

export function renderTranscript(messages: ChatMessageEntry[], useKaomoji: boolean): string {
  const visibleMessages = messages.filter((m) => !(m.role === "status" && m.text.startsWith("[status]")));
  if (visibleMessages.length === 0) return "";

  // Collapse [tool] + [done/fail] pairs into one line: ✓ toolname → short result
  const collapsed: ChatMessageEntry[] = [];
  for (let i = 0; i < visibleMessages.length; i++) {
    const m = visibleMessages[i];
    const next = visibleMessages[i + 1];
    if (
      m.role === "status" &&
      m.text.startsWith("[tool]") &&
      next?.role === "status" &&
      (next.text.startsWith("[done]") || next.text.startsWith("[fail]"))
    ) {
      // Merge: strip [tool] prefix, append result from next
      const toolPart = m.text.replace(/^\[tool\]\s*/, "");
      let resultPart = next.text.replace(/^\[done\]\s*/, "").replace(/^\[fail\]\s*/, "");
      // Truncate verbose JSON results — keep first 60 chars max
      if (resultPart.length > 60) resultPart = resultPart.slice(0, 57) + "...";
      const isError = next.text.startsWith("[fail]");
      collapsed.push({
        ...m,
        text: isError ? `[fail] ${toolPart}` : `[done] ${toolPart}${resultPart ? ` → ${resultPart}` : ""}`,
      });
      i++; // skip [done]/[fail] entry
    } else {
      collapsed.push(m);
    }
  }

  // ── Collapse runs of consecutive [done] tool lines ──────────────────────
  // When many tool calls stack up between text messages, show first 2,
  // a summary "... N more commands", and the last 1.  [fail] lines always shown.
  const MAX_VISIBLE_TOOLS = 3; // first 2 + last 1

  const folded: Array<ChatMessageEntry | { role: "tool-summary"; text: string }> = [];
  let i = 0;
  while (i < collapsed.length) {
    const m = collapsed[i];
    // Detect a run of [done] status lines
    if (m.role === "status" && m.text.startsWith("[done]")) {
      const runStart = i;
      const run: ChatMessageEntry[] = [];
      const fails: ChatMessageEntry[] = [];
      while (i < collapsed.length && collapsed[i].role === "status") {
        const s = collapsed[i];
        if (s.text.startsWith("[done]")) {
          run.push(s);
        } else if (s.text.startsWith("[fail]")) {
          fails.push(s);
        } else {
          break; // some other status line — stop the run
        }
        i++;
      }
      if (run.length <= MAX_VISIBLE_TOOLS) {
        // Short run — show all
        for (const r of run) folded.push(r);
      } else {
        // Long run — first 2, summary, last 1
        folded.push(run[0]);
        folded.push(run[1]);
        const hidden = run.length - 3;
        // Gather unique short command names from the hidden middle
        const names = run.slice(2, -1).map((r) => {
          const match = r.text.match(/^\[done\]\s*(\S+)/);
          return match ? match[1].replace(/run_command\s+/, "") : "?";
        });
        const uniqueNames = Array.from(new Set(names));
        const nameStr = uniqueNames.length <= 3
          ? uniqueNames.join(", ")
          : uniqueNames.slice(0, 3).join(", ") + " …";
        folded.push({ role: "tool-summary", text: `… ${hidden} more (${nameStr})` });
        folded.push(run[run.length - 1]);
      }
      // Always show all fails
      for (const f of fails) folded.push(f);
      continue;
    }
    folded.push(m);
    i++;
  }

  // Single blank line between user/assistant turns, no gap between tool lines
  const lines: string[] = [];
  for (let i = 0; i < folded.length; i++) {
    const m = folded[i];
    const prev = folded[i - 1];

    if ((m as any).role === "tool-summary") {
      const c = C();
      lines.push(`  {${c.muted}-fg}${(m as any).text}{/${c.muted}-fg}`);
      continue;
    }

    const msg = m as ChatMessageEntry;
    const rendered = renderMessage(msg, useKaomoji);
    if (!rendered) continue;
    // Add blank line before user/assistant turns (not between consecutive tool/status lines)
    const prevRole = prev && "role" in prev ? (prev as any).role : undefined;
    if (i > 0 && (msg.role !== "status" || (prevRole !== "status" && prevRole !== "tool-summary"))) {
      lines.push("");
    }
    lines.push(rendered);
  }
  return lines.join("\n");
}
