/**
 * Window Ports — typed connection points for inter-window data flow.
 *
 * Windows declare ports via describeState() or a dedicated declarePorts() hook.
 * ConnectionService tracks active connections between ports.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WindowPort {
  id: string;
  direction: "in" | "out" | "both";
  dataType: string;
  label?: string;
}

export interface PortConnection {
  id: string;
  from: { windowId: number; portId: string };
  to: { windowId: number; portId: string };
}

// ---------------------------------------------------------------------------
// ConnectionService
// ---------------------------------------------------------------------------

export class ConnectionService {
  private connections: PortConnection[] = [];
  private nextId = 1;

  connect(from: { windowId: number; portId: string }, to: { windowId: number; portId: string }): PortConnection {
    const conn: PortConnection = {
      id: `conn-${this.nextId++}`,
      from,
      to,
    };
    this.connections.push(conn);
    return conn;
  }

  disconnect(connectionId: string): boolean {
    const idx = this.connections.findIndex(c => c.id === connectionId);
    if (idx < 0) return false;
    this.connections.splice(idx, 1);
    return true;
  }

  /** Remove all connections involving a window (on close). */
  removeWindowConnections(windowId: number): void {
    this.connections = this.connections.filter(
      c => c.from.windowId !== windowId && c.to.windowId !== windowId
    );
  }

  /** List all connections. */
  list(): PortConnection[] {
    return [...this.connections];
  }

  /** List connections for a specific window. */
  forWindow(windowId: number): PortConnection[] {
    return this.connections.filter(
      c => c.from.windowId === windowId || c.to.windowId === windowId
    );
  }
}
