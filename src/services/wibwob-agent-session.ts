/**
 * WibWobAgentSession — a WibWobChatSession with TUI tools.
 *
 * Extends the base chat session so the agent can see and manipulate
 * the desktop. Desktop state is injected automatically every turn
 * via transformContext, and TUI tools are registered via setTools.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

import { REPO_ROOT, SPIKE_PI_APPEND_SYSTEM_PATH, SPIKE_PI_DIR } from "../core/config.js";
import type { ChatMessageEntry, DesktopState } from "../core/types.js";
import { Type } from "@sinclair/typebox";
import { createTuiTools, formatDesktopSummary, type TuiToolContext } from "./agent-tools.js";
import { listSessions, sendToSession, getLastMessage } from "./pi-session-bridge.js";
import {
  createBashTool,
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";
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

function createJailedCodingTools(jail: string) {
  const jailedRead = createReadTool(jail, {
    operations: {
      readFile: async (p) => { jailPath(p, jail); return readFile(p); },
      access: async (p) => { jailPath(p, jail); await access(p, constants.R_OK); },
    },
  });

  const jailedWrite = createWriteTool(jail, {
    operations: {
      writeFile: async (p, content) => { jailPath(p, jail); await writeFile(p, content, "utf8"); },
      mkdir: async (dir) => { jailPath(dir, jail); await mkdir(dir, { recursive: true }); },
    },
  });

  const jailedEdit = createEditTool(jail, {
    operations: {
      readFile: async (p) => { jailPath(p, jail); return readFile(p); },
      writeFile: async (p, content) => { jailPath(p, jail); await writeFile(p, content, "utf8"); },
      access: async (p) => { jailPath(p, jail); await access(p, constants.R_OK | constants.W_OK); },
    },
  });

  const jailedBash = createBashTool(jail, {
    spawnHook: (ctx) => {
      // Force cwd inside jail
      const cwd = ctx.cwd ?? jail;
      const jailedCwd = cwd.startsWith(jail) ? cwd : jail;
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
    default: {
      const j = JSON.stringify(args);
      return `${name}(${j.length > 50 ? j.slice(0, 47) + "..." : j})`;
    }
  }
}

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
  messageCount: number;
  messages: ChatMessageEntry[];
}

type Listener = (snapshot: AgentSnapshot) => void;

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

function createPiSessionTools() {
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
        const result = await sendToSession(target, params.message, params.mode ?? "steer");
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

export class WibWobAgentSession {
  private readonly listeners = new Set<Listener>();
  private messages: ChatMessageEntry[] = [];
  private agent?: Agent;
  private ready = false;
  private status = "Starting agent...";
  private lastError?: string;
  private currentAssistantId?: string;
  private lastToolName?: string;
  private readonly sessionId = createMessageId("wibwob-agent");

  readonly mode: "agent" | "chat";

  constructor(
    private readonly tuiContext: TuiToolContext | null,
    private readonly cwd: string = REPO_ROOT,
    mode: "agent" | "chat" = "agent"
  ) {
    this.mode = mode;
  }

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

      const tools = this.mode === "agent" && this.tuiContext
        ? [...createTuiTools(this.tuiContext), ...createJailedCodingTools(REPO_ROOT), ...createPiSessionTools()]
        : [];

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

      this.agent.subscribe((event) => this.handleEvent(event));
      this.ready = true;
      this.status = tools.length > 0
        ? `Ready. Tools: ${tools.length}. Model: ${initial.model.provider}/${initial.model.id}`
        : `Ready. Model: ${initial.model.provider}/${initial.model.id}`;
      this.lastError = undefined;
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

  dispose(): void {
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
    return {
      ready: this.ready,
      streaming: this.agent?.state.isStreaming ?? false,
      status: this.buildStatus(),
      lastError: this.lastError,
      model: this.agent?.state.model
        ? `${this.agent.state.model.provider}/${this.agent.state.model.id}`
        : undefined,
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      messages: this.messages.map((m) => ({ ...m })),
    };
  }

  reset(): void {
    if (this.agent?.state.isStreaming) return; // don't reset mid-stream
    this.messages = [];
    this.currentAssistantId = undefined;
    this.lastToolName = undefined;
    this.lastError = undefined;
    this.status = "Ready.";
    // Re-create the agent so context is fresh
    this.agent?.abort();
    this.agent = undefined;
    this.emit();
  }

  async send(text: string, sender?: string): Promise<void> {
    const msg = text.trim();
    if (!msg) return;

    if (!this.agent) await this.initialize();
    if (!this.agent) throw new Error("Agent was not created");

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
      if (this.agent.state.isStreaming) {
        this.agent.followUp({
          role: "user",
          content: [{ type: "text", text: msg }],
          timestamp: Date.now(),
        });
        await this.agent.waitForIdle();
      } else {
        await this.agent.prompt(msg);
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

  private handleEvent(event: import("@mariozechner/pi-agent-core").AgentEvent): void {
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
