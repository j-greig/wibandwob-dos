import type { WindowFacade } from "../core/window-facade.js";
import type { WindowRecord } from "../core/types.js";
import type { RuntimeCommandService } from "./runtime-command-service.js";

export interface RuntimeWindowBatchOp {
  id: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  close?: boolean;
}

export interface RuntimeWindowService {
  getWindowById(id: number): WindowRecord | undefined;
  open(
    type: string,
    args?: Record<string, unknown>,
  ): { ok: true; id: number } | { ok: false; error: string };
  focus(id: number): boolean;
  move(id: number, left: number, top: number): boolean;
  resize(id: number, width: number, height: number): boolean;
  close(id: number): boolean;
  toggleMaximize(id: number): boolean;
  batch(ops: RuntimeWindowBatchOp[]): boolean[];
  sendInput(id: number, input: string, sender?: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureText(id: number): string | undefined;
}

interface RuntimeWindowServiceDeps {
  commands: RuntimeCommandService;
  windows: WindowFacade;
}

const OPEN_COMMANDS: Record<string, string> = {
  agent: "agent.open",
  art: "art.open",
  browser: "document.open",
  companion: "companion.open",
  editor: "editor.new",
  "file-manager": "finder.open",
  figlet: "figlet.open",
  finder: "finder.open",
  gallery: "primer-gallery.open",
  inspector: "inspector.open",
  "music-player": "music-player.open",
  pattern: "pattern.open",
  plasma: "plasma.open",
  primer: "primer.browse",
  workspace: "workspace.manage",
  palette: "palette.open",
  "web-reader": "web-reader.open",
  chrome: "web-reader.open",
};

function resolveOpenCommand(
  type: string,
  args?: Record<string, unknown>,
): { id: string; args?: Record<string, unknown> } | undefined {
  if (type === "editor" && args && Object.keys(args).length > 0) {
    return { id: "editor.open", args };
  }
  if (type === "figlet") {
    const text =
      typeof args?.text === "string" && args.text.trim() ? args.text : "WibWob";
    const font =
      typeof args?.font === "string" && args.font.trim() ? args.font : undefined;
    return { id: "figlet.open", args: font ? { text, font } : { text } };
  }
  if (type === "web-reader" || type === "chrome") {
    const url =
      typeof args?.url === "string" && args.url.trim() ? args.url.trim() : undefined;
    return { id: "web-reader.open", args: url ? { url } : undefined };
  }
  const id = OPEN_COMMANDS[type];
  return id ? { id, args } : undefined;
}

export function createRuntimeWindowService(
  deps: RuntimeWindowServiceDeps,
): RuntimeWindowService {
  return {
    getWindowById: (id) => deps.windows.getWindowById(id),
    open: (type, args) => {
      const resolved = resolveOpenCommand(type, args);
      if (!resolved) {
        return { ok: false, error: `unknown window type: ${type}` };
      }

      const beforeIds = new Set(deps.windows.getWindows().map((window) => window.id));
      const result = deps.commands.run(resolved.id, resolved.args, {
        source: "internal",
        interactive: false,
      });
      if (!result.ok) {
        return result;
      }

      const opened = deps.windows
        .getWindows()
        .find((window) => !beforeIds.has(window.id));
      if (opened) {
        return { ok: true, id: opened.id };
      }

      const focused = deps.windows.getFocusedWindow();
      if (focused) {
        return { ok: true, id: focused.id };
      }

      return { ok: false, error: `window ${type} did not open` };
    },
    focus: (id) => deps.windows.focusWindow(id),
    move: (id, left, top) => deps.windows.moveWindow(id, left, top),
    resize: (id, width, height) => deps.windows.resizeWindow(id, width, height),
    close: (id) => deps.windows.closeWindow(id),
    toggleMaximize: (id) => deps.windows.toggleMaximize(id),
    batch: (ops) =>
      ops.map((op) => {
        if (op.close) {
          return deps.windows.closeWindow(op.id);
        }
        let ok = true;
        let touched = false;
        if (op.left !== undefined && op.top !== undefined) {
          ok = deps.windows.moveWindow(op.id, op.left, op.top) && ok;
          touched = true;
        }
        if (op.width !== undefined && op.height !== undefined) {
          ok = deps.windows.resizeWindow(op.id, op.width, op.height) && ok;
          touched = true;
        }
        return touched ? ok : false;
      }),
    sendInput: (id, input, sender) => deps.windows.sendInput(id, input, sender),
    writeEditorText: (id, text) => deps.windows.writeEditorText(id, text),
    captureText: (id) => deps.windows.captureText(id),
  };
}
