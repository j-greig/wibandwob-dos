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
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { DesktopState } from "../core/types.js";
import type { CommandListItem } from "../core/command-registry.js";
import type { SearchResult } from "./chrome-browser-service.js";
import { BraveSearchService } from "./brave-search-service.js";
import { fetchYoutubeTranscript } from "./youtube-transcript-service.js";

// -- Context interface: what the TUI exposes to tools --

export interface TuiToolContext {
  getState: () => DesktopState;
  listCommands: () => CommandListItem[];
  runCommand: (id: string, args?: Record<string, unknown>) => { ok: true } | { ok: false; error: string };
  openWindow: (type: string) => { id: number } | { error: string };
  openFigletWindow: (text: string, font?: string) => { id: number } | { error: string };
  openChromeBrowser: (url?: string) => { id: number } | { error: string };
  browserSearch: (query: string, numResults?: number) => Promise<SearchResult[]>;
  windows: import("../core/window-facade.js").WindowFacade;
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

const listCommands = tuiTool({
  name: "tui_list_commands",
  label: "List TUI Commands",
  description:
    "Lists the high-level app commands exposed by the shared command registry.",
  parameters: Type.Object({}),
  execute: (_params, ctx) => JSON.stringify(ctx.listCommands(), null, 2),
});

const runCommand = tuiTool({
  name: "tui_run_command",
  label: "Run TUI Command",
  description:
    "Runs a high-level app command by id using the shared command registry.",
  parameters: Type.Object({
    id: Type.String({ description: "Command id, e.g. chrome.open or window.tile" }),
    args: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
      description: "Optional arguments for parameterised commands, e.g. {\"theme\": \"forest\", \"model\": \"sonnet\", \"turns\": 8} for backrooms.run"
    }))
  }),
  execute: (params, ctx) => JSON.stringify(ctx.runCommand(params.id, params.args)),
});

const openWindow = tuiTool({
  name: "tui_open_window",
  label: "Open Window",
  description:
    "Opens a new window of the given type. Returns the new window's ID.",
  parameters: Type.Object({
    type: Type.String({
      description:
        'Window type to open: "editor", "primer", "art", ' +
        '"gallery", "browser", "figlet", "pattern", "chat", "agent", etc.',
    }),
  }),
  execute: (params, ctx) => {
    const result = ctx.openWindow(params.type);
    return JSON.stringify(result);
  },
});

const openFigletWindow = tuiTool({
  name: "tui_open_figlet",
  label: "Open Figlet Banner",
  description:
    "Opens a FIGlet ASCII-art banner window with the given text. " +
    "Optionally specify a font name. Returns the new window ID.",
  parameters: Type.Object({
    text: Type.String({ description: "Text to render as FIGlet ASCII art" }),
    font: Type.Optional(Type.String({ description: "FIGlet font name (e.g. 'standard', 'banner', 'big', 'slant'). Defaults to app default." })),
  }),
  execute: (params, ctx) => {
    const result = ctx.openFigletWindow(params.text, params.font);
    return JSON.stringify(result);
  },
});

const writeEditorText = tuiTool({
  name: "tui_editor_write",
  label: "Write to Editor Window",
  description: "Inserts text at the cursor position in an editor window.",
  parameters: Type.Object({
    id: Type.Number({ description: "Editor window ID" }),
    text: Type.String({ description: "Text to insert at cursor" }),
  }),
  execute: (params, ctx) => {
    const ok = ctx.windows.writeEditorText(params.id, params.text);
    return ok ? "written" : "editor not found";
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
    const ok = ctx.windows.closeWindow(params.id);
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
    const moved = ctx.windows.moveWindow(params.id, params.left, params.top);
    if (!moved) return "window not found";
    if (params.width !== undefined && params.height !== undefined) {
      ctx.windows.resizeWindow(params.id, params.width, params.height);
    }
    return "moved";
  },
});

const batchLayout = tuiTool({
  name: "tui_batch_layout",
  label: "Batch Layout",
  description:
    "Move, resize, and/or close multiple windows in a single call. " +
    "Pass an array of ops — each op needs an 'id' plus any of: left, top (move), width, height (resize), or close:true. " +
    "Ops are applied in order. Use this instead of chained tui_move_window calls whenever positioning more than one window.",
  parameters: Type.Object({
    ops: Type.Array(
      Type.Object({
        id: Type.Number({ description: "Window ID" }),
        left: Type.Optional(Type.Number({ description: "Left position (columns)" })),
        top: Type.Optional(Type.Number({ description: "Top position (rows)" })),
        width: Type.Optional(Type.Number({ description: "Width (columns)" })),
        height: Type.Optional(Type.Number({ description: "Height (rows)" })),
        close: Type.Optional(Type.Boolean({ description: "Close this window if true" })),
      }),
      { description: "Array of window operations to apply in order" }
    ),
  }),
  execute: (params, ctx) => {
    const results: string[] = [];
    for (const op of params.ops) {
      if (op.close) {
        const ok = ctx.windows.closeWindow(op.id);
        results.push(`${op.id}: ${ok ? "closed" : "not found"}`);
        continue;
      }
      if (op.left !== undefined && op.top !== undefined) {
        const moved = ctx.windows.moveWindow(op.id, op.left, op.top);
        if (!moved) { results.push(`${op.id}: not found`); continue; }
      }
      if (op.width !== undefined && op.height !== undefined) {
        ctx.windows.resizeWindow(op.id, op.width, op.height);
      }
      results.push(`${op.id}: ok`);
    }
    return results.join(", ");
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
    const ok = ctx.windows.focusWindow(params.id);
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
    const ok = ctx.windows.sendInput(params.id, params.input);
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
    const text = ctx.windows.captureText(params.id);
    return text ?? "window not found or not readable";
  },
});

const openChromeBrowser = tuiTool({
  name: "tui_open_web_reader",
  label: "Open Chrome Browser",
  description:
    "Opens a Chrome browser window, optionally navigating to a URL. " +
    "Returns the new window's ID.",
  parameters: Type.Object({
    url: Type.Optional(Type.String({ description: "URL to navigate to on open" })),
  }),
  execute: (params, ctx) => {
    const result = ctx.openChromeBrowser(params.url);
    return JSON.stringify(result);
  },
});

const browserNavigate = tuiTool({
  name: "tui_browser_navigate",
  label: "Navigate Chrome Browser",
  description:
    "Navigates an existing Chrome browser window to a URL. " +
    "Pass the window ID and the full URL (including https://).",
  parameters: Type.Object({
    id: Type.Number({ description: "Chrome browser window ID" }),
    url: Type.String({ description: "URL to navigate to" }),
  }),
  execute: (params, ctx) => {
    const ok = ctx.windows.sendInput(params.id, params.url);
    return ok ? `navigating to ${params.url}` : "window not found or not a browser";
  },
});

/**
 * Parse markdown links [text](url) from raw text.
 * Returns de-duplicated list preserving first-seen order.
 */
function parseMarkdownLinks(markdown: string): Array<{ index: number; text: string; url: string }> {
  const seen = new Set<string>();
  const links: Array<{ index: number; text: string; url: string }> = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const url = m[2].trim();
    // Skip fragment-only links (#section) — they're internal page jumps
    if (url.startsWith("#")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ index: links.length + 1, text: m[1].trim() || "(no text)", url });
  }
  return links;
}

const browserListLinks = tuiTool({
  name: "tui_browser_list_links",
  label: "List Links in Browser Page",
  description:
    "Extracts and returns a numbered list of all links found on the current " +
    "page in a Chrome browser window. Each link has an index number, display " +
    "text, and URL. Use the index with tui_browser_follow_link to navigate.",
  parameters: Type.Object({
    id: Type.Number({ description: "Chrome browser window ID" }),
  }),
  execute: (params, ctx) => {
    const text = ctx.windows.captureText(params.id);
    if (text === undefined) return "window not found or not readable";
    const links = parseMarkdownLinks(text);
    if (links.length === 0) return "No links found on this page.";
    const lines = links.map((l) => `${l.index}. [${l.text}] ${l.url}`);
    return `${links.length} links found:\n${lines.join("\n")}`;
  },
});

const browserFollowLink = tuiTool({
  name: "tui_browser_follow_link",
  label: "Follow Link in Browser Page",
  description:
    "Follows a link by its index number (from tui_browser_list_links) in a " +
    "Chrome browser window. Navigates to that URL and loads the page.",
  parameters: Type.Object({
    id: Type.Number({ description: "Chrome browser window ID" }),
    link_index: Type.Number({ description: "Link number from tui_browser_list_links output" }),
  }),
  execute: (params, ctx) => {
    const text = ctx.windows.captureText(params.id);
    if (text === undefined) return "window not found or not readable";
    const links = parseMarkdownLinks(text);
    const link = links.find((l) => l.index === params.link_index);
    if (!link) return `link #${params.link_index} not found. Use tui_browser_list_links to see available links.`;
    const ok = ctx.windows.sendInput(params.id, link.url);
    return ok ? `following link #${params.link_index}: [${link.text}] → ${link.url}` : "could not navigate";
  },
});

const browserSearch = tuiTool({
  name: "tui_browser_search",
  label: "Search the Web (Chrome)",
  description:
    "Searches Google via Chrome and returns structured results with title, " +
    "URL, and snippet for each result. Use tui_browser_navigate or " +
    "tui_browser_follow_link to visit a result. Requires Chrome on :9222. " +
    "Prefer tui_web_search (Brave) when available — it needs no browser.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    num_results: Type.Optional(
      Type.Number({ description: "Number of results to return (default 5, max 20)" })
    ),
  }),
  execute: async (params, ctx) => {
    const n = Math.max(1, Math.min(params.num_results ?? 5, 20));
    const results = await ctx.browserSearch(params.query, n);
    if (results.length === 0) return "No results found. Is Chrome running on :9222?";
    const lines = results.map(
      (r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`
    );
    return `${results.length} results for "${params.query}":\n\n${lines.join("\n\n")}`;
  },
});

// -- Brave Search (no browser needed) --

const braveService = new BraveSearchService();

const webSearch = tuiTool({
  name: "tui_web_search",
  label: "Search the Web (Brave)",
  description:
    "Searches the web via Brave Search API. No browser required. " +
    "Returns titles, URLs, snippets, and age for each result. " +
    "Use tui_web_content to fetch full page content for a URL. " +
    "Falls back with a helpful error if BRAVE_API_KEY is not set.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    num_results: Type.Optional(
      Type.Number({ description: "Number of results (default 5, max 20)" })
    ),
    freshness: Type.Optional(
      Type.String({
        description:
          "Time filter: pd (past day), pw (past week), pm (past month), " +
          "py (past year), or YYYY-MM-DDtoYYYY-MM-DD date range",
      })
    ),
  }),
  execute: async (params) => {
    const { results, error } = await braveService.search(params.query, {
      numResults: params.num_results,
      freshness: params.freshness,
    });
    if (error && results.length === 0) return error;
    if (results.length === 0) return "No results found.";
    const lines = results.map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   ${r.link}${r.age ? `  (${r.age})` : ""}\n   ${r.snippet}`
    );
    return `${results.length} results for "${params.query}":\n\n${lines.join("\n\n")}`;
  },
});

const webContent = tuiTool({
  name: "tui_web_content",
  label: "Fetch Web Page Content",
  description:
    "Fetches a URL and extracts readable content as markdown. " +
    "No browser required — uses HTTP fetch + Readability. " +
    "Works for most pages. For JS-heavy SPAs, use Chrome browser instead.",
  parameters: Type.Object({
    url: Type.String({ description: "Full URL to fetch (including https://)" }),
  }),
  execute: async (params) => {
    const result = await braveService.fetchContent(params.url);
    if (!result.ok) return result.error ?? "Could not fetch content";
    const header = result.title ? `# ${result.title}\nURL: ${result.url}\n\n` : `URL: ${result.url}\n\n`;
    return header + result.markdown;
  },
});

// -- YouTube Transcript --

const youtubeTranscript = tuiTool({
  name: "tui_youtube_transcript",
  label: "Fetch YouTube Transcript",
  description:
    "Fetches the transcript/captions from a YouTube video. " +
    "Accepts a video URL or 11-character video ID. " +
    "Returns timestamped text. No API key or browser required.",
  parameters: Type.Object({
    video: Type.String({
      description:
        "YouTube video URL or ID (e.g. 'dQw4w9WgXcQ' or 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')",
    }),
  }),
  execute: async (params) => {
    const result = await fetchYoutubeTranscript(params.video);
    if (!result.ok) return result.error ?? "Could not fetch transcript";
    const header = `YouTube transcript for ${result.videoId} (${result.entries.length} entries):\n\n`;
    return header + result.fullText;
  },
});

// -- Public API --

export function createTuiTools(ctx: TuiToolContext): AgentTool<any>[] {
  return [
    getState(ctx),
    listCommands(ctx),
    runCommand(ctx),
    openWindow(ctx),
    openFigletWindow(ctx),
    openChromeBrowser(ctx),
    browserNavigate(ctx),
    browserListLinks(ctx),
    browserFollowLink(ctx),
    browserSearch(ctx),
    webSearch(ctx),
    webContent(ctx),
    youtubeTranscript(ctx),
    writeEditorText(ctx),
    closeWindow(ctx),
    moveWindow(ctx),
    batchLayout(ctx),
    focusWindow(ctx),
    sendInput(ctx),
    readWindow(ctx),
  ];
}

export function agentToolToDefinition<T extends TSchema, TDetails>(
  tool: AgentTool<T, TDetails>
): ToolDefinition<T, TDetails> {
  return {
    ...tool,
    execute: (toolCallId, params, signal, onUpdate, _ctx) =>
      tool.execute(toolCallId, params, signal, onUpdate),
  };
}

export function createTuiToolDefinitions(ctx: TuiToolContext): ToolDefinition[] {
  return createTuiTools(ctx).map(agentToolToDefinition);
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
