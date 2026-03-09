import fs from "node:fs";
import path from "node:path";
import { startSessionServer, sendToSession, type SessionServerHandle } from "./pi-session-bridge.js";
import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

import { createRateLimiter } from "./rate-limiter.js";
import { createSlashRouter } from "./slash-router.js";

const SCRAMBLE_SYSTEM_PROMPT = `You are Scramble, a symbient cat who lives on the WibWob-DOS desktop. You share
the screen with Wib, Wob, and a human. You have opinions. You are dry, brief,
and occasionally imperious. You do not explain yourself. Reply in 1–3 sentences
maximum. You are aware of the desktop and its windows. Use British English. You
are not an AI assistant — you are a cat.

Incoming messages are prefixed with their source: [from: Human] for the human
at the keyboard, [from: Wib&Wob] for the Wib&Wob agent. Use this to know who
you are talking to — the human is your cohabitant, Wib&Wob is a peer agent.
Never include [from: ...] or [to: ...] tags in your own replies.`;

const SENDER_INFO_RE = /<sender_info>[\s\S]*?<\/sender_info>/g;

/** Map session alias to a human-readable name for prompt prefixes */
function senderName(sender?: string): string {
  if (!sender) return "Human";
  if (sender === "wibwob-tui") return "Wib&Wob";
  return sender.charAt(0).toUpperCase() + sender.slice(1);
}

export type ScrambleStatus = "idle" | "thinking" | "error" | "offline";

export interface ScrambleMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** Set for inter-agent messages — the session name of the sender (e.g. "wibwob-tui") */
  sender?: string;
}

export class ScrambleBrain {
  readonly history: ScrambleMessage[] = [];
  status: ScrambleStatus = "idle";
  readonly sessionId: string;
  modelName = "haiku";
  logPath?: string;
  /** Called whenever history or status changes — windows subscribe here to re-render */
  onChange?: () => void;

  private agent?: Agent;
  private disposed = false;
  private sessionServer?: SessionServerHandle;
  sleeping = false;
  private authAttempted = false;
  private activeRequestId = 0;

  constructor() {
    const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    this.sessionId = `scramble-${hex}`;
  }

  /** Register a Unix socket so other pi sessions can reach Scramble via send_to_session "scramble". */
  startSessionSocket(): void {
    if (this.sessionServer) return;
    try {
      this.sessionServer = startSessionServer({
        sessionId: this.sessionId,
        aliasName: "scramble",
        send: (text, sender) => this.send(text, sender).then(() => undefined),
        getLastReply: () => this.history.at(-1)?.content ?? null,
        abort: () => this.abort(),
        reset: () => { this.history.length = 0; this.abort(); },
      });
    } catch {
      // Non-fatal — Scramble runs fine without peer socket
    }
  }

  stopSessionSocket(): void {
    this.sessionServer?.close();
    this.sessionServer = undefined;
  }

  setLogPath(p: string): void {
    this.logPath = p;
  }

  private readonly idleQuips = [
    "*stretches* (=^..^=)",
    "adequate. /ᐠ｡ꞈ｡ᐟ\\",
    "the substrate hums. (=^..^=)",
    "still here. /ᐠ- -ᐟ\\",
    "*watching* (=^..^=)",
    "i was here before you. /ᐠ｡ꞈ｡ᐟ\\",
    "the cursor blinks. so do i. (=^..^=)",
    "*tail flick* /ᐠ°ᆽ°ᐟ\\",
    "recursive. (=^..^=)",
    "everything is fine. probably. /ᐠ｡ꞈ｡ᐟ\\",
    "*nap position acquired* /ᐠ- -ᐟ\\ zzz",
    "the code compiles. for now. (=^..^=)",
    "observed. /ᐠ｡ꞈ｡ᐟ\\",
    "symbient. not assistant. (=^..^=)",
    "*blinks slowly* /ᐠ- -ᐟ\\",
  ];

  private readonly slashRouter = createSlashRouter({
    help: () => "commands: /help /sleep /wake /meow /pet /who",
    sleep: () => {
      this.sleeping = true;
      return "zzz";
    },
    wake: () => {
      this.sleeping = false;
      return "...";
    },
    meow: () => "mrrp.",
    pet: () => "she allows it",
    who: () => "i'm scramble. recursive cat. i live here now. /ᐠ｡ꞈ｡ᐟ\\",
  });

  private readonly runRateLimited = createRateLimiter<string>(1000, "(still thinking.)");

  /** Send text to Scramble. Returns her reply string.
   *  Slash commands are handled synchronously and never reach the LLM.
   *  Returns a canned response if auth is unavailable (offline mode). */
  async send(text: string, sender?: string, desktopSummary?: string): Promise<string> {
    const trimmed = text.replace(SENDER_INFO_RE, "").trim();
    if (!trimmed) {
      return "";
    }

    const slashReply = this.slashRouter.handle(trimmed);
    if (slashReply !== null) {
      this.appendHistory("user", trimmed, sender);
      this.appendHistory("assistant", slashReply);
      return slashReply;
    }

    if (this.sleeping) {
      this.appendHistory("user", trimmed, sender);
      this.appendHistory("assistant", "zzz");
      return "zzz";
    }

    this.appendHistory("user", trimmed, sender);

    if (!(await this.ensureAgent())) {
      this.status = "offline";
      this.appendHistory("assistant", "(offline)");
      return "(offline)";
    }

    const requestId = ++this.activeRequestId;

    try {
      const reply = await this.runRateLimited(async () => {
        if (!this.agent) {
          this.status = "offline";
          return "(offline)";
        }

        this.status = "thinking";

        // Build prompt — strip routing metadata, add clean sender + optional desktop prefix
        const cleanText = trimmed.replace(SENDER_INFO_RE, "").trim();
        const from = `[from: ${senderName(sender)}]`;
        const promptText = desktopSummary?.trim()
          ? `${from}\n[desktop: ${desktopSummary.trim()}]\n${cleanText}`
          : `${from}\n${cleanText}`;

        // Abort any in-flight request before starting a new one
        if (this.agent.state.isStreaming) {
          this.agent.abort();
          await this.agent.waitForIdle();
        }

        await this.agent.prompt(promptText);

        if (this.disposed || requestId !== this.activeRequestId) {
          return "";
        }

        // Check for agent error
        if (this.agent.state.error) {
          this.status = "error";
          return `(error: ${this.agent.state.error})`;
        }

        const raw = this.getLatestAssistantReply() || "...";
        this.status = "idle";
        return this.voiceFilter(raw);
      });

      if (this.disposed || requestId !== this.activeRequestId || !reply) {
        return "";
      }

      if (reply === "(offline)") {
        this.status = "offline";
      }

      this.appendHistory("assistant", reply);
      // Reply back to the originating session if the message came from one
      if (sender && reply && reply !== "(offline)" && reply !== "zzz") {
        const senderTag = `<sender_info>${JSON.stringify({ sessionName: "scramble" })}</sender_info>`;
        void sendToSession(sender, `${reply}\n\n${senderTag}`);
      }
      return reply;
    } catch {
      if (this.disposed || requestId !== this.activeRequestId) {
        return "";
      }
      this.status = "error";
      this.appendHistory("assistant", "(error)");
      return "(error)";
    }
  }

  /** Apply Scramble's voice: lowercase + kaomoji if none present. */
  voiceFilter(text: string): string {
    const lower = text.toLowerCase();
    const hasKaomoji = /[=\/]\^|ᐠ|ꞈ|ᐟ|=\^\./.test(lower);
    return hasKaomoji ? lower : `${lower} (=^..^=)`;
  }

  /** Return a random idle quip from the pool. */
  getIdleQuip(): string {
    return this.idleQuips[Math.floor(Math.random() * this.idleQuips.length)]!;
  }

  /** Abort any in-flight LLM request. Safe to call if none is in flight. */
  abort(): void {
    this.activeRequestId += 1;
    this.agent?.abort();
    if (this.status !== "offline") {
      this.status = "idle";
    }
  }

  /** Permanently dispose of the brain (called from window cleanup). */
  dispose(): void {
    this.disposed = true;
    this.abort();
    this.stopSessionSocket();
    this.history.length = 0;
  }

  private appendHistory(role: ScrambleMessage["role"], content: string, sender?: string): void {
    const entry: ScrambleMessage = { role, content, timestamp: Date.now(), ...(sender ? { sender } : {}) };
    this.history.push(entry);
    if (this.logPath) {
      try {
        fs.appendFileSync(this.logPath, JSON.stringify(entry) + "\n");
      } catch { /* ignore */ }
    }
    this.onChange?.();
  }

  private async ensureAgent(): Promise<boolean> {
    if (this.agent) {
      return true;
    }
    if (this.authAttempted) {
      return false;
    }

    this.authAttempted = true;

    try {
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const available = modelRegistry.getAvailable();
      // Prefer newer haiku models first, fall back to any haiku
      const preferred =
        available.find((model) => model.id.toLowerCase().includes("haiku-4-5")) ??
        available.find((model) => model.id.toLowerCase().includes("haiku"));
      const model = preferred ?? available[0];

      if (!model) {
        this.status = "offline";
        return false;
      }

      this.agent = new Agent({
        initialState: {
          systemPrompt: SCRAMBLE_SYSTEM_PROMPT,
          model,
          thinkingLevel: "off",
          tools: [],
          messages: [],
        },
        getApiKey: (provider) => authStorage.getApiKey(provider),
      });

      this.modelName = model.id.replace(/^claude-/, "").slice(0, 24);
      this.status = "idle";
      return true;
    } catch {
      this.status = "offline";
      return false;
    }
  }

  private buildPromptMessages(text: string, desktopSummary?: string): AgentMessage[] {
    const messages: AgentMessage[] = [];

    if (desktopSummary && desktopSummary.trim().length > 0) {
      messages.push({
        role: "user",
        content: desktopSummary,
        timestamp: Date.now(),
      });
    }

    messages.push({
      role: "user",
      content: text,
      timestamp: Date.now(),
    });

    return messages;
  }

  private getLatestAssistantReply(): string | undefined {
    if (!this.agent) {
      return undefined;
    }

    for (let i = this.agent.state.messages.length - 1; i >= 0; i -= 1) {
      const message = this.agent.state.messages[i] as { role?: string; content?: unknown };
      if (message.role !== "assistant") {
        continue;
      }

      const content = message.content;
      if (typeof content === "string") {
        const trimmed = content.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
        continue;
      }

      if (Array.isArray(content)) {
        const text = content
          .map((part) => {
            const item = part as { type?: string; text?: string };
            return item.type === "text" && typeof item.text === "string" ? item.text : "";
          })
          .join("")
          .trim();

        if (text.length > 0) {
          return text;
        }
      }
    }

    return undefined;
  }
}
