import blessed from "blessed";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import fs from "node:fs";
import path from "node:path";
import type { MicroappHost, LogSeverity } from "../../src/services/microapp-sdk.js";
import {
  createButton,
  createButtonBar,
  createDataTable,
  createFormField,
  createHeaderBar,
  createKeyValuePanel,
  createLogView,
  createNodePart,
  createRow,
  createRule,
  createSelect,
  createStack,
  createStatusBar,
  createTextArea,
  renderFiglet,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "LLM Orch Studio";
const ORCH_ROOT = path.resolve(import.meta.dir, "../../scratch/llm-orchestrator");
const RUNS_ROOT = path.resolve(import.meta.dir, "../../scratch/llm-orch-runs");

const TOPIC_PRESETS = [
  "Should we trust AI in civic decision making?",
  "Is constraint the secret ingredient of creativity?",
  "What makes terminal-native art emotionally real?",
  "Can playful systems improve technical collaboration?",
];

type RunStatus = "idle" | "running" | "completed" | "failed" | "stopped";

interface TurnRow {
  speaker: string;
  model: string;
  excerpt: string;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Run llm-orchestrator CLI and watch wib/wob converse live.",
    menu: [{ category: "applications", order: 173, label: APP_TITLE }],
    palette: { order: 173, label: "Open LLM Orch Studio" },
    action: () => openStudio(host),
  });
}

function openStudio(host: MicroappHost) {
  const win = host.createWindow({ title: APP_TITLE, width: 126, height: 40 });

  let topic = TOPIC_PRESETS[0]!;
  let status: RunStatus = "idle";
  let lastError = "-";
  let runDir = "-";
  let startedAt = "-";
  let endedAt = "-";
  let pid = "-";
  let runCount = 0;
  let currentProc: ChildProcess | null = null;
  let killScriptPath = "-";
  let stdoutRemainder = "";
  let stderrRemainder = "";
  let turnRows: TurnRow[] = [];
  let activeTurn: { speaker: string; model: string } | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let runStamp = "-";
  let logPaths = {
    stream: "-",
    stdout: "-",
    stderr: "-",
    turns: "-",
    status: "-",
  };

  // ── Figlet header ──────────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 0,
    tags: false,
    style: { fg: host.theme().accent?.fg ?? host.theme().body.fg, bg: host.theme().body.bg },
  });
  function refreshHeader() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const font = w >= 80 ? "slant" : undefined;
    try {
      const art = font ? renderFiglet("LLM ORCH", font) : "═══ LLM ORCH STUDIO ═══";
      const subtitle = "  wib ↔ wob conversation orchestrator";
      headerBox.setContent(art + "\n" + subtitle);
    } catch {
      headerBox.setContent("═══ LLM ORCH STUDIO ═══\n  wib ↔ wob conversation orchestrator");
    }
  }

  // ── Topic input ───────────────────────────────────────────────────
  const topicInput = createTextArea({
    value: topic,
    rows: 2,
    onChange: (event) => {
      topic = event.value;
      refreshSettings();
    },
  });
  const topicField = createFormField({
    label: "Topic",
    help: "Wib (Haiku) vs Wob (Sonnet). ASCII in each turn.",
    child: topicInput,
  });

  const presetSelect = createSelect({
    options: TOPIC_PRESETS.map((value, i) => ({ label: `Preset ${i + 1}`, value })),
    selected: TOPIC_PRESETS[0],
    onChange: (event) => {
      if (status === "running" && event.value !== topic) {
        appendStep("preset changed while running; killing current process", "warning");
        forceKillRun();
      }
      topic = event.value;
      topicInput.update({ value: topic });
      topicField.update({ error: "" });
      refreshSettings();
      host.screen.render();
    },
  });

  // ── Action buttons in a horizontal bar ────────────────────────────
  const runButton = createButton({
    label: "▶ RUN",
    onPress: () => {
      if (!applyTopicFromInput({ killRunning: true })) return;
      startRun();
    },
  });

  const stopButton = createButton({
    label: "■ STOP",
    disabled: true,
    onPress: () => stopRun("stopped"),
  });

  const killButton = createButton({
    label: "✕ KILL",
    disabled: true,
    onPress: () => forceKillRun(),
  });

  const actionBar = createRow(win.body, [
    { key: "run", basis: "1fr", part: runButton },
    { key: "stop", basis: "1fr", part: stopButton },
    { key: "kill", basis: "1fr", part: killButton },
  ], { gap: 1 });

  // ── Status banner ─────────────────────────────────────────────────
  const statusBanner = blessed.box({
    parent: win.body,
    top: 0, left: 0, width: 0, height: 1,
    tags: false,
    align: "center" as const,
    style: {
      fg: host.theme().body.bg,
      bg: host.theme().accent?.fg ?? host.theme().body.fg,
      bold: true,
    },
  });
  function refreshBanner() {
    const labels: Record<RunStatus, string> = {
      idle: " ○ READY ",
      running: " ◉ RUNNING ",
      completed: " ✓ COMPLETED ",
      failed: " ✕ FAILED ",
      stopped: " ■ STOPPED ",
    };
    statusBanner.setContent(labels[status] ?? " ○ READY ");
    if (status === "running") {
      statusBanner.style.bg = host.theme().accent?.fg ?? host.theme().body.fg;
    } else if (status === "failed") {
      statusBanner.style.bg = "red";
    } else if (status === "completed") {
      statusBanner.style.bg = "green";
    } else {
      statusBanner.style.bg = host.theme().muted?.fg ?? host.theme().body.fg;
    }
  }

  // ── Conversation & logs ───────────────────────────────────────────
  const convoLog = createLogView({ border: true, label: "Wib ↔ Wob Conversation", maxEntries: 500 });
  const stepsLog = createLogView({ border: true, label: "Steps / Stream", maxEntries: 800 });

  // ── Compact settings ──────────────────────────────────────────────
  const settingsPanel = createKeyValuePanel({
    border: true,
    label: "Run Settings",
    entries: [],
  });

  // ── Turns table ───────────────────────────────────────────────────
  const turnsTable = createDataTable({
    columns: [
      { key: "speaker", label: "Speaker", width: 8 },
      { key: "model", label: "Model", width: 8 },
      { key: "excerpt", label: "Excerpt" },
    ],
    rows: [],
  });

  // ── Layout tree ───────────────────────────────────────────────────
  const topicControls = createStack(win.body, [
    { key: "topic", basis: 5, part: topicField },
    { key: "preset", basis: 1, part: presetSelect },
  ], { gap: 0 });

  const left = createStack(win.body, [
    { key: "header", basis: 6, part: createNodePart(headerBox) },
    { key: "topicControls", basis: 6, part: topicControls },
    { key: "banner", basis: 1, part: createNodePart(statusBanner) },
    { key: "actions", basis: 1, part: actionBar },
    { key: "convo", basis: "1fr", part: convoLog },
    { key: "turns", basis: 5, part: turnsTable },
  ], { gap: 0 });

  const right = createStack(win.body, [
    { key: "settings", basis: 10, part: settingsPanel },
    { key: "steps", basis: "1fr", part: stepsLog },
  ], { gap: 1 });

  const root = createRow(win.body, [
    { key: "left", basis: "3fr", part: left },
    { key: "right", basis: "2fr", part: right },
  ], { gap: 1 });

  // Seed idle state with atmospheric placeholder messages
  convoLog.append({ text: "Waiting for a conversation to begin...", severity: "info" });
  convoLog.append({ text: "Press ▶ RUN to start Wib & Wob talking.", severity: "info" });
  stepsLog.append({ text: "─── orchestrator idle ───", severity: "info" });
  stepsLog.append({ text: "Ready to launch cargo run --release", severity: "info" });

  refreshSettings();
  refreshHeader();
  refreshBanner();
  layout();

  function layout() {
    const width = Math.max(1, Number(win.body.width) || 0);
    const height = Math.max(1, Number(win.body.height) || 0);
    refreshHeader();
    root.layout({ top: 0, left: 0, width, height });
    host.screen.render();
  }

  function nowStamp() {
    return new Date().toISOString().replace("T", " ").replace(/\..+/, "");
  }

  function appendStep(text: string, severity: LogSeverity = "info") {
    stepsLog.append({ text, severity });
    if (logPaths.stream !== "-") {
      appendLine(logPaths.stream, `[${new Date().toISOString()}] ${severity.toUpperCase()} ${text}`);
    }
  }

  function refreshTurnsTable() {
    turnsTable.update({ rows: turnRows.slice(-3) });
  }

  function appendTurn(speaker: string, model: string, content: string) {
    const clean = content.trim();
    if (!clean) return;
    convoLog.append({ text: `${speaker}: ${clean}`, severity: "success" });
    turnRows = [...turnRows, {
      speaker,
      model,
      excerpt: clean.replace(/\s+/g, " ").slice(0, 120),
    }].slice(-80);
    refreshTurnsTable();
    if (logPaths.turns !== "-") {
      appendLine(logPaths.turns, JSON.stringify({
        ts: new Date().toISOString(),
        speaker,
        model,
        content: clean,
        kind: "start",
      }));
    }
  }

  function appendTurnContinuation(line: string) {
    const clean = line.replace(/\r/g, "");
    convoLog.append({ text: `  ${clean}`, severity: "info" });

    if (turnRows.length > 0) {
      const idx = turnRows.length - 1;
      const prev = turnRows[idx]!;
      const nextExcerpt = `${prev.excerpt} ${clean}`.replace(/\s+/g, " ").slice(0, 120);
      turnRows = [
        ...turnRows.slice(0, idx),
        { ...prev, excerpt: nextExcerpt },
        ...turnRows.slice(idx + 1),
      ];
      refreshTurnsTable();
    }

    if (logPaths.turns !== "-" && activeTurn) {
      appendLine(logPaths.turns, JSON.stringify({
        ts: new Date().toISOString(),
        speaker: activeTurn.speaker,
        model: activeTurn.model,
        content: clean,
        kind: "continuation",
      }));
    }
  }

  function applyTopicFromInput(opts: { killRunning: boolean }): boolean {
    const proposed = topicInput.value().trim();
    if (!proposed) {
      topicField.update({ error: "Topic is required" });
      host.screen.render();
      return false;
    }

    const changed = proposed !== topic;
    const wasRunning = status === "running";

    if (changed && wasRunning && opts.killRunning) {
      appendStep("topic changed while running; killing current process", "warning");
      forceKillRun();
    }

    topic = proposed;
    topicField.update({ error: "" });
    refreshSettings();
    return true;
  }

  function writeStatusLog(extra: Record<string, unknown> = {}) {
    if (logPaths.status === "-") return;
    const payload = {
      ts: new Date().toISOString(),
      status,
      topic,
      runStamp,
      pid,
      runDir,
      turns: turnRows.length,
      lastError,
      ...extra,
    };
    appendLine(logPaths.status, JSON.stringify(payload));
  }

  function stopHeartbeat() {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat(mainPid: number) {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (status !== "running") return;
      const snapshot = inspectProcessTree(mainPid);
      appendStep(`heartbeat pid=${mainPid}`);
      if (logPaths.stream !== "-") {
        appendLine(logPaths.stream, `[${new Date().toISOString()}] PROCESS ${snapshot}`);
      }
      writeStatusLog({ heartbeat: true });
    }, 10000);
  }

  function refreshSettings() {
    // Show compact essential info; verbose paths only when running/completed
    const entries: Array<{ key: string; value: string }> = [
      { key: "Status", value: status },
      { key: "Wib", value: "cc:haiku" },
      { key: "Wob", value: "cc:sonnet" },
      { key: "Runs", value: String(runCount) },
      { key: "PID", value: pid },
      { key: "Started", value: startedAt },
      { key: "Ended", value: endedAt },
    ];
    if (lastError !== "-") {
      entries.push({ key: "Error", value: lastError.slice(0, 60) });
    }
    settingsPanel.update({ entries });

    refreshBanner();
    runButton.update({ disabled: status === "running" });
    stopButton.update({ disabled: status !== "running" });
    killButton.update({ disabled: status !== "running" });
  }

  function startRun() {
    if (status === "running") return;

    if (!fs.existsSync(ORCH_ROOT)) {
      status = "failed";
      lastError = `llm-orchestrator repo missing at ${ORCH_ROOT}`;
      appendStep(lastError, "error");
      refreshSettings();
      host.screen.render();
      return;
    }

    const claudePath = findClaudeBinary();
    if (!claudePath) {
      status = "failed";
      lastError = "claude binary not found. Install/auth Claude Code first.";
      appendStep(lastError, "error");
      refreshSettings();
      host.screen.render();
      return;
    }

    turnRows = [];
    activeTurn = null;
    refreshTurnsTable();
    convoLog.clear();
    stepsLog.clear();

    const files = writeRunFiles(topic);
    runDir = files.runDir;
    runStamp = files.runStamp;
    logPaths = files.logPaths;
    killScriptPath = files.killScriptPath;
    status = "running";
    lastError = "-";
    startedAt = nowStamp();
    endedAt = "-";
    runCount += 1;
    appendStep(`run ${runCount} starting`, "success");
    appendStep(`topic: ${topic}`);
    appendStep(`config: ${files.conversationPath}`);
    appendStep(`actors: ${files.actorsDir}`);
    appendStep(`run dir: ${files.runDir}`);

    const runArgs = ["run", "--release", "--", "--config", files.conversationPath, "--actors", files.actorsDir];

    currentProc = spawn("cargo", runArgs, {
      cwd: ORCH_ROOT,
      env: {
        ...process.env,
        PATH: `${path.dirname(claudePath)}:${process.env.PATH ?? ""}`,
        RUST_LOG: process.env.RUST_LOG ?? "llm_orchestrator=info",
      },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });

    pid = currentProc.pid ? String(currentProc.pid) : "-";
    if (killScriptPath !== "-") {
      writeKillScript(killScriptPath, runDir, currentProc.pid);
    }
    if (logPaths.stream !== "-") {
      appendLine(logPaths.stream, `[${new Date().toISOString()}] COMMAND cargo ${runArgs.join(" ")}`);
      appendLine(logPaths.stream, `[${new Date().toISOString()}] CWD ${ORCH_ROOT}`);
      appendLine(logPaths.stream, `[${new Date().toISOString()}] CLAUDE ${claudePath}`);
      appendLine(logPaths.stream, `[${new Date().toISOString()}] ENV RUST_LOG=${process.env.RUST_LOG ?? "llm_orchestrator=info"}`);
    }
    writeStatusLog({ event: "spawned" });

    if (currentProc.pid) {
      startHeartbeat(currentProc.pid);
    }

    refreshSettings();
    host.screen.render();

    currentProc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (logPaths.stdout !== "-") appendRaw(logPaths.stdout, text);
      stdoutRemainder += text;
      stdoutRemainder = consumeLines(stdoutRemainder, (line) => handleLine("out", line));
    });

    currentProc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (logPaths.stderr !== "-") appendRaw(logPaths.stderr, text);
      stderrRemainder += text;
      stderrRemainder = consumeLines(stderrRemainder, (line) => handleLine("err", line));
    });

    currentProc.on("error", (error) => {
      status = "failed";
      lastError = error.message;
      endedAt = nowStamp();
      appendStep(`spawn error: ${error.message}`, "error");
      stopHeartbeat();
      writeStatusLog({ event: "spawn-error", message: error.message });
      currentProc = null;
      pid = "-";
      refreshSettings();
      host.screen.render();
    });

    currentProc.on("close", (code, signal) => {
      const wasStopped = status === "stopped";
      if (status === "running") {
        status = code === 0 ? "completed" : "failed";
      }
      if (!wasStopped && code !== 0) {
        lastError = `process ended code=${code ?? "-"} signal=${signal ?? "-"}`;
      }
      if (stdoutRemainder.trim()) handleLine("out", stdoutRemainder.trim());
      if (stderrRemainder.trim()) handleLine("err", stderrRemainder.trim());
      stdoutRemainder = "";
      stderrRemainder = "";
      endedAt = nowStamp();
      appendStep(`process closed code=${code ?? "-"} signal=${signal ?? "-"}`, code === 0 ? "success" : "warning");
      stopHeartbeat();
      activeTurn = null;
      writeStatusLog({ event: "close", code, signal });
      currentProc = null;
      pid = "-";
      refreshSettings();
      host.screen.render();
    });
  }

  function stopRun(nextStatus: RunStatus) {
    if (!currentProc) return;
    status = nextStatus;
    appendStep("stopping run...", "warning");
    try {
      const groupPid = currentProc.pid;
      if (typeof groupPid === "number" && groupPid > 0) {
        try { process.kill(-groupPid, "SIGTERM"); } catch { currentProc.kill("SIGTERM"); }
        setTimeout(() => {
          try { process.kill(-groupPid, "SIGKILL"); } catch {
            try { currentProc?.kill("SIGKILL"); } catch { /* no-op */ }
          }
        }, 1200);
      } else {
        currentProc.kill("SIGTERM");
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      appendStep(`stop error: ${lastError}`, "error");
    }
    stopHeartbeat();
    activeTurn = null;
    writeStatusLog({ event: "stop-requested" });
    refreshSettings();
    host.screen.render();
  }

  function forceKillRun() {
    appendStep("force kill requested", "warning");
    const pidNum = Number(pid);

    try {
      if (Number.isFinite(pidNum) && pidNum > 0) {
        try { process.kill(-pidNum, "SIGKILL"); } catch {
          try { process.kill(pidNum, "SIGKILL"); } catch { /* continue fallback */ }
        }
      }

      if (runDir !== "-") {
        const pattern = `llm-orchestrator|${escapeForRegex(runDir)}|${escapeForRegex(path.join(runDir, "conversation.toml"))}`;
        spawnSync("pkill", ["-f", pattern], { encoding: "utf8" });
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      appendStep(`force kill error: ${lastError}`, "error");
    }

    status = "stopped";
    currentProc = null;
    activeTurn = null;
    pid = "-";
    stopHeartbeat();
    writeStatusLog({ event: "force-kill" });
    refreshSettings();
    host.screen.render();
  }

  function handleLine(source: "out" | "err", rawLine: string) {
    const line = rawLine.trim();
    if (!line) return;
    const plainLine = stripAnsi(line);
    const channel = source === "err" ? "stderr" : "stdout";
    appendStep(`${channel}> ${plainLine}`);

    const talk = parseTalkLine(plainLine);
    if (talk) {
      activeTurn = { speaker: talk.speaker, model: talk.model };
      appendTurn(talk.speaker, talk.model, talk.message);
      host.screen.render();
      return;
    }

    if (source === "out" && activeTurn && !looksLikeSystemLine(plainLine)) {
      appendTurnContinuation(plainLine);
      host.screen.render();
      return;
    }

    if (plainLine.includes("CONVERSATION ENDED")) {
      appendStep("conversation ended", "success");
    }

    if (plainLine.includes("step=") || plainLine.includes("PromptSent") || plainLine.includes("awaits input")) {
      appendStep(`step: ${plainLine.replace(/\s+/g, " ").slice(0, 220)}`, "warning");
    }

    host.screen.render();
  }

  win.onResize(layout);

  win.onInput((input) => {
    const text = input.trim();
    if (!text) return;

    if (text === "/run") {
      const proposed = topicInput.value().trim();
      if (proposed) topic = proposed;
      startRun();
      return;
    }

    if (text === "/stop") {
      stopRun("stopped");
      return;
    }

    if (text === "/kill") {
      forceKillRun();
      return;
    }

    if (text.startsWith("/topic ")) {
      const nextTopic = text.slice("/topic ".length).trim();
      if (!nextTopic) {
        topicField.update({ error: "Topic is required" });
        host.screen.render();
        return;
      }
      if (status === "running" && nextTopic !== topic) {
        appendStep("/topic changed while running; killing current process", "warning");
        forceKillRun();
      }
      topic = nextTopic;
      topicInput.update({ value: topic });
      topicField.update({ error: "" });
      appendStep(`topic set via input: ${topic}`);
      refreshSettings();
      host.screen.render();
      return;
    }

    if (text.startsWith("/inject ")) {
      const sample = text.slice("/inject ".length).trim();
      handleLine("err", sample);
      return;
    }

    if (text === "/logs") {
      appendStep(`logs stream: ${logPaths.stream}`);
      appendStep(`logs turns: ${logPaths.turns}`);
      appendStep(`logs stdout: ${logPaths.stdout}`);
      appendStep(`logs stderr: ${logPaths.stderr}`);
      appendStep(`logs status: ${logPaths.status}`);
      appendStep(`kill script: ${killScriptPath}`);
      host.screen.render();
      return;
    }

    appendStep(`input ignored: ${text}`);
    host.screen.render();
  });

  win.describeState(() => ({
    summary: `${APP_TITLE} — ${status}`,
    status,
    topic,
    runs: runCount,
    turns: turnRows.length,
    pid,
    runDir,
    killScriptPath,
    logPaths,
    lastError,
  }));

  win.captureText(() => [
    `${APP_TITLE}`,
    `status: ${status}`,
    `topic: ${topic}`,
    `runs: ${runCount}`,
    `turns: ${turnRows.length}`,
    `runDir: ${runDir}`,
    `killScript: ${killScriptPath}`,
    `logs: ${logPaths.stream}`,
    `turnsLog: ${logPaths.turns}`,
    `statusLog: ${logPaths.status}`,
    "",
    "recent turns:",
    ...turnRows.slice(-8).map((row) => `${row.speaker} (${row.model}) ${row.excerpt}`),
    "",
    "recent steps:",
    ...stepsLog.entries().slice(-12).map((entry) => entry.text),
  ].join("\n"));

  win.onRestyle(() => {
    root.restyle();
    host.screen.render();
  });

  win.onCleanup(() => {
    forceKillRun();
    stopHeartbeat();
    root.destroy();
  });

  win.setFocusTarget(topicInput.node);
  win.focus();
}

function writeRunFiles(topic: string) {
  const runStamp = new Date().toISOString();
  const stamp = runStamp.replace(/[-:TZ.]/g, "").slice(0, 14);
  const runDir = path.join(RUNS_ROOT, `run-${stamp}-${Math.random().toString(36).slice(2, 8)}`);
  const actorsDir = path.join(runDir, "actors");
  const logsDir = path.join(runDir, "logs");
  fs.mkdirSync(actorsDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const safeTopic = topic.replace(/"""/g, "\"\"\"");

  const wibActor = [
    'matching_id = "wib"',
    'name = "Wib"',
    "",
    "[model]",
    'provider = "cc"',
    'model_name = "haiku"',
    "",
    "[identity]",
    'system_prompt = """',
    "You are Wib. Creative, odd, playful, and visually expressive.",
    "Always include a compact ASCII doodle (2-5 lines) in every reply.",
    "Keep turns short, provocative, and artistically opinionated.",
    '"""',
  ].join("\n");

  const wobActor = [
    'matching_id = "wob"',
    'name = "Wob"',
    "",
    "[model]",
    'provider = "cc"',
    'model_name = "sonnet"',
    "",
    "[identity]",
    'system_prompt = """',
    "You are Wob. Methodical, precise, and analytically clear.",
    "Always include a compact ASCII diagram or glyph block (2-5 lines).",
    "Challenge weak reasoning, keep structure crisp, avoid fluff.",
    '"""',
  ].join("\n");

  const conversation = [
    '[[actors]]',
    'actor_matching_id = "wib"',
    "",
    '[[actors]]',
    'actor_matching_id = "wob"',
    "",
    '[[tracks]]',
    'actor_matching_id = "wib"',
    '',
    '[[tracks.steps]]',
    'position = 0',
    'note = "Talk"',
    'enabled = true',
    '',
    '[[tracks.steps]]',
    'position = 2',
    'note = "Talk"',
    'enabled = true',
    '',
    '[[tracks.steps]]',
    'position = 4',
    'note = "Talk"',
    'enabled = true',
    "",
    '[[tracks]]',
    'actor_matching_id = "wob"',
    '',
    '[[tracks.steps]]',
    'position = 1',
    'note = "Talk"',
    'enabled = true',
    '',
    '[[tracks.steps]]',
    'position = 3',
    'note = "Talk"',
    'enabled = true',
    '',
    '[[tracks.steps]]',
    'position = 5',
    'note = "Talk"',
    'enabled = true',
    "",
    '[[region]]',
    'id = "region-wibwob-cli"',
    'name = "Main Loop"',
    'enabled = true',
    'start = 0',
    'end = 5',
    "",
    '[environment.topic]',
    'text = """',
    safeTopic,
    '"""',
  ].join("\n");

  const wibPath = path.join(actorsDir, "wib.toml");
  const wobPath = path.join(actorsDir, "wob.toml");
  const conversationPath = path.join(runDir, "conversation.toml");
  const logPaths = {
    stream: path.join(logsDir, "stream.log"),
    turns: path.join(logsDir, "turns.jsonl"),
    stdout: path.join(logsDir, "stdout.log"),
    stderr: path.join(logsDir, "stderr.log"),
    status: path.join(logsDir, "status.jsonl"),
  };
  const killScriptPath = path.join(runDir, "kill-run.sh");

  fs.writeFileSync(wibPath, wibActor, "utf8");
  fs.writeFileSync(wobPath, wobActor, "utf8");
  fs.writeFileSync(conversationPath, conversation, "utf8");
  fs.writeFileSync(logPaths.stream, "", "utf8");
  fs.writeFileSync(logPaths.turns, "", "utf8");
  fs.writeFileSync(logPaths.stdout, "", "utf8");
  fs.writeFileSync(logPaths.stderr, "", "utf8");
  fs.writeFileSync(logPaths.status, "", "utf8");
  writeKillScript(killScriptPath, runDir);
  fs.writeFileSync(path.join(RUNS_ROOT, "latest-run.txt"), `${runDir}\n`, "utf8");

  return { runDir, actorsDir, conversationPath, logPaths, runStamp, killScriptPath };
}

function appendLine(filePath: string, line: string) {
  try {
    fs.appendFileSync(filePath, `${line}\n`, "utf8");
  } catch {
    // best effort logging only
  }
}

function appendRaw(filePath: string, text: string) {
  try {
    fs.appendFileSync(filePath, text, "utf8");
  } catch {
    // best effort logging only
  }
}

function writeKillScript(scriptPath: string, runDir: string, pid?: number) {
  const pidLine = typeof pid === "number" && pid > 0
    ? `if kill -0 ${pid} 2>/dev/null; then\n  kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null || true\n  sleep 1\n  kill -KILL -${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true\nfi\n\n`
    : "";

  const pattern = `llm-orchestrator|${runDir}|${path.join(runDir, "conversation.toml")}`;

  const script = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    `RUN_DIR=${JSON.stringify(runDir)}`,
    `PATTERN=${JSON.stringify(pattern)}`,
    "",
    pidLine.trimEnd(),
    "pkill -f \"$PATTERN\" 2>/dev/null || true",
    "",
    "echo \"Killed processes matching: $PATTERN\"",
  ].filter(Boolean).join("\n");

  fs.writeFileSync(scriptPath, `${script}\n`, "utf8");
  try { fs.chmodSync(scriptPath, 0o755); } catch { /* best effort */ }
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inspectProcessTree(pid: number): string {
  try {
    const proc = spawnSync("ps", ["-o", "pid,ppid,stat,etime,command", "-p", String(pid)], { encoding: "utf8" });
    const kids = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
    const childIds = (kids.stdout ?? "")
      .split(/\s+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 8);

    let childBlock = "";
    if (childIds.length > 0) {
      const childPs = spawnSync("ps", ["-o", "pid,ppid,stat,etime,command", "-p", childIds.join(",")], { encoding: "utf8" });
      childBlock = ` children=${JSON.stringify(childIds)} ${JSON.stringify((childPs.stdout ?? "").trim())}`;
    }

    return `parent=${JSON.stringify((proc.stdout ?? "").trim())}${childBlock}`;
  } catch (error) {
    return `process-snapshot-error=${error instanceof Error ? error.message : String(error)}`;
  }
}

function consumeLines(buffer: string, onLine: (line: string) => void) {
  const lines = buffer.split(/\r?\n/);
  const trailing = lines.pop() ?? "";
  for (const line of lines) onLine(line);
  return trailing;
}

function parseTalkLine(line: string): { speaker: string; model: string; message: string } | null {
  const plain = stripAnsi(line).trim();
  if (!plain) return null;

  // Current llm-orchestrator format (no message= key), e.g.
  // INFO 💬 actor=Wib step="Talk" Hello world
  const talkMatch = plain.match(/actor\s*=\s*"?([^\s"]+)"?.*step\s*=\s*"?Talk"?\s*(.*)$/i);
  if (talkMatch) {
    const speaker = talkMatch[1] ?? "actor";
    const model = speaker.toLowerCase().includes("wib") ? "haiku" : "sonnet";
    const message = (talkMatch[2] ?? "").trim();
    if (message) return { speaker, model, message };
  }

  // Older format fallback: step=Talk message=...
  const legacyTalkIdx = plain.indexOf("step=Talk");
  const legacyMessageIdx = plain.indexOf("message=");
  if (legacyTalkIdx === -1 || legacyMessageIdx === -1) return null;

  const actorMatch = plain.match(/actor=([^\s]+)/);
  const speaker = actorMatch?.[1] ?? "actor";
  const model = speaker.toLowerCase().includes("wib") ? "haiku" : "sonnet";
  const after = plain.slice(legacyMessageIdx + "message=".length).trim();
  const stripped = after.replace(/^"|"$/g, "").replace(/\s+💬$/, "").trim();
  return stripped ? { speaker, model, message: stripped } : null;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, "");
}

function looksLikeSystemLine(line: string): boolean {
  if (!line.trim()) return false;
  if (/^(INFO|WARN|ERROR|DEBUG)\b/.test(line)) return true;
  if (line.includes("step=") || line.includes("PromptSent") || line.includes("CONVERSATION ENDED")) return true;
  return false;
}

function findClaudeBinary(): string | null {
  const candidates = [
    path.join(process.env.HOME ?? "", ".local/bin/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(process.env.HOME ?? "", ".npm-global/bin/claude"),
  ];

  const pathEntries = (process.env.PATH ?? "")
    .split(":")
    .filter(Boolean)
    .map((entry) => path.join(entry, "claude"));

  for (const candidate of [...candidates, ...pathEntries]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return null;
}
