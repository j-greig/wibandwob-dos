import blessed from "blessed";

import { createScrollbar } from "../core/ui-primitives.js";
import type {
  Box,
  ChatMessageEntry,
  ChatTaskLoop,
  ChatTaskStory,
  Textbox,
  WindowRecord
} from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WibWobChatSession } from "../services/wibwob-chat-service.js";

function renderTaskLoop(taskLoop?: ChatTaskLoop): string {
  if (!taskLoop?.stories.length) {
    return "TASK LOOP\nNo task loop yet.";
  }

  const lines = ["TASK LOOP"];
  for (const story of taskLoop.stories.slice(0, 3)) {
    lines.push(`[${story.status}] ${story.title}`);
    lines.push(`  ${story.description}`);
    for (const item of story.items.slice(0, 4)) {
      lines.push(`  - [${item.status}] ${item.title}`);
    }
  }
  return lines.join("\n");
}

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

function summarizeTaskLoop(taskLoop?: ChatTaskLoop): { pending: number; passed: number } {
  let pending = 0;
  let passed = 0;
  for (const story of taskLoop?.stories ?? []) {
    if (story.status === "passed") {
      passed += 1;
    } else {
      pending += 1;
    }
    for (const item of story.items) {
      if (item.status === "passed") {
        passed += 1;
      } else {
        pending += 1;
      }
    }
  }
  return { pending, passed };
}

export function openWibWobChatWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  chat: WibWobChatSession;
  restore?: {
    messages?: ChatMessageEntry[];
    draft?: string;
    taskLoop?: ChatTaskLoop;
  };
}): void {
  const frame = params.windowManager.createFrame("Wib&Wob Chat", "chat");
  const taskPanel = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    tags: false,
    style: { fg: "yellow", bg: "black" }
  });
  const transcript = blessed.box({
    parent: frame.body,
    top: 7,
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
  const input = blessed.textbox({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    inputOnFocus: true,
    mouse: true,
    style: { fg: "white", bg: "blue" }
  });

  if (params.restore) {
    params.chat.hydrate({
      messages: params.restore.messages,
      taskLoop: params.restore.taskLoop
    });
    if (params.restore.draft) {
      input.setValue(params.restore.draft);
    }
  }

  let inputArmed = false;

  const armInput = () => {
    params.windowManager.focusWindow(frame);
    input.focus();
    if (inputArmed) {
      params.screen.render();
      return;
    }
    inputArmed = true;
    input.readInput();
    params.screen.render();
  };

  const submit = (override?: string) => {
    inputArmed = false;
    const value = (override ?? input.getValue() ?? "").trim();
    input.clearValue();
    params.screen.render();
    if (!value) {
      armInput();
      return;
    }
    void params.chat.send(value).finally(() => {
      armInput();
    });
  };

  const render = () => {
    const snapshot = params.chat.getSnapshot();
    const loopSummary = summarizeTaskLoop(snapshot.taskLoop);
    taskPanel.setContent(
      `${renderTaskLoop(snapshot.taskLoop)}\n\nStatus: ${snapshot.status}\nMessages: ${snapshot.messageCount}  Pending: ${loopSummary.pending}  Passed: ${loopSummary.passed}`
    );
    transcript.setContent(renderTranscript(snapshot.messages));
    transcript.setScrollPerc(100);
    params.screen.render();
  };

  const unsubscribe = params.chat.subscribe(() => render());
  render();
  void params.chat.initialize();

  input.on("submit", (value) => submit(value ?? ""));
  input.on("cancel", () => {
    inputArmed = false;
    params.screen.render();
  });
  input.on("blur", () => {
    inputArmed = false;
  });
  frame.body.on("click", () => armInput());
  transcript.on("click", () => armInput());
  taskPanel.on("click", () => armInput());
  input.on("focus", () => params.windowManager.focusWindow(frame));

  frame.kind = "chat";
  frame.chat = {
    mode: "pi-sdk",
    transcript,
    input,
    getTranscriptLines: () => renderTranscript(params.chat.getSnapshot().messages).split("\n"),
    getDraft: () => input.getValue(),
    setDraft: (value) => input.setValue(value),
    submit,
    messages: params.chat.getSnapshot().messages,
    taskLoop: params.chat.getSnapshot().taskLoop
  };
  frame.describeState = () => {
    const snapshot = params.chat.getSnapshot();
    const loopSummary = summarizeTaskLoop(snapshot.taskLoop);
    return {
      appType: "wibwob-chat-v2",
      summary: "Native Pi SDK chat window with task-loop rendering.",
      contentPreview: renderTranscript(snapshot.messages).split("\n").slice(-8).join("\n"),
      transcriptLines: snapshot.messages.map((message) => renderMessage(message)),
      messageCount: snapshot.messageCount,
      status: snapshot.status,
      model: snapshot.model,
      ready: snapshot.ready,
      streaming: snapshot.streaming,
      lastError: snapshot.lastError,
      pendingTaskCount: loopSummary.pending,
      passedTaskCount: loopSummary.passed,
      draft: input.getValue(),
      messages: snapshot.messages,
      taskLoop: snapshot.taskLoop
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
    const initial = input.getValue();
    input.setValue(initial + segments[0]);
    for (const segment of segments.slice(1)) {
      submit();
      if (segment) {
        input.setValue(segment);
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
