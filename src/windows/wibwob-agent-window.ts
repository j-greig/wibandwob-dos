/**
 * Wib&Wob Agent window — chat with TUI superpowers.
 *
 * Same look as the regular chat window but backed by WibWobAgentSession
 * which has desktop tools (open/close/move windows, send input, read
 * terminal buffers, etc). Desktop state is injected every turn.
 */

import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { theme } from "../core/theme-resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import type { Box, ChatMessageEntry } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WibWobAgentSession } from "../services/wibwob-agent-session.js";

function escapeTagBraces(text: string): string {
  // Escape { and } that aren't blessed tags so they don't break rendering
  return text.replace(/\{(?!\/?(?:bold|underline|blink|inverse|invisible|[a-z]+-(?:fg|bg))(?:\}|-))/g, "\\{");
}

// wibwob-tv theme palette
const C = {
  pink:  "#f07f8f",  // accent, user
  blue:  "#57c7ff",  // tool title, borders
  lime:  "#b7ff3c",  // success, status
  muted: "#666666",  // dim text, tool args
  gray:  "#d0d0d0",  // main text
} as const;

// Kaomoji voice markers — replaces "Wib:" and "Wob:" in rendered text.
// Only used for non-haiku models (haiku struggles with kaomoji in output).
const WIB_FACE = "༼つ◕‿◕‿⚆༽つ";
const WOB_FACE = "༼つ⚆‿◕‿◕༽つ";

function applyVoiceMarkers(text: string, useKaomoji: boolean): string {
  if (!useKaomoji) return text;
  return text
    .replace(/^Wib:/gm, WIB_FACE)
    .replace(/^Wob:/gm, WOB_FACE);
}

function renderMessage(msg: ChatMessageEntry, useKaomoji: boolean): string {
  if (msg.role === "user") {
    return `{${C.pink}-fg}You:{/${C.pink}-fg} {${C.gray}-fg}${escapeTagBraces(msg.text)}{/${C.gray}-fg}`;
  }
  if (msg.role === "status") {
    const escaped = escapeTagBraces(msg.text);
    if (escaped.includes("[tool]")) {
      const trimmed = escaped.replace(/^\s*\[tool\]\s*/, "");
      return `  {${C.blue}-fg}▸{/${C.blue}-fg} {${C.muted}-fg}${trimmed}{/${C.muted}-fg}`;
    }
    if (escaped.includes("[done]")) {
      const trimmed = escaped.replace(/^\s*\[done\]\s*/, "");
      return `  {${C.lime}-fg}✓{/${C.lime}-fg} {${C.muted}-fg}${trimmed}{/${C.muted}-fg}`;
    }
    if (escaped.includes("[fail]")) {
      const trimmed = escaped.replace(/^\s*\[fail\]\s*/, "");
      return `  {${C.pink}-fg}✗ ${trimmed}{/${C.pink}-fg}`;
    }
    return `  {${C.lime}-fg}${escaped}{/${C.lime}-fg}`;
  }
  // Assistant text — Wib/Wob voices with kaomoji faces
  const text = msg.text || (msg.streaming ? "Wib: …\nWob: …" : "");
  return escapeTagBraces(applyVoiceMarkers(text, useKaomoji));
}

function renderTranscript(messages: ChatMessageEntry[], useKaomoji: boolean): string {
  if (messages.length === 0) return "[status] Starting…";
  return messages.map((m) => renderMessage(m, useKaomoji)).join("\n\n");
}

/** Find the most recent Claude Code JSONL for the current project cwd. */
function findClaudeCodeJsonl(cwd: string): string | null {
  try {
    const safePath = cwd.replace(/\//g, "-");
    const projectDir = path.join(os.homedir(), ".claude", "projects", safePath);
    if (!fs.existsSync(projectDir)) return null;
    const files = fs.readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!files.length) return null;
    return path.join(projectDir, files[0].f);
  } catch {
    return null;
  }
}

export function openWibWobAgentWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  agent: WibWobAgentSession;
  title?: string;
  initialPos?: { top: number; left: number; width: number; height: number };
}): void {
  const frame = params.windowManager.createFrame(params.title ?? "Wib&Wob Agent", "chat");

  // Restore position/size if reloading
  if (params.initialPos) {
    const { top, left, width, height } = params.initialPos;
    frame.frame.top = top;
    frame.frame.left = left;
    frame.frame.width = width;
    frame.frame.height = height;
  }

  // Top info bar — model + session ID on the right, Claude Code log link on the left
  const infoBar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    mouse: true,
    style: theme().muted,
  });

  const transcript = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    bottom: 2,
    tags: true,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body,
  });

  const statusLine = blessed.box({
    parent: frame.body,
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    style: theme().warning,
  });

  const input = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    style: theme().input,
  });

  let draft = "";
  const MAX_INPUT_ROWS = 6;

  const renderInput = () => {
    const width = Math.max(1, Number(input.width) || 1);
    const cursor = input === params.screen.focused ? "_" : " ";
    const full = draft + cursor;

    // Word-wrap the draft into rows of (width) chars
    const rows: string[] = [];
    for (let i = 0; i < full.length || rows.length === 0; i += width) {
      rows.push(full.slice(i, i + width).padEnd(width, " "));
    }

    const inputRows = Math.min(MAX_INPUT_ROWS, Math.max(1, rows.length));

    // Resize input and push transcript bottom up to match
    input.height = inputRows;
    input.bottom = 0;
    statusLine.bottom = inputRows;
    transcript.bottom = inputRows + 1;

    input.setContent(rows.join("\n"));
  };

  const armInput = () => {
    input.focus();
    renderInput();
    params.screen.render();
  };

  // Info bar — rendered once and updated when model info changes
  const cwd = process.cwd();
  const claudeJsonl = findClaudeCodeJsonl(cwd);

  const renderInfoBar = (model: string, sessionId: string) => {
    const barWidth = Math.max(1, Number(infoBar.width) || 80);
    // Right side: model + session short ID
    const shortSession = sessionId.replace(/^wibwob-agent-/, "").slice(0, 8);
    const right = `${model}  #${shortSession}`;
    // Left side: claude code log link if available
    const left = claudeJsonl
      ? `{${C.blue}-fg}cc:${path.basename(claudeJsonl, ".jsonl").slice(0, 8)}{/${C.blue}-fg}`
      : "";
    // Pad to right-align the right portion
    const leftLen = claudeJsonl ? 12 : 0;
    const gap = Math.max(1, barWidth - leftLen - right.length - 1);
    infoBar.setContent(` ${left}${" ".repeat(gap)}{${C.muted}-fg}${right}{/${C.muted}-fg}`);
  };

  // Click the left side (cc: label) to open the JSONL in an editor
  if (claudeJsonl) {
    infoBar.on("click", (mouse) => {
      const clickX = (mouse as unknown as { x: number }).x;
      if (clickX < 14) {
        // Open the Claude Code log in a text editor window
        const edWin = params.windowManager.createFrame(path.basename(claudeJsonl), "editor");
        try {
          const content = fs.readFileSync(claudeJsonl, "utf-8");
          edWin.body.setContent(content);
        } catch {
          edWin.body.setContent("(could not read file)");
        }
        params.windowManager.registerWindow(edWin);
        params.screen.render();
      }
    });
  }

  // Subscribe to agent state
  const unsubscribe = params.agent.subscribe((snapshot) => {
    const useKaomoji = !snapshot.model?.toLowerCase().includes("haiku");
    transcript.setContent(renderTranscript(snapshot.messages, useKaomoji));
    transcript.setScrollPerc(100);
    statusLine.setContent(` ${snapshot.status}`);
    renderInfoBar(snapshot.model ?? "—", snapshot.sessionId ?? "");
    params.screen.render();
  });

  // Key handling
  input.on("keypress", (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!key) return;

    if (key.name === "return" || key.name === "enter") {
      const text = draft.trim();
      if (text === "/reload") {
        draft = "";
        renderInput();
        params.screen.render();
        // Close this window WITHOUT disposing the agent, then reopen with same session
        unsubscribe();
        frame.cleanup = undefined; // prevent dispose on close
        const pos = {
          top: Number(frame.frame.top),
          left: Number(frame.frame.left),
          width: Number(frame.frame.width),
          height: Number(frame.frame.height),
        };
        frame.close();
        const newFrame = openWibWobAgentWindow({ ...params, initialPos: pos });
        void newFrame;
        return;
      }
      if (text) {
        draft = "";
        renderInput();
        params.screen.render();
        void params.agent.send(text);
      }
      return;
    }

    if (key.name === "backspace") {
      draft = draft.slice(0, -1);
      renderInput();
      params.screen.render();
      return;
    }

    if (key.name === "escape") {
      return;
    }

    // Tab to focus transcript for scrolling
    if (key.name === "tab") {
      transcript.focus();
      params.screen.render();
      return;
    }

    // Use key.sequence if available, fall back to ch for punctuation and
    // symbols that blessed may not populate sequence for.
    const char = (key.sequence && key.sequence.length === 1)
      ? key.sequence
      : (ch && ch.length === 1 && ch >= " " ? ch : null);

    if (char && !key.ctrl && !key.meta) {
      draft += char;
      renderInput();
      params.screen.render();
    }
  });

  // Click transcript to read, click input to type
  transcript.on("click", () => {
    transcript.focus();
    params.screen.render();
  });

  input.on("click", armInput);

  // Scroll keys when transcript focused
  transcript.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!key) return;
    if (key.name === "tab") {
      armInput();
      return;
    }
  });

  frame.describeState = () => {
    const snapshot = params.agent.getSnapshot();
    return {
      appType: params.agent.mode === "chat" ? "wibwob-chat-v2" : "wibwob-agent",
      summary: snapshot.status,
      messageCount: snapshot.messageCount,
      streaming: snapshot.streaming,
      model: snapshot.model,
      ready: snapshot.ready,
    };
  };

  frame.cleanup = () => {
    unsubscribe();
    params.agent.dispose();
  };
  // NOTE: on /reload we set frame.cleanup = undefined before calling frame.close()
  // so the agent session is preserved across the reload.

  frame.writeInput = (text: string) => {
    void params.agent.send(text);
  };

  params.windowManager.registerWindow(frame);
  armInput();

  // Initialize agent (starts model, registers tools)
  void params.agent.initialize();
}
