import net from "node:net";

type Client = {
  socket: net.Socket;
  nick?: string;
  username?: string;
  realname?: string;
  buffer: string;
  channels: Set<string>;
  registered: boolean;
  quitting: boolean; // true once QUIT has been broadcast — prevents double relay on socket close
};

const port = Number(process.env.PORT || "6667");
const host = process.env.HOST || "127.0.0.1";
const clients = new Set<Client>();
const channels = new Map<string, Set<Client>>();

const SERVER = "dev-irc";

function line(socket: net.Socket, text: string): void {
  socket.write(`${text}\r\n`);
}

function ensureChannel(name: string): Set<Client> {
  let set = channels.get(name);
  if (!set) {
    set = new Set();
    channels.set(name, set);
  }
  return set;
}

function nickInUse(nick: string, self?: Client): boolean {
  for (const c of clients) {
    if (c !== self && c.nick?.toLowerCase() === nick.toLowerCase()) return true;
  }
  return false;
}

function sendNames(client: Client, channel: string): void {
  const members = [...(channels.get(channel) ?? [])]
    .map((member) => member.nick)
    .filter(Boolean)
    .join(" ");
  line(client.socket, `:${SERVER} 353 ${client.nick ?? "*"} = ${channel} :${members}`);
  line(client.socket, `:${SERVER} 366 ${client.nick ?? "*"} ${channel} :End of /NAMES list.`);
}

function broadcast(channel: string, raw: string, except?: Client): void {
  for (const client of channels.get(channel) ?? []) {
    if (client === except) continue;
    line(client.socket, raw);
  }
}

function broadcastAll(channels_: Iterable<string>, raw: string, except?: Client): void {
  const seen = new Set<Client>();
  for (const ch of channels_) {
    for (const client of channels.get(ch) ?? []) {
      if (client === except || seen.has(client)) continue;
      seen.add(client);
      line(client.socket, raw);
    }
  }
}

function sendWelcome(client: Client): void {
  const nick = client.nick!;
  line(client.socket, `:${SERVER} 001 ${nick} :Welcome to dev-irc, ${nick}`);
  line(client.socket, `:${SERVER} 002 ${nick} :Your host is ${SERVER}, running dev build`);
  line(client.socket, `:${SERVER} 003 ${nick} :This server was created just now`);
  line(
    client.socket,
    `:${SERVER} 004 ${nick} ${SERVER} dev-build iox beiIklmnoOpqstv`,
  );
  line(client.socket, `:${SERVER} 375 ${nick} :- ${SERVER} Message of the day -`);
  line(client.socket, `:${SERVER} 372 ${nick} :- WibWob dev IRC — local only`);
  line(client.socket, `:${SERVER} 376 ${nick} :End of /MOTD command.`);
  client.registered = true;
}

function removeClient(client: Client): void {
  clients.delete(client);
  if (client.nick && !client.quitting) {
    // Abrupt disconnect — no QUIT was sent by the client; relay a synthetic one
    const quitRaw = `:${client.nick}!${client.username ?? client.nick}@${SERVER} QUIT :connection closed`;
    broadcastAll(client.channels, quitRaw, client);
  }
  for (const channel of client.channels) {
    const members = channels.get(channel);
    if (!members) continue;
    members.delete(client);
    if (members.size === 0) channels.delete(channel);
  }
}

function handlePrivmsg(client: Client, target: string, text: string): void {
  if (!client.nick) return;
  const raw = `:${client.nick}!${client.username ?? client.nick}@${SERVER} PRIVMSG ${target} :${text}`;
  if (target.startsWith("#")) {
    broadcast(target, raw, client);
  } else {
    // Direct message — find target client
    for (const c of clients) {
      if (c.nick?.toLowerCase() === target.toLowerCase()) {
        line(c.socket, raw);
        break;
      }
    }
  }
}

function handleJoin(client: Client, channel: string): void {
  if (!client.nick || !client.registered) return;
  const members = ensureChannel(channel);
  members.add(client);
  client.channels.add(channel);
  const raw = `:${client.nick}!${client.username ?? client.nick}@${SERVER} JOIN :${channel}`;
  broadcast(channel, raw, client);
  line(client.socket, raw);
  sendNames(client, channel);
}

function handlePart(client: Client, channel: string, reason?: string): void {
  if (!client.nick) return;
  const raw = `:${client.nick}!${client.username ?? client.nick}@${SERVER} PART ${channel}${reason ? ` :${reason}` : ""}`;
  broadcast(channel, raw);
  const members = channels.get(channel);
  if (members) {
    members.delete(client);
    if (members.size === 0) channels.delete(channel);
  }
  client.channels.delete(channel);
}

function handleLine(client: Client, raw: string): void {
  const lineText = raw.trim();
  if (!lineText) return;

  if (lineText.startsWith("PING ")) {
    const token = lineText.slice(5);
    line(client.socket, `:${SERVER} PONG ${SERVER} ${token}`);
    return;
  }

  const [command, ...parts] = lineText.split(" ");
  switch ((command || "").toUpperCase()) {
    case "NICK": {
      const newNick = parts[0]?.replace(/^:/, "");
      if (!newNick) return;
      if (nickInUse(newNick, client)) {
        line(
          client.socket,
          `:${SERVER} 433 ${client.nick ?? "*"} ${newNick} :Nickname is already in use`,
        );
        return;
      }
      if (client.registered && client.nick) {
        // Nick change while connected — relay to shared channels
        const oldMask = `${client.nick}!${client.username ?? client.nick}@${SERVER}`;
        broadcastAll(client.channels, `:${oldMask} NICK :${newNick}`, client);
        line(client.socket, `:${oldMask} NICK :${newNick}`);
      }
      client.nick = newNick;
      if (!client.registered && client.nick && client.username) sendWelcome(client);
      return;
    }
    case "USER": {
      client.username = parts[0];
      const realnameIndex = lineText.indexOf(" :");
      client.realname = realnameIndex >= 0 ? lineText.slice(realnameIndex + 2) : client.username;
      if (!client.registered && client.nick && client.username) sendWelcome(client);
      return;
    }
    case "JOIN": {
      const chans = (parts[0] ?? "").split(",");
      for (const ch of chans) if (ch) handleJoin(client, ch);
      return;
    }
    case "PART": {
      const ch = parts[0];
      if (ch) handlePart(client, ch, parts.slice(1).join(" ").replace(/^:/, ""));
      return;
    }
    case "PRIVMSG": {
      const target = parts[0];
      const colonIndex = lineText.indexOf(" :");
      const text = colonIndex >= 0 ? lineText.slice(colonIndex + 2) : "";
      if (target && text) handlePrivmsg(client, target, text);
      return;
    }
    case "QUIT": {
      const reason = lineText.indexOf(" :") >= 0 ? lineText.slice(lineText.indexOf(" :") + 2) : "Quit";
      if (client.nick) {
        const quitRaw = `:${client.nick}!${client.username ?? client.nick}@${SERVER} QUIT :${reason}`;
        broadcastAll(client.channels, quitRaw, client);
      }
      client.quitting = true; // prevents removeClient from sending a second QUIT
      client.socket.end();
      return;
    }
    case "NAMES": {
      if (parts[0]) sendNames(client, parts[0]);
      return;
    }
    case "WHO":
    case "MODE":
    case "CAP":
      // silently ignore — clients send these; we don't need to error
      return;
    default:
      return;
  }
}

const server = net.createServer((socket) => {
  const client: Client = { socket, buffer: "", channels: new Set(), registered: false, quitting: false };
  clients.add(client);

  socket.on("data", (chunk) => {
    client.buffer += chunk.toString("utf8");
    while (true) {
      const index = client.buffer.indexOf("\r\n");
      if (index < 0) break;
      const raw = client.buffer.slice(0, index);
      client.buffer = client.buffer.slice(index + 2);
      handleLine(client, raw);
    }
  });

  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

server.listen(port, host, () => {
  console.log(`dev-irc listening on ${host}:${port}`);
});
