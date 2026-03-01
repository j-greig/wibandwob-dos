import blessed from "blessed";

import { createScrollbar } from "../core/ui-primitives.js";
import type {
  Box,
  ChatMessageEntry,
} from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WibWobChatSession } from "../services/wibwob-chat-service.js";

function renderMessage(message: ChatMessageEntry): string {
  if (message.role === "user") {
    return `You: ${message.text}`;
  }
  if (message.role === "status") {
    return `[status] ${message.text}`;
  }
  return message.text || (message.streaming ? "Wib: …\nWob: …" : "");
}

function renderTranscript(messages: ChatMessageEntry[]): string {
  if (messages.length === 0) {
    return "[status] Opening Wib&Wob Chat…";
  }
  return messages.map((message) => renderMessage(message)).join("\n\n");
}

export function openWibWobChatWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  chat: WibWobChatSession;
  restore?: {
    messages?: ChatMessageEntry[];
    draft?: string;
  };
}): void {
  const frame = params.windowManager.createFrame("Wib&Wob Chat", "chat");
  const transcript = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: "white", bg: "black" }
  });
  const input = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    style: { fg: "white", bg: "blue" }
  });
  let draft = "";

  if (params.restore) {
    params.chat.hydrate({
      messages: params.restore.messages
    });
    if (params.restore.draft) {
      draft = params.restore.draft;
    }
  }

  const renderInput = () => {
    const width = Math.max(1, Number(input.width) || 1);
    const visibleWidth = Math.max(1, width - 1);
    const visible = draft.slice(-visibleWidth);
    const cursor = input === params.screen.focused ? "_" : " ";
    input.setContent((visible + cursor).padEnd(width, " "));
  };

  const armInput = () => {
    params.windowManager.focusWindow(frame);
    input.focus();
    renderInput();
    params.screen.render();
  };

  const submit = (override?: string) => {
    const value = (override ?? draft).trim();
    draft = "";
    renderInput();
    params.screen.render();
    if (!value) {
      armInput();
      return;
    }
    void params.chat.send(value).finally(() => params.screen.render());
  };

  const render = () => {
    const snapshot = params.chat.getSnapshot();
    transcript.setContent(renderTranscript(snapshot.messages));
    transcript.setScrollPerc(100);
    renderInput();
    params.screen.render();
  };

  const unsubscribe = params.chat.subscribe(() => render());
  render();
  void params.chat.initialize();

  frame.frame.on("resize", () => render());
  frame.body.on("click", () => armInput());
  transcript.on("click", () => armInput());
  input.on("focus", () => {
    params.windowManager.focusWindow(frame);
    renderInput();
    params.screen.render();
  });
  input.on("blur", () => {
    renderInput();
    params.screen.render();
  });
  input.on("keypress", (ch, key) => {
    if (key.name === "enter") {
      submit();
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
    if (key.ctrl && key.name === "u") {
      draft = "";
      renderInput();
      params.screen.render();
      return;
    }
    if (typeof ch === "string" && ch.length > 0 && !key.ctrl && !key.meta) {
      draft += ch;
      renderInput();
      params.screen.render();
    }
  });

  frame.kind = "chat";
  frame.chat = {
    mode: "pi-sdk",
    transcript,
    input,
    getTranscriptLines: () => renderTranscript(params.chat.getSnapshot().messages).split("\n"),
    getDraft: () => draft,
    setDraft: (value) => {
      draft = value;
      renderInput();
    },
    submit,
    messages: params.chat.getSnapshot().messages
  };
  frame.describeState = () => {
    const snapshot = params.chat.getSnapshot();
    return {
      appType: "wibwob-chat-v2",
      summary: "Native Pi SDK chat window.",
      contentPreview: renderTranscript(snapshot.messages).split("\n").slice(-8).join("\n"),
      transcriptLines: snapshot.messages.map((message) => renderMessage(message)),
      messageCount: snapshot.messageCount,
      status: snapshot.status,
      model: snapshot.model,
      ready: snapshot.ready,
      streaming: snapshot.streaming,
      lastError: snapshot.lastError,
      draft,
      messages: snapshot.messages
    };
  };
  frame.captureText = () => params.chat.captureText();
  frame.cleanup = () => {
    unsubscribe();
    params.chat.dispose();
  };
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    armInput();
  };
  frame.writeInput = (text) => {
    if (!text) {
      return;
    }
    const normalized = text.replace(/\r\n/g, "\n");
    const segments = normalized.split(/\n/);
    draft += segments[0];
    renderInput();
    for (const segment of segments.slice(1)) {
      submit();
      if (segment) {
        draft = segment;
        renderInput();
      }
    }
    if (normalized.includes("\r") || normalized.endsWith("\n")) {
      submit();
    } else {
      params.screen.render();
    }
  };

  params.windowManager.registerWindow(frame);
  frame.focus();
}
