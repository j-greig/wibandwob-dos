import blessed from "blessed";
import { spawn as spawnProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "../core/config.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import { theme as appTheme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle, createSelectableList, deferRender } from "../core/ui-parts.js";
import { EMPTY_PRIMER_SELECTED } from "../core/empty-states.js";
import type { BackroomsChannel, List, LogBox } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { BackroomsService } from "../services/backrooms-service.js";
import { openBackroomsLogBrowserWindow as openBackroomsLogBrowser } from "./backrooms-log-browser-window.js";

export interface BackroomsWindowContext {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  backrooms: BackroomsService;
  syncState: () => void;
  openEditorWindow: (filePath?: string, title?: string, initial?: string) => void;
  openBackroomsTv: (channel: BackroomsChannel) => void;
}

export function openBackroomsLogBrowserWindow(context: BackroomsWindowContext): void {
  const logsDir = path.join(REPO_ROOT, "logs", "backrooms-tv");
  openBackroomsLogBrowser({
    screen: context.screen,
    windowManager: context.windowManager,
    overlays: context.overlays,
    logsDir,
    onOpenReplay: (logPath, theme) => {
      context.openBackroomsTv({ theme, model: "sonnet", turns: 0, mode: "fake-live", primers: logPath });
    },
    onSaveSnippet: (title, content) => {
      context.openEditorWindow(undefined, title, content);
    },
    onStateChanged: () => context.syncState(),
  });
}

export function promptForBackroomsTv(context: BackroomsWindowContext): void {
  const defaults: BackroomsChannel = {
    theme: "liminal fluorescent maze",
    primers: "",
    turns: 3,
    model: "sonnet"
  };
  context.overlays.openValuePrompt("Backrooms Theme", defaults.theme, (theme) => {
    openBackroomsPrimerPicker(context, theme.trim() || defaults.theme, defaults);
  });
}

export function openBackroomsPrimerPicker(context: BackroomsWindowContext, theme: string, defaults: BackroomsChannel): void {
  const allEntries = context.backrooms.collectPrimers();
  if (allEntries.length === 0) {
    context.overlays.flash("No Backrooms primers found.");
    return;
  }

  const frame = context.windowManager.createFrame("Backrooms Primer Picker", "browser");
  frame.frame.width = 96;
  frame.frame.height = 28;

  const header = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    style: appTheme().header
  });
  const searchBox = blessed.textbox({
    parent: frame.body,
    top: 2,
    left: 0,
    width: "36%",
    height: 1,
    inputOnFocus: true,
    mouse: true,
    style: appTheme().input
  });
  const listHandle = createSelectableList({
    parent: frame.body,
    top: 3,
    left: 0,
    width: "36%",
    bottom: 0,
  });
  const list = listHandle.node;
  const preview = blessed.box({
    parent: frame.body,
    top: 2,
    left: "36%",
    right: 0,
    bottom: 0,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: appTheme().body
  });

  let searchValue = "";
  let filteredEntries = [...allEntries];
  const selectedLabels = new Set<string>();

  const syncHeader = () => {
    header.setContent(
      ` Theme: ${theme}\n Enter run  Space toggle  / search  Esc cancel  Letters jump  Selected: ${selectedLabels.size || 0} `
    );
  };

  const renderList = (selectedIndex = 0) => {
    list.setItems(
      filteredEntries.map((entry) => `${selectedLabels.has(entry.label) ? "[x]" : "[ ]"} ${entry.label}`)
    );
    if (filteredEntries.length > 0) {
      list.select(Math.max(0, Math.min(selectedIndex, filteredEntries.length - 1)));
    } else {
      list.select(0);
    }
    syncHeader();
    context.screen.render();
  };

  const updatePreview = (index: number) => {
    const entry = filteredEntries[index];
    if (!entry) {
      preview.setContent(searchValue ? `No primers match "${searchValue}".` : EMPTY_PRIMER_SELECTED);
      context.screen.render();
      return;
    }
    try {
      const content = fs.readFileSync(entry.filePath, "utf8");
      preview.setContent(`${entry.label}\n${entry.filePath}\n\n${content}`);
    } catch (error) {
      preview.setContent(`Cannot preview primer.\n\n${error instanceof Error ? error.message : String(error)}`);
    }
    context.screen.render();
  };

  const applyFilter = (preserveLabel?: string) => {
    const lowered = searchValue.toLowerCase();
    filteredEntries = allEntries.filter((entry) => entry.label.toLowerCase().includes(lowered));
    const nextIndex = preserveLabel
      ? Math.max(0, filteredEntries.findIndex((entry) => entry.label === preserveLabel))
      : 0;
    renderList(nextIndex < 0 ? 0 : nextIndex);
    updatePreview((list as List & { selected: number }).selected ?? 0);
  };

  const toggleSelected = () => {
    const index = (list as List & { selected: number }).selected ?? 0;
    const entry = filteredEntries[index];
    if (!entry) {
      return;
    }
    if (selectedLabels.has(entry.label)) {
      selectedLabels.delete(entry.label);
    } else {
      selectedLabels.add(entry.label);
    }
    renderList(index);
    updatePreview(index);
  };

  const jumpToLetter = (letter: string) => {
    const upper = letter.toUpperCase();
    const index = filteredEntries.findIndex((entry) => entry.label.charAt(0).toUpperCase() === upper);
    if (index >= 0) {
      list.select(index);
      updatePreview(index);
      context.screen.render();
    }
  };

  let pickerClosed = false;
  const closePicker = () => {
    if (pickerClosed) return;
    pickerClosed = true;
    // Cancel any active readInput() on searchBox before destroying the frame.
    // If we skip this, blessed keeps firing keypresses into the orphaned widget
    // and crashes at textbox.js:40 when the overlay prompt receives its first key.
    // cancelInput() is a blessed runtime method not in @types/blessed — cast needed.
    try { (searchBox as unknown as { cancel(): void }).cancel(); } catch { /* already idle or widget destroyed */ }
    frame.close();
  };

  const getSelectedIndex = () => (list as List & { selected: number }).selected ?? 0;

  const confirmSelection = () => {
    const focusedIndex = getSelectedIndex();
    const fallback = filteredEntries[focusedIndex]?.label;
    const selected = selectedLabels.size > 0 ? [...selectedLabels] : fallback ? [fallback] : [];
    closePicker();
    promptForBackroomsRunOptions(context, theme, selected.join(","), defaults);
  };

  const focusSearch = () => {
    searchBox.focus();
    searchBox.readInput();
    context.screen.render();
  };

  searchBox.setValue(searchValue);
  searchBox.on("keypress", (_, key) => {
    if (pickerClosed) return;
    if (key.name === "escape") {
      list.focus();
      context.screen.render();
      return;
    }
    if (key.name === "enter") {
      searchValue = searchBox.getValue().trim();
      applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
      list.focus();
      context.screen.render();
      return;
    }
    setTimeout(() => {
      searchValue = searchBox.getValue().trim();
      applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
    }, 0);
  });
  searchBox.on("submit", (value) => {
    if (pickerClosed) return;
    searchValue = (value ?? "").trim();
    applyFilter(filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label);
    list.focus();
    context.screen.render();
  });

  list.on("select item", (_, index) => updatePreview(index));
  list.on("keypress", (ch, key) => {
    if (key.name === "enter") {
      confirmSelection();
      return;
    }
    if (key.name === "space") {
      toggleSelected();
      return;
    }
    if (key.name === "escape") {
      closePicker();
      return;
    }
    if (key.name === "slash") {
      focusSearch();
      return;
    }
    if (["up", "down", "j", "k", "pageup", "pagedown", "home", "end"].includes(key.name ?? "")) {
      deferRender(() => updatePreview((list as List & { selected: number }).selected ?? 0));
      return;
    }
    if (ch && /^[a-z]$/i.test(ch)) {
      jumpToLetter(ch);
    }
  });

  // API bridge hooks for command-driven picker automation.
  (frame as unknown as Record<string, unknown>)._backroomsPickerInfo = () => ({
    active: !pickerClosed,
    selectedIndex: getSelectedIndex(),
    visibleEntryCount: filteredEntries.length,
    selectedLabel: filteredEntries[getSelectedIndex()]?.label,
    selectedPrimers: [...selectedLabels],
    searchValue,
    theme,
  });
  (frame as unknown as Record<string, unknown>)._backroomsPickerSelect = (requestedIndex: number) => {
    if (pickerClosed) return { ok: false, error: "Backrooms picker is closed" };
    const count = filteredEntries.length;
    if (count <= 0) return { ok: false, error: "No selectable entries", count: 0 };
    const index = Math.max(0, Math.min(Math.trunc(requestedIndex), count - 1));
    list.select(index);
    updatePreview(index);
    context.screen.render();
    return { ok: true, index, count, label: filteredEntries[index]?.label };
  };
  (frame as unknown as Record<string, unknown>)._backroomsPickerConfirm = () => {
    if (pickerClosed) return { ok: false, error: "Backrooms picker is closed" };
    confirmSelection();
    return { ok: true };
  };
  (frame as unknown as Record<string, unknown>)._backroomsPickerCancel = () => {
    if (pickerClosed) return { ok: false, error: "Backrooms picker is already closed" };
    closePicker();
    return { ok: true };
  };

  frame.kind = "browser";
  frame.describeState = () => ({
    appType: "backrooms-primer-picker",
    summary: `Backrooms primer picker with ${allEntries.length} primers.`,
    theme,
    searchValue,
    selectedPrimers: [...selectedLabels],
    visibleEntryCount: filteredEntries.length,
    selectedLabel: filteredEntries[(list as List & { selected: number }).selected ?? 0]?.label,
    contentPreview: preview.getContent().split("\n").slice(0, 8).join("\n")
  });
  frame.setFocusTarget(list);
  frame.onRestyle = createRestyleBundle([
    [header, () => appTheme().header],
    [searchBox, () => appTheme().input],
    [list, () => ({ ...appTheme().body, selected: appTheme().selected })],
    [preview, () => appTheme().body],
  ]).restyle;

  context.windowManager.registerWindow(frame);
  renderList(0);
  updatePreview(0);
  frame.focus();
}

export function promptForBackroomsRunOptions(
  context: BackroomsWindowContext,
  theme: string,
  primers: string,
  defaults: BackroomsChannel
): void {
  context.overlays.openValuePrompt("Backrooms Turns", String(defaults.turns), (turnsValue) => {
    context.overlays.openValuePrompt("Backrooms Model", defaults.model, (modelValue) => {
      const turns = Math.max(1, Math.min(20, Number.parseInt(turnsValue, 10) || defaults.turns));
      const trimmedModel = modelValue.trim();
      const model = ["haiku", "sonnet", "opus"].includes(trimmedModel) ? (trimmedModel as BackroomsChannel["model"]) : defaults.model;
      context.openBackroomsTv({
        theme,
        primers,
        turns,
        model
      });
    });
  });
}

export function openBackroomsTvWindow(context: BackroomsWindowContext, channel: BackroomsChannel): void {
  const frame = context.windowManager.createFrame("Backrooms TV", "backrooms");
  frame.frame.width = 86;
  frame.frame.height = 24;

  const header = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    tags: true,
    style: appTheme().header
  });
  const transcript = blessed.log({
    parent: frame.body,
    top: 2,
    left: 0,
    right: 0,
    bottom: 1,
    tags: false,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: appTheme().body
  }) as LogBox;
  const footer = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    style: appTheme().footer
  });

  let status = "IDLE";
  let phase: "idle" | "starting" | "waiting" | "streaming" | "playback" | "complete" | "error" = "idle";
  let processRef: ChildProcessWithoutNullStreams | undefined;
  let backroomsPartialLine = "";
  let logPath = context.backrooms.createLogPath(channel.theme);
  let fallbackTimer: ReturnType<typeof setInterval> | undefined;
  let fallbackPlaybackTimer: ReturnType<typeof setInterval> | undefined;
  let lastError = "";
  let sourceMode: "live" | "playback" | "simulated-live" = "live";
  let playbackSourceLabels: string[] = [];
  let liveStdoutBytes = 0;
  let liveStderrBytes = 0;
  let lastActivityAt = 0;
  let sawLiveStdout = false;
  let startTime = 0;
  let startedAt = "";
  let endedAt = "";
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let fallbackReason = "";
  const requestedMode = channel.mode ?? "auto";
  let launchMode = context.backrooms.resolveLaunchMode(requestedMode);
  const command = context.backrooms.resolveCliCommand();
  const cliArgs = context.backrooms.buildCliArgs(channel);
  const backroomsCwd = context.backrooms.resolveBackroomsPath();
  let runRoot = "";

  const updateChrome = () => {
    header.setContent(
      ` Theme: ${channel.theme}\n Model: ${channel.model}  Turns: ${channel.turns}  Primers: ${channel.primers || "(none)"}  Mode: ${launchMode}${
        (sourceMode === "playback" || sourceMode === "simulated-live") && playbackSourceLabels.length > 0 ? `  Playback: ${playbackSourceLabels.join(" | ")}` : ""
      } `
    );
    footer.setContent(` ${status} [${sourceMode}]  log: ${logPath}  Space restart  N restart  Alt-Shift-Arrows resize  +> mouse resize `);
  };

  const appendChunk = (chunk: string) => {
    const clean = context.backrooms.sanitizeOutputChunk(chunk);
    if (!clean) {
      return;
    }
    lastActivityAt = Date.now();
    liveStdoutBytes += Buffer.byteLength(clean);
    sawLiveStdout = sawLiveStdout || clean.length > 0;
    if (sourceMode === "live") {
      phase = "streaming";
      status = "STREAMING";
      updateChrome();
    }
    fs.appendFileSync(logPath, clean, "utf8");
    const combined = backroomsPartialLine + clean;
    const lines = combined.split("\n");
    backroomsPartialLine = lines.pop() ?? "";
    for (const line of lines) {
      transcript.log(line);
    }
    context.syncState();
    context.screen.render();
  };

  const stopBackrooms = () => {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    }
    if (fallbackPlaybackTimer) {
      clearInterval(fallbackPlaybackTimer);
      fallbackPlaybackTimer = undefined;
    }
    if (!processRef || processRef.killed) {
      return;
    }
    processRef.kill("SIGTERM");
    processRef = undefined;
    phase = "idle";
    status = "IDLE";
    updateChrome();
    context.syncState();
    context.screen.render();
  };

  const startSimulatedLive = () => {
    const playback = context.backrooms.buildPlaybackStream(channel, 3);
    playbackSourceLabels = playback.labels;
    sourceMode = "simulated-live";
    phase = "streaming";
    status = "SIMULATED LIVE";
    fallbackReason = "forced-fake-live";
    updateChrome();
    if (playback.lines.length === 0) {
      transcript.log("[backrooms fake-live unavailable: no local sample files found]");
      phase = "error";
      status = "SIMULATED LIVE UNAVAILABLE";
      updateChrome();
      context.syncState();
      context.screen.render();
      return;
    }
    transcript.log(`[backrooms fake-live] ${playbackSourceLabels.join(", ")}`);
    let index = 0;
    fallbackPlaybackTimer = setInterval(() => {
      if (index >= playback.lines.length) {
        if (fallbackPlaybackTimer) {
          clearInterval(fallbackPlaybackTimer);
          fallbackPlaybackTimer = undefined;
        }
        phase = "complete";
        status = "SIMULATED COMPLETE";
        updateChrome();
        context.syncState();
        context.screen.render();
        return;
      }
      transcript.log(playback.lines[index]);
      index += 1;
      context.syncState();
      context.screen.render();
    }, 30);
  };

  const startPlaybackFallback = (reason: string) => {
    if (fallbackPlaybackTimer) {
      return;
    }
    if (processRef && !processRef.killed) {
      processRef.kill("SIGTERM");
      processRef = undefined;
    }
    fallbackReason = reason;
    sourceMode = "playback";
    phase = "playback";
    status = `PLAYBACK ${reason}`;
    const playback = context.backrooms.buildPlaybackStream(channel, 3);
    playbackSourceLabels = playback.labels;
    if (playback.lines.length === 0) {
      transcript.log("[backrooms playback unavailable: no local sample files found]");
      phase = "error";
      status = "PLAYBACK UNAVAILABLE";
      updateChrome();
      context.syncState();
      context.screen.render();
      return;
    }
    let index = 0;
    transcript.log(`[backrooms playback fallback] ${playbackSourceLabels.join(", ")}`);
    updateChrome();
    fallbackPlaybackTimer = setInterval(() => {
      if (index >= playback.lines.length) {
        if (fallbackPlaybackTimer) {
          clearInterval(fallbackPlaybackTimer);
          fallbackPlaybackTimer = undefined;
        }
        phase = "complete";
        status = "PLAYBACK COMPLETE";
        updateChrome();
        context.syncState();
        context.screen.render();
        return;
      }
      transcript.log(playback.lines[index]);
      index += 1;
      context.syncState();
      context.screen.render();
    }, 35);
  };

  const startBackrooms = () => {
    stopBackrooms();
    transcript.setContent("");
    backroomsPartialLine = "";
    logPath = context.backrooms.createLogPath(channel.theme);
    launchMode = context.backrooms.resolveLaunchMode(requestedMode);
    phase = "starting";
    status = "STARTING";
    sourceMode = "live";
    playbackSourceLabels = [];
    lastError = "";
    liveStdoutBytes = 0;
    liveStderrBytes = 0;
    lastActivityAt = Date.now();
    sawLiveStdout = false;
    startTime = Date.now();
    startedAt = new Date(startTime).toISOString();
    endedAt = "";
    exitCode = null;
    exitSignal = null;
    fallbackReason = "";
    runRoot = context.backrooms.prepareRunRoot(channel);
    updateChrome();

    if (launchMode === "fake-live") {
      startSimulatedLive();
      context.syncState();
      context.screen.render();
      return;
    }

    processRef = spawnProcess(command.command, cliArgs, {
      cwd: backroomsCwd,
      env: {
        ...process.env,
        TERM: "dumb",
        NO_COLOR: "1",
        DOTENV_CONFIG_QUIET: "true",
        WIBWOB_ROOT: runRoot,
        WIBWOB_AUTH_METHOD: process.env.WIBWOB_AUTH_METHOD || "claude-cli"
      }
    });

    processRef.stdout.on("data", (chunk: Buffer) => appendChunk(chunk.toString("utf8")));
    processRef.stderr.on("data", (chunk: Buffer) => {
      const text = context.backrooms.sanitizeOutputChunk(chunk.toString("utf8")).trim();
      liveStderrBytes += Buffer.byteLength(text);
      lastActivityAt = Date.now();
      if (!text) {
        return;
      }
      if (!sawLiveStdout) {
        phase = "waiting";
        status = "WAITING FOR FIRST TOKENS";
      }
      lastError = text;
      fs.appendFileSync(logPath, `[stderr] ${text}\n`, "utf8");
      transcript.log(`[stderr] ${text}`);
      context.syncState();
      context.screen.render();
    });
    processRef.on("close", (code, signal) => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
      processRef = undefined;
      endedAt = new Date().toISOString();
      exitCode = code ?? null;
      exitSignal = signal ?? null;
      if (backroomsPartialLine.length > 0) {
        transcript.log(backroomsPartialLine);
        backroomsPartialLine = "";
      }
      phase = code === 0 ? "complete" : "error";
      status = `EXIT ${code ?? "?"}/${signal ?? "none"}`;
      updateChrome();
      transcript.log(`[backrooms exited code=${code ?? "?"} signal=${signal ?? "none"}]`);
      if (!sawLiveStdout) {
        startPlaybackFallback(code === 0 && liveStderrBytes === 0 ? "silent" : "error");
      }
      context.syncState();
      context.screen.render();
    });
    processRef.on("error", (err: Error) => {
      processRef = undefined;
      endedAt = new Date().toISOString();
      phase = "error";
      status = `SPAWN ERROR: ${err.message}`;
      updateChrome();
      transcript.log(`[backrooms spawn error: ${err.message}]`);
      context.syncState();
      context.screen.render();
    });

    fallbackTimer = setInterval(() => {
      const silentForMs = Date.now() - lastActivityAt;
      const uptimeMs = Date.now() - startTime;
      if (!processRef || processRef.killed || sourceMode !== "live" || sawLiveStdout) {
        return;
      }
      if (uptimeMs >= 1000 && phase === "starting") {
        phase = "waiting";
        status = "WAITING FOR FIRST TOKENS";
        updateChrome();
        context.syncState();
        context.screen.render();
      }
      if (uptimeMs >= 8000 && silentForMs >= 8000) {
        transcript.log("[backrooms live mode is still silent after 8s]");
        if (lastError) {
          transcript.log(`[backrooms last stderr] ${lastError}`);
        }
        startPlaybackFallback("timeout");
      }
    }, 1000);
  };

  updateChrome();
  frame.cleanup = () => stopBackrooms();
  frame.describeState = () => ({
    appType: "backrooms-tv",
    summary: "Streams existing backrooms cli-v3.ts output into a scrolling window.",
    theme: channel.theme,
    primers: channel.primers,
    turns: channel.turns,
    model: channel.model,
    requestedMode,
    launchMode,
    phase,
    status,
    sourceMode,
    playbackSources: playbackSourceLabels,
    lastError,
    fallbackReason,
    logPath,
    command: command.command,
    args: cliArgs,
    cwd: backroomsCwd,
    runRoot,
    pid: processRef?.pid,
    startedAt,
    endedAt,
    exitCode,
    exitSignal,
    liveStdoutBytes,
    liveStderrBytes,
    lastActivityMsAgo: Math.max(0, Date.now() - lastActivityAt),
    uptimeMs: Math.max(0, Date.now() - startTime),
    contentPreview: transcript.getContent().split("\n").slice(-40).join("\n"),
    transcriptLineCount: transcript.getContent().split("\n").filter(Boolean).length
  });
  frame.captureText = () => transcript.getContent();
  frame.setFocusTarget(transcript);
  frame.frame.key(["space", "n"], () => startBackrooms());
  frame.onRestyle = createRestyleBundle([
    [header, () => appTheme().header],
    [transcript, () => appTheme().body],
    [footer, () => appTheme().footer],
  ]).restyle;
  context.windowManager.registerWindow(frame);
  frame.focus();
  startBackrooms();
}
