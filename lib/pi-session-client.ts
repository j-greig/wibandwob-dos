/**
 * Pi session control client.
 *
 * Connects to a pi coding agent session via the control.ts Unix socket protocol.
 * Protocol: newline-delimited JSON-RPC over Unix domain socket.
 *
 * @see https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/control.ts
 */

import * as net from "node:net";

// ============================================================================
// Types
// ============================================================================

export interface PiSessionClient {
  /** Send a message to the pi session. Mode: "steer" (interrupts), "followUp" (queues). */
  sendMessage(text: string, mode?: "steer" | "followUp"): Promise<PiResponse>;
  /** Get the last assistant message from the session. */
  getLastMessage(): Promise<PiResponse<{ message: string }>>;
  /** Get an AI-generated summary of the session. */
  getSummary(): Promise<PiResponse<{ summary: string; model?: string }>>;
  /** Abort the current operation. */
  abort(): Promise<PiResponse>;
  /** Clear/rewind the session, optionally summarizing first. */
  clear(summarize?: boolean): Promise<PiResponse>;
  /** Subscribe to turn_end events. Returns unsubscribe function. */
  onTurnEnd(cb: (data: TurnEndData) => void): () => void;
  /** Whether the socket is currently connected. */
  readonly connected: boolean;
  /** Close the connection and clean up. */
  close(): void;
}

export interface PiResponse<T = unknown> {
  success: boolean;
  command: string;
  data?: T;
  error?: string;
}

export interface TurnEndData {
  [key: string]: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const SUMMARY_TIMEOUT_MS = 60000; // Summaries can take a while (LLM call)
const MAX_BUFFER_BYTES = 1024 * 1024; // 1MB max unprocessed buffer

// ============================================================================
// Implementation
// ============================================================================

let requestIdCounter = 0;

export function connectPiSession(socketPath: string): Promise<PiSessionClient> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";
    let isConnected = false;

    // Connect timeout
    const connectTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);

    // Pending request/response pairs keyed by request ID
    const pending = new Map<
      string,
      { resolve: (resp: PiResponse) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
    >();

    // Event subscribers
    const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

    function processLine(line: string) {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "event") {
          const handlers = eventHandlers.get(msg.event);
          if (handlers) {
            for (const cb of handlers) cb(msg.data);
          }
        } else if (msg.type === "response") {
          // Match by command field — control.ts echoes the command type back
          // Try matching by _reqId first (if we injected one), fall back to command type
          const reqId = msg._reqId;
          let p = reqId ? pending.get(reqId) : undefined;
          if (!p && msg.command) {
            // Fallback: find first pending request for this command type
            for (const [id, entry] of pending) {
              if (id.startsWith(msg.command + ":")) {
                p = entry;
                pending.delete(id);
                break;
              }
            }
          }
          if (p) {
            clearTimeout(p.timer);
            if (reqId) pending.delete(reqId);
            p.resolve(msg as PiResponse);
          }
        }
      } catch {
        // Ignore malformed lines
      }
    }

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      // Guard against unbounded buffer growth
      if (buffer.length > MAX_BUFFER_BYTES) {
        buffer = buffer.slice(-MAX_BUFFER_BYTES / 2);
      }
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) processLine(line);
    });

    socket.on("connect", () => {
      clearTimeout(connectTimer);
      isConnected = true;
      resolve(client);
    });

    socket.on("error", (err) => {
      clearTimeout(connectTimer);
      if (!isConnected) {
        reject(err);
        return;
      }
      // Reject all pending requests
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(err);
      }
      pending.clear();
    });

    socket.on("close", () => {
      clearTimeout(connectTimer);
      isConnected = false;
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error("Socket closed"));
      }
      pending.clear();
    });

    function send<T = unknown>(cmd: Record<string, unknown>, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<PiResponse<T>> {
      return new Promise((res, rej) => {
        if (!isConnected) {
          rej(new Error("Not connected"));
          return;
        }
        const type = cmd.type as string;
        const reqId = `${type}:${++requestIdCounter}`;

        const timer = setTimeout(() => {
          pending.delete(reqId);
          rej(new Error(`Request timeout: ${type} after ${timeoutMs}ms`));
        }, timeoutMs);

        pending.set(reqId, {
          resolve: res as (resp: PiResponse) => void,
          reject: rej,
          timer,
        });

        socket.write(JSON.stringify(cmd) + "\n");
      });
    }

    const client: PiSessionClient = {
      sendMessage: (text, mode = "followUp") => send({ type: "send", message: text, mode }),
      getLastMessage: () => send<{ message: string }>({ type: "get_message" }),
      getSummary: () => send<{ summary: string; model?: string }>({ type: "get_summary" }, SUMMARY_TIMEOUT_MS),
      abort: () => send({ type: "abort" }),
      clear: (summarize = true) => send({ type: "clear", summarize }),

      onTurnEnd(cb: (data: TurnEndData) => void): () => void {
        let handlers = eventHandlers.get("turn_end");
        if (!handlers) {
          handlers = new Set();
          eventHandlers.set("turn_end", handlers);
          // Send subscription request (fire-and-forget)
          if (isConnected) {
            socket.write(JSON.stringify({ type: "subscribe", event: "turn_end" }) + "\n");
          }
        }
        handlers.add(cb);
        return () => {
          handlers!.delete(cb);
        };
      },

      get connected() {
        return isConnected;
      },

      close() {
        isConnected = false;
        for (const [, p] of pending) {
          clearTimeout(p.timer);
        }
        pending.clear();
        eventHandlers.clear();
        socket.destroy();
      },
    };
  });
}
