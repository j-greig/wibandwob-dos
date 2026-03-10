/**
 * Wib&Wob Agent window — chat with TUI superpowers.
 *
 * Same look as the regular chat window but backed by WibWobAgentSession
 * which has desktop tools (open/close/move windows, send input, read
 * terminal buffers, etc). Desktop state is injected every turn.
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { REPO_ROOT } from "../core/config.js";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { createCollapsibleBlock, createContentStack, createRestyleBundle, type CollapsibleBlockHandle, type ContentStackChild } from "../core/ui-parts.js";
import type { Box } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import { listLocalSessions, type LocalSessionInfo } from "../services/pi-session-bridge.js";
import type { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { sharedPlayer, fmtTime } from "../services/audio-player-controller.js";
import { findClaudeCodeJsonl, formatRelativeSessionTime, truncatePreview } from "../services/agent-session-helpers.js";
import { dispatchSlashCommand } from "./agent-slash-commands.js";
import { C, renderTranscript, buildTranscriptBlocks, type TranscriptBlock } from "./wibwob-agent-render.js";

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

  // Content stack manages variable-height child blocks (text messages + collapsible tool runs)
  // inside a scrollable container. Replaces the old single-string transcript box.
  const transcriptStack = createContentStack(frame.body, { style: theme().agentBg });
  const transcript = transcriptStack.node;
  transcript.top = 1;
  transcript.bottom = 2;

  // Track collapsible block handles for cleanup and re-use
  const collapsibleBlocks = new Map<string, CollapsibleBlockHandle>();
  const textBlocks = new Map<string, blessed.Widgets.BoxElement>();
  let lastBlockKeys: string[] = [];

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

  // ── Block-based transcript rendering ─────────────────────────────────────────
  // Build transcript as individual blessed child boxes inside the content stack.
  // Text messages → plain boxes. Tool runs → collapsible blocks.

  const updateTranscript = (snapshot: ReturnType<typeof params.agent.getSnapshot>) => {
    const useKaomoji = !snapshot.model?.toLowerCase().includes("haiku");
    const blocks = buildTranscriptBlocks(snapshot.messages, snapshot.toolRuns, useKaomoji);
    const newKeys = blocks.map((b) => b.key);

    // Fast path: if keys haven't changed, just update content in place
    const keysChanged = newKeys.length !== lastBlockKeys.length ||
      newKeys.some((k, i) => k !== lastBlockKeys[i]);

    if (!keysChanged) {
      // Update content of existing blocks without rebuilding
      for (const block of blocks) {
        if (block.type === "text") {
          const existing = textBlocks.get(block.key);
          if (existing) {
            existing.setContent(block.content);
            // Recalculate height — content may have changed line count (streaming)
            existing.height = block.content.split("\n").length + 1;
          }
        } else {
          const existing = collapsibleBlocks.get(block.key);
          if (existing) {
            existing.update({ summary: block.summary, detail: block.detail, badge: block.badge });
            // Auto-collapse when run transitions from active to inactive
            if (!block.run.active && !existing.isCollapsed()) {
              existing.setCollapsed(true);
            }
          }
        }
      }
      transcriptStack.relayout();
      transcriptStack.scrollToBottom();
      return;
    }

    // Full rebuild: create new children array
    const children: ContentStackChild[] = [];

    // Clean up blocks that are no longer present
    const newKeySet = new Set(newKeys);
    for (const [key, handle] of collapsibleBlocks) {
      if (!newKeySet.has(key)) {
        handle.destroy();
        collapsibleBlocks.delete(key);
      }
    }
    for (const [key, node] of textBlocks) {
      if (!newKeySet.has(key)) {
        node.destroy();
        textBlocks.delete(key);
      }
    }

    for (const block of blocks) {
      if (block.type === "text") {
        let node = textBlocks.get(block.key);
        if (!node) {
          node = blessed.box({
            parent: transcript,
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            tags: true,
            style: theme().agentBg,
          });
          textBlocks.set(block.key, node);
        }
        node.setContent(block.content);
        // Height = number of lines in content + 1 blank line for spacing between turns
        const lineCount = block.content.split("\n").length;
        node.height = lineCount + 1;
        children.push({
          key: block.key,
          node,
          contentHeight: () => Number(node!.height) || 1,
        });
      } else {
        // Tool run → collapsible block
        let handle = collapsibleBlocks.get(block.key);
        if (!handle) {
          handle = createCollapsibleBlock(transcript, {
            collapsed: !block.run.active, // active runs start expanded
            onChange: () => {
              transcriptStack.relayout();
              params.screen.render();
            },
          });
          collapsibleBlocks.set(block.key, handle);
        } else if (!block.run.active && !handle.isCollapsed()) {
          // Sync collapsed state on full rebuild (run finished since creation)
          handle.setCollapsed(true);
        }
        handle.update({ summary: block.summary, detail: block.detail, badge: block.badge });
        children.push({
          key: block.key,
          node: handle.node,
          contentHeight: () => handle!.contentHeight(),
        });
      }
    }

    transcriptStack.setChildren(children);
    transcriptStack.scrollToBottom();
    lastBlockKeys = newKeys;
  };

  // Subscribe to agent state
  const unsubscribe = params.agent.subscribe((snapshot) => {
    updateTranscript(snapshot);
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
      if (text) {
        draft = "";
        renderInput();
        params.screen.render();
        void dispatchSlashCommand(text.trim(), params.agent, runResumeCommand)
          .then((handled) => {
            if (!handled) {
              void params.agent.send(text);
            }
          })
          .catch((error) => {
            params.agent.pushStatus(`[slash] ${error instanceof Error ? error.message : String(error)}`);
          });
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
    for (const handle of collapsibleBlocks.values()) handle.destroy();
    collapsibleBlocks.clear();
    for (const node of textBlocks.values()) node.destroy();
    textBlocks.clear();
    transcriptStack.destroy();
    params.agent.dispose();
  };

  frame.writeInput = (text: string, sender?: string) => {
    const trimmed = text.trim();
    void dispatchSlashCommand(trimmed, params.agent, runResumeCommand)
      .then((handled) => {
        if (!handled) {
          void params.agent.send(text, sender);
        }
      })
      .catch((error) => {
        params.agent.pushStatus(`[slash] ${error instanceof Error ? error.message : String(error)}`);
      });
  };
  const restyleBundle = createRestyleBundle([
    [infoBar, () => theme().muted],
    [statusLine, () => theme().warning],
    [input, () => theme().input],
  ]);
  frame.onRestyle = () => {
    restyleBundle.restyle();
    transcriptStack.restyle();
    for (const handle of collapsibleBlocks.values()) handle.restyle();
    for (const node of textBlocks.values()) safeSetStyle(node, theme().agentBg);
    // playerBar keeps its own fixed dark style
  };

  params.windowManager.registerWindow(frame);
  params.agent.setWindowId(frame.id);
  armInput();

  // Initialize agent (starts model, registers tools)
  void params.agent.initialize();
}
