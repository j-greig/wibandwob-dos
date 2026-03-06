import net from "node:net";

type Client = {
  socket: net.Socket;
  nick?: string;
  username?: string;
  realname?: string;
  buffer: string;
  channels: Set<string>;
};

const port = Number(process.env.PORT || "6667");
const host = process.env.HOST || "127.0.0.1";
const clients = new Set<Client>();
const channels = new Map<string, Set<Client>>();

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

function sendNames(client: Client, channel: string): void {
  const members = [...(channels.get(channel) ?? [])]
    .map((member) => member.nick)
    .filter(Boolean)
    .join(" ");
  line(client.socket, `:dev-irc 353 ${client.nick ?? "*"} = ${channel} :${members}`);
  line(client.socket, `:dev-irc 366 ${client.nick ?? "*"} ${channel} :End of /NAMES list.`);
}

function broadcast(channel: string, raw: string, except?: Client): void {
  for (const client of channels.get(channel) ?? []) {
    if (client === except) continue;
    line(client.socket, raw);
  }
}

function removeClient(client: Client): void {
  clients.delete(client);
  for (const channel of client.channels) {
    const members = channels.get(channel);
    if (!members) continue;
    members.delete(client);
    if (members.size === 0) channels.delete(channel);
  }
}

function handlePrivmsg(client: Client, target: string, text: string): void {
  if (!client.nick) return;
  const raw = `:${client.nick}!${client.username ?? client.nick}@dev-irc PRIVMSG ${target} :${text}`;
  broadcast(target, raw);
}

function handleJoin(client: Client, channel: string): void {
  if (!client.nick) return;
  const members = ensureChannel(channel);
  members.add(client);
  client.channels.add(channel);
  const raw = `:${client.nick}!${client.username ?? client.nick}@dev-irc JOIN :${channel}`;
  broadcast(channel, raw);
  line(client.socket, raw);
  sendNames(client, channel);
}

function handleLine(client: Client, raw: string): void {
  const lineText = raw.trim();
  if (!lineText) return;
  if (lineText.startsWith("PING ")) {
    line(client.socket, `PONG ${lineText.slice(5)}`);
    return;
  }

  const [command, ...parts] = lineText.split(" ");
  switch ((command || "").toUpperCase()) {
    case "NICK":
      client.nick = parts[0];
      if (client.nick && client.username) {
        line(client.socket, `:dev-irc 001 ${client.nick} :Welcome to dev-irc`);
      }
      return;
    case "USER": {
      client.username = parts[0];
      const realnameIndex = lineText.indexOf(" :");
      client.realname = realnameIndex >= 0 ? lineText.slice(realnameIndex + 2) : client.username;
      if (client.nick && client.username) {
        line(client.socket, `:dev-irc 001 ${client.nick} :Welcome to dev-irc`);
      }
      return;
    }
    case "JOIN":
      if (parts[0]) handleJoin(client, parts[0]);
      return;
    case "PRIVMSG": {
      const target = parts[0];
      const colonIndex = lineText.indexOf(" :");
      const text = colonIndex >= 0 ? lineText.slice(colonIndex + 2) : "";
      if (target && text) handlePrivmsg(client, target, text);
      return;
    }
    case "QUIT":
      client.socket.end();
      return;
    default:
      return;
  }
}

const server = net.createServer((socket) => {
  const client: Client = { socket, buffer: "", channels: new Set() };
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
