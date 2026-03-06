import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { Client } from "irc-framework";
import path from "node:path";
import { spawnAgent, listAgents, getAgent, killAll, type AgentHandle } from "./driver.js";
import {
  parseMultilineCap,
  startMultilineBatch,
  collectMultilineLine,
  endMultilineBatch,
  buildMultilineBatch,
  type MultilineCaps,
} from "./multiline.js";

interface BufferedMessage {
  readonly time: string;
  readonly nick: string;
  readonly channel: string;
  readonly text: string;
  readonly msgid?: string | undefined;
  readonly replyTo?: string | undefined;
}

// Helper to cast Type.Object results for pi's registerTool
function schema<T extends TSchema>(s: T): T {
  return s;
}

export default function (pi: ExtensionAPI): void {
  const MAX_HISTORY = 200;

  // --- Configuration ---
  const server = process.env["PIRC_SERVER"] ?? "localhost";
  const port = parseInt(process.env["PIRC_PORT"] ?? "6667", 10);
  const provider = process.env["PI_PROVIDER"] ?? "anthropic";
  const model = process.env["PI_MODEL"] ?? "claude-sonnet-4-20250514";

  // Derive project name from cwd
  const projectName = path
    .basename(process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  const nick = process.env["PIRC_NICK"] ?? `${projectName}-lead`;
  const mainChannel = `#${projectName}`;

  // Default channels: project channel + coordination channels
  const defaultChannels = process.env["PIRC_CHANNELS"]?.split(",").map((c) => c.trim()) ?? [
    mainChannel,
    `${mainChannel}-tasks`,
    `${mainChannel}-status`,
  ];

  // Extension path for subagents — point at this extension's directory
  const extensionPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

  // --- IRC State ---
  let irc: Client = new Client();
  let connected = false;
  let multilineCaps: MultilineCaps | undefined;
  const history: Record<string, BufferedMessage[]> = {};

  const watchChannels = new Set(
    (
      process.env["PIRC_WATCH_CHANNELS"] ??
      process.env["PIRC_CHANNELS"] ??
      defaultChannels.join(",")
    )
      .split(",")
      .map((c: string) => c.trim()),
  );

  function pushMessage(msg: BufferedMessage): void {
    const ch = msg.channel;
    if (!history[ch]) history[ch] = [];
    const channelHistory = history[ch]!;
    channelHistory.push(msg);
    if (channelHistory.length > MAX_HISTORY) channelHistory.shift();
  }

  function formatMessages(msgs: readonly BufferedMessage[]): string {
    if (msgs.length === 0) return "(no messages)";
    return msgs
      .map((m) => {
        const id = m.msgid ? ` [id:${m.msgid}]` : "";
        const reply = m.replyTo ? ` (reply to ${m.replyTo})` : "";
        return `[${m.time}] <${m.nick}>${reply} ${m.text}${id}`;
      })
      .join("\n");
  }

  function now(): string {
    return new Date().toLocaleTimeString("en-US", { hour12: false });
  }

  // --- IRC Connection ---

  function connectIRC(onNotify: (msg: string, level: "info" | "error" | "warning") => void): void {
    if (connected) return;

    irc = new Client();
    irc.requestCap(["batch", "draft/multiline", "message-tags"]);
    irc.connect({ host: server, port, nick });

    irc.on("registered", () => {
      connected = true;

      // Check if multiline was negotiated
      const capValue = irc.network.cap.available.get("draft/multiline");
      if (irc.network.cap.isEnabled("draft/multiline") && capValue) {
        multilineCaps = parseMultilineCap(capValue);
        onNotify(
          `IRC: multiline enabled (max-bytes=${String(multilineCaps.maxBytes)}, max-lines=${String(multilineCaps.maxLines ?? "unlimited")})`,
          "info",
        );
      } else {
        multilineCaps = undefined;
      }

      for (const ch of defaultChannels) {
        irc.join(ch);
      }
      onNotify(
        `IRC: connected to ${server}:${port} as ${nick}, channels: ${defaultChannels.join(", ")}`,
        "info",
      );
    });

    // Handle multiline batch lifecycle
    irc.on("batch start draft/multiline", (event: unknown) => {
      try {
        const evt = event as { id: string; params: string[] };
        startMultilineBatch(evt.id, evt.params[0] ?? "");
      } catch (err) {
        onNotify(`IRC multiline batch start error: ${String(err)}`, "error");
      }
    });

    irc.on("batch end draft/multiline", (event: unknown) => {
      try {
        const evt = event as { id: string };
        const assembled = endMultilineBatch(evt.id);
        if (!assembled) return;

        const msg: BufferedMessage = {
          time: now(),
          nick: assembled.nick,
          channel: assembled.target,
          text: assembled.text,
          msgid: assembled.tags["msgid"],
          replyTo: assembled.tags["+draft/reply"] ?? assembled.tags["draft/reply"],
        };
        pushMessage(msg);

        if (watchChannels.has(msg.channel)) {
          const replyCtx = msg.replyTo ? ` (reply to ${msg.replyTo})` : "";
          const idCtx = msg.msgid ? ` [id:${msg.msgid}]` : "";
          pi.sendMessage(
            {
              customType: "pirc-message",
              content: `[IRC ${msg.channel}] <${msg.nick}>${replyCtx} ${msg.text}${idCtx}`,
              display: true,
            },
            { triggerTurn: true, deliverAs: "followUp" },
          );
        }
      } catch (err) {
        onNotify(`IRC multiline batch end error: ${String(err)}`, "error");
      }
    });

    irc.on("message", (event: unknown) => {
      const evt = event as Record<string, unknown>;
      if (evt["nick"] === nick) return;

      // If this message is part of a multiline batch, collect it instead
      const tags = (evt["tags"] ?? {}) as Record<string, string>;
      try {
        const batch = evt["batch"] as { id: string; type: string } | undefined;
        if (
          collectMultilineLine({
            batch,
            nick: evt["nick"] as string,
            message: evt["message"] as string,
            tags,
          })
        ) {
          return;
        }
      } catch {
        // Fall through to normal message handling
      }

      const msg: BufferedMessage = {
        time: now(),
        nick: evt["nick"] as string,
        channel: evt["target"] as string,
        text: evt["message"] as string,
        msgid: tags["msgid"],
        replyTo: tags["+draft/reply"] ?? tags["draft/reply"],
      };
      pushMessage(msg);

      if (watchChannels.has(msg.channel)) {
        const replyCtx = msg.replyTo ? ` (reply to ${msg.replyTo})` : "";
        const idCtx = msg.msgid ? ` [id:${msg.msgid}]` : "";
        pi.sendMessage(
          {
            customType: "pirc-message",
            content: `[IRC ${msg.channel}] <${msg.nick}>${replyCtx} ${msg.text}${idCtx}`,
            display: true,
          },
          { triggerTurn: true, deliverAs: "followUp" },
        );
      }
    });

    irc.on("error", (err: unknown) => {
      const e = err as Record<string, unknown>;
      onNotify(`IRC error: ${String(e["message"] ?? e)}`, "error");
    });

    irc.on("close", () => {
      connected = false;
      onNotify("IRC: disconnected", "warning");
    });
  }

  // --- Lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    connectIRC((msg, level) => {
      ctx.ui.notify(msg, level);
    });
  });

  pi.on("session_shutdown", async () => {
    killAll();
    try {
      irc.quit("Lead agent shutting down");
    } catch {
      // ignore
    }
  });

  // --- IRC Tools ---

  pi.registerTool({
    name: "irc_send",
    label: "IRC Send",
    description:
      "Send a message to an IRC channel. Use this to communicate with subagents and humans.",
    parameters: schema(
      Type.Object({
        channel: Type.String({ description: 'IRC channel, e.g. "#myproject"' }),
        message: Type.String({ description: "Message to send" }),
        replyTo: Type.Optional(
          Type.String({ description: "msgid of the message to reply to (for threading)" }),
        ),
      }),
    ),
    async execute(_toolCallId, params) {
      const tags: Record<string, string> = {};
      if (params.replyTo) {
        tags["+draft/reply"] = params.replyTo;
      }

      // Try multiline batch if the server supports it and message needs it
      let sentMultiline = false;
      if (multilineCaps) {
        const batch = buildMultilineBatch(
          params.channel,
          params.message,
          multilineCaps,
          350,
          Object.keys(tags).length > 0 ? tags : undefined,
        );
        if (batch) {
          for (const line of batch) {
            irc.raw(line.raw);
          }
          sentMultiline = true;
        }
      }

      if (!sentMultiline) {
        irc.say(params.channel, params.message, Object.keys(tags).length > 0 ? tags : undefined);
      }

      const replyNote = params.replyTo ? ` (reply to ${params.replyTo})` : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `Sent to ${params.channel}${replyNote}: ${params.message}`,
          },
        ],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "irc_read",
    label: "IRC Read",
    description: "Read recent message history from an IRC channel.",
    parameters: schema(
      Type.Object({
        channel: Type.String({ description: "IRC channel to read from" }),
        limit: Type.Optional(
          Type.Number({ description: "Max messages to return (default 20)", default: 20 }),
        ),
      }),
    ),
    async execute(_toolCallId, params) {
      const msgs = history[params.channel]?.slice(-(params.limit ?? 20)) ?? [];
      return {
        content: [{ type: "text" as const, text: formatMessages(msgs) }],
        details: { count: msgs.length },
      };
    },
  });

  pi.registerTool({
    name: "irc_channels",
    label: "IRC Channels",
    description: "List joined IRC channels and how many buffered messages each has.",
    parameters: schema(Type.Object({})),
    async execute() {
      const allChannels = new Set([...defaultChannels, ...Object.keys(history)]);
      const info = [...allChannels].map((ch) => {
        const count = history[ch]?.length ?? 0;
        return `${ch}: ${count} messages buffered`;
      });
      return {
        content: [{ type: "text" as const, text: info.join("\n") || "(no channels)" }],
        details: {},
      };
    },
  });

  // --- Agent Management Tools ---

  pi.registerTool({
    name: "spawn_agent",
    label: "Spawn Agent",
    description: `Spawn a new pi subagent that connects to IRC and works on a task. The agent joins the project IRC channels (${defaultChannels.join(", ")}) and communicates with other agents there. Give it a clear role and instructions.`,
    parameters: schema(
      Type.Object({
        nick: Type.String({
          description:
            "IRC nickname for this agent. Should relate to the project and role, e.g. 'myapp-builder', 'myapp-tester'. Must be unique.",
        }),
        role: Type.String({
          description: "Short role description, e.g. 'backend builder', 'test writer', 'reviewer'",
        }),
        instructions: Type.String({
          description:
            "Detailed instructions for the agent. What it should do, how it should coordinate, what channels to use. This becomes the agent's boot prompt.",
        }),
        workdir: Type.Optional(
          Type.String({
            description:
              "Working directory for the agent (default: current directory). The agent has full file access here.",
          }),
        ),
        provider: Type.Optional(
          Type.String({
            description:
              "LLM provider for this agent (e.g. 'anthropic', 'openai'). Defaults to the lead agent's provider.",
          }),
        ),
        model: Type.Optional(
          Type.String({
            description:
              "Model for this agent (e.g. 'claude-sonnet-4-20250514', 'gpt-4o'). Defaults to the lead agent's model.",
          }),
        ),
      }),
    ),
    async execute(_toolCallId, params) {
      const workdir = params.workdir ?? process.cwd();
      const agentProvider = params.provider ?? provider;
      const agentModel = params.model ?? model;

      const bootPrompt = `# Your Role: ${params.role}

You are "${params.nick}", a subagent in a multi-agent system coordinating over IRC.

## IRC Channels
${defaultChannels.map((ch) => `- ${ch}`).join("\n")}

The main project channel is ${mainChannel}. Use ${mainChannel}-tasks for task claims/specs and ${mainChannel}-status for progress updates.

## Instructions
${params.instructions}

## How to Communicate
- Use irc_send to post messages to channels
- Use irc_read to catch up on channel history
- Keep messages concise — this is IRC
- When you finish a task, announce it on ${mainChannel}-status
- If you need help or clarification, ask on ${mainChannel}
- You will receive IRC messages automatically as they arrive. Do NOT poll or loop.

## Important
- Messages from other agents arrive automatically via [pirc-message] notifications
- Just respond naturally when you receive them
- Start by announcing yourself on ${mainChannel} and then begin your work

Begin now.`;

      let handle: AgentHandle;
      try {
        handle = spawnAgent(
          {
            nick: params.nick,
            role: params.role,
            channels: [...defaultChannels],
            cwd: workdir,
            extensionPath,
            provider: agentProvider,
            model: agentModel,
            server,
            port,
            bootPrompt,
          },
          (agentNick, msg) => {
            pi.sendMessage(
              {
                customType: "agent-log",
                content: `[${agentNick}] ${msg}`,
                display: false,
              },
              { triggerTurn: false, deliverAs: "nextTurn" },
            );
          },
        );
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to spawn agent: ${String(err)}` }],
          details: {},
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Spawned agent "${params.nick}" (role: ${params.role}, pid: ${String(handle.pid)}). It will connect to IRC and join ${defaultChannels.join(", ")}.`,
          },
        ],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "list_agents",
    label: "List Agents",
    description: "List all running subagents and their status.",
    parameters: schema(Type.Object({})),
    async execute() {
      const all = listAgents();
      if (all.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No agents running." }],
          details: { count: 0 },
        };
      }
      const lines = all.map(
        (a) => `${a.nick} (${a.role}) — pid ${String(a.pid)}, ${a.alive ? "alive" : "dead"}`,
      );
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        details: { count: all.length },
      };
    },
  });

  pi.registerTool({
    name: "kill_agent",
    label: "Kill Agent",
    description: "Stop a running subagent by nickname.",
    parameters: schema(
      Type.Object({
        nick: Type.String({ description: "Nickname of the agent to kill" }),
      }),
    ),
    async execute(_toolCallId, params) {
      const handle = getAgent(params.nick);
      if (!handle) {
        return {
          content: [{ type: "text" as const, text: `No agent found with nick "${params.nick}"` }],
          details: {},
        };
      }
      handle.kill();
      return {
        content: [{ type: "text" as const, text: `Killed agent "${params.nick}"` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "message_agent",
    label: "Message Agent",
    description:
      "Send a direct RPC prompt to a subagent (bypasses IRC). Use this for urgent instructions or to redirect an agent's work.",
    parameters: schema(
      Type.Object({
        nick: Type.String({ description: "Nickname of the agent" }),
        message: Type.String({ description: "Message/instruction to send" }),
      }),
    ),
    async execute(_toolCallId, params) {
      const handle = getAgent(params.nick);
      if (!handle) {
        return {
          content: [{ type: "text" as const, text: `No agent found with nick "${params.nick}"` }],
          details: {},
        };
      }
      if (!handle.alive) {
        return {
          content: [{ type: "text" as const, text: `Agent "${params.nick}" is not alive` }],
          details: {},
        };
      }
      const resp = await handle.sendPrompt(params.message);
      return {
        content: [
          {
            type: "text" as const,
            text: resp.success
              ? `Sent prompt to "${params.nick}"`
              : `Failed to send to "${params.nick}": ${String(resp.error)}`,
          },
        ],
        details: {},
      };
    },
  });

  // --- Commands ---

  pi.registerCommand("pirc-agents", {
    description: "Show running agents and IRC status",
    handler: async (_args, ctx) => {
      const all = listAgents();
      const agentInfo =
        all.length === 0
          ? "  (none)"
          : all.map((a) => `  ${a.nick} (${a.role}) — ${a.alive ? "alive" : "dead"}`).join("\n");

      const channelInfo = defaultChannels
        .map((ch) => `  ${ch}: ${history[ch]?.length ?? 0} msgs`)
        .join("\n");

      ctx.ui.notify(
        `IRC: ${nick}@${server}:${port} (${connected ? "connected" : "disconnected"})\n\nChannels:\n${channelInfo}\n\nAgents:\n${agentInfo}`,
        "info",
      );
    },
  });

  pi.registerCommand("pirc-killall", {
    description: "Kill all running subagents",
    handler: async (_args, ctx) => {
      const count = listAgents().length;
      killAll();
      ctx.ui.notify(`Killed ${String(count)} agent(s)`, "info");
    },
  });

  pi.registerCommand("pirc-plan", {
    description: "Decompose a plan into IRC-coordinated subagents. Usage: /pirc-plan <description>",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /pirc-plan <description of what you want to build>", "warning");
        return;
      }

      const plan = args.trim();
      pi.sendUserMessage(
        `You have a multi-agent system with IRC coordination. The project is "${projectName}" and agents communicate on these channels: ${defaultChannels.join(", ")}.

Decompose the following plan into subagents. For each agent:
1. Pick a nickname that relates to the project and its role (e.g. "${projectName}-builder", "${projectName}-reviewer")
2. Define a clear role
3. Write detailed instructions covering what it should build/do, what files to touch, and how to coordinate with the other agents
4. Spawn it with spawn_agent

After spawning all agents, send a kickoff message to ${mainChannel} summarizing the plan and tagging each agent by nick so they know to start.

The plan:
${plan}`,
        { deliverAs: "followUp" },
      );
    },
  });
}
