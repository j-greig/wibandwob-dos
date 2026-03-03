/**
 * Pi Session Bridge
 *
 * Allows the in-app Wib&Wob Agent to communicate with running pi sessions
 * (wibwob1, wibwob2) via the same Unix socket protocol used by control.ts.
 *
 * Protocol: newline-delimited JSON over ~/.pi/session-control/<sessionId>.sock
 * Alias sockets: ~/.pi/session-control/<name>.alias (symlinks)
 *
 * This module is a pure Node client — no pi SDK dependencies.
 */

import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

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
