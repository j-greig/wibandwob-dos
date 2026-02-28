import fs from "node:fs";
import path from "node:path";

import { createNodeApp } from "@rezi-ui/node";
import { spawn } from "@skitee3000/bun-pty";
import {
  rgb,
  ui,
  type CursorPosition,
  type EditorSelection,
  type LogEntry
} from "@rezi-ui/core";
import type { IExitEvent } from "@skitee3000/bun-pty";

type PanelId = "primer" | "editor" | "terminal";

interface WindowState {
  id: PanelId;
  title: string;
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
}

interface EditorModel {
  lines: string[];
  cursor: CursorPosition;
  selection: EditorSelection | null;
  scrollTop: number;
  scrollLeft: number;
  filePath?: string;
}

interface AppState {
  status: string;
  primer: EditorModel;
  editor: EditorModel;
  terminalInput: string;
  terminalScrollTop: number;
  terminalEntries: LogEntry[];
  windows: Record<PanelId, WindowState>;
}

const scratchPath = path.join(process.cwd(), "scratch", "rezi-mvp-notes.txt");

const initialState: AppState = {
  status: "Rezi MVP ready.",
  primer: createEditorModel(path.join(process.cwd(), "README.md")),
  editor: createEditorModel(scratchPath, "Type here. Save writes to scratch/rezi-mvp-notes.txt.\n"),
  terminalInput: "",
  terminalScrollTop: 0,
  terminalEntries: [],
  windows: {
    primer: {
      id: "primer",
      title: "Primer",
      top: 1,
      left: 1,
      width: 56,
      height: 18,
      zIndex: 1
    },
    editor: {
      id: "editor",
      title: "Text Editor",
      top: 3,
      left: 22,
      width: 64,
      height: 18,
      zIndex: 2
    },
    terminal: {
      id: "terminal",
      title: "Terminal",
      top: 20,
      left: 4,
      width: 82,
      height: 15,
      zIndex: 3
    }
  }
};

const app = createNodeApp<AppState>({
  initialState,
  config: {
    fpsCap: 30
  }
});

let logCounter = 0;
let currentState: AppState = initialState;

const pty = spawn(resolveShellPath(), ["-i"], {
  name: "xterm-256color",
  cols: 100,
  rows: 24,
  cwd: process.cwd(),
  env: process.env as Record<string, string>
});

pty.onData((chunk: string) => {
  const lines = sanitizeTerminalChunk(chunk);
  if (lines.length === 0) {
    return;
  }
  updateApp((state) => ({
    ...state,
    terminalEntries: limitLogs([
      ...state.terminalEntries,
      ...lines.map((line) => makeLogEntry("shell", "info", line))
    ]),
    terminalScrollTop: Math.max(0, state.terminalEntries.length + lines.length - 1),
    status: "Terminal output received."
  }));
});

pty.onExit(({ exitCode, signal }: IExitEvent) => {
  updateApp((state) => ({
    ...state,
    terminalEntries: limitLogs([
      ...state.terminalEntries,
      makeLogEntry("shell", "warn", `Shell exited with code ${exitCode} signal ${signal ?? "none"}`)
    ]),
    status: "Shell exited."
  }));
});

app.view((state) =>
  ui.page({
    header: ui.box(
      {
        border: "none",
        style: { bg: rgb(220, 228, 240), fg: rgb(20, 24, 30) },
        px: 1,
        py: 0
      },
      [
        ui.toolbar({}, [
          ui.text("File", { style: { bold: true } }),
          ui.button("load-readme", "Open README", {
            onPress: () => loadPrimer(path.join(process.cwd(), "README.md")),
            intent: "secondary"
          }),
          ui.button("load-claude", "Open CLAUDE", {
            onPress: () => loadPrimer(path.join(process.cwd(), "CLAUDE.md")),
            intent: "secondary"
          }),
          ui.text("Edit", { style: { bold: true } }),
          ui.button("save-editor", "Save Notes", {
            onPress: saveEditor,
            intent: "primary"
          }),
          ui.button("send-pwd", "pwd", {
            onPress: () => sendTerminalCommand("pwd"),
            intent: "secondary"
          }),
          ui.button("send-ls", "ls", {
            onPress: () => sendTerminalCommand("ls"),
            intent: "secondary"
          })
        ])
      ]
    ),
    body: renderDesktop(state),
    footer: ui.box(
      {
        border: "none",
        style: { bg: rgb(220, 228, 240), fg: rgb(20, 24, 30) },
        px: 1,
        py: 0
      },
      [
        ui.statusBar({
          left: [
            ui.text("Tab focus"),
            ui.text("Enter buttons"),
            ui.text("Editor is real Rezi code editor"),
            ui.text("Terminal is PTY + logs console")
          ],
          right: [ui.text(state.status)]
        })
      ]
    )
  })
);

await app.run();

function renderDesktop(state: AppState) {
  const windowNodes = [
    renderEditorWindow(state.windows.primer, state.primer, true),
    renderEditorWindow(state.windows.editor, state.editor, false),
    renderTerminalWindow(state)
  ];

  return ui.box(
    {
      width: "100%",
      height: "100%",
      style: { bg: rgb(132, 163, 192), fg: rgb(18, 24, 32) }
    },
    windowNodes
  );
}

function renderEditorWindow(window: WindowState, model: EditorModel, readOnly: boolean) {
  return ui.box(
    {
      position: "absolute",
      top: window.top,
      left: window.left,
      width: window.width,
      height: window.height,
      border: "rounded",
      style: { bg: rgb(26, 29, 36), fg: rgb(228, 232, 238) },
      borderStyle: { fg: rgb(255, 208, 98) },
      p: 1
    },
    [
      ui.row({ items: "center", gap: 1 }, [
        ui.text(window.title, { variant: "heading" }),
        ui.text(model.filePath ?? "untitled", { style: { dim: true } })
      ]),
      ui.box({ flex: 1 }, [
        ui.codeEditor({
          id: `${window.id}-editor`,
          lines: model.lines,
          cursor: model.cursor,
          selection: model.selection,
          scrollTop: model.scrollTop,
          scrollLeft: model.scrollLeft,
          readOnly,
          lineNumbers: true,
          syntaxLanguage: "plain",
          onChange: (lines, cursor) => {
            if (readOnly) {
              return;
            }
            updateApp((state) => ({
              ...state,
              editor: {
                ...state.editor,
                lines: [...lines],
                cursor
              },
              status: "Editor changed."
            }));
          },
          onSelectionChange: (selection) => {
            if (readOnly) {
              updateApp((state) => ({
                ...state,
                primer: { ...state.primer, selection }
              }));
              return;
            }
            updateApp((state) => ({
              ...state,
              editor: { ...state.editor, selection }
            }));
          },
          onScroll: (scrollTop, scrollLeft) => {
            if (readOnly) {
              updateApp((state) => ({
                ...state,
                primer: { ...state.primer, scrollTop, scrollLeft }
              }));
              return;
            }
            updateApp((state) => ({
              ...state,
              editor: { ...state.editor, scrollTop, scrollLeft }
            }));
          }
        })
      ])
    ]
  );
}

function renderTerminalWindow(state: AppState) {
  const terminalWindow = state.windows.terminal;
  return ui.box(
    {
      position: "absolute",
      top: terminalWindow.top,
      left: terminalWindow.left,
      width: terminalWindow.width,
      height: terminalWindow.height,
      border: "rounded",
      style: { bg: rgb(18, 20, 26), fg: rgb(229, 235, 241) },
      borderStyle: { fg: rgb(109, 197, 255) },
      p: 1
    },
    [
      ui.row({ items: "center", gap: 1 }, [
        ui.text(terminalWindow.title, { variant: "heading" }),
        ui.text("bun-pty + logsConsole", { style: { dim: true } }),
        ui.spacer({ flex: 1 }),
        ui.button("clear-terminal", "Clear", {
          onPress: () =>
            updateApp((current) => ({
              ...current,
              terminalEntries: [],
              terminalScrollTop: 0,
              status: "Terminal cleared."
            })),
          intent: "secondary"
        })
      ]),
      ui.box({ flex: 1 }, [
        ui.logsConsole({
          id: "terminal-logs",
          entries: state.terminalEntries,
          scrollTop: state.terminalScrollTop,
          autoScroll: true,
          showTimestamps: false,
          showSource: true,
          onScroll: (scrollTop) =>
            updateApp((current) => ({
              ...current,
              terminalScrollTop: scrollTop
            }))
        })
      ]),
      ui.row({ items: "center", gap: 1 }, [
        ui.box({ flex: 1 }, [
          ui.input({
            id: "terminal-input",
            value: state.terminalInput,
            placeholder: "Type a shell command here",
            onInput: (value) =>
              updateApp((current) => ({
                ...current,
                terminalInput: value
              }))
          })
        ]),
        ui.button("send-terminal", "Run", {
          onPress: () => sendTerminalCommand(state.terminalInput),
          intent: "primary"
        })
      ])
    ]
  );
}

function createEditorModel(filePath: string, fallback = ""): EditorModel {
  const content = readTextFile(filePath, fallback);
  return {
    lines: splitLines(content),
    cursor: { line: 0, column: 0 },
    selection: null,
    scrollTop: 0,
    scrollLeft: 0,
    filePath
  };
}

function splitLines(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  return lines.length > 0 ? lines : [""];
}

function readTextFile(filePath: string, fallback = ""): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function saveEditor(): void {
  const state = getCurrentState();
  const target = state.editor.filePath ?? scratchPath;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, state.editor.lines.join("\n"), "utf8");
  updateApp((current) => ({
    ...current,
    editor: {
      ...current.editor,
      filePath: target
    },
    status: `Saved ${target}`
  }));
}

function loadPrimer(filePath: string): void {
  const content = readTextFile(filePath, `Could not read ${filePath}`);
  updateApp((state) => ({
    ...state,
    primer: {
      ...state.primer,
      lines: splitLines(content),
      filePath
    },
    status: `Loaded ${path.basename(filePath)}`
  }));
}

function sendTerminalCommand(command: string): void {
  const trimmed = command.trim();
  if (!trimmed) {
    return;
  }
  updateApp((state) => ({
    ...state,
    terminalInput: "",
    terminalEntries: limitLogs([
      ...state.terminalEntries,
      makeLogEntry("you", "debug", `$ ${trimmed}`)
    ]),
    status: `Ran ${trimmed}`
  }));
  pty.write(`${trimmed}\n`);
}

function makeLogEntry(source: string, level: LogEntry["level"], message: string): LogEntry {
  logCounter += 1;
  return {
    id: `log-${logCounter}`,
    timestamp: Date.now(),
    level,
    source,
    message
  };
}

function limitLogs(entries: LogEntry[]): LogEntry[] {
  return entries.slice(-300);
}

function sanitizeTerminalChunk(chunk: string): string[] {
  return chunk
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function resolveShellPath(): string {
  const candidates = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "/bin/sh";
}

function getCurrentState(): AppState {
  return currentState;
}

function updateApp(updater: (state: Readonly<AppState>) => AppState): void {
  app.update((state) => {
    const next = updater(state);
    currentState = next;
    return next;
  });
}

process.on("SIGINT", async () => {
  pty.kill();
  await app.stop();
  process.exit(0);
});
