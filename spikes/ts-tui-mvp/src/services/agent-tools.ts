/**
 * TUI tools for the Wib&Wob Chat agent.
 *
 * These are AgentTool[] (from @mariozechner/pi-agent-core) that give
 * the agent awareness of and control over the TUI desktop.
 *
 * The agent sees these as normal tools alongside text generation.
 * When it calls tui_get_state, it gets back the desktop layout.
 * When it calls tui_open_window, a window actually opens.
 *
 * Registration: pass to Agent via initialState.tools or agent.setTools().
 * Desktop state injection: use Agent's transformContext to prepend
 * a compact desktop summary to the context each turn.
 */

import { Type, type Static, type TSchema } from "@sinclair/typebox";
import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-agent-core";
import type { DesktopState } from "../core/types.js";

// -- Context interface: what the TUI exposes to tools --

export interface TuiToolContext {
  getState: () => DesktopState;
  openWindow: (type: string) => { id: number } | { error: string };
  closeWindow: (id: number) => boolean;
  moveWindow: (
    id: number,
    left: number,
    top: number,
    width?: number,
    height?: number
  ) => boolean;
  focusWindow: (id: number) => boolean;
  sendWindowInput: (id: number, input: string) => boolean;
  captureWindowText: (id: number) => string | undefined;
}

// -- Helper to build an AgentTool from our simpler shape --

function tuiTool<T extends TSchema>(opts: {
  name: string;
  label: string;
  description: string;
  parameters: T;
  execute: (
    params: Static<T>,
    ctx: TuiToolContext
  ) => Promise<string> | string;
}): (ctx: TuiToolContext) => AgentTool<T> {
  return (ctx) => ({
    name: opts.name,
    label: opts.label,
    description: opts.description,
    parameters: opts.parameters,
    execute: async (
      _toolCallId: string,
      params: Static<T>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback
    ): Promise<AgentToolResult<unknown>> => {
      const result = await opts.execute(params, ctx);
      return {
        content: [{ type: "text", text: result }],
        details: undefined,
      };
    },
  });
}

// -- Tool definitions --

const getState = tuiTool({
  name: "tui_get_state",
  label: "Get Desktop State",
  description:
    "Returns the current desktop state: screen size, open windows with " +
    "their positions/sizes/types, and which window is focused.",
  parameters: Type.Object({}),
  execute: (_params, ctx) => JSON.stringify(ctx.getState(), null, 2),
});

const openWindow = tuiTool({
  name: "tui_open_window",
  label: "Open Window",
  description:
    "Opens a new window of the given type. Returns the new window's ID.",
  parameters: Type.Object({
    type: Type.String({
      description:
        'Window type to open: "terminal", "editor", "primer", "art", ' +
        '"gallery", "browser", "figlet", "pattern", "orbit", "glitch", etc.',
    }),
  }),
  execute: (params, ctx) => {
    const result = ctx.openWindow(params.type);
    return JSON.stringify(result);
  },
});

const closeWindow = tuiTool({
  name: "tui_close_window",
  label: "Close Window",
  description: "Closes a window by its numeric ID.",
  parameters: Type.Object({
    id: Type.Number({ description: "Window ID to close" }),
  }),
  execute: (params, ctx) => {
    const ok = ctx.closeWindow(params.id);
    return ok ? "closed" : "window not found";
  },
});

const moveWindow = tuiTool({
  name: "tui_move_window",
  label: "Move/Resize Window",
  description:
    "Moves and optionally resizes a window. All coordinates are in " +
    "terminal columns/rows. (0,0) is top-left.",
  parameters: Type.Object({
    id: Type.Number({ description: "Window ID" }),
    left: Type.Number({ description: "X position (columns from left)" }),
    top: Type.Number({ description: "Y position (rows from top)" }),
    width: Type.Optional(Type.Number({ description: "New width" })),
    height: Type.Optional(Type.Number({ description: "New height" })),
  }),
  execute: (params, ctx) => {
    const ok = ctx.moveWindow(
      params.id,
      params.left,
      params.top,
      params.width,
      params.height
    );
    return ok ? "moved" : "window not found";
  },
});

const focusWindow = tuiTool({
  name: "tui_focus_window",
  label: "Focus Window",
  description: "Brings a window to the front and focuses it.",
  parameters: Type.Object({
    id: Type.Number({ description: "Window ID to focus" }),
  }),
  execute: (params, ctx) => {
    const ok = ctx.focusWindow(params.id);
    return ok ? "focused" : "window not found";
  },
});

const sendInput = tuiTool({
  name: "tui_send_input",
  label: "Send Input to Window",
  description:
    'Sends text input to a window (e.g. a terminal). Include "\\n" to ' +
    "press Enter.",
  parameters: Type.Object({
    id: Type.Number({ description: "Window ID" }),
    input: Type.String({ description: "Text to send" }),
  }),
  execute: (params, ctx) => {
    const ok = ctx.sendWindowInput(params.id, params.input);
    return ok ? "sent" : "window not found or not interactive";
  },
});

const readWindow = tuiTool({
  name: "tui_read_window",
  label: "Read Window Text",
  description:
    "Captures the visible text content of a window (terminal buffer, " +
    "editor text, primer content, etc).",
  parameters: Type.Object({
    id: Type.Number({ description: "Window ID to read" }),
  }),
  execute: (params, ctx) => {
    const text = ctx.captureWindowText(params.id);
    return text ?? "window not found or not readable";
  },
});

// -- Public API --

export function createTuiTools(ctx: TuiToolContext): AgentTool<any>[] {
  return [
    getState(ctx),
    openWindow(ctx),
    closeWindow(ctx),
    moveWindow(ctx),
    focusWindow(ctx),
    sendInput(ctx),
    readWindow(ctx),
  ];
}

/**
 * Compact desktop summary for injection into agent context.
 * Keep this small — it's prepended every turn.
 */
export function formatDesktopSummary(state: DesktopState): string {
  const { screen, windows } = state;
  const lines = [
    `[Desktop ${screen.width}x${screen.height} | ${windows.length} windows]`,
  ];
  for (const w of windows) {
    const focus = w.focused ? " focused" : "";
    lines.push(
      `  w${w.id}: ${w.title} (${w.width}x${w.height} @ ${w.left},${w.top})${focus}`
    );
  }
  return lines.join("\n");
}
