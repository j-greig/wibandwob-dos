/**
 * Wib&Wob Agent window — chat with TUI superpowers.
 *
 * Same look as the regular chat window but backed by WibWobAgentSession
 * which has desktop tools (open/close/move windows, send input, read
 * terminal buffers, etc). Desktop state is injected every turn.
 */

import blessed from "blessed";
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

function renderMessage(msg: ChatMessageEntry): string {
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
  // Assistant text — Wib/Wob voices in main gray
  const text = msg.text || (msg.streaming ? "Wib: …\nWob: …" : "");
  return escapeTagBraces(text);
}

function renderTranscript(messages: ChatMessageEntry[]): string {
  if (messages.length === 0) return "[status] Starting Wib&Wob Agent…";
  return messages.map(renderMessage).join("\n\n");
}

export function openWibWobAgentWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  agent: WibWobAgentSession;
}): void {
  const frame = params.windowManager.createFrame("Wib&Wob Agent", "chat");

  const transcript = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 2,
    tags: true,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: C.gray, bg: "black" },
  });

  const statusLine = blessed.box({
    parent: frame.body,
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: "yellow", bg: "black" },
  });

  const input = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    style: { fg: "white", bg: "blue" },
  });

  let draft = "";

  const renderInput = () => {
    const width = Math.max(1, Number(input.width) || 1);
    const visibleWidth = Math.max(1, width - 1);
    const visible = draft.slice(-visibleWidth);
    const cursor = input === params.screen.focused ? "_" : " ";
    input.setContent((visible + cursor).padEnd(width, " "));
  };

  const armInput = () => {
    input.focus();
    renderInput();
    params.screen.render();
  };

  // Subscribe to agent state
  const unsubscribe = params.agent.subscribe((snapshot) => {
    transcript.setContent(renderTranscript(snapshot.messages));
    transcript.setScrollPerc(100);
    statusLine.setContent(` ${snapshot.status}`);
    params.screen.render();
  });

  // Key handling
  input.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!key) return;

    if (key.name === "return" || key.name === "enter") {
      const text = draft.trim();
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

    if (key.sequence && !key.ctrl && !key.meta) {
      draft += key.sequence;
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
      appType: "wibwob-agent",
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

  frame.writeInput = (text: string) => {
    void params.agent.send(text);
  };

  params.windowManager.registerWindow(frame);
  armInput();

  // Initialize agent (starts model, registers tools)
  void params.agent.initialize();
}
