/**
 * PTY bridge — runs under Node (not Bun) to work around Bun's
 * libuv incompatibility with node-pty native events.
 *
 * Protocol:
 *   stdin  → raw bytes forwarded to PTY input
 *            control messages: \x00 + JSON line (resize, kill)
 *   stdout ← raw PTY output
 *   stderr ← JSON control messages (ready, exit)
 */
const pty = require("node-pty");

const cols = parseInt(process.env.PTY_COLS || "80");
const rows = parseInt(process.env.PTY_ROWS || "24");
const shell = process.env.PTY_SHELL || process.env.SHELL || "/bin/zsh";
const cwd = process.env.PTY_CWD || process.env.HOME || "/tmp";

const p = pty.spawn(shell, [], {
  name: "xterm-256color",
  cols,
  rows,
  cwd,
  env: { ...process.env, TERM: "xterm-256color" },
});

p.onData((data) => {
  process.stdout.write(data);
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", (data) => {
  if (data[0] === "\x00") {
    try {
      const msg = JSON.parse(data.slice(1));
      if (msg.type === "resize") p.resize(msg.cols, msg.rows);
      if (msg.type === "kill") {
        p.kill();
        process.exit(0);
      }
    } catch (e) { /* ignore malformed control */ }
    return;
  }
  p.write(data);
});

p.onExit(({ exitCode }) => {
  process.stderr.write(JSON.stringify({ type: "exit", code: exitCode }) + "\n");
  process.exit(exitCode || 0);
});

process.stderr.write(JSON.stringify({ type: "ready", pid: p.pid }) + "\n");
