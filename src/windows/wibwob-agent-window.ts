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
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { REPO_ROOT } from "../core/config.js";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
import type { Box, ChatMessageEntry } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import { listLocalSessions, type LocalSessionInfo } from "../services/pi-session-bridge.js";
import type { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { sharedPlayer, fmtTime } from "../services/audio-player-controller.js";

function escapeTagBraces(text: string): string {
  // Escape { and } that aren't blessed tags so they don't break rendering
  return text.replace(/\{(?!\/?(?:bold|underline|blink|inverse|invisible|[a-z]+-(?:fg|bg))(?:\}|-))/g, "\\{");
}

// Resolve agent palette from the active theme tokens at call time.
// Never cache these — theme() is cheap and we want live theme switching.
function C() {
  const t = theme();
  return {
    pink:  t.highlight.fg,  // user labels, warm accent
    blue:  t.accent.fg,     // tool titles, borders
    lime:  t.success.fg,    // checkmarks, status lines
    muted: t.muted.fg,      // dim tool arg text
    gray:  t.body.fg,       // main assistant text
  };
}

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
  const c = C();
  if (msg.role === "user") {
    const label = msg.sender ?? "Human";
    return `{${c.pink}-fg}${label}:{/${c.pink}-fg} {${c.gray}-fg}${escapeTagBraces(msg.text)}{/${c.gray}-fg}`;
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

function renderTranscript(messages: ChatMessageEntry[], useKaomoji: boolean): string {
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

function truncatePreview(text: string, max = 50): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
}

function formatRelativeSessionTime(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

  if (dayDiff === 0) {
    return `today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  if (dayDiff === 1) {
    return "yesterday";
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
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
  onStateChanged?: () => void;
}): void {
  const frame = params.windowManager.createFrame(params.title ?? "Wib&Wob Agent", "chat");
  let lastSessionList: LocalSessionInfo[] | undefined;

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
    style: theme().agentBg,
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

  // ── Inline player bar ──────────────────────────────────────────────────────
  // A 1-row strip that appears above the status line whenever audio is playing
  // or paused. Subscribes directly to sharedPlayer for live second-by-second
  // updates, independent of the agent turn cycle.

  const playerBar = blessed.box({
    parent: frame.body,
    bottom: 2,   // above statusLine; adjusted by renderPlayerBarLayout()
    left: 0,
    right: 0,
    height: 0,   // hidden until something is playing
    tags: true,
    mouse: true,
    clickable: true,
    style: { fg: "#57c7ff", bg: "#1a1a2e" },
  });

  // Click anywhere on the player bar to toggle play/pause
  playerBar.on("click", () => {
    sharedPlayer.togglePause().then(() => renderPlayerBar());
  });

  // Track whether bar is currently visible so we avoid redundant layout thrash
  let playerBarVisible = false;

  const renderPlayerBar = () => {
    const snap = sharedPlayer.getSnapshot();
    const active = snap.state !== "stopped";

    if (active !== playerBarVisible) {
      playerBarVisible = active;
      // Re-run layout with current input height so stack stays consistent
      renderLayout(Math.max(1, Number(input.height) || 1));
    }

    if (!active) {
      playerBar.setContent("");
      params.screen.render();
      return;
    }

    const w = Math.max(20, Number(playerBar.width) || 60);
    const c = C();
    const icon = snap.state === "playing" ? `{${c.lime}-fg}▶{/${c.lime}-fg}` : `{#f5a623-fg}⏸{/#f5a623-fg}`;
    const name = snap.fileName.length > 24 ? snap.fileName.slice(0, 21) + "…" : snap.fileName;
    const timeStr = `${fmtTime(snap.elapsed)}/${fmtTime(snap.duration)}`;
    const volStr = `${snap.volume}%`;
    // Reserve space: icon(1) + sp(1) + name(25) + sp(1) + time(11) + sp(1) + vol(4) + sp(1) = ~45
    const fixedLen = 1 + 1 + 25 + 1 + 11 + 1 + 4 + 2;
    const barWidth = Math.max(4, w - fixedLen);
    const ratio = snap.duration > 0 ? Math.min(snap.elapsed / snap.duration, 1) : 0;
    const filled = Math.round(ratio * barWidth);
    const bar = `{${c.blue}-fg}${"▪".repeat(filled)}{/${c.blue}-fg}{${c.muted}-fg}${"·".repeat(barWidth - filled)}{/${c.muted}-fg}`;

    playerBar.setContent(
      ` ${icon} {${c.gray}-fg}${name}{/${c.gray}-fg} ${bar} {${c.muted}-fg}${timeStr}  ${volStr}{/${c.muted}-fg}`
    );
    params.screen.render();
  };

  const unsubscribePlayer = sharedPlayer.subscribe(renderPlayerBar);

  // ── Input rendering ─────────────────────────────────────────────────────────

  let draft = "";
  const MAX_INPUT_ROWS = 6;

  // Single source of truth for the vertical layout stack (from bottom up):
  //   input (inputRows)  →  statusLine (1)  →  playerBar (0 or 1)  →  transcript
  const renderLayout = (inputRows: number) => {
    const barRows = playerBarVisible ? 1 : 0;
    input.height = inputRows;
    input.bottom = 0;
    statusLine.bottom = inputRows;
    playerBar.bottom = inputRows + 1;
    playerBar.height = barRows;
    transcript.bottom = inputRows + 1 + barRows;
  };

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
    renderLayout(inputRows);
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
  let currentSessionFile: string | undefined;

  const renderInfoBar = (model: string, sessionId: string, sessionFile?: string) => {
    currentSessionFile = sessionFile;
    const barWidth = Math.max(1, Number(infoBar.width) || 80);
    // Right side: short model name + clickable session short ID (blue when log exists)
    const shortModel = model.replace(/^[^/]+\//, "").replace(/^claude-/, "");
    const c = C();
    const shortSession = sessionId.replace(/^wibwob-agent-/, "").slice(0, 8);
    const sessionLabel = sessionFile
      ? `{${c.blue}-fg}#${shortSession}{/${c.blue}-fg}`
      : `#${shortSession}`;
    const sessionLabelLen = 1 + shortSession.length; // plain text length
    const right = `${shortModel}  ${sessionLabel}`;
    const rightLen = shortModel.length + 2 + sessionLabelLen;
    // Left side: claude code log link if available
    const left = claudeJsonl
      ? `{${c.blue}-fg}cc:${path.basename(claudeJsonl, ".jsonl").slice(0, 8)}{/${c.blue}-fg}`
      : "";
    const leftLen = claudeJsonl ? 12 : 0;
    const gap = Math.max(1, barWidth - leftLen - rightLen - 1);
    infoBar.setContent(` ${left}${" ".repeat(gap)}{${c.muted}-fg}${right}{/${c.muted}-fg}`);
  };

  const runResumeCommand = (rawArg: string) => {
    const arg = rawArg.trim();

    if (!arg) {
      void (async () => {
        const sessions = await listLocalSessions(REPO_ROOT);
        lastSessionList = sessions;
        if (sessions.length === 0) {
          params.agent.pushStatus("[resume] No local pi sessions found.");
          return;
        }
        params.agent.pushStatus(
          [
            "Recent sessions (type /resume <number> to load):",
            ...sessions.map((session, index) =>
              `  ${index + 1}  ${truncatePreview(session.firstMessage || "(no message)")}  —  ${session.messageCount} msgs  —  ${formatRelativeSessionTime(session.modified)}`
            ),
          ].join("\n")
        );
      })().catch((error) => {
        params.agent.pushStatus(`[resume] Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }

    if (/^\d+$/.test(arg) && lastSessionList) {
      const session = lastSessionList[Number(arg) - 1];
      if (!session) {
        params.agent.pushStatus(`[resume] No session ${arg} in the last shown list.`);
        return;
      }
      void params.agent.resume(session.path).catch((error) => {
        params.agent.pushStatus(`[resume] Failed to load session: ${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }

    void (async () => {
      const sessions = await SessionManager.list(REPO_ROOT);
      const match = sessions.find((session) => session.id === arg);
      if (!match) {
        params.agent.pushStatus(`[resume] No local session found for id ${arg}.`);
        return;
      }
      await params.agent.resume(match.path);
    })().catch((error) => {
      params.agent.pushStatus(`[resume] Failed to load session: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  /** Open a JSONL log file in a read-only viewer window. */
  const openLogViewer = (filePath: string) => {
    const edWin = params.windowManager.createFrame(path.basename(filePath), "editor");
    edWin.filePath = filePath; // enables "Copy Path" / "Reveal in Finder" in context menu
    edWin.describeState = () => ({
      appType: "text-editor" as const,
      summary: `Viewing ${path.basename(filePath)}`,
      filePath,
    });
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      edWin.body.setContent(content);
    } catch {
      edWin.body.setContent("(could not read file)");
    }
    params.windowManager.registerWindow(edWin);
    params.screen.render();
  };

  // Click the left side (cc: label) to open Claude Code log,
  // click the right side (#session) to open the pi session log
  infoBar.on("click", (mouse) => {
    const clickX = (mouse as unknown as { x: number }).x;
    const barWidth = Math.max(1, Number(infoBar.width) || 80);
    const frameLeft = Number(frame.frame.left) || 0;
    const relativeX = clickX - frameLeft - 1; // account for window border

    if (claudeJsonl && relativeX < 14) {
      openLogViewer(claudeJsonl);
    } else if (currentSessionFile && relativeX > barWidth - 20) {
      openLogViewer(currentSessionFile);
    }
  });

  // Right-click info bar: show session log path in transcript
  infoBar.on("mousedown", (mouse) => {
    const data = mouse as unknown as { button: string };
    if (data.button !== "right") return;
    if (currentSessionFile) {
      params.agent.pushStatus(`[session log] ${currentSessionFile}`);
    }
  });

  // Subscribe to agent state
  const unsubscribe = params.agent.subscribe((snapshot) => {
    const useKaomoji = !snapshot.model?.toLowerCase().includes("haiku");
    transcript.setContent(renderTranscript(snapshot.messages, useKaomoji));
    transcript.setScrollPerc(100);
    statusLine.setContent(` ${snapshot.status}`);
    renderInfoBar(snapshot.model ?? "—", snapshot.sessionId ?? "", snapshot.sessionFile);
    params.onStateChanged?.();
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
        unsubscribePlayer();
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
        if (text.trim() === "/help") {
          params.agent.pushStatus(
            "[commands]\n" +
            "  /help       — show this list\n" +
            "  /session    — session id, model, message count, log path\n" +
            "  /new        — start a fresh session\n" +
            "  /resume [n] — list or load previous sessions\n" +
            "  /reload     — hot-swap system prompt from disk"
          );
        } else if (text.trim() === "/new") {
          params.agent.reset();
        } else if (text.trim() === "/session") {
          const snap = params.agent.getSnapshot();
          const msgs = snap.messageCount;
          const model = snap.model ?? "—";
          const file = snap.sessionFile ?? "(no log)";
          params.agent.pushStatus(`[session] ${snap.sessionId}\n  model: ${model}\n  messages: ${msgs}\n  log: ${file}`);
        } else if (text.trim().startsWith("/resume")) {
          runResumeCommand(text.trim().slice("/resume".length));
        } else {
          void params.agent.send(text);
        }
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
    unsubscribePlayer();
    params.agent.dispose();
  };
  // NOTE: on /reload we set frame.cleanup = undefined before calling frame.close()
  // so the agent session is preserved across the reload.

  frame.writeInput = (text: string, sender?: string) => {
    const trimmed = text.trim();
    if (trimmed === "/help") {
      params.agent.pushStatus(
        "[commands]\n" +
        "  /help       — show this list\n" +
        "  /session    — session id, model, message count, log path\n" +
        "  /new        — start a fresh session\n" +
        "  /resume [n] — list or load previous sessions\n" +
        "  /reload     — hot-swap system prompt from disk"
      );
      return;
    }
    if (trimmed === "/new") { params.agent.reset(); return; }
    if (trimmed === "/session") {
      const snap = params.agent.getSnapshot();
      params.agent.pushStatus(`[session] ${snap.sessionId}\n  model: ${snap.model ?? "—"}\n  messages: ${snap.messageCount}\n  log: ${snap.sessionFile ?? "(no log)"}`);
      return;
    }
    if (trimmed.startsWith("/resume")) {
      runResumeCommand(trimmed.slice("/resume".length));
      return;
    }
    void params.agent.send(text, sender);
  };
  frame.onRestyle = () => {
    infoBar.style = theme().muted;
    safeSetStyle(transcript, theme().agentBg);
    statusLine.style = theme().warning;
    input.style = theme().input;
    // playerBar keeps its own fixed dark style
  };

  params.windowManager.registerWindow(frame);
  params.agent.setWindowId(frame.id);
  armInput();

  // Initialize agent (starts model, registers tools)
  void params.agent.initialize();
}
