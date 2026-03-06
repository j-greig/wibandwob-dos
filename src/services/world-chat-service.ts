export interface Chatspot {
  id: string;
  label: string;
  x: number;
  y: number;
  channelId: string;
  kind: "campfire" | "ruin" | "tower" | "crossroads";
}

export interface WorldMessage {
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

class WorldChatService {
  private currentWorldKey = "";
  private chatspots: Chatspot[] = [];
  private channels = new Map<string, WorldChannel>();

  ensureWorld(worldKey: string, width: number, height: number): Chatspot[] {
    if (this.currentWorldKey === worldKey && this.chatspots.length > 0) {
      return this.chatspots;
    }

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
              sender: "system",
              text: `${spot.label} is live.`,
              at: nowIso(),
            },
          ],
          participants: [],
        },
      ]),
    );
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
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;
    if (!channel.participants.includes(agentId)) {
      channel.participants.push(agentId);
      channel.messages.push({
        sender: "system",
        text: `${agentId} joined ${channel.label}.`,
        at: nowIso(),
      });
    }
    return this.getChannel(channelId);
  }

  sendMessage(agentId: string, channelId: string, text: string): WorldChannel | undefined {
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;
    if (!channel.participants.includes(agentId)) {
      channel.participants.push(agentId);
    }
    channel.messages.push({
      sender: agentId,
      text,
      at: nowIso(),
    });
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
    };
  }
}

export const worldChatService = new WorldChatService();
