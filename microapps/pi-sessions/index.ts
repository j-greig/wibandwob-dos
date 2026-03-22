/**
 * Pi Sessions — WibWob-DOS microapp
 *
 * Discovers and connects to live pi coding agent sessions via the
 * control.ts Unix socket protocol. Shows session list, streaming output,
 * and send-message input.
 *
 * @see https://github.com/j-greig/wibandwob-dos/issues/129
 */

// eslint-disable-next-line no-restricted-imports
import blessed from "blessed";
import type { MicroappHost, MicroappWindowHandle } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import { connectPiSession, type PiSessionClient } from "../../lib/pi-session-client.js";
import { discoverPiSessions, sessionDisplayName, type DiscoveredSession } from "../../lib/pi-session-discovery.js";

const APP_TITLE = "Pi Sessions";
const REFRESH_INTERVAL_MS = 5000;

// ============================================================================
// Session List Window
// ============================================================================

function openSessionList(host: MicroappHost) {
  const win = host.createWindow({ title: APP_TITLE, width: 60, height: 24 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  let sessions: DiscoveredSession[] = [];
  let selectedIndex = 0;

  // -- Layout --

  const header = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, height: 1,
    tags: true,
    content: " {bold}Pi Sessions{/bold}  (scanning…)",
    style: { ...host.theme().body, bold: true },
  });

  const list = blessed.box({
    parent: win.body,
    top: 1, left: 0, right: 0, bottom: 2,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    style: host.theme().body,
  });

  const statusBar = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 2,
    tags: true,
    content: " {gray-fg}Enter: connect  r: refresh  q: close{/gray-fg}",
    style: host.theme().body,
  });

  // -- Rendering --

  function renderList() {
    if (sessions.length === 0) {
      list.setContent("\n  No pi sessions found.\n\n  Start pi with the control.ts extension\n  and --session-control flag.");
      header.setContent(` {bold}Pi Sessions{/bold}  (0 found)`);
      host.screen.render();
      return;
    }

    const lines: string[] = [];
    const width = (list.width as number) - 2;

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const indicator = s.alive ? "{green-fg}●{/green-fg}" : "{red-fg}○{/red-fg}";
      const name = sessionDisplayName(s);
      const aliasTag = s.alias ? ` {cyan-fg}(${s.alias}){/cyan-fg}` : "";
      const idSuffix = s.alias ? ` {gray-fg}${s.id.slice(0, 8)}{/gray-fg}` : "";
      const line = ` ${indicator} ${name}${aliasTag}${idSuffix}`;

      if (i === selectedIndex) {
        lines.push(`{inverse}${line.padEnd(width)}{/inverse}`);
      } else {
        lines.push(line);
      }
    }

    list.setContent(lines.join("\n"));
    const aliveCount = sessions.filter((s) => s.alive).length;
    header.setContent(` {bold}Pi Sessions{/bold}  (${aliveCount} live, ${sessions.length} total)`);
    host.screen.render();
  }

  // -- Discovery --

  async function refresh() {
    try {
      sessions = await discoverPiSessions();
      if (selectedIndex >= sessions.length) {
        selectedIndex = Math.max(0, sessions.length - 1);
      }
      renderList();
    } catch {
      list.setContent("\n  {red-fg}Error scanning sessions{/red-fg}");
      host.screen.render();
    }
  }

  // -- Input --

  function handleInput(data: string) {
    if (sessions.length === 0 && data !== "r" && data !== "q") return;

    switch (data) {
      case "j":
      case "\x1b[B": // down arrow
        if (selectedIndex < sessions.length - 1) {
          selectedIndex++;
          renderList();
        }
        break;
      case "k":
      case "\x1b[A": // up arrow
        if (selectedIndex > 0) {
          selectedIndex--;
          renderList();
        }
        break;
      case "\r": // enter
      case "\n":
        if (sessions[selectedIndex]?.alive) {
          openSessionDetail(host, sessions[selectedIndex]);
        } else if (sessions[selectedIndex]) {
          host.flash("Session is not alive — cannot connect");
        }
        break;
      case "r":
        refresh();
        break;
      case "s":
        if (sessions[selectedIndex]?.alive) {
          showSummary(host, sessions[selectedIndex]);
        }
        break;
      case "q":
        win.close();
        break;
    }
  }

  win.body.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    // Map blessed keypress to our handler
    if (key.name === "up") handleInput("\x1b[A");
    else if (key.name === "down") handleInput("\x1b[B");
    else if (key.name === "enter" || key.name === "return") handleInput("\r");
    else if (key.ch) handleInput(key.ch);
  });

  win.setFocusTarget(win.body);
  win.body.focus();

  // -- Lifecycle --

  win.describeState(() => {
    const aliveCount = sessions.filter((s) => s.alive).length;
    return {
      summary: `Pi Sessions — ${aliveCount} live sessions`,
      contentPreview: sessions.map((s) => `${s.alive ? "●" : "○"} ${sessionDisplayName(s)}`).join(", "),
      sessions: sessions.map((s) => ({
        id: s.id,
        alias: s.alias,
        alive: s.alive,
      })),
    };
  });

  win.captureText(() => {
    return sessions
      .map((s) => `${s.alive ? "●" : "○"} ${sessionDisplayName(s)} ${s.alias ? `(${s.alias})` : ""} [${s.id}]`)
      .join("\n");
  });

  win.onRestyle(() => {
    header.style = { ...host.theme().body, bold: true };
    list.style = host.theme().body;
    statusBar.style = host.theme().body;
    host.screen.render();
  });

  // Auto-refresh timer (using SDK createTimer to avoid leaks)
  createTimer(() => refresh(), REFRESH_INTERVAL_MS, timers);

  win.onCleanup(() => {
    clearTimers(timers);
  });

  // Initial scan
  refresh();
  win.focus();
}

// ============================================================================
// Session Detail Window
// ============================================================================

function openSessionDetail(host: MicroappHost, session: DiscoveredSession) {
  const displayName = sessionDisplayName(session);
  const win = host.createWindow({
    title: `π ${displayName}`,
    width: 80,
    height: 30,
  });

  let client: PiSessionClient | null = null;
  let unsubTurnEnd: (() => void) | null = null;
  const logLines: string[] = [];
  const MAX_LOG_LINES = 500;

  // -- Layout --

  const output = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 3,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: "│" },
    style: host.theme().body,
  });

  const divider = blessed.box({
    parent: win.body,
    bottom: 2, left: 0, right: 0, height: 1,
    style: { ...host.theme().body, fg: "gray" },
  });

  function updateDivider() {
    const w = typeof divider.width === "number" ? divider.width : 78;
    divider.setContent("─".repeat(Math.max(1, w)));
  }
  updateDivider();

  const input = blessed.textbox({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 2,
    inputOnFocus: true,
    style: {
      ...host.theme().body,
      focus: { border: { fg: "cyan" } },
    },
  });

  const statusLine = blessed.box({
    parent: win.body,
    bottom: 2, left: 0, right: 0, height: 1,
    tags: true,
    content: " {yellow-fg}Connecting…{/yellow-fg}",
    style: host.theme().body,
  });

  // -- Log --

  function appendLog(text: string, style?: string) {
    const prefix = style ? `{${style}}` : "";
    const suffix = style ? `{/${style}}` : "";
    logLines.push(`${prefix}${text}${suffix}`);
    if (logLines.length > MAX_LOG_LINES) {
      logLines.splice(0, logLines.length - MAX_LOG_LINES);
    }
    output.setContent(logLines.join("\n"));
    output.setScrollPerc(100);
    host.screen.render();
  }

  // -- Connection --

  async function connect() {
    try {
      client = await connectPiSession(session.socketPath);
      statusLine.setContent(` {green-fg}● Connected{/green-fg} to ${displayName}  {gray-fg}[Ctrl-S: summary, Ctrl-A: abort]{/gray-fg}`);
      appendLog(`Connected to pi session: ${displayName}`, "green-fg");

      // Get initial message
      const msg = await client.getLastMessage();
      if (msg.success && msg.data?.message) {
        const text = typeof msg.data.message === "string"
          ? msg.data.message
          : (msg.data.message as { content?: string })?.content ?? JSON.stringify(msg.data.message);
        appendLog("");
        appendLog("─── Last assistant message ───", "cyan-fg");
        appendLog(text);
        appendLog("─────────────────────────────", "cyan-fg");
      }

      // Subscribe to turn_end events
      unsubTurnEnd = client.onTurnEnd((data) => {
        appendLog("");
        appendLog(`─── Turn complete ───`, "cyan-fg");
        if (data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          const msg = d.message;
          if (msg && typeof msg === "object" && "content" in (msg as object)) {
            appendLog(String((msg as { content: string }).content));
          } else if (typeof msg === "string") {
            appendLog(msg);
          } else {
            appendLog(JSON.stringify(data, null, 2));
          }
        } else {
          appendLog("[turn_end event received]", "gray-fg");
        }
      });

      host.screen.render();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      statusLine.setContent(` {red-fg}● Disconnected{/red-fg}  ${msg}`);
      appendLog(`Connection failed: ${msg}`, "red-fg");
      host.screen.render();
    }
  }

  // -- Input handling --

  input.on("submit", async (value: string) => {
    if (!value.trim()) {
      input.clearValue();
      input.focus();
      host.screen.render();
      return;
    }

    input.clearValue();
    appendLog("");
    appendLog(`→ ${value}`, "yellow-fg");

    if (!client?.connected) {
      appendLog("Not connected — cannot send", "red-fg");
      input.focus();
      host.screen.render();
      return;
    }

    try {
      const resp = await client.sendMessage(value, "followUp");
      if (!resp.success) {
        appendLog(`Send failed: ${resp.error ?? "unknown error"}`, "red-fg");
      }
    } catch (err) {
      appendLog(`Send error: ${err instanceof Error ? err.message : String(err)}`, "red-fg");
    }

    input.focus();
    host.screen.render();
  });

  // Keyboard shortcuts on output area
  output.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.ctrl && key.name === "s") {
      // Get summary
      if (client?.connected) {
        appendLog("Requesting summary…", "gray-fg");
        client.getSummary().then((resp) => {
          if (resp.success && resp.data?.summary) {
            appendLog("");
            appendLog("─── Summary ───", "cyan-fg");
            appendLog(resp.data.summary);
            if (resp.data.model) appendLog(`  (model: ${resp.data.model})`, "gray-fg");
          }
          host.screen.render();
        });
      }
    } else if (key.ctrl && key.name === "a") {
      // Abort
      if (client?.connected) {
        appendLog("Aborting…", "yellow-fg");
        client.abort().then(() => {
          appendLog("Abort sent", "yellow-fg");
          host.screen.render();
        });
      }
    } else if (key.name === "tab") {
      input.focus();
      host.screen.render();
    }
  });

  input.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name === "escape") {
      output.focus();
      host.screen.render();
    }
  });

  win.setFocusTarget(output);

  // -- Lifecycle --

  win.describeState(() => ({
    summary: `Pi Session: ${displayName} — ${client?.connected ? "connected" : "disconnected"}`,
    contentPreview: logLines.slice(-5).join("\n"),
    sessionId: session.id,
    alias: session.alias,
    connected: client?.connected ?? false,
  }));

  win.captureText(() => logLines.join("\n"));

  win.onRestyle(() => {
    output.style = host.theme().body;
    input.style = host.theme().body;
    statusLine.style = host.theme().body;
    divider.style = { ...host.theme().body, fg: "gray" };
    updateDivider();
    host.screen.render();
  });

  win.onResize(() => {
    updateDivider();
    host.screen.render();
  });

  // Allow API/agent to inject text as messages to the pi session
  win.onInput(async (text: string) => {
    if (!client?.connected) return;
    appendLog(`→ ${text}`, "yellow-fg");
    try {
      await client.sendMessage(text, "followUp");
    } catch (err) {
      appendLog(`Send error: ${err instanceof Error ? err.message : String(err)}`, "red-fg");
    }
  });

  win.onCleanup(() => {
    if (unsubTurnEnd) unsubTurnEnd();
    if (client) client.close();
  });

  // Connect immediately
  connect();
  win.focus();
}

// ============================================================================
// Summary Popup
// ============================================================================

async function showSummary(host: MicroappHost, session: DiscoveredSession) {
  const displayName = sessionDisplayName(session);
  let client: PiSessionClient | null = null;

  try {
    client = await connectPiSession(session.socketPath);
    const resp = await client.getSummary();
    client.close();

    if (resp.success && resp.data?.summary) {
      host.flash(`[${displayName}] ${resp.data.summary}`);
    } else {
      host.flash(`[${displayName}] No summary available`);
    }
  } catch (err) {
    if (client) client.close();
    host.flash(`[${displayName}] ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================================
// Setup
// ============================================================================

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Discover and connect to live pi coding agent sessions.",
    menu: [{ category: "applications", order: 90, label: APP_TITLE }],
    palette: { order: 90, label: "Open Pi Sessions" },
    action: () => openSessionList(host),
  });

  host.registerCommand({
    id: "refresh",
    label: "Refresh Sessions",
    description: "Re-scan for live pi sessions.",
    direct: true,
    action: async () => {
      const sessions = await discoverPiSessions();
      return {
        ok: true,
        sessions: sessions.map((s) => ({
          id: s.id,
          alias: s.alias,
          alive: s.alive,
          displayName: sessionDisplayName(s),
        })),
      };
    },
  });
}
