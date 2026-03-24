/**
 * Scramble window — floating LLM companion cat.
 *
 * Two entry points:
 *   openScrambleFloatingWindow — full floating window (S1), port of agent window
 *   openScrambleSmolPopup      — three-state clippy: smol → tall → pop-out (S2)
 *
 * Both share a single ScrambleBrain instance passed from app-controller.
 */

import blessed from "blessed";
import { escapeBlessedTags as escBraces } from "../core/blessed-escape.js";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle } from "../core/ui-parts.js";
import type { WindowManager } from "../core/window-manager.js";
import type { ScrambleBrain } from "../services/scramble-brain.js";
import { C } from "./wibwob-agent-render.js";

// ── Cat art ──────────────────────────────────────────────────────────────────

const CAT_DEFAULT  = "   /\\_/\\\n  ( o.o )\n   > ^ <";
const CAT_CURIOUS  = "   /\\_/\\\n  ( o.O )\n   > ^ <";
const CAT_SLEEPING = "   /\\_/\\\n  ( -.- )\n   > ^ <";

function catArt(brain: ScrambleBrain): string {
  if (brain.sleeping) return CAT_SLEEPING;
  if (brain.status === "thinking") return CAT_CURIOUS;
  return CAT_DEFAULT;
}

function statusLabel(brain: ScrambleBrain): string {
  if (brain.sleeping) return " ( -.- ) zzz";
  switch (brain.status) {
    case "thinking": return " ( o.O ) thinking...";
    case "error":    return " ( x.x ) error";
    case "offline":  return " ( -.- ) offline";
    default:         return " ( =^..^= ) ready";
  }
}

// ── Shared input handling ─────────────────────────────────────────────────────

function wireInput(
  screen: blessed.Widgets.Screen,
  inputEl: blessed.Widgets.BoxElement,
  renderInput: () => void,
  onSubmit: (text: string) => void,
): { getDraft: () => string; setDraft: (s: string) => void } {
  let draft = "";

  inputEl.on("keypress", (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (!key) return;

    if (key.name === "return" || key.name === "enter") {
      const text = draft.trim();
      if (text) {
        draft = "";
        renderInput();
        screen.render();
        onSubmit(text);
      }
      return;
    }

    if (key.name === "backspace") {
      draft = draft.slice(0, -1);
      renderInput();
      screen.render();
      return;
    }

    if (key.name === "escape" || key.name === "tab") return;

    const char = key.sequence?.length === 1
      ? key.sequence
      : (ch?.length === 1 && ch >= " " ? ch : null);

    if (char && !key.ctrl && !key.meta) {
      draft += char;
      renderInput();
      screen.render();
    }
  });

  inputEl.on("click", () => { inputEl.focus(); screen.render(); });

  return {
    getDraft: () => draft,
    setDraft: (s: string) => { draft = s; },
  };
}

// ── Render transcript from brain history ──────────────────────────────────────

/** Map session alias → display name for Scramble's transcript */
function senderLabel(sender?: string): string {
  if (!sender) return "Human";
  if (sender === "wibwob-tui") return "Wib&Wob";
  return sender.charAt(0).toUpperCase() + sender.slice(1);
}

function renderHistory(brain: ScrambleBrain): string {
  const c = C();
  return brain.history
    .map((msg) => {
      if (msg.role === "user") {
        const label = senderLabel(msg.sender);
        const isAgent = !!msg.sender;
        const color = isAgent ? c.blue : c.pink;
        return `{${color}-fg}${label}:{/${color}-fg} {${c.gray}-fg}${escBraces(msg.content)}{/${c.gray}-fg}`;
      }
      return `{${c.lime}-fg}scramble:{/${c.lime}-fg} ${escBraces(msg.content)}`;
    })
    .join("\n");
}


// ── S1: Full floating window ──────────────────────────────────────────────────

export interface ScrambleFloatingDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  brain: ScrambleBrain;
  initialPos?: { top: number; left: number; width: number; height: number };
  onStateChanged?: () => void;
  onOpenLog?: () => void;
}

export function openScrambleFloatingWindow(deps: ScrambleFloatingDeps): void {
  const { screen, windowManager, brain, onStateChanged } = deps;
  const frame = windowManager.createFrame("Scramble", "companion");

  if (deps.initialPos) {
    const { top, left, width, height } = deps.initialPos;
    frame.frame.top = top;
    frame.frame.left = left;
    frame.frame.width = width;
    frame.frame.height = height;
  } else {
    frame.frame.width = 40;
    frame.frame.height = 18;
  }

  // Cat header (3 lines)
  const catHeader = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    tags: false,
    style: theme().body,
  });

  // Scrollable message history
  const transcript = blessed.box({
    parent: frame.body,
    top: 3,
    left: 0,
    right: 0,
    bottom: 2,
    tags: true,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().agentBg,
  });

  // Status line — shows brain state left, model+session right (click right to open log)
  const statusLine = blessed.box({
    parent: frame.body,
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    mouse: true,
    clickable: true,
    style: theme().warning,
  });

  // Input
  const inputEl = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    style: theme().input,
  });

  const renderCat = () => {
    catHeader.setContent(catArt(brain));
  };

  const renderStatus = () => {
    const c = C();
    const w = Math.max(1, Number(statusLine.width) || 40);
    const left = statusLabel(brain);
    const sid = brain.sessionId.replace("scramble-", "#");
    const right = `${brain.modelName}  ${sid}`;
    const gap = Math.max(1, w - left.length - right.length);
    statusLine.setContent(`${left}${" ".repeat(gap)}{${c.muted}-fg}${right}{/${c.muted}-fg}`);
  };

  // Click the right side of status line to open log
  statusLine.on("click", (mouse) => {
    const clickX = (mouse as unknown as { x: number }).x;
    const w = Math.max(1, Number(statusLine.width) || 40);
    if (clickX > w - 24) deps.onOpenLog?.();
  });

  const renderTranscriptContent = () => {
    transcript.setContent(renderHistory(brain));
    transcript.setScrollPerc(100);
  };

  const MAX_INPUT_ROWS = 4;

  const renderInputEl = () => {
    const raw = Number(inputEl.width);
    if (!raw || raw < 4) { screen.render(); return; } // not laid out yet — skip
    const width = raw;
    const cursor = inputEl === screen.focused ? "█" : " ";
    const full = getDraft() + cursor;
    const rows: string[] = [];
    for (let i = 0; i < full.length || rows.length === 0; i += width) {
      rows.push(full.slice(i, i + width).padEnd(width, " "));
    }
    const inputRows = Math.min(MAX_INPUT_ROWS, Math.max(1, rows.length));
    inputEl.height = inputRows;
    inputEl.bottom = 0;
    statusLine.bottom = inputRows;
    transcript.bottom = inputRows + 1;
    inputEl.setContent(rows.join("\n"));
  };

  const { getDraft } = wireInput(screen, inputEl, renderInputEl, (text) => {
    void brain.send(text).then((reply) => {
      renderCat();
      renderStatus();
      renderTranscriptContent();
      renderInputEl();
      onStateChanged?.();
      screen.render();
    });
    renderCat();
    renderStatus();
    renderTranscriptContent();
    renderInputEl();
    screen.render();
  });

  renderCat();
  renderStatus();
  renderTranscriptContent();
  renderInputEl();

  transcript.on("click", () => { transcript.focus(); screen.render(); });

  frame.describeState = () => ({
    appType: "companion-widget" as const,
    summary: `Scramble — ${brain.status}`,
    displayMode: "floating",
    status: brain.status,
    messageCount: brain.history.length,
    lastMessage: brain.history.at(-1)?.content ?? null,
    contentPreview: brain.history.slice(-3).map((m) => `${m.role}: ${m.content}`).join(" | "),
  });

  frame.refresh = () => {
    renderCat();
    renderStatus();
    renderTranscriptContent();
    renderInputEl();
    screen.render();
  };

  frame.cleanup = () => {
    // Brain is owned by app-controller, don't dispose here
  };

  frame.focus = () => {
    inputEl.focus();
    screen.render();
  };

  const restyleBundle1 = createRestyleBundle([
    [catHeader, () => theme().body],
    [transcript, () => theme().agentBg],
    [statusLine, () => theme().warning],
    [inputEl, () => theme().input],
  ]);
  frame.onRestyle = () => {
    restyleBundle1.restyle();
    screen.render();
  };

  frame.writeInput = (text: string) => {
    void brain.send(text).then(() => {
      renderCat();
      renderStatus();
      renderTranscriptContent();
      onStateChanged?.();
      screen.render();
    });
  };

  windowManager.registerWindow(frame);
  inputEl.focus();
  screen.render();
}

// ── S2: Three-state clippy popup ──────────────────────────────────────────────

export type ScramblePopupMode = "smol" | "tall";

export interface ScrambleSmolDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  brain: ScrambleBrain;
  initialMode?: ScramblePopupMode;
  onPopOut?: () => void;   // called when user clicks pop-out
  onStateChanged?: () => void;
}

export function openScrambleSmolPopup(deps: ScrambleSmolDeps): void {
  const { screen, windowManager, brain, onStateChanged } = deps;
  const frame = windowManager.createFrame("Scramble", "companion");

  const SMOL_W = 34;
  const SMOL_H = 12;
  const TALL_H = 24;

  let mode: ScramblePopupMode = deps.initialMode ?? "smol";

  // Anchor bottom-right
  const positionFrame = (h: number) => {
    const sw = Math.max(1, Number(screen.width) || 80);
    const sh = Math.max(1, Number(screen.height) || 24);
    frame.frame.width = SMOL_W;
    frame.frame.height = h;
    frame.frame.left = sw - SMOL_W - 2;
    frame.frame.top = sh - h - 2;
  };

  positionFrame(mode === "tall" ? TALL_H : SMOL_H);

  // Button bar — top of window body: [↗ expand] [□ pop-out]
  const btnBar = blessed.box({
    parent: frame.body,
    top: 0,
    right: 0,
    height: 1,
    width: 12,
    tags: true,
    mouse: true,
    clickable: true,
    style: theme().muted,
  });

  // Cat (3 lines)
  const catHeader = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    height: 3,
    tags: false,
    style: theme().body,
  });

  // Speech bubble / last message (smol only — 1 line below cat)
  const bubbleLine = blessed.box({
    parent: frame.body,
    top: 4,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: theme().muted,
  });

  // Message history (tall only)
  const transcript = blessed.box({
    parent: frame.body,
    top: 5,
    left: 0,
    right: 0,
    bottom: 2,
    tags: true,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().agentBg,
    hidden: true,
  });

  // Status + input row
  const statusLine = blessed.box({
    parent: frame.body,
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    style: theme().warning,
  });

  const inputEl = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    style: theme().input,
  });

  const renderBtnBar = () => {
    const c = C();
    const expandIcon = mode === "smol" ? "↗" : "↙";
    btnBar.setContent(
      `{${c.muted}-fg}[${expandIcon}] [□]{/${c.muted}-fg}`
    );
  };

  const renderCat = () => { catHeader.setContent(catArt(brain)); };
  const renderStatus = () => { statusLine.setContent(statusLabel(brain)); };

  const renderBubble = () => {
    const last = brain.history.at(-1);
    const text = last
      ? (last.role === "assistant" ? last.content : `you: ${last.content}`)
      : "lurking...";
    const c = C();
    bubbleLine.setContent(`{${c.muted}-fg}${escBraces(text.slice(0, SMOL_W - 2))}{/${c.muted}-fg}`);
  };

  const renderTranscriptContent = () => {
    transcript.setContent(renderHistory(brain));
    transcript.setScrollPerc(100);
  };

  const applyMode = () => {
    if (mode === "smol") {
      positionFrame(SMOL_H);
      bubbleLine.show();
      transcript.hide();
    } else {
      positionFrame(TALL_H);
      bubbleLine.hide();
      transcript.show();
    }
    renderBtnBar();
    renderCat();
    renderBubble();
    renderTranscriptContent();
    renderStatus();
    screen.render();
  };

  const { getDraft } = wireInput(screen, inputEl, () => {
    const width = Math.max(1, Number(inputEl.width) || 1);
    const full = getDraft() + "_";
    // Show the tail so the cursor is always visible — scrolling-input behaviour
    inputEl.setContent(full.slice(Math.max(0, full.length - width)).padEnd(width, " "));
  }, (text) => {
    void brain.send(text).then(() => {
      renderCat();
      renderBubble();
      renderTranscriptContent();
      renderStatus();
      onStateChanged?.();
      screen.render();
    });
    renderCat();
    renderStatus();
    screen.render();
  });

  // Button click handling
  btnBar.on("click", (mouse) => {
    const clickX = (mouse as unknown as { x: number }).x - (Number(frame.frame.left) || 0) - 1;
    const barRight = Math.max(1, Number(frame.frame.width) || SMOL_W);
    // [↗/↙] is chars 0-2, [□] is chars 4-6 relative to btnBar right edge
    // btnBar starts at right=0, width=12 so it's last 12 chars
    const relX = clickX - (barRight - 12);

    if (relX <= 4) {
      // expand/collapse toggle
      mode = mode === "smol" ? "tall" : "smol";
      applyMode();
    } else {
      // pop-out
      deps.onPopOut?.();
    }
  });

  frame.describeState = () => ({
    appType: "companion-widget" as const,
    summary: `Scramble — ${mode} — ${brain.status}`,
    displayMode: mode,
    status: brain.status,
    messageCount: brain.history.length,
    lastMessage: brain.history.at(-1)?.content ?? null,
  });

  frame.refresh = () => {
    renderCat();
    renderStatus();
    renderTranscriptContent();
    renderBubble();
    screen.render();
  };

  frame.cleanup = () => { /* brain owned by app-controller */ };

  frame.focus = () => {
    inputEl.focus();
    screen.render();
  };

  const restyleBundle2 = createRestyleBundle([
    [catHeader, () => theme().body],
    [transcript, () => theme().agentBg],
    [statusLine, () => theme().warning],
    [inputEl, () => theme().input],
  ]);
  frame.onRestyle = () => {
    restyleBundle2.restyle();
    screen.render();
  };

  frame.writeInput = (text: string) => {
    void brain.send(text).then(() => {
      renderCat();
      renderBubble();
      renderTranscriptContent();
      renderStatus();
      onStateChanged?.();
      screen.render();
    });
  };

  // Expose expand method so app-controller can call it
  (frame as unknown as Record<string, unknown>)._scrambleExpand = () => {
    mode = mode === "smol" ? "tall" : "smol";
    applyMode();
  };

  (frame as unknown as Record<string, unknown>)._scramblePopOut = () => {
    deps.onPopOut?.();
  };

  windowManager.registerWindow(frame);

  // Fix initial sizing/positioning after registration
  const sw = Math.max(1, Number(screen.width) || 80);
  const sh = Math.max(1, Number(screen.height) || 24);
  const h = mode === "tall" ? TALL_H : SMOL_H;
  windowManager.resizeWindow(frame.id, SMOL_W, h);
  windowManager.moveWindow(frame.id, Math.max(0, sw - SMOL_W - 2), Math.max(0, sh - h - 3));

  applyMode();
  inputEl.focus();
}
