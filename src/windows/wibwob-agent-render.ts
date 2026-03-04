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
      const trimmed = escaped.replace(/^\s*\[done\]\s*/, "");
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

  // Collapse [tool] + [done/fail] pairs into one line: ▸ toolname → result
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
      const resultPart = next.text.replace(/^\[done\]\s*/, "").replace(/^\[fail\]\s*/, "");
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

  // Single blank line between user/assistant turns, no gap between tool lines
  const lines: string[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const m = collapsed[i];
    const prev = collapsed[i - 1];
    const rendered = renderMessage(m, useKaomoji);
    if (!rendered) continue;
    // Add blank line before user/assistant turns (not between consecutive tool calls)
    if (i > 0 && (m.role !== "status" || prev?.role !== "status")) {
      lines.push("");
    }
    lines.push(rendered);
  }
  return lines.join("\n");
}
