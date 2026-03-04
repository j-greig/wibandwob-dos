import type { WibWobAgentSession } from "../services/wibwob-agent-session.js";

const HELP_TEXT =
  "[commands]\n" +
  "  /help       — show this list\n" +
  "  /session    — session id, model, message count, log path\n" +
  "  /new        — start a fresh session\n" +
  "  /resume [n] — list or load previous sessions\n" +
  "  /reload     — hot-swap system prompt from disk\n" +
  "  /stop       — abort current generation\n" +
  "  /model      — show current model info\n" +
  "  /tools      — list active tools\n" +
  "  /clear      — clear transcript (keeps session)";

export function dispatchSlashCommand(
  trimmed: string,
  agent: WibWobAgentSession,
  runResumeCommand: (arg: string) => void,
): boolean {
  if (trimmed === "/help") {
    agent.pushStatus(HELP_TEXT);
    return true;
  }

  if (trimmed === "/new") {
    agent.reset();
    return true;
  }

  if (trimmed === "/session") {
    const snap = agent.getSnapshot();
    agent.pushStatus(
      `[session] ${snap.sessionId}\n  model: ${snap.model ?? "—"}\n  messages: ${snap.messageCount}\n  log: ${snap.sessionFile ?? "(no log)"}`
    );
    return true;
  }

  if (trimmed.startsWith("/resume")) {
    runResumeCommand(trimmed.slice("/resume".length));
    return true;
  }

  if (trimmed === "/stop") {
    const aborted = agent.abort();
    if (!aborted) agent.pushStatus("[stop] Nothing running.");
    return true;
  }

  if (trimmed === "/model") {
    const snap = agent.getSnapshot();
    agent.pushStatus(`[model] ${snap.model ?? "no model loaded"}`);
    return true;
  }

  if (trimmed === "/tools") {
    const names = agent.getToolNames();
    if (names.length === 0) {
      agent.pushStatus("[tools] No tools registered (chat mode?)");
    } else {
      agent.pushStatus(`[tools] ${names.length} active\n  ${names.join("\n  ")}`);
    }
    return true;
  }

  if (trimmed === "/clear") {
    agent.clearTranscript();
    return true;
  }

  return false;
}
