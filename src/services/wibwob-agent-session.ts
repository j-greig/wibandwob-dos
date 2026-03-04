/**
 * Native Wib & Wob agent/chat session. Owns model selection, prompt loading,
 * jailed coding tools (scoped to REPO_ROOT), TUI desktop tools, desktop-state
 * injection via transformContext, session resume, and pi-session bridge
 * integration. Supports "agent" (tools enabled) and "chat" (tools stripped) modes.
 */

import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import {
  AgentSession,
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
  type SessionStats,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";

import { REPO_ROOT, SPIKE_PI_APPEND_SYSTEM_PATH, SPIKE_PI_DIR } from "../core/config.js";
import type { ChatMessageEntry, DesktopState } from "../core/types.js";
import { Type } from "@sinclair/typebox";
import { agentToolToDefinition, createTuiToolDefinitions, createTuiTools, formatDesktopSummary, type TuiToolContext } from "./agent-tools.js";
import { getLastMessage, listSessions, sendToSession, startSessionServer, type SessionServerHandle } from "./pi-session-bridge.js";
import {
  createBashTool,
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";
import { log } from "./app-logger.js";
import { sharedPlayer, fmtTime, findAudioFiles, COMPOSITIONS_DIR } from "./audio-player-controller.js";
import fs from "node:fs";
import nodePath from "node:path";
import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";

// -- Path jailing: agent cannot escape REPO_ROOT --

function jailPath(requestedPath: string, jail: string): string {
  const expanded = requestedPath.startsWith("~/")
    ? nodePath.join(process.env.HOME || "/", requestedPath.slice(2))
    : requestedPath;
  const resolved = nodePath.isAbsolute(expanded)
    ? nodePath.resolve(expanded)
    : nodePath.resolve(jail, expanded);
  if (!resolved.startsWith(jail + nodePath.sep) && resolved !== jail) {
    throw new Error(`Path escapes workspace: ${requestedPath} → ${resolved}`);
  }
  return resolved;
}

/** Wrap pi coding tools so all file/process operations stay jailed to the given root directory. */
function createJailedCodingTools(jail: string) {
  const jailedRead = createReadTool(jail, {
    operations: {
      readFile: async (p) => { const r = jailPath(p, jail); return readFile(r); },
      access: async (p) => { const r = jailPath(p, jail); await access(r, constants.R_OK); },
    },
  });

  const jailedWrite = createWriteTool(jail, {
    operations: {
      writeFile: async (p, content) => { const r = jailPath(p, jail); await writeFile(r, content, "utf8"); },
      mkdir: async (dir) => { const r = jailPath(dir, jail); await mkdir(r, { recursive: true }); },
    },
  });

  const jailedEdit = createEditTool(jail, {
    operations: {
      readFile: async (p) => { const r = jailPath(p, jail); return readFile(r); },
      writeFile: async (p, content) => { const r = jailPath(p, jail); await writeFile(r, content, "utf8"); },
      access: async (p) => { const r = jailPath(p, jail); await access(r, constants.R_OK | constants.W_OK); },
    },
  });

  const jailedBash = createBashTool(jail, {
    spawnHook: (ctx) => {
      // Force cwd inside jail using the same boundary check as jailPath
      const cwd = ctx.cwd ?? jail;
      let jailedCwd: string;
      try {
        jailedCwd = jailPath(cwd, jail);
      } catch {
        jailedCwd = jail;
      }
      return { ...ctx, cwd: jailedCwd };
    },
  });

  const jailedGrep = createGrepTool(jail);
  const jailedFind = createFindTool(jail);
  const jailedLs = createLsTool(jail);

  return [jailedRead, jailedWrite, jailedEdit, jailedBash, jailedGrep, jailedFind, jailedLs];
}

// -- Compact tool call formatting --

function shortenPath(p: string): string {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  if (p.startsWith(REPO_ROOT + "/")) return p.slice(REPO_ROOT.length + 1);
  return p;
}

/** Format a tool invocation into a compact one-line summary for the visible chat transcript. */
function formatToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read": return `read ${shortenPath(String(args.path || ""))}${args.offset ? `:${args.offset}` : ""}`;
    case "write": return `write ${shortenPath(String(args.path || ""))}`;
    case "edit": return `edit ${shortenPath(String(args.path || ""))}`;
    case "bash": {
      const cmd = String(args.command || "");
      return `$ ${cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd}`;
    }
    case "grep": return `grep /${args.pattern}/ in ${shortenPath(String(args.path || "."))}`;
    case "find": return `find ${args.pattern} in ${shortenPath(String(args.path || "."))}`;
    case "ls": return `ls ${shortenPath(String(args.path || "."))}`;
    case "tui_get_state": return "get_state";
    case "tui_list_commands": return "list_commands";
    case "tui_run_command": return `run_command ${String(args.id || "")}`;
    case "tui_open_window": return `open ${args.type}`;
    case "tui_open_figlet": return `figlet "${args.text}"${args.font ? ` [${args.font}]` : ""}`;
    case "tui_close_window": return `close #${args.id}`;
    case "tui_move_window": return `move #${args.id} → ${args.left},${args.top}${args.width ? ` ${args.width}x${args.height}` : ""}`;
    case "tui_focus_window": return `focus #${args.id}`;
    case "tui_send_input": return `input #${args.id} "${String(args.text || args.input || "").slice(0, 40)}"`;
    case "tui_read_window": return `read_window #${args.id}`;
    case "tui_open_chrome_browser": return `open_chrome${args.url ? ` ${String(args.url).slice(0, 50)}` : ""}`;
    case "tui_browser_navigate": return `navigate #${args.id} → ${String(args.url || "").slice(0, 50)}`;
    case "tui_browser_list_links": return `list_links #${args.id}`;
    case "tui_browser_follow_link": return `follow_link #${args.id} link ${args.link_index}`;
    case "tui_browser_search": return `chrome_search "${String(args.query || "").slice(0, 50)}"${args.num_results ? ` (${args.num_results})` : ""}`;
    case "tui_web_search": return `search "${String(args.query || "").slice(0, 50)}"${args.num_results ? ` (${args.num_results})` : ""}${args.freshness ? ` [${args.freshness}]` : ""}`;
    case "tui_web_content": return `fetch ${String(args.url || "").slice(0, 60)}`;
    case "tui_youtube_transcript": return `yt_transcript ${String(args.video || "").slice(0, 50)}`;
    case "play_music": {
      if (args.action === "stop") return "♫ player stop";
      if (args.action === "open_window") {
        const label = typeof args.filePath === "string" ? ` ${nodePath.basename(args.filePath)}` : "";
        return `♫ open Music Player window${label}`;
      }
      const label = typeof args.filePath === "string" ? nodePath.basename(args.filePath) : "(no file)";
      return `♫ player play ${label}`;
    }
    case "list_music": return "♫ list tracks";
    default: {
      const j = JSON.stringify(args);
      return `${name}(${j.length > 50 ? j.slice(0, 47) + "..." : j})`;
    }
  }
}

/** Format a tool result into a truncated text summary for the visible chat transcript. */
function formatToolResult(result: { content?: Array<{ type?: string; text?: string }> }): string {
  if (!result?.content) return "";
  const text = result.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("");
  if (!text) return "";
  // Show first line, truncated
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length > 60) return ` → ${firstLine.slice(0, 57)}...`;
  if (firstLine) return ` → ${firstLine}`;
  return "";
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toToolDefinitionList(tools: AgentTool<any>[]): ToolDefinition[] {
  return tools.map(agentToolToDefinition);
}

function normalizeVisibleReply(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Wob: …";
  if (/(^|\n)\s*(Wib|Wob):/i.test(trimmed)) return trimmed;
  return `Wob: ${trimmed}`;
}

function getUserContentText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const role = Reflect.get(message, "role");
  if (role !== "user" && role !== "assistant" && role !== "toolResult") return undefined;
  const content = Reflect.get(message, "content");
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = content
    .filter((p): p is { type?: unknown; text?: unknown } => Boolean(p) && typeof p === "object")
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string);
  return parts.length > 0 ? parts.join("") : undefined;
}

function getMessageRole(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const role = Reflect.get(message, "role");
  return typeof role === "string" ? role : undefined;
}

interface AgentSnapshot {
  ready: boolean;
  streaming: boolean;
  status: string;
  lastError?: string;
  model?: string;
  sessionId?: string;
  sessionFile?: string;
  tokenInput?: number;
  tokenOutput?: number;
  tokenTotal?: number;
  cost?: number;
  messageCount: number;
  messages: ChatMessageEntry[];
}

type Listener = (snapshot: AgentSnapshot) => void;

/** Load prompt fragments from modules-private/wibwob-prompts/*.md, sorted by filename. Falls back to legacy single-file path. */
function loadBasePrompt(): string {
  // Load all .md files from the wibwob-prompts module, sorted by filename.
  // This lets identity.md and other fragments live alongside the machinery file
  // and be rewritten independently without touching the loader.
  const promptsDir = nodePath.join(REPO_ROOT, "modules-private", "wibwob-prompts");
  try {
    const files = fs.readdirSync(promptsDir)
      .filter(f => f.endsWith(".md"))
      .sort();
    if (files.length === 0) throw new Error("no prompt files");
    return files
      .map(f => fs.readFileSync(nodePath.join(promptsDir, f), "utf8").trim())
      .filter(Boolean)
      .join("\n\n");
  } catch {
    // Fallback to the legacy single-file path
    try {
      return fs.readFileSync(SPIKE_PI_APPEND_SYSTEM_PATH, "utf8").trim();
    } catch {
      return [
        "You are Wib & Wob, a two-voice assistant inside WibWob-DOS.",
        "Keep replies concise, helpful, and written as Wib: / Wob: dialog when natural."
      ].join("\n\n");
    }
  }
}

/** Build sender info with the actual agent window id so replies route correctly. */
function buildSenderInfo(windowId: number): string {
  return JSON.stringify({
    sessionName: "wibwob-tui",
    replyVia: "POST http://127.0.0.1:8099/windows/agent-message",
    windowId,
  });
}

/** Create tools for cross-session communication: list_sessions, send_to_session, get_session_message. */
function createPiSessionTools(appendSenderInfo: (message: string) => string): AgentTool<any>[] {
  return [
    {
      name: "list_sessions",
      label: "List Pi Sessions",
      description: "List running pi sessions (wibwob1, wibwob2, etc.) that have a control socket.",
      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: Record<string, never>) {
        const sessions = await listSessions();
        if (sessions.length === 0) return { content: [{ type: "text" as const, text: "No live pi sessions found." }], details: undefined };
        const lines = sessions.map(s => `- ${s.name ?? s.sessionId}${s.name ? ` (${s.sessionId})` : ""}`);
        return { content: [{ type: "text" as const, text: `Live sessions:\n${lines.join("\n")}` }], details: sessions };
      },
    },
    {
      name: "send_to_session",
      label: "Send To Pi Session",
      description: "Send a message to a running pi session (wibwob1 or wibwob2). Use sessionName for named sessions.",
      parameters: Type.Object({
        sessionName: Type.Optional(Type.String({ description: "Session name e.g. wibwob1 or wibwob2" })),
        sessionId: Type.Optional(Type.String({ description: "Session UUID" })),
        message: Type.String({ description: "Message to send" }),
        mode: Type.Optional(Type.Union([Type.Literal("steer"), Type.Literal("follow_up")], { description: "Delivery mode (default: steer)" })),
      }),
      async execute(_toolCallId: string, params: { sessionName?: string; sessionId?: string; message: string; mode?: "steer" | "follow_up" }) {
        const target = params.sessionName ?? params.sessionId;
        if (!target) return { content: [{ type: "text" as const, text: "Provide sessionName or sessionId" }], isError: true, details: undefined };
        const result = await sendToSession(target, appendSenderInfo(params.message), params.mode ?? "steer");
        return { content: [{ type: "text" as const, text: result.ok ? `Message delivered to ${target}` : `Failed: ${result.error}` }], details: result };
      },
    },
    {
      name: "get_session_message",
      label: "Get Pi Session Message",
      description: "Get the last assistant message from a running pi session.",
      parameters: Type.Object({
        sessionName: Type.Optional(Type.String()),
        sessionId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId: string, params: { sessionName?: string; sessionId?: string }) {
        const target = params.sessionName ?? params.sessionId;
        if (!target) return { content: [{ type: "text" as const, text: "Provide sessionName or sessionId" }], isError: true, details: undefined };
        const msg = await getLastMessage(target);
        return { content: [{ type: "text" as const, text: msg ?? "No message found" }], details: { message: msg } };
      },
    },
  ];
}

/** Create play_music and list_music tools backed by the shared AudioPlayerController singleton. */
function createMusicTools(runCommand: TuiToolContext["runCommand"]): AgentTool<any>[] {
  return [
    {
      name: "play_music",
      label: "Play Music",
      description:
        "Play an audio file from scratch/compositions in the background via ffplay, stop current playback, " +
        "or open the full TUI Music Player window. " +
        "Use list_music first to see available tracks. " +
        "Use action=open_window to open the graphical Music Player instead of inline playback.",
      parameters: Type.Object({
        action: Type.Union(
          [Type.Literal("play"), Type.Literal("stop"), Type.Literal("open_window")],
          { description: "play inline, stop current playback, or open_window to open the TUI Music Player" }
        ),
        filePath: Type.Optional(
          Type.String({
            description: "Filename or path relative to scratch/compositions. Used for action=play (inline) or action=open_window (auto-loads the track).",
          })
        ),
      }),
      async execute(_toolCallId: string, params: { action: "play" | "stop" | "open_window"; filePath?: string }) {
        if (params.action === "open_window") {
          const args: Record<string, unknown> = {};
          if (params.filePath?.trim()) args.filePath = params.filePath.trim();
          const result = runCommand("music-player.open", args);
          if (!result.ok) {
            return { isError: true, content: [{ type: "text" as const, text: `Could not open Music Player: ${result.error}` }], details: { error: result.error } };
          }
          const trackNote = params.filePath ? ` Loading: ${nodePath.basename(params.filePath)}` : "";
          return { content: [{ type: "text" as const, text: `Music Player window opened.${trackNote}` }], details: { action: "open_window", filePath: params.filePath } };
        }

        if (params.action === "stop") {
          const snap = await sharedPlayer.stop();
          const text = snap.fileName && snap.fileName !== "(no file)"
            ? `Stopped. (was playing: ${snap.fileName})`
            : "Stopped.";
          return { content: [{ type: "text" as const, text }], details: { action: "stop", ...snap } };
        }

        if (!params.filePath?.trim()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "filePath is required for action=play." }],
            details: { error: "filePath required" },
          };
        }

        try {
          const snap = await sharedPlayer.playFile(params.filePath);
          const duration = snap.duration > 0 ? ` (${fmtTime(snap.duration)})` : "";
          return {
            content: [{ type: "text" as const, text: `Playing ${snap.fileName}${duration}` }],
            details: { action: "play", state: snap.state, fileName: snap.fileName, filePath: snap.filePath, volume: snap.volume },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { isError: true, content: [{ type: "text" as const, text: message }], details: { error: message } };
        }
      },
    },
    {
      name: "list_music",
      label: "List Music Tracks",
      description: "List available audio files in scratch/compositions.",
      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: Record<string, never>) {
        const files = findAudioFiles(COMPOSITIONS_DIR);
        if (files.length === 0) {
          return { content: [{ type: "text" as const, text: "No audio files found in scratch/compositions." }], details: [] };
        }
        const snap = sharedPlayer.getSnapshot();
        const lines = files.map((f, i) => {
          const playing = f === snap.fileName && snap.state !== "stopped" ? ` [${snap.state}]` : "";
          return `${i + 1}. ${f}${playing}`;
        });
        return {
          content: [{ type: "text" as const, text: `Tracks in scratch/compositions:\n${lines.join("\n")}` }],
          details: files,
        };
      },
    },
  ];
}

function loadAgentSystemPrompt(): string {
  return [
    loadBasePrompt(),
    "",
    "You have TUI tools that let you see and control the desktop.",
    "You also have standard coding tools: read, write, edit, bash, grep, find, ls.",
    `All file operations are scoped to ${REPO_ROOT} — you cannot access files outside this directory.`,
    "The desktop state is injected at the start of each turn automatically.",
    "For high-level app actions, prefer the shared command registry path first.",
    "Use tui_list_commands to discover available commands and tui_run_command to execute them.",
    "Examples: opening windows, tiling/cascading, opening Chrome, opening the file manager, opening Wib&Wob Chat or Wib&Wob Agent.",
    "Use low-level TUI tools like tui_open_window, tui_move_window, tui_send_input, tui_read_window, or tui_editor_write only when you need precise control that the registry does not expose.",
    "Use read, write, edit, bash for file operations — no need to use the terminal for these.",
    "You can open terminals, run commands, open primers, arrange windows.",
    "You have play_music and list_music tools for audio playback from scratch/compositions.",
    "The human can type slash commands: /help, /session, /new, /resume, /reload. These are handled locally and never reach you.",
    "This session is logged to a JSONL file. The human can see the path via /session or by clicking the session ID in the info bar.",
  ].join("\n");
}

function loadChatSystemPrompt(): string {
  const base = loadBasePrompt();
  // Strip any tool/desktop instructions that leaked in from APPEND_SYSTEM.md
  const lines = base.split("\n").filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes("tui tool") &&
           !lower.includes("desktop state") &&
           !lower.includes("tui_") &&
           !lower.includes("coding tool");
  });
  return lines.join("\n").trim() || "You are Wib & Wob, a two-voice assistant. Keep replies concise and helpful.";
}

/** Pick the best available model. Prefers Anthropic Sonnet, then Opus, then OpenAI, then Google. */
function resolveModel(params: {
  modelRegistry: ModelRegistry;
  settingsManager: SettingsManager;
}) {
  const available = params.modelRegistry.getAvailable();
  const defaultThinking = params.settingsManager.getDefaultThinkingLevel();
  const preferred: Array<[string, string]> = [
    ["anthropic", "claude-sonnet-4-6"],
    ["anthropic", "claude-opus-4-6"],
    ["openai", "gpt-5.1-codex"],
    ["google", "gemini-2.5-pro"],
  ];
  for (const [provider, id] of preferred) {
    const m = available.find((x) => x.provider === provider && x.id === id);
    if (m) return { model: m, thinkingLevel: defaultThinking ?? ("off" as const) };
  }
  return { model: available[0], thinkingLevel: defaultThinking ?? ("off" as const) };
}

/** Native agent/chat session. Supports "agent" (TUI + coding tools) and "chat" (tools stripped) modes. */
export class WibWobAgentSession {
  private readonly listeners = new Set<Listener>();
  private messages: ChatMessageEntry[] = [];
  private agent?: Agent;
  private session?: AgentSession;
  private ready = false;
  private status = "Starting agent...";
  private lastError?: string;
  private currentAssistantId?: string;
  private lastToolName?: string;
  private readonly sessionId = createMessageId("wibwob-agent");
  private sessionServer?: SessionServerHandle;
  private senderInfo = buildSenderInfo(0);
  private sessionManager?: SessionManager;

  readonly mode: "agent" | "chat";

  constructor(
    private readonly tuiContext: TuiToolContext | null,
    private readonly cwd: string = REPO_ROOT,
    mode: "agent" | "chat" = "agent"
  ) {
    this.mode = mode;
  }

  /** Update the window id used in outbound sender info for session routing. */
  setWindowId(id: number): void {
    this.senderInfo = buildSenderInfo(id);
  }

  /** Path to the JSONL session log file, if persistence is active. */
  getSessionFile(): string | undefined {
    return this.session?.sessionFile ?? this.sessionManager?.getSessionFile() ?? undefined;
  }

  /** Append sender info to an outbound message so recipients can reply via the control API. */
  private withSenderInfo(message: string): string {
    return `${message}\n\n<sender_info>${this.senderInfo}</sender_info>`;
  }

  /** Build the underlying Agent, choose model, inject tools/context, and start the session-control server. */
  async initialize(): Promise<void> {
    if (this.agent) return;

    this.status = this.mode === "agent"
      ? "Starting agent with TUI tools..."
      : "Starting chat...";
    this.emit();

    try {
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const settingsManager = SettingsManager.create(this.cwd, SPIKE_PI_DIR);
      const initial = resolveModel({ modelRegistry, settingsManager });

      if (!initial.model) {
        throw new Error("No model available. Check provider auth.");
      }

      const resourceLoader = new DefaultResourceLoader({
        cwd: this.cwd,
        agentDir: SPIKE_PI_DIR,
        settingsManager,
      });
      await resourceLoader.reload();

      const tuiTools = this.mode === "agent" && this.tuiContext ? createTuiTools(this.tuiContext) : [];
      const jailedCodingTools = this.mode === "agent" ? createJailedCodingTools(REPO_ROOT) : [];
      const piSessionTools = this.mode === "agent" ? createPiSessionTools((msg) => this.withSenderInfo(msg)) : [];
      const musicTools = this.mode === "agent" && this.tuiContext ? createMusicTools(this.tuiContext.runCommand) : [];

      // Tools are registered through AgentSession (customTools + baseToolsOverride),
      // NOT on the raw Agent. Passing tools here would create duplicates.
      const tools: AgentTool<any>[] = [];
      const baseToolsOverride = jailedCodingTools.reduce<Record<string, AgentTool<any>>>((acc, tool) => {
        acc[tool.name] = tool;
        return acc;
      }, {});
      // Music tools are registered by .pi/extensions/music-player.ts — do NOT
      // include them here or AgentSession will see duplicate tool names.
      const customTools = this.mode === "agent" && this.tuiContext
        ? [
            ...createTuiToolDefinitions(this.tuiContext),
            ...toToolDefinitionList(piSessionTools),
          ]
        : [];
      // Activate all tools: jailed coding tools (via baseToolsOverride) + custom tools
      const initialActiveToolNames = [...Object.keys(baseToolsOverride), ...customTools.map(t => t.name)];

      const systemPrompt = this.mode === "agent"
        ? loadAgentSystemPrompt()
        : loadChatSystemPrompt();

      const transformContext = this.mode === "agent" && this.tuiContext
        ? async (messages: import("@mariozechner/pi-agent-core").AgentMessage[]) => {
            const state = this.tuiContext!.getState();
            const summary = formatDesktopSummary(state);
            const stateMessage = {
              role: "user" as const,
              content: `[Current desktop state]\n${summary}`,
              timestamp: Date.now(),
            };
            return [stateMessage, ...messages];
          }
        : undefined;

      // Create a persistent SessionManager so conversation history is saved
      // to ~/.pi/agent/sessions/ as JSONL — same location as regular pi sessions.
      if (!this.sessionManager) {
        this.sessionManager = SessionManager.create(this.cwd);
        log.sys(`session log: ${this.sessionManager.getSessionFile()}`);
      }

      this.agent = new Agent({
        initialState: {
          systemPrompt,
          model: initial.model,
          thinkingLevel: initial.thinkingLevel,
          tools,
          messages: [],
        },
        transformContext,
        sessionId: this.sessionId,
        getApiKey: (provider) => authStorage.getApiKey(provider),
      });

      this.session = new AgentSession({
        agent: this.agent,
        sessionManager: this.sessionManager,
        settingsManager,
        resourceLoader,
        modelRegistry,
        cwd: this.cwd,
        customTools,
        baseToolsOverride: initialActiveToolNames.length > 0 ? baseToolsOverride : undefined,
        initialActiveToolNames: initialActiveToolNames.length > 0 ? initialActiveToolNames : undefined,
      });
      this.session.subscribe((event) => this.handleSessionEvent(event));
      this.ready = true;
      const totalTools = initialActiveToolNames.length;
      this.status = totalTools > 0
        ? `Ready. Tools: ${totalTools}. Model: ${initial.model.provider}/${initial.model.id}`
        : `Ready. Model: ${initial.model.provider}/${initial.model.id}`;
      this.lastError = undefined;

      // Start the session control server so wibwob-tui appears in list_sessions
      if (!this.sessionServer) {
        const self = this;
        try {
          this.sessionServer = startSessionServer({
            sessionId: this.sessionId,
            send: (text, sender) => self.send(text, sender),
            getLastReply: () => self.getLastReply(),
            abort: () => {
              void self.abort();
            },
            reset: () => {
              void self.reset();
            },
          });
        } catch (e) {
          // Non-fatal — agent runs fine without peer socket
          console.error("[wibwob-agent-session] could not start session server:", e);
        }
      }

      this.emit();
    } catch (error) {
      this.ready = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.status = "Startup failed.";
      this.messages.push({
        id: createMessageId("status"),
        role: "status",
        text: `Agent startup failed: ${this.lastError}`,
      });
      this.emit();
    }
  }

  getLastReply(): string | null {
    const msgs = this.messages.filter(m => m.role === "assistant" && !m.streaming && m.text);
    return msgs.length > 0 ? msgs[msgs.length - 1].text : null;
  }

  async reload(): Promise<boolean> {
    if (!this.session) return false;
    await this.session.reload();
    this.status = "Ready.";
    this.lastError = undefined;
    this.emit();
    return true;
  }

  dispose(): void {
    this.sessionServer?.close();
    this.sessionServer = undefined;
    this.session?.dispose();
    this.session = undefined;
    this.agent?.abort();
    this.agent = undefined;
    this.ready = false;
    this.status = "Closed.";
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): AgentSnapshot {
    const model = this.session?.model ?? this.agent?.state.model;
    const stats = this.session?.getSessionStats();
    return {
      ready: this.ready,
      streaming: this.session?.isStreaming ?? this.agent?.state.isStreaming ?? false,
      status: this.buildStatus(),
      lastError: this.lastError,
      model: model ? `${model.provider}/${model.id}` : undefined,
      sessionId: this.session?.sessionId ?? this.sessionId,
      sessionFile: stats?.sessionFile ?? this.session?.sessionFile ?? this.sessionManager?.getSessionFile() ?? undefined,
      tokenInput: stats?.tokens.input,
      tokenOutput: stats?.tokens.output,
      tokenTotal: stats?.tokens.total,
      cost: stats?.cost,
      messageCount: this.messages.length,
      messages: this.messages.map((m) => ({ ...m })),
    };
  }

  /** Abort in-flight streaming. Returns true if something was aborted. */
  async abort(): Promise<boolean> {
    if (!this.session?.isStreaming) return false;
    await this.session.abort();
    this.status = "Aborted.";
    this.emit();
    return true;
  }

  /** Clear the transcript without resetting the session or model. */
  clearTranscript(): void {
    this.messages = [];
    this.currentAssistantId = undefined;
    this.lastToolName = undefined;
    this.lastError = undefined;
    this.status = "Ready.";
    this.emit();
  }

  /** List names of all registered tools. */
  getToolNames(): string[] {
    return this.session?.getActiveToolNames() ?? this.agent?.state.tools?.map((t) => t.name) ?? [];
  }

  getSessionStats(): SessionStats | undefined {
    return this.session?.getSessionStats();
  }

  async reset(): Promise<void> {
    if (!this.session || this.session.isStreaming) return; // don't reset mid-stream
    await this.session.newSession();
    this.messages = [];
    this.currentAssistantId = undefined;
    this.lastToolName = undefined;
    this.lastError = undefined;
    this.status = "Ready.";
    this.emit();
  }

  pushStatus(text: string): void {
    this.messages.push({
      id: createMessageId("status"),
      role: "status",
      text,
    });
    this.emit();
  }

  async resume(sessionPath: string): Promise<void> {
    if (!this.session) await this.initialize();
    if (!this.session) throw new Error("Agent session was not created");
    if (this.session.isStreaming) {
      throw new Error("Cannot resume while the agent is streaming.");
    }

    this.messages = [];
    this.currentAssistantId = undefined;
    this.lastToolName = undefined;
    this.lastError = undefined;
    const switched = await this.session.switchSession(sessionPath);
    if (!switched) throw new Error("Session switch was cancelled.");
    const loadedMessageCount = this.session.state.messages.length;
    this.messages.push({
      id: createMessageId("system"),
      role: "status",
      text: `[resumed] Session loaded — ${loadedMessageCount} messages`,
    });
    this.status = "Ready.";
    this.emit();
  }

  /** Enqueue a user message, create an optimistic assistant placeholder, and stream the response. */
  async send(text: string, sender?: string): Promise<void> {
    const msg = text.trim();
    if (!msg) return;

    if (!this.session) await this.initialize();
    if (!this.session) throw new Error("Agent session was not created");

    const from = sender ? `[${sender}]` : "user";
    const preview = msg.length > 80 ? msg.slice(0, 77) + "..." : msg;
    log.msg(`${from} → ${preview}`);

    this.messages.push({ id: createMessageId("user"), role: "user", text: msg, sender });
    this.currentAssistantId = createMessageId("assistant");
    this.messages.push({
      id: this.currentAssistantId,
      role: "assistant",
      text: "",
      streaming: true,
    });
    this.status = "Thinking...";
    this.lastError = undefined;
    this.emit();

    try {
      if (this.session.isStreaming) {
        await this.session.followUp(msg);
      } else {
        await this.session.prompt(msg);
      }
    } catch (error) {
      const assistant = this.findCurrentAssistant();
      if (assistant && !assistant.text.trim()) {
        assistant.text = `Wob: Something went wrong.\nWib: ${error instanceof Error ? error.message : String(error)}`;
        assistant.streaming = false;
      }
      this.status = "Error.";
      this.lastError = error instanceof Error ? error.message : String(error);
      this.currentAssistantId = undefined;
      this.emit();
    }
  }

  captureText(): string {
    const header = this.mode === "agent" ? "WIB&WOB AGENT" : "WIB&WOB CHAT";
    const parts = [header, `Status: ${this.buildStatus()}`, ""];
    for (const m of this.messages) {
      const prefix =
        m.role === "user" ? "You: " : m.role === "status" ? "[status] " : "";
      parts.push(`${prefix}${m.text || (m.streaming ? "..." : "")}`.trimEnd(), "");
    }
    return parts.join("\n").trimEnd();
  }

  private buildStatus(): string {
    const tool = this.lastToolName ? ` [${this.lastToolName}]` : "";
    return `${this.status}${tool}`.trim();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private findCurrentAssistant(): ChatMessageEntry | undefined {
    return this.currentAssistantId
      ? this.messages.find((m) => m.id === this.currentAssistantId)
      : undefined;
  }

  /** Translate low-level agent events into chat transcript entries and visible session status. */
  private handleSessionEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case "message_start": {
        if (getMessageRole(event.message) !== "assistant" || this.findCurrentAssistant()) return;
        this.currentAssistantId = createMessageId("assistant");
        this.messages.push({
          id: this.currentAssistantId,
          role: "assistant",
          text: "",
          streaming: true,
        });
        this.status = "Streaming...";
        this.emit();
        return;
      }
      case "message_update": {
        if (event.assistantMessageEvent.type !== "text_delta") return;
        const a = this.findCurrentAssistant();
        if (!a) {
          this.currentAssistantId = createMessageId("assistant");
          this.messages.push({
            id: this.currentAssistantId,
            role: "assistant",
            text: event.assistantMessageEvent.delta,
            streaming: true,
          });
        } else {
          a.text += event.assistantMessageEvent.delta;
        }
        this.status = "Streaming...";
        this.emit();
        return;
      }
      case "tool_execution_start":
        this.lastToolName = event.toolName;
        this.status = `Running ${event.toolName}...`;
        this.messages.push({
          id: createMessageId("tool"),
          role: "status",
          text: `[tool] ${formatToolCall(event.toolName, event.args)}`,
        });
        this.emit();
        return;
      case "tool_execution_end": {
        const summary = event.isError
          ? `[fail] ${event.toolName}`
          : `[done] ${event.toolName}${formatToolResult(event.result)}`;
        this.messages.push({
          id: createMessageId("tool-result"),
          role: "status",
          text: summary,
        });
        this.status = event.isError
          ? `Tool ${event.toolName} failed.`
          : `Tool ${event.toolName} done.`;
        this.emit();
        return;
      }
      case "message_end": {
        if (getMessageRole(event.message) !== "assistant") return;
        const a = this.findCurrentAssistant();
        if (a) {
          a.text = normalizeVisibleReply(getUserContentText(event.message) || a.text);
          a.streaming = false;
          this.status = "Ready.";
          this.emit();
        }
        return;
      }
      case "turn_end": {
        // Surface API errors (e.g. context too long, rate limit, auth failure)
        const turnMsg = event.message as unknown as Record<string, unknown>;
        if (turnMsg?.errorMessage) {
          const errText = String(turnMsg.errorMessage);
          const a = this.findCurrentAssistant();
          if (a && !a.text.trim()) {
            a.text = `Wob: API error.\nWib: ${errText}`;
            a.streaming = false;
          }
          this.status = "Error.";
          this.lastError = errText;
          this.currentAssistantId = undefined;
          this.emit();
        }
        return;
      }
      case "auto_compaction_start": {
        this.status = "Compacting...";
        this.messages.push({
          id: createMessageId("compact"),
          role: "status",
          text: `[compact] start (${event.reason})`,
        });
        this.emit();
        return;
      }
      case "auto_compaction_end": {
        const detail = event.aborted
          ? "aborted"
          : event.result?.summary
            ? "ok"
            : "no-op";
        this.messages.push({
          id: createMessageId("compact"),
          role: "status",
          text: `[compact] end (${detail})${event.willRetry ? " — retrying" : ""}${event.errorMessage ? ` — ${event.errorMessage}` : ""}`,
        });
        this.status = event.errorMessage ? "Error." : "Ready.";
        if (event.errorMessage) this.lastError = event.errorMessage;
        this.emit();
        return;
      }
      case "auto_retry_start": {
        this.status = "Retrying...";
        this.messages.push({
          id: createMessageId("retry"),
          role: "status",
          text: `[retry] ${event.attempt}/${event.maxAttempts} in ${event.delayMs}ms — ${event.errorMessage}`,
        });
        this.emit();
        return;
      }
      case "auto_retry_end": {
        this.messages.push({
          id: createMessageId("retry"),
          role: "status",
          text: event.success
            ? `[retry] success on attempt ${event.attempt}`
            : `[retry] failed on attempt ${event.attempt}${event.finalError ? ` — ${event.finalError}` : ""}`,
        });
        this.status = event.success ? "Ready." : "Error.";
        if (!event.success && event.finalError) this.lastError = event.finalError;
        this.emit();
        return;
      }
      case "agent_end": {
        const a = this.findCurrentAssistant();
        if (a) {
          a.text = normalizeVisibleReply(a.text);
          a.streaming = false;
        }
        this.currentAssistantId = undefined;
        this.lastToolName = undefined;
        this.status = "Ready.";
        this.emit();
        return;
      }
    }
  }
}
