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
import { createTuiTools, formatDesktopSummary, type TuiToolContext } from "./agent-tools.js";
import fs from "node:fs";

// Re-use helpers from wibwob-chat-service without importing the class
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

function loadAgentSystemPrompt(): string {
  const base = (() => {
    try {
      return fs.readFileSync(SPIKE_PI_APPEND_SYSTEM_PATH, "utf8").trim();
    } catch {
      return [
        "You are Wib & Wob, a two-voice assistant inside WibWob-DOS.",
        "Keep replies concise, helpful, and written as Wib: / Wob: dialog when natural."
      ].join("\n\n");
    }
  })();

  return [
    base,
    "",
    "You have TUI tools that let you see and control the desktop.",
    "The desktop state is injected at the start of each turn automatically.",
    "Use tui_open_window, tui_send_input, tui_read_window etc to help the user.",
    "You can open terminals, run commands, open primers, arrange windows.",
  ].join("\n");
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
  private readonly messages: ChatMessageEntry[] = [];
  private agent?: Agent;
  private ready = false;
  private status = "Starting agent...";
  private lastError?: string;
  private currentAssistantId?: string;
  private lastToolName?: string;
  private readonly sessionId = createMessageId("wibwob-agent");

  constructor(
    private readonly tuiContext: TuiToolContext,
    private readonly cwd: string = REPO_ROOT
  ) {}

  async initialize(): Promise<void> {
    if (this.agent) return;

    this.status = "Starting agent with TUI tools...";
    this.emit();

    try {
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const settingsManager = SettingsManager.create(this.cwd, SPIKE_PI_DIR);
      const initial = resolveModel({ modelRegistry, settingsManager });

      if (!initial.model) {
        throw new Error("No model available. Check provider auth.");
      }

      const tools = createTuiTools(this.tuiContext);

      this.agent = new Agent({
        initialState: {
          systemPrompt: loadAgentSystemPrompt(),
          model: initial.model,
          thinkingLevel: initial.thinkingLevel,
          tools,
          messages: [],
        },
        transformContext: async (messages) => {
          // Inject desktop state as a user message at the start of context
          const state = this.tuiContext.getState();
          const summary = formatDesktopSummary(state);
          const stateMessage = {
            role: "user" as const,
            content: `[Current desktop state]\n${summary}`,
            timestamp: Date.now(),
          };
          return [stateMessage, ...messages];
        },
        sessionId: this.sessionId,
        getApiKey: (provider) => authStorage.getApiKey(provider),
      });

      this.agent.subscribe((event) => this.handleEvent(event));
      this.ready = true;
      this.status = `Ready. Tools: ${tools.length}. Model: ${initial.model.provider}/${initial.model.id}`;
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

  async send(text: string): Promise<void> {
    const msg = text.trim();
    if (!msg) return;

    if (!this.agent) await this.initialize();
    if (!this.agent) throw new Error("Agent was not created");

    this.messages.push({ id: createMessageId("user"), role: "user", text: msg });
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
    const parts = ["WIB&WOB AGENT", `Status: ${this.buildStatus()}`, ""];
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
        // Add tool call to transcript
        this.messages.push({
          id: createMessageId("tool"),
          role: "status",
          text: `[tool] ${event.toolName}(${JSON.stringify(event.args).slice(0, 80)})`,
        });
        this.emit();
        return;
      case "tool_execution_end":
        this.status = event.isError
          ? `Tool ${event.toolName} failed.`
          : `Tool ${event.toolName} done.`;
        this.emit();
        return;
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
