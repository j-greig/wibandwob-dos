/**
 * Terminal module — PTY-backed terminal emulator window for WibWob-DOS.
 *
 * Architecture:
 *   Bun process ←stdio→ Node bridge ←pty→ /bin/zsh
 *
 * Blessed's Terminal widget (term.js) handles escape-sequence parsing and
 * screen-buffer management. A small Node bridge subprocess owns the real
 * PTY via node-pty, working around Bun's libuv incompatibility with
 * native addon event callbacks.
 */
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";
import { spawn, type ChildProcess } from "child_process";
import path from "path";

const BRIDGE_SCRIPT = path.join(import.meta.dir, "pty-bridge.cjs");
const REPO_ROOT = path.resolve(import.meta.dir, "../..");

/** Find node-pty for the bridge. Prefer repo copy, fall back to /tmp test install. */
function findNodePtyPath(): string {
  const candidates = [
    path.join(REPO_ROOT, "node_modules"),
    "/tmp/pty-test/node_modules",
  ];
  for (const c of candidates) {
    try {
      // Check if pty.node binary exists (the native addon)
      const ptyNode = path.join(c, "node-pty/build/Release/pty.node");
      if (Bun.file(ptyNode).size) return c;
    } catch { /* next */ }
  }
  return candidates[0]; // best-effort fallback
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Terminal",
    description: "Open a terminal emulator window",
    menu: [{ category: "applications", order: 92, label: "Terminal" }],
    palette: { order: 292, label: "Terminal" },
    action: () => openTerminal(host),
  });
}

function openTerminal(host: MicroappHost) {
  const W = 82;
  const H = 26;
  const win = host.createWindow({ title: "Terminal", width: W, height: H });

  // --- Compute inner content dimensions ---
  // body is already inside window chrome — no extra subtraction needed.
  // The terminal widget fills 100% of body, term.js accounts for its own iwidth.
  const body = win.body;
  const bodyW = typeof body.width === "number" ? body.width : W - 2;
  const bodyH = typeof body.height === "number" ? body.height : H - 2;
  const ptyCols = Math.max(20, bodyW);
  const ptyRows = Math.max(5, bodyH);

  // --- Create blessed terminal widget (handler mode — no pty.js) ---
  const term = (blessed as any).terminal({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    // input + keys required for blessed.box keypress events to fire
    // (same gotcha as music player — see .agents/specs/window-system.md)
    input: true,
    keys: true,
    mouse: true,
    handler: (data: string) => {
      // Input from blessed → PTY bridge stdin
      if (bridge && !bridgeDead) {
        bridge.stdin?.write(data);
      }
    },
    shell: "/bin/zsh",     // only used for term.js metadata, not actual spawn
    terminal: "xterm-256color",
    cursor: "block",
    cursorBlink: true,
    screenKeys: true,
    style: {
      bg: host.theme().body.bg,
      fg: host.theme().body.fg,
    },
  });

  // --- Spawn Node bridge for PTY ---
  let bridge: ChildProcess | null = null;
  let bridgeDead = false;
  let bridgePid = 0;

  function spawnBridge() {
    const nodePtyPath = findNodePtyPath();
    bridge = spawn("node", [BRIDGE_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_PATH: nodePtyPath,
        PTY_COLS: String(ptyCols),
        PTY_ROWS: String(ptyRows),
        PTY_CWD: REPO_ROOT,
        PTY_SHELL: process.env.SHELL || "/bin/zsh",
      },
    });

    // PTY output → blessed terminal widget
    bridge.stdout?.on("data", (chunk: Buffer) => {
      if (!bridgeDead) {
        term.write(chunk.toString("utf8"));
        host.screen.render();
      }
    });

    // Control messages from bridge
    bridge.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "ready") bridgePid = msg.pid;
          if (msg.type === "exit") {
            bridgeDead = true;
            term.write("\r\n[Process exited]\r\n");
            host.screen.render();
          }
        } catch { /* not JSON, ignore */ }
      }
    });

    bridge.on("close", () => {
      bridgeDead = true;
    });

    bridge.on("error", (err) => {
      bridgeDead = true;
      term.write(`\r\n[Bridge error: ${err.message}]\r\n`);
      host.screen.render();
    });
  }

  spawnBridge();

  // --- Resize handling ---
  win.onResize(() => {
    const newW = typeof body.width === "number" ? body.width : W - 2;
    const newH = typeof body.height === "number" ? body.height : H - 2;
    const cols = Math.max(20, newW);
    const rows = Math.max(5, newH);
    // Resize blessed terminal emulator
    term.term?.resize(cols, rows);
    // Resize PTY in bridge
    if (bridge && !bridgeDead) {
      bridge.stdin?.write("\x00" + JSON.stringify({ type: "resize", cols, rows }) + "\n");
    }
  });

  // --- State & lifecycle ---
  win.describeState(() => ({
    summary: `Terminal — ${bridgeDead ? "exited" : "running"} pid:${bridgePid}`,
    running: !bridgeDead,
    pid: bridgePid,
  }));

  win.captureText(() => {
    // Capture visible terminal content
    try {
      const lines: string[] = [];
      const termLines = term.term?.lines;
      if (termLines) {
        for (let y = 0; y < Math.min(ptyRows, termLines.length); y++) {
          const row = termLines[y];
          if (!row) continue;
          let line = "";
          for (let x = 0; x < row.length; x++) {
            line += row[x]?.[1] || " ";
          }
          lines.push(line.trimEnd());
        }
      }
      return lines.join("\n");
    } catch {
      return "(terminal capture unavailable)";
    }
  });

  win.onRestyle(() => {
    const t = host.theme();
    term.style = { bg: t.body.bg, fg: t.body.fg };
    host.screen.render();
  });

  win.onCleanup(() => {
    if (bridge && !bridgeDead) {
      bridge.stdin?.write("\x00" + JSON.stringify({ type: "kill" }) + "\n");
      setTimeout(() => bridge?.kill(), 500);
    }
    bridgeDead = true;
  });

  // Redirect window focus to the terminal widget so blessed's Terminal
  // _onData handler sees screen.focused === term and forwards keystrokes
  win.setFocusTarget(term);

  // Click inside terminal → grab focus
  term.on("click", () => { term.focus(); });
  body.on("click", () => { term.focus(); });

  // Fix blessed Terminal mouse y-offset bug: the built-in handler uses
  // y = data.y - self.atop but doesn't subtract 1 for the 0-indexed
  // term.js grid. Patch by overriding the screen mouse listener.
  if (term._onData) {
    // Remove blessed's built-in raw input listener — we handle it ourselves
    // (the handler callback already receives keystrokes via the bootstrap)
  }
  // Monkey-patch: shift mouse y by -1 inside the terminal's screen event
  const origOnScreenEvent = term.onScreenEvent.bind(term);
  // The terminal already registered a 'mouse' screen event in bootstrap().
  // We can't easily patch that, but we CAN adjust the term.js write offset.

  term.focus();
  host.screen.render();
}
