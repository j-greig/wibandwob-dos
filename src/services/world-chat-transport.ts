import net from "node:net";

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
    return {
      kind: "local",
      connected: true,
      joinedChannels: [],
    };
  }
}

class IrcWorldChatTransport implements WorldChatTransport {
  readonly kind = "irc" as const;
  private socket?: net.Socket;
  private buffer = "";
  private connected = false;
  private connecting = false;
  private joinedChannels = new Set<string>();
  private handler?: (event: WorldChatTransportEvent) => void;
  private lastError?: string;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly nick: string,
    private readonly username: string,
    private readonly realname: string,
  ) {}

  connect(): void {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;

    socket.on("connect", () => {
      this.connecting = false;
      this.connected = true;
      this.lastError = undefined;
      this.write(`NICK ${this.nick}`);
      this.write(`USER ${this.username} 0 * :${this.realname}`);
      this.emit({ type: "system", text: `connected to irc ${this.host}:${this.port} as ${this.nick}` });
      for (const channelId of this.joinedChannels) this.write(`JOIN ${channelId}`);
    });

    socket.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      this.flushLines();
    });

    socket.on("error", (error) => {
      this.lastError = error.message;
      this.emit({ type: "system", text: `irc error: ${error.message}` });
    });

    socket.on("close", () => {
      this.connected = false;
      this.connecting = false;
      this.emit({ type: "system", text: `irc disconnected from ${this.host}:${this.port}` });
      // Reconnect after 5 seconds so a dev server restart doesn't require a full app restart.
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        if (!this.connected && !this.connecting) this.connect();
      }, 5000);
    });
  }

  join(channelId: string): void {
    this.joinedChannels.add(channelId);
    this.connect();
    if (this.connected) this.write(`JOIN ${channelId}`);
  }

  send(channelId: string, sender: string, text: string): void {
    this.join(channelId);
    const payload = sender === this.nick ? text : `${sender}: ${text}`;
    if (this.connected) this.write(`PRIVMSG ${channelId} :${payload}`);
  }

  onEvent(handler: (event: WorldChatTransportEvent) => void): void {
    this.handler = handler;
  }

  status(): WorldChatTransportStatus {
    return {
      kind: "irc",
      connected: this.connected,
      server: `${this.host}:${this.port}`,
      nick: this.nick,
      joinedChannels: [...this.joinedChannels],
      lastError: this.lastError,
    };
  }

  private emit(event: WorldChatTransportEvent): void {
    this.handler?.(event);
  }

  private write(line: string): void {
    this.socket?.write(`${line}\r\n`);
  }

  private flushLines(): void {
    while (true) {
      const index = this.buffer.indexOf("\r\n");
      if (index < 0) break;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (!line) return;
    if (line.startsWith("PING ")) {
      this.write(`PONG ${line.slice(5)}`);
      return;
    }

    const privmsg = line.match(/^:([^!]+)![^ ]+ PRIVMSG ([^ ]+) :(.*)$/);
    if (privmsg) {
      const [, nick, channelId, text] = privmsg;
      if (nick === this.nick) return;
      this.emit({ type: "message", channelId, sender: nick, text });
      return;
    }

    const join = line.match(/^:([^!]+)![^ ]+ JOIN :?([^ ]+)$/);
    if (join) {
      const [, nick, channelId] = join;
      if (nick === this.nick) return;
      this.emit({ type: "join", channelId, sender: nick });
      return;
    }
  }
}

export function createWorldChatTransport(sessionId: string): WorldChatTransport {
  const transport = process.env.WIBWOB_CHAT_TRANSPORT?.trim().toLowerCase();
  if (transport !== "irc") return new LocalWorldChatTransport();

  const host = process.env.WIBWOB_CHAT_IRC_HOST?.trim();
  const rawPort = process.env.WIBWOB_CHAT_IRC_PORT?.trim();
  if (!host) return new LocalWorldChatTransport();
  const port = rawPort ? Number(rawPort) : 6667;
  const nick = process.env.WIBWOB_CHAT_IRC_NICK?.trim() || `ww-${process.env.WIBWOB_INSTANCE_LABEL?.trim() || sessionId}`;
  const username = process.env.WIBWOB_CHAT_IRC_USERNAME?.trim() || nick;
  const realname = process.env.WIBWOB_CHAT_IRC_REALNAME?.trim() || "WibWobWorld";
  return new IrcWorldChatTransport(host, Number.isFinite(port) ? port : 6667, nick, username, realname);
}
