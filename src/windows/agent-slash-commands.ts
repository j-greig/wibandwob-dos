import { exec } from "node:child_process";
import path from "node:path";
import type { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { buildLocalControlApiBaseUrl } from "../runtime/runtime-node.js";

const CONTROL_API_BASE_URL = buildLocalControlApiBaseUrl();

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
  "  /clear      — clear transcript (keeps session)\n" +
  "  /minimap    — ASCII spatial map of desktop windows\n" +
  "  /state      — compact desktop state summary\n" +
  "  /dance      — open GlitchBox and start dancing";

export async function dispatchSlashCommand(
  trimmed: string,
  agent: WibWobAgentSession,
  runResumeCommand: (arg: string) => void,
): Promise<boolean> {
  if (trimmed === "/help") {
    agent.pushStatus(HELP_TEXT);
    return true;
  }

  if (trimmed === "/new") {
    await agent.reset();
    return true;
  }

  if (trimmed === "/session") {
    const stats = agent.getSessionStats();
    const snap = agent.getSnapshot();
    if (stats) {
      agent.pushStatus(
        `[session] ${stats.sessionId}\n  model: ${snap.model ?? "—"}\n  messages: ${stats.totalMessages} (${stats.userMessages} user / ${stats.assistantMessages} assistant)\n  tokens: in ${stats.tokens.input}  out ${stats.tokens.output}  total ${stats.tokens.total}\n  cost: $${stats.cost.toFixed(4)}\n  log: ${stats.sessionFile ?? "(no log)"}`
      );
    } else {
      agent.pushStatus(
        `[session] ${snap.sessionId}\n  model: ${snap.model ?? "—"}\n  messages: ${snap.messageCount}\n  log: ${snap.sessionFile ?? "(no log)"}`
      );
    }
    return true;
  }

  if (trimmed.startsWith("/resume")) {
    runResumeCommand(trimmed.slice("/resume".length));
    return true;
  }

  if (trimmed === "/stop") {
    const aborted = await agent.abort();
    if (!aborted) agent.pushStatus("[stop] Nothing running.");
    return true;
  }

  if (trimmed === "/reload") {
    const reloaded = await agent.reload();
    agent.pushStatus(reloaded ? "[reload] Prompt/runtime reloaded." : "[reload] No active session.");
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

  if (trimmed === "/minimap") {
    const script = path.join(process.cwd(), "scripts", "minimap.sh");
    exec(script, { timeout: 5000 }, (err, stdout) => {
      agent.pushStatus(err ? "[minimap] app not running or script failed" : stdout.trimEnd());
    });
    return true;
  }

  if (trimmed === "/dance") {
    fetch(`${CONTROL_API_BASE_URL}/commands/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "microapp.wibwob.glitchbox.glitchbox.open" }),
    })
      .then(() => agent.pushStatus("[dance] GlitchBox opened — Wib&Wob on the floor"))
      .catch(() => agent.pushStatus("[dance] could not open GlitchBox"));
    return true;
  }

  if (trimmed === "/state") {
    fetch(`${CONTROL_API_BASE_URL}/state`)
      .then((r) => r.json())
      .then((d: Record<string, any>) => {
        const app = d.app ?? {};
        const scr = d.screen ?? {};
        const wins = (d.windows ?? []) as Array<Record<string, any>>;
        const focusId = d.focus?.windowId;
        const lines = [
          `[desktop] ${app.theme ?? "?"}  ${scr.width}x${scr.height}  ${wins.length} windows  focus:${focusId ?? "none"}`,
        ];
        for (const w of wins.sort((a, b) => a.id - b.id)) {
          const marker = w.id === focusId ? " ◀" : "";
          lines.push(
            `  ${String(w.id).padStart(3)}  ${(w.appType ?? w.kind).padEnd(20)} ${w.title.slice(0, 24).padEnd(24)}  ${w.width}x${w.height}  @${w.left},${w.top}${marker}`
          );
        }
        agent.pushStatus(lines.join("\n"));
      })
      .catch(() => agent.pushStatus("[state] app not running"));
    return true;
  }

  return false;
}
