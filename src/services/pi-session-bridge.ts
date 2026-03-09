/**
 * Pi Session Bridge
 *
 * Allows the in-app Wib&Wob Agent to communicate with running pi sessions
 * (wibwob1, wibwob2) via the same Unix socket protocol used by control.ts.
 *
 * Protocol: newline-delimited JSON over ~/.pi/session-control/<sessionId>.sock
 * Alias sockets: ~/.pi/session-control/<name>.alias (symlinks)
 *
 * This module bridges both live socket control and local persisted pi sessions.
 */

import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

const CONTROL_DIR = path.join(os.homedir(), ".pi", "session-control");
const SOCKET_SUFFIX = ".sock";

function getSocketPath(sessionId: string): string {
  return path.join(CONTROL_DIR, `${sessionId}${SOCKET_SUFFIX}`);
}

function isSafe(id: string): boolean {
  return id.length > 0 && !id.includes("/") && !id.includes("\\") && !id.includes("..");
}

async function resolveSocketPath(target: string): Promise<string | null> {
  // Try as alias first
  const aliasPath = path.join(CONTROL_DIR, `${target}.alias`);
  try {
    const link = fs.readlinkSync(aliasPath);
    const resolved = path.resolve(CONTROL_DIR, link);
    const base = path.basename(resolved);
    if (!base.endsWith(SOCKET_SUFFIX)) return null;
    const sessionId = base.slice(0, -SOCKET_SUFFIX.length);
    return isSafe(sessionId) ? getSocketPath(sessionId) : null;
  } catch { /* not an alias */ }

  // Try as session id
  if (isSafe(target)) {
    const sock = getSocketPath(target);
    if (fs.existsSync(sock)) return sock;
  }

  return null;
}

async function rpc(socketPath: string, command: object, timeoutMs = 10000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.setEncoding("utf8");
    const timer = setTimeout(() => { socket.destroy(new Error("timeout")); }, timeoutMs);
    let buffer = "";

    socket.once("connect", () => {
      socket.write(`${JSON.stringify(command)}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      const nl = buffer.indexOf("\n");
      if (nl !== -1) {
        clearTimeout(timer);
        socket.end();
        try { resolve(JSON.parse(buffer.slice(0, nl))); }
        catch (e) { reject(e); }
      }
    });

    socket.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

export interface LiveSession {
  sessionId: string;
  name?: string;
  socketPath: string;
}

export interface LocalSessionInfo {
  id: string;
  path: string;
  firstMessage: string;
  messageCount: number;
  modified: Date;
}

export async function listLocalSessions(repoRoot: string): Promise<LocalSessionInfo[]> {
  const sessions = await SessionManager.list(repoRoot);
  return sessions
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .slice(0, 15)
    .map((session) => ({
      id: session.id,
      path: session.path,
      firstMessage: session.firstMessage,
      messageCount: session.messageCount,
      modified: session.modified,
    }));
}

export async function loadSessionMessages(path: string): Promise<AgentMessage[]> {
  return SessionManager.open(path)
    .getBranch()
    .filter((entry): entry is typeof entry & { type: "message"; message: AgentMessage } => entry.type === "message")
    .map((entry) => entry.message);
}

export async function listSessions(): Promise<LiveSession[]> {
  try {
    const entries = fs.readdirSync(CONTROL_DIR, { withFileTypes: true });
    const sessions: LiveSession[] = [];

    // Build alias map
    const aliasMap = new Map<string, string>();
    for (const e of entries) {
      if (!e.isSymbolicLink() || !e.name.endsWith(".alias")) continue;
      try {
        const target = fs.readlinkSync(path.join(CONTROL_DIR, e.name));
        const resolved = path.resolve(CONTROL_DIR, target);
        aliasMap.set(resolved, e.name.slice(0, -".alias".length));
      } catch { /* skip */ }
    }

    for (const e of entries) {
      if (!e.name.endsWith(SOCKET_SUFFIX)) continue;
      const sockPath = path.join(CONTROL_DIR, e.name);
      const alive = await isAlive(sockPath);
      if (!alive) continue;
      const sessionId = e.name.slice(0, -SOCKET_SUFFIX.length);
      if (!isSafe(sessionId)) continue;
      sessions.push({ sessionId, name: aliasMap.get(sockPath), socketPath: sockPath });
    }

    return sessions.sort((a, b) => (a.name ?? a.sessionId).localeCompare(b.name ?? b.sessionId));
  } catch {
    return [];
  }
}

async function isAlive(sockPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createConnection(sockPath);
    const t = setTimeout(() => { s.destroy(); resolve(false); }, 300);
    s.once("connect", () => { clearTimeout(t); s.end(); resolve(true); });
    s.once("error", () => { clearTimeout(t); resolve(false); });
  });
}

export type SendMode = "steer" | "follow_up";

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendToSession(
  target: string,
  message: string,
  mode: SendMode = "steer"
): Promise<SendResult> {
  const sockPath = await resolveSocketPath(target);
  if (!sockPath) return { ok: false, error: `Session not found: ${target}` };

  try {
    const resp = await rpc(sockPath, { type: "send", message, mode }) as { success?: boolean; error?: string };
    return { ok: resp.success === true, error: resp.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Send a message and wait for the turn_end event — returns the reply content. */
export async function sendAndWait(
  target: string,
  message: string,
  timeoutMs = 120_000,
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const sockPath = await resolveSocketPath(target);
  if (!sockPath) return { ok: false, error: `Session not found: ${target}` };

  return new Promise((resolve) => {
    const socket = net.createConnection(sockPath);
    socket.setEncoding("utf8");
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "timeout waiting for turn_end" });
    }, timeoutMs);

    let buffer = "";
    let acked = false;

    socket.once("connect", () => {
      socket.write(`${JSON.stringify({ type: "send", message })}\n`);
      socket.write(`${JSON.stringify({ type: "subscribe", event: "turn_end" })}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\n")) {
        const nl = buffer.indexOf("\n");
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as Record<string, unknown>;
          if (msg.type === "response" && msg.command === "send") acked = true;
          if (msg.type === "event" && msg.event === "turn_end") {
            clearTimeout(timer);
            socket.end();
            const data = msg.data as { message?: { content?: string } } | undefined;
            resolve({ ok: true, reply: data?.message?.content ?? undefined });
          }
        } catch { /* ignore parse errors */ }
      }
    });

    socket.once("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    });

    void acked; // used implicitly via acked flag above
  });
}

export async function getLastMessage(target: string): Promise<string | null> {
  const sockPath = await resolveSocketPath(target);
  if (!sockPath) return null;

  try {
    const resp = await rpc(sockPath, { type: "get_message" }) as { success?: boolean; data?: { message?: { content: string } } };
    return resp.data?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// Session Server — makes any in-app session a first-class peer in list_sessions
// ============================================================================

/** A subscriber waiting for the next turn_end event on a given socket. */
interface TurnEndSub {
  socket: net.Socket;
  subscriptionId: string;
}

export interface SessionServerHandle {
  /** The socket file path, e.g. ~/.pi/session-control/<id>.sock */
  socketPath: string;
  /** The alias symlink path, e.g. ~/.pi/session-control/scramble.alias */
  aliasPath: string;
  /** Stop the server and remove the socket + alias */
  close(): void;
}

export interface SessionServerTarget {
  /** The session's unique id (used as the socket filename) */
  sessionId: string;
  /** Human-readable alias name for discovery (default: "wibwob-tui") */
  aliasName?: string;
  /** Submit a message into the session */
  send(text: string, sender?: string): Promise<void>;
  /** Return the last assistant reply, or null if none yet */
  getLastReply(): string | null;
  /** Abort any in-flight streaming */
  abort?(): void;
  /** Reset the session to empty state */
  reset?(): void;
}

/**
 * Start a Unix socket server so that `listSessions()` on any pi node
 * discovers wibwob-tui as a first-class peer.
 *
 * Registers the socket at ~/.pi/session-control/<sessionId>.sock
 * and a named alias at ~/.pi/session-control/wibwob-tui.alias.
 *
 * Handles the four standard RPC commands: send, get_message, abort, clear.
 * get_summary returns the last reply as a stub summary.
 */
export function startSessionServer(target: SessionServerTarget): SessionServerHandle {
  fs.mkdirSync(CONTROL_DIR, { recursive: true });

  const socketPath = getSocketPath(target.sessionId);
  const aliasPath = path.join(CONTROL_DIR, `${target.aliasName ?? "wibwob-tui"}.alias`);

  // Clean up any stale socket from a previous run
  try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  try { fs.unlinkSync(aliasPath); } catch { /* ignore */ }

  // Sockets waiting for the next turn_end event (registered via `subscribe` command)
  const turnEndSubs: TurnEndSub[] = [];

  function fireTurnEnd(reply: string | null): void {
    if (turnEndSubs.length === 0) return;
    const subs = turnEndSubs.splice(0);
    for (const sub of subs) {
      try {
        const event = JSON.stringify({
          type: "event",
          event: "turn_end",
          subscriptionId: sub.subscriptionId,
          data: { message: reply ? { content: reply } : null },
        });
        sub.socket.end(event + "\n");
      } catch { /* subscriber already gone */ }
    }
  }

  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    let socketHasSubscriber = false;

    function processLine(line: string): void {
      let cmd: Record<string, unknown>;
      try { cmd = JSON.parse(line); }
      catch { socket.end(); return; }

      const id = typeof cmd.id === "string" ? cmd.id : undefined;
      const cmdType = typeof cmd.type === "string" ? cmd.type : "unknown";

      // Reply helper. keepOpen=true writes without closing (used by subscribe).
      // Otherwise closes the socket unless a subscriber is still pending.
      function reply(success: boolean, data?: unknown, error?: string, keepOpen = false) {
        const resp = JSON.stringify({ type: "response", command: cmdType, success, data, error, id });
        if (keepOpen || socketHasSubscriber) {
          socket.write(resp + "\n");
        } else {
          socket.end(resp + "\n");
        }
      }

      switch (cmdType) {
        case "send": {
          const message = typeof cmd.message === "string" ? cmd.message : "";
          if (!message) { reply(false, undefined, "empty message"); return; }
          // Sender: explicit field, or strip from <sender_info>sessionName</sender_info> tag
          let sender = typeof cmd.sender === "string" ? cmd.sender : undefined;
          if (!sender) {
            const m = message.match(/<sender_info>[^<]*"sessionName"\s*:\s*"([^"]+)"[^<]*<\/sender_info>/);
            if (m) sender = m[1];
          }
          // Acknowledge immediately, then fire turn_end when the reply resolves
          reply(true, { queued: true });
          target.send(message, sender)
            .then(() => fireTurnEnd(target.getLastReply()))
            .catch(() => fireTurnEnd(null));
          return;
        }
        case "subscribe": {
          if (cmd.event !== "turn_end") {
            reply(false, undefined, `Unknown event type: ${String(cmd.event)}`);
            return;
          }
          const subscriptionId = (typeof id === "string" ? id : undefined)
            ?? `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const sub: TurnEndSub = { socket, subscriptionId };
          socketHasSubscriber = true;
          turnEndSubs.push(sub);
          // Remove subscriber if socket closes before the event fires
          const cleanup = () => {
            const idx = turnEndSubs.indexOf(sub);
            if (idx !== -1) turnEndSubs.splice(idx, 1);
            socketHasSubscriber = false;
          };
          socket.once("close", cleanup);
          socket.once("error", cleanup);
          reply(true, { subscriptionId, event: "turn_end" }, undefined, true /* keepOpen */);
          return;
        }
        case "get_message": {
          const last = target.getLastReply();
          reply(true, { message: last ? { content: last } : null });
          return;
        }
        case "get_summary": {
          const last = target.getLastReply();
          reply(true, { summary: last ?? "No messages yet." });
          return;
        }
        case "abort": {
          target.abort?.();
          reply(true);
          return;
        }
        case "clear": {
          target.reset?.();
          reply(true);
          return;
        }
        default:
          reply(false, undefined, `Unknown command: ${cmdType}`);
      }
    }

    socket.on("data", (chunk) => {
      buffer += chunk;
      // Collect all complete lines from the buffer
      const lines: string[] = [];
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (line) lines.push(line);
      }
      // Pre-scan: if any line is a subscribe command, mark socketHasSubscriber
      // before processing so that a preceding send command doesn't close the socket.
      for (const line of lines) {
        try {
          const peek = JSON.parse(line) as Record<string, unknown>;
          if (peek.type === "subscribe" && peek.event === "turn_end") {
            socketHasSubscriber = true;
            break;
          }
        } catch { /* ignore */ }
      }
      for (const line of lines) {
        processLine(line);
      }
    });

    socket.on("error", () => { /* ignore client disconnect errors */ });
  });

  server.listen(socketPath, () => {
    // Create the alias symlink pointing to the socket basename
    const rel = path.basename(socketPath);
    try { fs.symlinkSync(rel, aliasPath); } catch { /* alias already exists or failed */ }
  });

  server.on("error", (e) => {
    // Log but don't crash — the app runs fine without peer visibility
    console.error("[pi-session-bridge] server error:", e.message);
  });

  return {
    socketPath,
    aliasPath,
    close() {
      server.close();
      try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
      try { fs.unlinkSync(aliasPath); } catch { /* ignore */ }
    },
  };
}
