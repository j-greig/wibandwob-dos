import {
  AuthStorage,
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent
} from "@mariozechner/pi-coding-agent";

import { REPO_ROOT, SPIKE_PI_APPEND_SYSTEM_PATH, SPIKE_PI_DIR } from "../core/config.js";
import type {
  ChatMessageEntry,
  ChatTaskItem,
  ChatTaskLoop,
  ChatTaskStory
} from "../core/types.js";

interface WibWobChatSnapshot {
  ready: boolean;
  streaming: boolean;
  status: string;
  lastError?: string;
  model?: string;
  sessionId?: string;
  messageCount: number;
  taskLoop?: ChatTaskLoop;
  messages: ChatMessageEntry[];
}

type Listener = (snapshot: WibWobChatSnapshot) => void;

const TASK_LOOP_INSTRUCTIONS = `Before your visible reply, emit exactly one task loop block in this format:
<task_loop>
{"stories":[{"title":"...","description":"...","status":"pending","items":[{"title":"...","description":"...","status":"pending"}]}]}
</task_loop>

Rules:
- use valid JSON only inside the tags
- statuses are only "pending" or "passed"
- keep the loop compact and update it every turn
- if the request is conversational, still emit one minimal story called "Conversation"
- after the closing tag, write the user-facing reply in plain text with Wib: and Wob: speaker markers
- do not mention the task loop unless the user asks for it`;

function buildPromptMessage(userMessage: string): string {
  return `${TASK_LOOP_INSTRUCTIONS}

User request:
${userMessage}`;
}

function buildFallbackTaskLoop(userMessage: string): ChatTaskLoop {
  const summary = userMessage.replace(/\s+/g, " ").trim() || "Conversation";
  const short = summary.length > 56 ? `${summary.slice(0, 53)}...` : summary;
  return {
    stories: [
      {
        title: "Conversation",
        description: short,
        status: "pending",
        items: [
          {
            title: "Respond to user",
            description: short,
            status: "pending"
          }
        ]
      }
    ]
  };
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTaskItem(value: unknown): ChatTaskItem | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  const status = item.status === "passed" ? "passed" : item.status === "pending" ? "pending" : undefined;
  if (typeof item.title !== "string" || typeof item.description !== "string" || !status) {
    return undefined;
  }
  return {
    title: item.title,
    description: item.description,
    status
  };
}

function normalizeTaskStory(value: unknown): ChatTaskStory | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const story = value as Record<string, unknown>;
  const status = story.status === "passed" ? "passed" : story.status === "pending" ? "pending" : undefined;
  if (typeof story.title !== "string" || typeof story.description !== "string" || !status || !Array.isArray(story.items)) {
    return undefined;
  }
  const items = story.items.map((item) => normalizeTaskItem(item)).filter((item): item is ChatTaskItem => Boolean(item));
  if (items.length === 0) {
    return undefined;
  }
  return {
    title: story.title,
    description: story.description,
    status,
    items
  };
}

function extractTaskLoop(text: string): { visibleText: string; taskLoop?: ChatTaskLoop } {
  const match = text.match(/<task_loop>\s*([\s\S]*?)\s*<\/task_loop>/i);
  if (!match) {
    return { visibleText: text.trim() };
  }

  let taskLoop: ChatTaskLoop | undefined;
  try {
    const parsed = JSON.parse(match[1]) as { stories?: unknown[] };
    const stories = Array.isArray(parsed.stories)
      ? parsed.stories
          .map((story) => normalizeTaskStory(story))
          .filter((story): story is ChatTaskStory => Boolean(story))
      : [];
    if (stories.length > 0) {
      taskLoop = { stories };
    }
  } catch {
    taskLoop = undefined;
  }

  const visibleText = text.replace(match[0], "").trim();
  return {
    visibleText,
    taskLoop
  };
}

function normalizeVisibleReply(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Wib: …\nWob: The line went missing.";
  }
  if (/(^|\n)\s*(Wib|Wob):/i.test(trimmed)) {
    return trimmed;
  }
  return `Wob: ${trimmed}`;
}

export class WibWobChatSession {
  private readonly listeners = new Set<Listener>();
  private readonly messages: ChatMessageEntry[] = [];
  private session?: AgentSession;
  private ready = false;
  private status = "Starting Pi SDK session...";
  private lastError?: string;
  private taskLoop?: ChatTaskLoop;
  private currentAssistantId?: string;
  private unsubscribe?: () => void;
  private lastToolName?: string;

  constructor(private readonly cwd: string = REPO_ROOT) {}

  hydrate(state: { messages?: ChatMessageEntry[]; taskLoop?: ChatTaskLoop }): void {
    if (Array.isArray(state.messages) && state.messages.length > 0) {
      this.messages.length = 0;
      this.messages.push(...state.messages.map((message) => ({ ...message, streaming: false })));
    }
    if (state.taskLoop) {
      this.taskLoop = state.taskLoop;
    }
    this.emit();
  }

  async initialize(): Promise<void> {
    if (this.session) {
      return;
    }

    this.status = "Starting Pi SDK session...";
    this.emit();

    try {
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const settingsManager = SettingsManager.create(this.cwd, SPIKE_PI_DIR);
      const resourceLoader = new DefaultResourceLoader({
        cwd: this.cwd,
        agentDir: SPIKE_PI_DIR,
        settingsManager,
        appendSystemPrompt: SPIKE_PI_APPEND_SYSTEM_PATH,
        appendSystemPromptOverride: (base) => [...base, TASK_LOOP_INSTRUCTIONS],
        noThemes: true
      });

      const { session, modelFallbackMessage } = await createAgentSession({
        cwd: this.cwd,
        agentDir: SPIKE_PI_DIR,
        authStorage,
        modelRegistry,
        settingsManager,
        resourceLoader,
        tools: createCodingTools(this.cwd),
        sessionManager: SessionManager.inMemory(this.cwd)
      });

      this.session = session;
      this.ready = true;
      this.status = modelFallbackMessage ?? "Ready.";
      this.lastError = undefined;
      this.unsubscribe = session.subscribe((event) => this.handleEvent(event));
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
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.session?.dispose();
    this.session = undefined;
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
      streaming: this.session?.isStreaming ?? false,
      status: this.buildStatus(),
      lastError: this.lastError,
      model: this.session?.model ? `${this.session.model.provider}/${this.session.model.id}` : undefined,
      sessionId: this.session?.sessionId,
      messageCount: this.messages.length,
      taskLoop: this.taskLoop,
      messages: this.messages.map((message) => ({ ...message }))
    };
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message) {
      return;
    }

    if (!this.session) {
      await this.initialize();
    }
    if (!this.session) {
      throw new Error("Pi SDK session was not created");
    }

    this.messages.push({
      id: createMessageId("user"),
      role: "user",
      text: message
    });
    this.taskLoop = buildFallbackTaskLoop(message);
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
      if (this.session.isStreaming) {
        await this.session.prompt(buildPromptMessage(message), { streamingBehavior: "followUp" });
      } else {
        await this.session.prompt(buildPromptMessage(message));
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
    parts.push("WIB&WOB CHAT V2");
    parts.push(`Status: ${this.buildStatus()}`);
    const model = this.session?.model ? `${this.session.model.provider}/${this.session.model.id}` : "unselected";
    parts.push(`Model: ${model}`);
    parts.push("");
    parts.push("TASK LOOP");
    if (this.taskLoop?.stories.length) {
      for (const story of this.taskLoop.stories) {
        parts.push(`[${story.status}] ${story.title} — ${story.description}`);
        for (const item of story.items) {
          parts.push(`  - [${item.status}] ${item.title} — ${item.description}`);
        }
      }
    } else {
      parts.push("(no task loop yet)");
    }
    parts.push("");
    parts.push("TRANSCRIPT");
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

  private handleEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") {
          return;
        }
        if (!this.findCurrentAssistant()) {
          this.currentAssistantId = createMessageId("assistant");
          this.messages.push({
            id: this.currentAssistantId,
            role: "assistant",
            text: "",
            streaming: true
          });
        }
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
      case "agent_end": {
        const assistant = this.findCurrentAssistant();
        if (assistant) {
          const extracted = extractTaskLoop(assistant.text);
          assistant.text = normalizeVisibleReply(extracted.visibleText);
          assistant.streaming = false;
          if (extracted.taskLoop) {
            this.taskLoop = extracted.taskLoop;
          }
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
