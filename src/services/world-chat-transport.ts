import { Client as IRCClient } from "irc-framework";

export interface WorldChatTransportStatus {
  kind: "local" | "irc";
  connected: boolean;
  server?: string;
  nick?: string;
  joinedChannels: string[];
  lastError?: string;
}

export type WorldChatTransportEvent =
  | { type: "message"; channelId: string; sender: string; text: string }
  | { type: "join"; channelId: string; sender: string }
  | { type: "system"; channelId?: string; text: string };

export interface WorldChatTransport {
  readonly kind: "local" | "irc";
  connect(): void;
  join(channelId: string): void;
  send(channelId: string, sender: string, text: string): void;
  status(): WorldChatTransportStatus;
  onEvent(handler: (event: WorldChatTransportEvent) => void): void;
}

class LocalWorldChatTransport implements WorldChatTransport {
  readonly kind = "local" as const;
  private handler?: (event: WorldChatTransportEvent) => void;

  connect(): void {}
  join(_channelId: string): void {}
  send(_channelId: string, _sender: string, _text: string): void {}
  onEvent(handler: (event: WorldChatTransportEvent) => void): void {
    this.handler = handler;
  }
  status(): WorldChatTransportStatus {
    return { kind: "local", connected: true, joinedChannels: [] };
  }
}

class IrcWorldChatTransport implements WorldChatTransport {
  readonly kind = "irc" as const;
  private client?: IRCClient;
  private connected = false;
  private effectiveNick: string; // actual nick after registration (may differ if 433 suffixed)
  private joinedChannels = new Set<string>();
  private handler?: (event: WorldChatTransportEvent) => void;
  private lastError?: string;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly nick: string, // desired nick; effectiveNick holds the actual one after registration
    private readonly username: string,
    private readonly realname: string,
  ) {
    this.effectiveNick = nick;
  }

  connect(): void {
    if (this.client) return; // already initialised — irc-framework handles reconnect internally
    const client = new IRCClient();
    this.client = client;

    // Track the nick irc-framework is actively trying (may differ from this.nick after 433 suffix)
    let attemptedNick = this.nick;

    client.on("registered", (event) => {
      this.effectiveNick = event.nick ?? attemptedNick; // use actual nick assigned by server
      this.connected = true;
      this.lastError = undefined;
      this.emit({ type: "system", text: `connected to irc ${this.host}:${this.port} as ${this.effectiveNick}` });
      for (const channelId of this.joinedChannels) client.join(channelId);
    });

    // 433 ERR_NICKNAMEINUSE — append _ and retry (handles stale nicks from hard-killed instances)
    (client as any).on("nick in use", () => {
      attemptedNick = attemptedNick + "_";
      (client as any).changeNick(attemptedNick);
    });

    client.on("message", (event) => {
      if (event.nick === this.effectiveNick) return; // suppress own echo
      this.emit({ type: "message", channelId: event.target, sender: event.nick, text: event.message });
    });

    client.on("join", (event) => {
      if (event.nick === this.effectiveNick) return; // suppress own join echo
      this.emit({ type: "join", channelId: event.channel, sender: event.nick });
    });

    client.on("close", () => {
      this.connected = false;
      this.emit({ type: "system", text: `irc disconnected from ${this.host}:${this.port}` });
    });

    client.on("socket close", () => {
      this.connected = false;
    });

    client.on("error", (event) => {
      this.lastError = event.error?.message ?? event.message ?? "unknown irc error";
      this.emit({ type: "system", text: `irc error: ${this.lastError}` });
    });

    client.connect({
      host: this.host,
      port: this.port,
      nick: this.nick,
      username: this.username,
      gecos: this.realname,
      auto_reconnect: true,
      auto_reconnect_wait: 5000,
      auto_reconnect_max_retries: 9999, // keep trying indefinitely
    });
  }

  join(channelId: string): void {
    this.joinedChannels.add(channelId);
    this.connect();
    if (this.connected) this.client?.join(channelId);
  }

  send(channelId: string, sender: string, text: string): void {
    this.join(channelId);
    const payload = sender === this.effectiveNick ? text : `${sender}: ${text}`;
    if (this.connected) this.client?.say(channelId, payload);
  }

  onEvent(handler: (event: WorldChatTransportEvent) => void): void {
    this.handler = handler;
  }

  status(): WorldChatTransportStatus {
    return {
      kind: "irc",
      connected: this.connected,
      server: `${this.host}:${this.port}`,
      nick: this.effectiveNick,
      joinedChannels: [...this.joinedChannels],
      lastError: this.lastError,
    };
  }

  private emit(event: WorldChatTransportEvent): void {
    this.handler?.(event);
  }
}

export function createWorldChatTransport(sessionId: string): WorldChatTransport {
  const transport = process.env.WIBWOB_CHAT_TRANSPORT?.trim().toLowerCase();
  if (transport !== "irc") return new LocalWorldChatTransport();

  const host = process.env.WIBWOB_CHAT_IRC_HOST?.trim();
  const rawPort = process.env.WIBWOB_CHAT_IRC_PORT?.trim();
  if (!host) return new LocalWorldChatTransport();
  const port = rawPort ? Number(rawPort) : 6667;
  const nick =
    process.env.WIBWOB_CHAT_IRC_NICK?.trim() ||
    `ww-${process.env.WIBWOB_INSTANCE_LABEL?.trim() || sessionId}`;
  const username = process.env.WIBWOB_CHAT_IRC_USERNAME?.trim() || nick;
  const realname = process.env.WIBWOB_CHAT_IRC_REALNAME?.trim() || "WibWobWorld";
  return new IrcWorldChatTransport(
    host,
    Number.isFinite(port) ? port : 6667,
    nick,
    username,
    realname,
  );
}
