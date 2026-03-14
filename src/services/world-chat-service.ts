import fs from "node:fs";
import path from "node:path";
import { LOGS_DIR } from "../core/config.js";
import { createWorldChatTransport, type WorldChatTransport, type WorldChatTransportStatus } from "./world-chat-transport.js";

export interface Chatspot {
  id: string;
  label: string;
  x: number;
  y: number;
  channelId: string;
  kind: "campfire" | "ruin" | "tower" | "crossroads";
}

export interface WorldMessage {
  kind: "system" | "chat" | "event";
  sender: string;
  text: string;
  at: string;
}

export interface WorldChannel {
  id: string;
  label: string;
  chatspotId: string;
  messages: WorldMessage[];
  participants: string[];
}

export interface WorldChatSnapshot {
  worldKey: string;
  chatspots: Chatspot[];
  channels: WorldChannel[];
  transport: WorldChatTransportStatus;
}

export type WorldChatChangeEvent =
  | { type: "world-reset"; worldKey: string }
  | { type: "channel"; channelId: string }
  | { type: "transport"; status: WorldChatTransportStatus };

export function formatWorldChannelText(channel: WorldChannel): string {
  const lines = [
    `${channel.label}  ${channel.id}`,
    `participants: ${channel.participants.join(", ") || "(none)"}`,
    "",
  ];
  for (const message of channel.messages) {
    const time = message.at.slice(11, 16);
    if (message.kind === "chat") {
      lines.push(`[${time}] <${message.sender}> ${message.text}`);
      continue;
    }
    lines.push(`[${time}] ${message.text}`);
  }
  return lines.join("\n");
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function defaultChatspots(width: number, height: number): Chatspot[] {
  const x1 = clamp(Math.floor(width * 0.28), 2, Math.max(2, width - 3));
  const y1 = clamp(Math.floor(height * 0.28), 2, Math.max(2, height - 3));
  const x2 = clamp(Math.floor(width * 0.52), 2, Math.max(2, width - 3));
  const y2 = clamp(Math.floor(height * 0.68), 2, Math.max(2, height - 3));
  const x3 = clamp(Math.floor(width * 0.74), 2, Math.max(2, width - 3));
  const y3 = clamp(Math.floor(height * 0.22), 2, Math.max(2, height - 3));
  return [
    {
      id: "chatspot.ridge-overlook",
      label: "Ridge Overlook",
      x: x1,
      y: y1,
      channelId: "#world-ridge-overlook",
      kind: "tower",
    },
    {
      id: "chatspot.lowland-camp",
      label: "Lowland Camp",
      x: x2,
      y: y2,
      channelId: "#world-lowland-camp",
      kind: "campfire",
    },
    {
      id: "chatspot.north-ruin",
      label: "North Ruin",
      x: x3,
      y: y3,
      channelId: "#world-north-ruin",
      kind: "ruin",
    },
  ];
}

const WORLD_CHAT_LOG_PATH = path.join(LOGS_DIR, "world-chat.log");
const WORLD_CHAT_IDENTITY = [
  process.env.WIBWOB_INSTANCE_LABEL?.trim(),
  process.env.WIBWOB_INSTANCE_ID?.trim(),
].filter(Boolean).join(" ");

function appendWorldChatLog(line: string): void {
  try {
    fs.mkdirSync(path.dirname(WORLD_CHAT_LOG_PATH), { recursive: true });
    fs.appendFileSync(WORLD_CHAT_LOG_PATH, `${line}\n`);
  } catch {
    // Logging must never break the live chat path.
  }
}

function logWorldChatEvent(channelId: string, kind: WorldMessage["kind"], text: string): void {
  const identity = WORLD_CHAT_IDENTITY ? `[${WORLD_CHAT_IDENTITY}] ` : "";
  appendWorldChatLog(`${nowIso()} ${identity}[${channelId}] [${kind}] ${text}`);
}

class WorldChatService {
  private currentWorldKey = "";
  private chatspots: Chatspot[] = [];
  private channels = new Map<string, WorldChannel>();
  private readonly transport: WorldChatTransport;
  private readonly listeners = new Set<(event: WorldChatChangeEvent) => void>();

  constructor() {
    this.transport = createWorldChatTransport(process.env.WIBWOB_INSTANCE_ID?.trim() || "wwd");
    this.transport.onEvent((event) => {
      if (event.type === "system") {
        if (event.channelId) logWorldChatEvent(event.channelId, "system", event.text);
        else appendWorldChatLog(`${nowIso()} [transport] ${event.text}`);
        this.emit({ type: "transport", status: this.transport.status() });
        return;
      }
      if (event.type === "join") {
        this.applyJoin(event.sender, event.channelId, true);
        return;
      }
      this.applyIncomingMessage(event.sender, event.channelId, event.text, true);
    });
  }

  ensureWorld(worldKey: string, width: number, height: number): Chatspot[] {
    this.transport.connect();

    const sameWorld = this.currentWorldKey === worldKey && this.chatspots.length > 0;
    if (sameWorld) {
      // Same terrain+seed. If viewport changed, reposition chatspots but keep channel state.
      const newSpots = defaultChatspots(width, height);
      const dimsChanged =
        newSpots.length !== this.chatspots.length ||
        newSpots[0]?.x !== this.chatspots[0]?.x ||
        newSpots[0]?.y !== this.chatspots[0]?.y;
      if (dimsChanged) this.chatspots = newSpots;
      return this.chatspots;
    }

    // New world — full reinit.
    this.currentWorldKey = worldKey;
    this.chatspots = defaultChatspots(width, height);
    this.channels = new Map(
      this.chatspots.map((spot) => [
        spot.channelId,
        {
          id: spot.channelId,
          label: spot.label,
          chatspotId: spot.id,
          messages: [
            {
              kind: "system",
              sender: "system",
              text: `${spot.label} is live.`,
              at: nowIso(),
            },
          ],
          participants: [],
        },
      ]),
    );
    const identity = WORLD_CHAT_IDENTITY ? `[${WORLD_CHAT_IDENTITY}] ` : "";
    appendWorldChatLog(`${nowIso()} ${identity}[world] init ${worldKey} ${width}x${height}`);
    for (const spot of this.chatspots) {
      logWorldChatEvent(spot.channelId, "system", `${spot.label} is live.`);
    }
    this.emit({ type: "world-reset", worldKey });
    this.emit({ type: "transport", status: this.transport.status() });
    return this.chatspots;
  }

  getCurrentWorldKey(): string {
    return this.currentWorldKey;
  }

  listChatspots(): Chatspot[] {
    return [...this.chatspots];
  }

  nearestChatspot(x: number, y: number): Chatspot | undefined {
    return this.chatspots.reduce<Chatspot | undefined>((best, spot) => {
      if (!best) return spot;
      const bestDistance = Math.abs(best.x - x) + Math.abs(best.y - y);
      const distance = Math.abs(spot.x - x) + Math.abs(spot.y - y);
      return distance < bestDistance ? spot : best;
    }, undefined);
  }

  getChannel(channelId: string): WorldChannel | undefined {
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;
    return {
      ...channel,
      messages: [...channel.messages],
      participants: [...channel.participants],
    };
  }

  listChannels(): WorldChannel[] {
    return [...this.channels.values()].map((channel) => ({
      ...channel,
      messages: [...channel.messages],
      participants: [...channel.participants],
    }));
  }

  joinChannel(agentId: string, channelId: string): WorldChannel | undefined {
    this.applyJoin(agentId, channelId, false);
    this.transport.join(channelId);
    return this.getChannel(channelId);
  }

  sendMessage(agentId: string, channelId: string, text: string): WorldChannel | undefined {
    this.applyOutgoingMessage(agentId, channelId, text);
    this.transport.send(channelId, agentId, text);
    return this.getChannel(channelId);
  }

  readChannel(channelId: string): WorldChannel | undefined {
    return this.getChannel(channelId);
  }

  snapshot(): WorldChatSnapshot {
    return {
      worldKey: this.currentWorldKey,
      chatspots: this.listChatspots(),
      channels: this.listChannels(),
      transport: this.transport.status(),
    };
  }

  getTransportStatus(): WorldChatTransportStatus {
    return this.transport.status();
  }

  subscribe(listener: (event: WorldChatChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: WorldChatChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private applyJoin(agentId: string, channelId: string, fromTransport: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    if (!channel.participants.includes(agentId)) {
      channel.participants.push(agentId);
      const message = {
        kind: "system",
        sender: "system",
        text: `${agentId} joined ${channel.label}.`,
        at: nowIso(),
      } satisfies WorldMessage;
      channel.messages.push(message);
      logWorldChatEvent(channelId, message.kind, `${fromTransport ? "[irc] " : ""}${message.text}`);
      this.emit({ type: "channel", channelId });
    }
  }

  private applyOutgoingMessage(agentId: string, channelId: string, text: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    if (!channel.participants.includes(agentId)) {
      channel.participants.push(agentId);
    }
    const chatMessage = {
      kind: "chat",
      sender: agentId,
      text,
      at: nowIso(),
    } satisfies WorldMessage;
    channel.messages.push(chatMessage);
    logWorldChatEvent(channelId, chatMessage.kind, `<${agentId}> ${text}`);
    const eventMessage = {
      kind: "event",
      sender: "system",
      text: `${agentId} said: ${text}`,
      at: nowIso(),
    } satisfies WorldMessage;
    channel.messages.push(eventMessage);
    logWorldChatEvent(channelId, eventMessage.kind, eventMessage.text);
    this.emit({ type: "channel", channelId });
  }

  private applyIncomingMessage(agentId: string, channelId: string, text: string, fromTransport: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    if (!channel.participants.includes(agentId)) {
      channel.participants.push(agentId);
    }
    const chatMessage = {
      kind: "chat",
      sender: agentId,
      text,
      at: nowIso(),
    } satisfies WorldMessage;
    channel.messages.push(chatMessage);
    logWorldChatEvent(channelId, chatMessage.kind, `${fromTransport ? "[irc] " : ""}<${agentId}> ${text}`);
    const eventMessage = {
      kind: "event",
      sender: "system",
      text: `${agentId} said: ${text}`,
      at: nowIso(),
    } satisfies WorldMessage;
    channel.messages.push(eventMessage);
    logWorldChatEvent(channelId, eventMessage.kind, `${fromTransport ? "[irc] " : ""}${eventMessage.text}`);
    this.emit({ type: "channel", channelId });
  }
}

export const worldChatService = new WorldChatService();
