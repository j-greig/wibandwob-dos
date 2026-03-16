/**
 * Pi session discovery.
 *
 * Scans ~/.pi/session-control/ for live Unix sockets and alias symlinks.
 * Each .sock file represents a live pi coding agent session running with --session-control.
 * Alias symlinks (.alias) map human-readable names to session sockets.
 */

import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredSession {
  /** Session ID (hex string from socket filename). */
  id: string;
  /** Absolute path to the Unix socket. */
  socketPath: string;
  /** Human-readable alias, if one exists. */
  alias?: string;
  /** Whether the socket responded to a probe (true = live, false = stale). */
  alive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CONTROL_DIR = path.join(os.homedir(), ".pi", "session-control");
const SOCK_EXT = ".sock";
const ALIAS_EXT = ".alias";
const PROBE_TIMEOUT_MS = 500; // Fast probe — just checks if socket accepts connections
const PROBE_CONCURRENCY = 50; // Limit parallel probes to avoid fd exhaustion

// ============================================================================
// Implementation
// ============================================================================

/**
 * Check if a Unix socket is alive by attempting a brief connection.
 * Returns true if the socket accepts the connection, false otherwise.
 */
function probeSocket(socketPath: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Discover all pi sessions in the control directory.
 *
 * Scans ~/.pi/session-control/ for:
 * - *.sock files (Unix domain sockets)
 * - *.alias symlinks pointing to sockets
 *
 * Probes each socket to determine if the session is still alive.
 * Returns sessions sorted: alive first, then by alias/id.
 */
export async function discoverPiSessions(): Promise<DiscoveredSession[]> {
  if (!fs.existsSync(CONTROL_DIR)) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(CONTROL_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  // Collect aliases: alias name → target session ID
  const aliasMap = new Map<string, string>();
  for (const entry of entries) {
    if (entry.name.endsWith(ALIAS_EXT)) {
      try {
        const target = fs.readlinkSync(path.join(CONTROL_DIR, entry.name));
        const targetId = path.basename(target, SOCK_EXT);
        const aliasName = entry.name.slice(0, -ALIAS_EXT.length);
        aliasMap.set(targetId, aliasName);
      } catch {
        // Broken symlink, skip
      }
    }
  }

  // Collect sockets
  const sessions: DiscoveredSession[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(SOCK_EXT)) continue;

    const id = entry.name.slice(0, -SOCK_EXT.length);
    const socketPath = path.join(CONTROL_DIR, entry.name);
    sessions.push({
      id,
      socketPath,
      alias: aliasMap.get(id),
      alive: false,
    });
  }

  // Probe sockets in batches to avoid fd exhaustion (can be 1000+ sockets)
  for (let i = 0; i < sessions.length; i += PROBE_CONCURRENCY) {
    const batch = sessions.slice(i, i + PROBE_CONCURRENCY);
    const results = await Promise.all(batch.map((s) => probeSocket(s.socketPath)));
    for (let j = 0; j < batch.length; j++) {
      batch[j].alive = results[j];
    }
  }

  // Sort: alive first, then by display name
  sessions.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    const nameA = a.alias ?? a.id;
    const nameB = b.alias ?? b.id;
    return nameA.localeCompare(nameB);
  });

  return sessions;
}

/**
 * Get a short display name for a session.
 */
export function sessionDisplayName(session: DiscoveredSession): string {
  if (session.alias) return session.alias;
  // Show first 8 chars of hex ID
  return session.id.length > 8 ? session.id.slice(0, 8) + "…" : session.id;
}

/**
 * Clean up stale (dead) sockets from the control directory.
 * Returns the number of sockets removed.
 */
export async function cleanStaleSockets(): Promise<number> {
  const sessions = await discoverPiSessions();
  let removed = 0;
  for (const session of sessions) {
    if (!session.alive) {
      try {
        fs.unlinkSync(session.socketPath);
        removed++;
      } catch {
        // Already gone or permission denied
      }
    }
  }
  return removed;
}
