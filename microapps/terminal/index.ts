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
import type blessed from "blessed";
import fs from "node:fs";
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

function ensureNodePtyHelperExecutable(nodeModulesPath: string): void {
  const helper = path.join(nodeModulesPath, "node-pty", "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  try {
    if (!fs.existsSync(helper)) return;
    const mode = fs.statSync(helper).mode & 0o777;
    if ((mode & 0o111) !== 0o111) {
      fs.chmodSync(helper, mode | 0o755);
    }
  } catch {
    // Best-effort only. If this still fails, the bridge will surface the real error.
  }
}

function installTerminalMousePassthrough(
  term: blessed.Widgets.BlessedElement & {
    aleft: number;
    atop: number;
    ileft: number;
    itop: number;
    width: number;
    height: number;
    term?: {
      x10Mouse?: boolean;
      vt200Mouse?: boolean;
      normalMouse?: boolean;
      mouseEvents?: boolean;
      utfMouse?: boolean;
      sgrMouse?: boolean;
      urxvtMouse?: boolean;
    };
    screen: blessed.Widgets.Screen & {
      program: blessed.Widgets.Screen["program"] & { sgrMouse?: boolean };
    };
    handler?: (data: string) => void;
    onScreenEvent?: (type: string, handler: (data: blessed.Widgets.Events.IMouseEventArg) => void) => void;
    removeScreenEvent?: (type: string, handler: (data: blessed.Widgets.Events.IMouseEventArg) => void) => void;
    _slisteners?: Array<{ type: string; handler: (data: blessed.Widgets.Events.IMouseEventArg) => void }>;
    _wwTerminalMouseHandler?: (data: blessed.Widgets.Events.IMouseEventArg) => void;
  },
) {
  const existingMouseHandlers = (term._slisteners ?? [])
    .filter((listener) => listener.type === "mouse")
    .map((listener) => listener.handler);

  for (const handler of existingMouseHandlers) {
    term.removeScreenEvent?.("mouse", handler);
  }

  const mouseHandler = (data: blessed.Widgets.Events.IMouseEventArg) => {
    if (term.screen.focused !== term) return;

    if (data.x < term.aleft + term.ileft) return;
    if (data.y < term.atop + term.itop) return;
    if (data.x > term.aleft - term.ileft + term.width) return;
    if (data.y > term.atop - term.itop + term.height) return;

    const state = term.term;
    if (!state) return;
    if (!(
      state.x10Mouse
      || state.vt200Mouse
      || state.normalMouse
      || state.mouseEvents
      || state.utfMouse
      || state.sgrMouse
      || state.urxvtMouse
    )) {
      return;
    }

    let b = data.raw[0];
    const x = data.x - term.aleft + 1;
    const y = data.y - term.atop + 1;
    let sequence: string;

    if (state.urxvtMouse) {
      if (term.screen.program.sgrMouse) b += 32;
      sequence = `\x1b[${b};${x};${y}M`;
    } else if (state.sgrMouse) {
      if (!term.screen.program.sgrMouse) b -= 32;
      sequence = `\x1b[<${b};${x};${y}${data.action === "mousedown" ? "M" : "m"}`;
    } else {
      if (term.screen.program.sgrMouse) b += 32;
      sequence = `\x1b[M${String.fromCharCode(b)}${String.fromCharCode(x + 32)}${String.fromCharCode(y + 32)}`;
    }

    term.handler?.(sequence);
  };

  term._wwTerminalMouseHandler = mouseHandler;
  term.onScreenEvent?.("mouse", mouseHandler);

  const activeMouseHandlers = (term._slisteners ?? [])
    .filter((listener) => listener.type === "mouse")
    .map((listener) => listener.handler);
  if (activeMouseHandlers.length !== 1 || activeMouseHandlers[0] !== mouseHandler) {
    throw new Error("terminal mouse passthrough install failed: expected exactly one active mouse handler");
  }
}

export default function setup(host: MicroappHost) {
  // Track open terminals for write command
  const termWriteHandlers = new Map<number, (text: string) => void>();

  host.registerCommand({
    id: "open",
    label: "Terminal",
    description: "Open a terminal emulator window",
    menu: [{ category: "applications", order: 92, label: "Terminal" }],
    palette: { order: 292, label: "Terminal" },
    action: () => openTerminal(host, termWriteHandlers),
  });

  host.registerCommand({
    id: "write",
    label: "Write to Terminal",
    description:
      "Send text to a terminal window's PTY stdin. Args: text (string, required), windowId (number, required).",
    action: (args) => {
      const text = args?.text as string | undefined;
      const windowId = args?.windowId as number | undefined;
      if (!text) return { error: "text is required" };
      if (windowId === undefined) return { error: "windowId is required" };
      const handler = termWriteHandlers.get(windowId);
      if (!handler) return { error: `no terminal window with id ${windowId}` };
      handler(text);
      return { ok: true, windowId, bytesWritten: text.length };
    },
    palette: false,
    menu: false,
    direct: true,
  });
}

function openTerminal(host: MicroappHost, termWriteHandlers: Map<number, (text: string) => void>) {
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
    // (same gotcha as music player — see .agents/shell-dev/specs/window-system.md)
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

  installTerminalMousePassthrough(term);

  // --- Spawn Node bridge for PTY ---
  let bridge: ChildProcess | null = null;
  let bridgeDead = false;
  let bridgePid = 0;

  function spawnBridge() {
    const nodePtyPath = findNodePtyPath();
    ensureNodePtyHelperExecutable(nodePtyPath);
    bridge = spawn("node", [BRIDGE_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_PATH: nodePtyPath,
        PTY_COLS: String(ptyCols),
        PTY_ROWS: String(ptyRows),
        PTY_CWD: REPO_ROOT,
        PTY_SHELL: process.env.SHELL || "/bin/zsh",
        // Prevent zsh/shell from probing kitty keyboard protocol, bracketed
        // paste extensions, etc. that blessed's term.js doesn't understand —
        // leaked escape fragments appear as literal text like "5u".
        TERM: "xterm",
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

  win.onInput((input: string) => {
    if (!bridge || bridgeDead) return;
    bridge.stdin?.write(input.replace(/\r/g, "\n"));
  });

  win.onRestyle(() => {
    const t = host.theme();
    term.style = { bg: t.body.bg, fg: t.body.fg };
    host.screen.render();
  });

  // Register write handler for this terminal
  termWriteHandlers.set(win.id, (text: string) => {
    if (bridge && !bridgeDead) {
      bridge.stdin?.write(text);
    }
  });

  win.onCleanup(() => {
    termWriteHandlers.delete(win.id);
    if (bridge && !bridgeDead) {
      bridge.stdin?.write("\x00" + JSON.stringify({ type: "kill" }) + "\n");
      // SIGTERM immediately, SIGKILL after 1s fallback
      try { bridge.kill("SIGTERM"); } catch { /* already dead */ }
      const b = bridge;
      setTimeout(() => { try { b.kill("SIGKILL"); } catch { /* ok */ } }, 1000);
    }
    bridge = null;
    bridgeDead = true;
  });

  // Redirect window focus to the terminal widget so blessed's Terminal
  // _onData handler sees screen.focused === term and forwards keystrokes
  win.setFocusTarget(term);

  // Click inside terminal → grab focus (aggressive: both term and body)
  term.on("click", () => { term.focus(); host.screen.render(); });
  body.on("click", () => { term.focus(); host.screen.render(); });
  // Also grab focus when the window gets focus from the window manager
  body.on("focus", () => { term.focus(); });

  term.focus();
  host.screen.render();
}
