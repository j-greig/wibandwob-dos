/**
 * WibWob Rooms — PartyKit Server (E008 F01)
 *
 * One Durable Object instance per room (keyed by room_id).
 * Coordinates multiplayer state for WibWob-DOS instances.
 *
 * Message protocol (JSON over WebSocket):
 *
 *   state_delta  { type, room_id, delta: { add?, remove?, update? } }
 *     Sent by a C++ instance when its window layout mutates.
 *     Server merges into canonical state, broadcasts to all others.
 *
 *   state_sync   { type, state }
 *     Server → new joiner: full canonical state on connect.
 *
 *   chat_msg     { type, sender, text, ts }
 *     Scramble chat message. Broadcast to all except sender.
 *
 *   cursor_pos   { type, sender, x, y }
 *     Terminal cursor position (row/col). Broadcast to all except sender.
 *
 *   presence     { type, event: "join"|"leave", id, count }
 *     Connection lifecycle events. Broadcast to all.
 *
 * State shape (canonical, stored in Durable Object):
 *   {
 *     windows: Record<string, WindowState>,  // window_id → state
 *     version: number,                        // monotonic counter
 *   }
 */

import type * as Party from "partykit/server";

// ── Types ──────────────────────────────────────────────────────────────────

interface WindowState {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

interface CanonicalState {
  windows: Record<string, WindowState>;
  version: number;
}

type IncomingMessage =
  | { type: "state_delta"; room_id?: string; delta: StateDelta }
  | { type: "chat_msg"; sender: string; text: string; ts?: number }
  | { type: "cursor_pos"; sender: string; x: number; y: number }
  | { type: "ping" };

interface StateDelta {
  add?: WindowState[];
  remove?: string[];
  update?: WindowState[];
}

// ── Server ─────────────────────────────────────────────────────────────────

export default class WibWobRoom implements Party.Server {
  readonly room: Party.Room;

  // Canonical window state, persisted in Durable Object storage.
  private state: CanonicalState = { windows: {}, version: 0 };
  private stateLoaded = false;

  constructor(room: Party.Room) {
    this.room = room;
  }

  /** Load persisted state from Durable Object storage on first access. */
  private async ensureState(): Promise<void> {
    if (this.stateLoaded) return;
    const stored = await this.room.storage.get<CanonicalState>("state");
    if (stored) {
      this.state = stored;
    }
    this.stateLoaded = true;
  }

  private async saveState(): Promise<void> {
    await this.room.storage.put("state", this.state);
  }

  /** Apply a state delta to canonical state and bump version. */
  private applyDelta(delta: StateDelta): void {
    for (const win of delta.add ?? []) {
      this.state.windows[win.id] = win;
    }
    for (const id of delta.remove ?? []) {
      delete this.state.windows[id];
    }
    for (const win of delta.update ?? []) {
      if (this.state.windows[win.id]) {
        this.state.windows[win.id] = { ...this.state.windows[win.id], ...win };
      } else {
        this.state.windows[win.id] = win;
      }
    }
    this.state.version += 1;
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
    await this.ensureState();

    // Send canonical state to the new joiner.
    conn.send(
      JSON.stringify({
        type: "state_sync",
        state: this.state,
        room: this.room.id,
      })
    );

    // Announce presence to all others.
    this.room.broadcast(
      JSON.stringify({
        type: "presence",
        event: "join",
        id: conn.id,
        count: [...this.room.getConnections()].length,
      }),
      [conn.id]
    );

    console.log(`[${this.room.id}] connect: ${conn.id} (total: ${[...this.room.getConnections()].length})`);
  }

  async onMessage(message: string, sender: Party.Connection): Promise<void> {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(message) as IncomingMessage;
    } catch {
      console.warn(`[${this.room.id}] bad JSON from ${sender.id}`);
      return;
    }

    switch (msg.type) {
      case "state_delta": {
        await this.ensureState();
        this.applyDelta(msg.delta);
        await this.saveState();
        // Broadcast enriched delta (with server version) to all except sender.
        this.room.broadcast(
          JSON.stringify({
            type: "state_delta",
            delta: msg.delta,
            version: this.state.version,
            from: sender.id,
          }),
          [sender.id]
        );
        break;
      }

      case "chat_msg": {
        // Relay chat message to all except sender.
        const relay = {
          type: "chat_msg",
          sender: msg.sender,
          text: msg.text,
          ts: msg.ts ?? Date.now(),
          from: sender.id,
        };
        this.room.broadcast(JSON.stringify(relay), [sender.id]);
        break;
      }

      case "cursor_pos": {
        // Relay cursor position to all except sender.
        const relay = {
          type: "cursor_pos",
          sender: msg.sender,
          x: msg.x,
          y: msg.y,
          from: sender.id,
        };
        this.room.broadcast(JSON.stringify(relay), [sender.id]);
        break;
      }

      case "ping": {
        sender.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        break;
      }

      default:
        console.warn(`[${this.room.id}] unknown message type from ${sender.id}`);
    }
  }

  onClose(conn: Party.Connection): void {
    const remaining = [...this.room.getConnections()].length - 1;
    this.room.broadcast(
      JSON.stringify({
        type: "presence",
        event: "leave",
        id: conn.id,
        count: remaining,
      }),
      [conn.id]
    );
    console.log(`[${this.room.id}] disconnect: ${conn.id} (remaining: ${remaining})`);
  }

  onError(conn: Party.Connection, error: Error): void {
    console.error(`[${this.room.id}] error from ${conn.id}:`, error.message);
  }
}

export { WibWobRoom };
