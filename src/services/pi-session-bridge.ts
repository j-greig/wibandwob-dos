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
// Session Server — makes wibwob-tui a first-class peer in list_sessions
// ============================================================================

export interface SessionServerHandle {
  /** The socket file path, e.g. ~/.pi/session-control/<id>.sock */
  socketPath: string;
  /** The alias symlink path, e.g. ~/.pi/session-control/wibwob-tui.alias */
  aliasPath: string;
  /** Stop the server and remove the socket + alias */
  close(): void;
}

export interface SessionServerTarget {
  /** The session's unique id (used as the socket filename) */
  sessionId: string;
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
  const aliasPath = path.join(CONTROL_DIR, "wibwob-tui.alias");

  // Clean up any stale socket from a previous run
  try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  try { fs.unlinkSync(aliasPath); } catch { /* ignore */ }

  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk;
      const nl = buffer.indexOf("\n");
      if (nl === -1) return;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);

      let cmd: Record<string, unknown>;
      try { cmd = JSON.parse(line); }
      catch { socket.end(); return; }

      const id = typeof cmd.id === "string" ? cmd.id : undefined;

      function respond(success: boolean, data?: unknown, error?: string) {
        const resp = JSON.stringify({ type: "response", command: cmd.type, success, data, error, id });
        socket.end(resp + "\n");
      }

      switch (cmd.type) {
        case "send": {
          const message = typeof cmd.message === "string" ? cmd.message : "";
          const mode = cmd.mode === "follow_up" ? "follow_up" : "steer";
          // Sender from explicit field, or extracted from <sender_info> in message text
          let sender = typeof cmd.sender === "string" ? cmd.sender : undefined;
          if (!sender) {
            const m = message.match(/<sender_info>\s*\{[^}]*"sessionName"\s*:\s*"([^"]+)"[^}]*\}\s*<\/sender_info>/);
            if (m) sender = m[1];
          }
          if (!message) { respond(false, undefined, "empty message"); return; }
          // Fire and forget — the response is sent immediately so the caller isn't blocked
          target.send(message, sender).catch(() => { /* swallow */ });
          void mode; // mode noted, steer vs follow_up distinction handled by session.send internals
          respond(true, { queued: true });
          return;
        }
        case "get_message": {
          const reply = target.getLastReply();
          respond(true, { message: reply ? { content: reply } : null });
          return;
        }
        case "get_summary": {
          // Stub: return the last reply as summary
          const reply = target.getLastReply();
          respond(true, { summary: reply ?? "No messages yet." });
          return;
        }
        case "abort": {
          target.abort?.();
          respond(true);
          return;
        }
        case "clear": {
          target.reset?.();
          respond(true);
          return;
        }
        default:
          respond(false, undefined, `Unknown command: ${cmd.type}`);
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
