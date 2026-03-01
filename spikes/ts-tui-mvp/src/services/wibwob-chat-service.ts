import fs from "node:fs";

import { Agent, type AgentEvent, type ThinkingLevel } from "@mariozechner/pi-agent-core";
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

import {
  REPO_ROOT,
  SPIKE_PI_APPEND_SYSTEM_PATH,
  SPIKE_PI_DIR
} from "../core/config.js";
import type { ChatMessageEntry } from "../core/types.js";

interface WibWobChatSnapshot {
  ready: boolean;
  streaming: boolean;
  status: string;
  lastError?: string;
  model?: string;
  sessionId?: string;
  messageCount: number;
  messages: ChatMessageEntry[];
}

type Listener = (snapshot: WibWobChatSnapshot) => void;

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVisibleReply(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Wob: …";
  }
  if (/(^|\n)\s*(Wib|Wob):/i.test(trimmed)) {
    return trimmed;
  }
  return `Wob: ${trimmed}`;
}

function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(SPIKE_PI_APPEND_SYSTEM_PATH, "utf8").trim();
  } catch {
    return [
      "You are Wib & Wob, a two-voice assistant inside WibWob-DOS.",
      "Keep replies concise, helpful, and written as Wib: / Wob: dialog when natural."
    ].join("\n\n");
  }
}

function resolveInitialModel(params: {
  modelRegistry: ModelRegistry;
  settingsManager: SettingsManager;
}): {
  model?: ReturnType<ModelRegistry["getAll"]>[number];
  thinkingLevel: ThinkingLevel;
} {
  const availableModels = params.modelRegistry.getAvailable();
  const defaultProvider = params.settingsManager.getDefaultProvider();
  const defaultModelId = params.settingsManager.getDefaultModel();
  const defaultThinkingLevel = params.settingsManager.getDefaultThinkingLevel();
  const preferredModels: Array<[string, string]> = [
    ["anthropic", "claude-sonnet-4-6"],
    ["anthropic", "claude-opus-4-6"],
    ["openai", "gpt-5.1-codex"],
    ["google", "gemini-2.5-pro"],
    ["openrouter", "openai/gpt-5.1-codex"],
    ["vercel-ai-gateway", "anthropic/claude-opus-4-6"]
  ];

  for (const [provider, modelId] of preferredModels) {
    const preferred = availableModels.find((model) => model.provider === provider && model.id === modelId);
    if (preferred) {
      return {
        model: preferred,
        thinkingLevel: defaultThinkingLevel ?? "off"
      };
    }
  }

  if (defaultProvider && defaultModelId) {
    const found = params.modelRegistry.find(defaultProvider, defaultModelId);
    if (found && availableModels.some((model) => model.provider === found.provider && model.id === found.id)) {
      return {
        model: found,
        thinkingLevel: defaultThinkingLevel ?? "off"
      };
    }
  }

  return {
    model: availableModels[0],
    thinkingLevel: defaultThinkingLevel ?? "off"
  };
}

function getUserContentText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const role = Reflect.get(message, "role");
  if (role !== "user" && role !== "assistant" && role !== "toolResult") {
    return undefined;
  }
  const content = Reflect.get(message, "content");
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  const textParts = content
    .filter((part): part is { type?: unknown; text?: unknown } => Boolean(part) && typeof part === "object")
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);
  return textParts.length > 0 ? textParts.join("") : undefined;
}

function getMessageRole(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const role = Reflect.get(message, "role");
  return typeof role === "string" ? role : undefined;
}

export class WibWobChatSession {
  private readonly listeners = new Set<Listener>();
  private readonly messages: ChatMessageEntry[] = [];
  private agent?: Agent;
  private ready = false;
  private status = "Starting Pi agent...";
  private lastError?: string;
  private currentAssistantId?: string;
  private lastToolName?: string;
  private readonly sessionId = createMessageId("wibwob-chat");

  constructor(private readonly cwd: string = REPO_ROOT) {}

  hydrate(state: { messages?: ChatMessageEntry[] }): void {
    if (Array.isArray(state.messages) && state.messages.length > 0) {
      this.messages.length = 0;
      this.messages.push(...state.messages.map((message) => ({ ...message, streaming: false })));
    }
    this.emit();
  }

  async initialize(): Promise<void> {
    if (this.agent) {
      return;
    }

    this.status = "Starting Pi agent...";
    this.emit();

    try {
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const settingsManager = SettingsManager.create(this.cwd, SPIKE_PI_DIR);
      const initialModel = resolveInitialModel({ modelRegistry, settingsManager });

      if (!initialModel.model) {
        throw new Error("No Pi model is available. Check provider auth/config.");
      }

      this.agent = new Agent({
        initialState: {
          systemPrompt: loadSystemPrompt(),
          model: initialModel.model,
          thinkingLevel: initialModel.thinkingLevel,
          messages: []
        },
        sessionId: this.sessionId,
        getApiKey: (provider) => authStorage.getApiKey(provider)
      });
      this.agent.subscribe((event) => this.handleEvent(event));
      this.ready = true;
      this.status = "Ready.";
      this.lastError = undefined;
      this.emit();
    } catch (error) {
      this.ready = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.status = "Startup failed.";
      this.messages.push({
        id: createMessageId("status"),
        role: "status",
        text: `Chat startup failed: ${this.lastError}`
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

  getSnapshot(): WibWobChatSnapshot {
    return {
      ready: this.ready,
      streaming: this.agent?.state.isStreaming ?? false,
      status: this.buildStatus(),
      lastError: this.lastError,
      model: this.agent?.state.model ? `${this.agent.state.model.provider}/${this.agent.state.model.id}` : undefined,
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      messages: this.messages.map((message) => ({ ...message }))
    };
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message) {
      return;
    }

    if (!this.agent) {
      await this.initialize();
    }
    if (!this.agent) {
      throw new Error("Pi agent was not created");
    }

    this.messages.push({
      id: createMessageId("user"),
      role: "user",
      text: message
    });
    this.currentAssistantId = createMessageId("assistant");
    this.messages.push({
      id: this.currentAssistantId,
      role: "assistant",
      text: "",
      streaming: true
    });
    this.status = "Waiting for Wib & Wob...";
    this.lastError = undefined;
    this.emit();

    try {
      if (this.agent.state.isStreaming) {
        this.agent.followUp({
          role: "user",
          content: [{ type: "text", text: message }],
          timestamp: Date.now()
        });
        await this.agent.waitForIdle();
      } else {
        await this.agent.prompt(message);
      }
    } catch (error) {
      const assistant = this.findCurrentAssistant();
      if (assistant && !assistant.text.trim()) {
        assistant.text = `Wob: The chat stalled.\nWib: ${error instanceof Error ? error.message : String(error)}`;
        assistant.streaming = false;
      }
      this.status = "Error.";
      this.lastError = error instanceof Error ? error.message : String(error);
      this.currentAssistantId = undefined;
      this.emit();
    }
  }

  captureText(): string {
    const parts: string[] = [];
    parts.push("WIB&WOB CHAT");
    parts.push(`Status: ${this.buildStatus()}`);
    const model = this.agent?.state.model ? `${this.agent.state.model.provider}/${this.agent.state.model.id}` : "unselected";
    parts.push(`Model: ${model}`);
    parts.push("");
    for (const message of this.messages) {
      const prefix =
        message.role === "user"
          ? "You: "
          : message.role === "assistant"
            ? ""
            : message.role === "status"
              ? "[status] "
              : "[system] ";
      const text = message.text || (message.streaming ? "..." : "");
      parts.push(`${prefix}${text}`.trimEnd());
      parts.push("");
    }
    return parts.join("\n").trimEnd();
  }

  private buildStatus(): string {
    const tool = this.lastToolName ? ` Tool:${this.lastToolName}` : "";
    return `${this.status}${tool}`.trim();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private findCurrentAssistant(): ChatMessageEntry | undefined {
    return this.currentAssistantId ? this.messages.find((message) => message.id === this.currentAssistantId) : undefined;
  }

  private handleEvent(event: AgentEvent): void {
    switch (event.type) {
      case "message_start": {
        if (getMessageRole(event.message) !== "assistant" || this.findCurrentAssistant()) {
          return;
        }
        this.currentAssistantId = createMessageId("assistant");
        this.messages.push({
          id: this.currentAssistantId,
          role: "assistant",
          text: "",
          streaming: true
        });
        this.status = "Streaming...";
        this.emit();
        return;
      }
      case "message_update": {
        if (event.assistantMessageEvent.type !== "text_delta") {
          return;
        }
        const assistant = this.findCurrentAssistant();
        if (!assistant) {
          this.currentAssistantId = createMessageId("assistant");
          this.messages.push({
            id: this.currentAssistantId,
            role: "assistant",
            text: event.assistantMessageEvent.delta,
            streaming: true
          });
        } else {
          assistant.text += event.assistantMessageEvent.delta;
        }
        this.status = "Streaming...";
        this.emit();
        return;
      }
      case "tool_execution_start":
        this.lastToolName = event.toolName;
        this.status = `Running ${event.toolName}...`;
        this.emit();
        return;
      case "tool_execution_end":
        this.status = event.isError ? `Tool ${event.toolName} failed.` : `Tool ${event.toolName} finished.`;
        this.emit();
        return;
      case "message_end": {
        if (getMessageRole(event.message) !== "assistant") {
          return;
        }
        const assistant = this.findCurrentAssistant();
        if (assistant) {
          assistant.text = normalizeVisibleReply(getUserContentText(event.message) || assistant.text);
          assistant.streaming = false;
          this.status = "Ready.";
          this.emit();
        }
        return;
      }
      case "agent_end": {
        const assistant = this.findCurrentAssistant();
        if (assistant) {
          assistant.text = normalizeVisibleReply(assistant.text);
          assistant.streaming = false;
        }
        this.currentAssistantId = undefined;
        this.lastToolName = undefined;
        this.status = "Ready.";
        this.emit();
        return;
      }
      default:
        return;
    }
  }
}

export class WibWobChatService {
  createSession(cwd: string = REPO_ROOT): WibWobChatSession {
    return new WibWobChatSession(cwd);
  }
}
