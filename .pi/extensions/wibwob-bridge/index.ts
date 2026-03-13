/**
 * WibWob-DOS Bridge Extension for pi
 *
 * Registers TUI tools that proxy to the WibWob-DOS control API (port 8099).
 * The agent can see and control the desktop — open windows, run commands,
 * read window content, move/resize/close, interact with Scramble, etc.
 *
 * WibWob-DOS must be running separately (e.g. in tmux).
 * The extension auto-detects whether it's reachable on startup.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";

const API = "http://127.0.0.1:8099";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string; json?: unknown }> {
  try {
    const opts: RequestInit = { method };
    if (body) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}${path}`, opts);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { /* plain text */ }
    return { ok: res.ok, status: res.status, text, json };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      text: `WibWob-DOS unreachable at ${API}: ${e.message}. Is it running?`,
    };
  }
}

function result(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details: details ?? {},
  };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {

  // -- Health check on startup --
  pi.on("session_start", async (_event, ctx) => {
    const r = await api("GET", "/health");
    if (r.ok) {
      ctx.ui.setStatus("wibwob", "WibWob-DOS ✓");
      ctx.ui.notify("WibWob-DOS connected", "info");
    } else {
      ctx.ui.setStatus("wibwob", "WibWob-DOS ✗");
      ctx.ui.notify("WibWob-DOS not running — tui_ tools will error", "warning");
    }
  });

  // =========================================================================
  // CORE: state, commands, screenshot
  // =========================================================================

  pi.registerTool({
    name: "tui_get_state",
    label: "Get Desktop State",
    description:
      "Returns WibWob-DOS desktop state: screen size, open windows with " +
      "positions/sizes/types, focused window, theme.",
    parameters: Type.Object({}),
    async execute() {
      const r = await api("GET", "/state");
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_list_commands",
    label: "List TUI Commands",
    description:
      "Lists all available WibWob-DOS commands from the shared command registry. " +
      "Use this to discover what you can do before calling tui_run_command.",
    parameters: Type.Object({}),
    async execute() {
      const r = await api("GET", "/commands/list");
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_run_command",
    label: "Run TUI Command",
    description:
      "Execute a WibWob-DOS command by id. Use tui_list_commands first to discover " +
      "available commands. Example ids: primer.open, figlet.open, window.tile, " +
      "theme.cycle, art.open, backrooms.open, agent.open",
    parameters: Type.Object({
      id: Type.String({ description: "Command id, e.g. chrome.open or window.tile" }),
      args: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Optional arguments, e.g. {\"text\": \"HELLO\", \"font\": \"slant\"} for figlet.open",
        }),
      ),
    }),
    async execute(_id, params) {
      const r = await api("POST", "/commands/run", {
        id: params.id,
        args: params.args,
      });
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_screenshot",
    label: "Screenshot",
    description:
      "Capture a text screenshot of the WibWob-DOS desktop or a specific window. " +
      "Returns clean readable text. Pass window_id to capture just that window.",
    parameters: Type.Object({
      window_id: Type.Optional(Type.Number({ description: "Window ID to capture (omit for full screen)" })),
    }),
    async execute(_id, params) {
      const qs = params.window_id != null ? `?id=${params.window_id}` : "";
      const r = await api("GET", `/screenshot/text${qs}`);
      return result(r.text);
    },
  });

  // =========================================================================
  // WINDOWS: focus, move, resize, close, batch, read, input
  // =========================================================================

  pi.registerTool({
    name: "tui_focus_window",
    label: "Focus Window",
    description: "Bring a window to the front and give it focus.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/focus", { id: params.id });
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_move_window",
    label: "Move Window",
    description: "Move a window to absolute coordinates.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
      left: Type.Number({ description: "X position" }),
      top: Type.Number({ description: "Y position" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/move", params);
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_resize_window",
    label: "Resize Window",
    description: "Resize a window.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
      width: Type.Number({ description: "New width" }),
      height: Type.Number({ description: "New height" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/resize", params);
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_close_window",
    label: "Close Window",
    description: "Close a window by ID. Never close the Wib&Wob Chat window.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/close", { id: params.id });
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_batch_layout",
    label: "Batch Window Layout",
    description:
      "Move, resize, or close multiple windows in one call. Each op can " +
      "include any combination of left, top, width, height, close.",
    parameters: Type.Object({
      ops: Type.Array(
        Type.Object({
          id: Type.Number(),
          left: Type.Optional(Type.Number()),
          top: Type.Optional(Type.Number()),
          width: Type.Optional(Type.Number()),
          height: Type.Optional(Type.Number()),
          close: Type.Optional(Type.Boolean()),
        }),
      ),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/batch", { ops: params.ops });
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_read_window",
    label: "Read Window Content",
    description:
      "Read the text content of a window. Returns semantic content " +
      "(not raw screen buffer) where available.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
    }),
    async execute(_tid, params) {
      const r = await api("GET", `/windows/text?id=${params.id}`);
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_send_input",
    label: "Send Input to Window",
    description:
      "Send text input to a window. For chat windows, append \\r to submit. " +
      "For editor windows, text is inserted at cursor.",
    parameters: Type.Object({
      id: Type.Number({ description: "Window ID" }),
      input: Type.String({ description: "Text to send (\\r to submit in chat)" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/windows/input", {
        id: params.id,
        input: params.input,
      });
      return result(r.text);
    },
  });

  // =========================================================================
  // VIEWS: open specific window types
  // =========================================================================

  pi.registerTool({
    name: "tui_open_figlet",
    label: "Open Figlet Banner",
    description: "Open a FIGlet ASCII art banner with given text and optional font.",
    parameters: Type.Object({
      text: Type.String({ description: "Text to render" }),
      font: Type.Optional(Type.String({ description: "Font name (e.g. slant, banner, big)" })),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/view/figlet/open-default", params);
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_open_primer",
    label: "Open Primer",
    description: "Open a primer (ASCII art) viewer by file path.",
    parameters: Type.Object({
      filePath: Type.String({ description: "Absolute path to primer .txt file" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/view/primer/open", { filePath: params.filePath });
      return result(r.text);
    },
  });

  pi.registerTool({
    name: "tui_open_editor",
    label: "Open Editor",
    description: "Open the text editor, optionally with a file or initial content.",
    parameters: Type.Object({
      filePath: Type.Optional(Type.String({ description: "File to open" })),
      title: Type.Optional(Type.String()),
      initial: Type.Optional(Type.String({ description: "Initial text content" })),
    }),
    async execute(_tid, params) {
      const r = await api("POST", "/view/editor/open", params);
      return result(r.text);
    },
  });

  // =========================================================================
  // SCRAMBLE: the cat
  // =========================================================================

  pi.registerTool({
    name: "tui_scramble",
    label: "Scramble the Cat",
    description:
      "Interact with Scramble the cat. Actions: say (send message), pet, " +
      "sleep, wake, meow, state (check status), history (conversation log).",
    parameters: Type.Object({
      action: StringEnum(["say", "pet", "sleep", "wake", "meow", "state", "history"] as const),
      text: Type.Optional(Type.String({ description: "Message to send (for 'say' action)" })),
    }),
    async execute(_tid, params) {
      const { action, text } = params;
      let r;
      switch (action) {
        case "say":
          r = await api("POST", "/scramble/say", { text: text ?? "hello" });
          break;
        case "state":
          r = await api("GET", "/scramble/state");
          break;
        case "history":
          r = await api("GET", "/scramble/history");
          break;
        default:
          r = await api("POST", `/scramble/${action}`);
      }
      return result(r.text);
    },
  });

  // =========================================================================
  // WIBWOB AGENT: send messages to the agent chat window
  // =========================================================================

  pi.registerTool({
    name: "tui_wibwob_ask",
    label: "Send to Wib&Wob Chat",
    description:
      "Send a message to the Wib&Wob Agent chat window inside WibWob-DOS. " +
      "This triggers a response from the embedded AI agent. Use to relay " +
      "questions, trigger actions, or continue a chain of thought.",
    parameters: Type.Object({
      text: Type.String({ description: "Message to send" }),
      window_id: Type.Optional(Type.Number({ description: "Agent window ID (auto-detected if omitted)" })),
    }),
    async execute(_tid, params) {
      // Find agent window if no ID given
      let windowId = params.window_id;
      if (windowId == null) {
        const stateR = await api("GET", "/state");
        if (stateR.json && typeof stateR.json === "object") {
          const state = stateR.json as any;
          const agentWin = state.windows?.find(
            (w: any) => w.kind === "agent" || w.title?.includes("Wib") || w.title?.includes("Agent"),
          );
          if (agentWin) windowId = agentWin.id;
        }
      }
      if (windowId == null) {
        return result("Could not find Wib&Wob Agent window. Is it open?");
      }
      const r = await api("POST", "/windows/agent-message", {
        id: windowId,
        text: params.text,
        sender: "pi",
      });
      return result(r.text);
    },
  });

  // =========================================================================
  // OVERLAY: modal dialog control
  // =========================================================================

  pi.registerTool({
    name: "tui_overlay",
    label: "Overlay Control",
    description:
      "Check or interact with modal overlays (dialogs, pickers, prompts). " +
      "Actions: info (check if overlay active), confirm (press OK/Enter), " +
      "cancel (press Escape), select (pick item by index).",
    parameters: Type.Object({
      action: StringEnum(["info", "confirm", "cancel", "select"] as const),
      index: Type.Optional(Type.Number({ description: "Item index for select action" })),
    }),
    async execute(_tid, params) {
      const { action, index } = params;
      let r;
      switch (action) {
        case "info":
          r = await api("GET", "/overlay/info");
          break;
        case "confirm":
          r = await api("POST", "/overlay/confirm");
          break;
        case "cancel":
          r = await api("POST", "/overlay/cancel");
          break;
        case "select":
          r = await api("POST", "/overlay/select", { index: index ?? 0 });
          break;
      }
      return result(r.text);
    },
  });

  // =========================================================================
  // WORKSPACE: save/load layouts
  // =========================================================================

  pi.registerTool({
    name: "tui_workspace",
    label: "Workspace",
    description: "Save or load a named window layout.",
    parameters: Type.Object({
      action: StringEnum(["save", "load"] as const),
      name: Type.String({ description: "Workspace name" }),
    }),
    async execute(_tid, params) {
      const r = await api("POST", `/workspace/${params.action}`, { name: params.name });
      return result(r.text);
    },
  });

  // =========================================================================
  // BROWSER: Chrome browser control
  // =========================================================================

  pi.registerTool({
    name: "tui_browser",
    label: "Chrome Browser",
    description:
      "Control the Chrome Browser window. Actions: open (navigate to URL), " +
      "links (list clickable links), follow (click a link by index), " +
      "search (search within page).",
    parameters: Type.Object({
      action: StringEnum(["open", "links", "follow", "search"] as const),
      url: Type.Optional(Type.String({ description: "URL to navigate to (for open)" })),
      window_id: Type.Optional(Type.Number({ description: "Browser window ID" })),
      index: Type.Optional(Type.Number({ description: "Link index (for follow)" })),
      query: Type.Optional(Type.String({ description: "Search query (for search)" })),
    }),
    async execute(_tid, params) {
      const { action } = params;
      // For open, use the command
      if (action === "open") {
        const r = await api("POST", "/commands/run", {
          id: "chrome.open",
          args: params.url ? { url: params.url } : {},
        });
        return result(r.text);
      }
      // Other actions need the run_command approach
      const cmdMap: Record<string, string> = {
        links: "chrome.links",
        follow: "chrome.follow",
        search: "chrome.search",
      };
      const args: Record<string, unknown> = {};
      if (params.window_id != null) args.window_id = params.window_id;
      if (params.index != null) args.index = params.index;
      if (params.query) args.query = params.query;
      const r = await api("POST", "/commands/run", { id: cmdMap[action], args });
      return result(r.text);
    },
  });

  // =========================================================================
  // COMMANDS: slash commands that bridge pi ↔ WibWob-DOS
  // =========================================================================

  pi.registerCommand("wibwob", {
    description: "Check WibWob-DOS status or launch it",
    async handler(args, ctx) {
      const r = await api("GET", "/health");
      if (r.ok) {
        const state = await api("GET", "/state");
        const s = state.json as any;
        const winCount = s?.windows?.length ?? "?";
        ctx.ui.notify(
          `WibWob-DOS running — ${winCount} windows open`,
          "info",
        );
        ctx.ui.setStatus("wibwob", "WibWob-DOS ✓");
      } else {
        ctx.ui.notify(
          "WibWob-DOS not running. Start it with: bun run dev (in the wibandwob-dos repo)",
          "warning",
        );
        ctx.ui.setStatus("wibwob", "WibWob-DOS ✗");
      }
    },
  });

  // -- /ww-edit <path> — open a file in WibWob-DOS editor fullscreen --
  pi.registerCommand("ww-edit", {
    description: "Open a file in the WibWob-DOS editor (fullscreen). Usage: /ww-edit path/to/file",
    async handler(args, ctx) {
      const filePath = args?.trim();
      if (!filePath) {
        ctx.ui.notify("Usage: /ww-edit <file-path>", "warning");
        return;
      }

      // Resolve relative paths against cwd
      const resolved = filePath.startsWith("/")
        ? filePath
        : `${ctx.cwd}/${filePath}`;

      // Check WibWob is alive
      const health = await api("GET", "/health");
      if (!health.ok) {
        ctx.ui.notify("WibWob-DOS not running", "error");
        return;
      }

      // Read file content via node
      let content: string;
      try {
        const fs = await import("node:fs");
        content = fs.readFileSync(resolved, "utf-8");
      } catch (e: any) {
        ctx.ui.notify(`Can't read ${resolved}: ${e.message}`, "error");
        return;
      }

      // Open editor with content
      const r = await api("POST", "/view/editor/open", {
        filePath: resolved,
        title: filePath.split("/").pop(),
        initial: content,
      });

      if (!r.ok) {
        ctx.ui.notify(`Failed to open editor: ${r.text}`, "error");
        return;
      }

      // Maximize it — find the editor window we just opened
      const state = await api("GET", "/state");
      const s = state.json as any;
      const editors = (s?.windows ?? []).filter(
        (w: any) => w.kind === "editor",
      );
      if (editors.length > 0) {
        const newest = editors[editors.length - 1];
        await api("POST", "/windows/maximize", { id: newest.id });
      }

      ctx.ui.notify(`Opened ${filePath} in WibWob-DOS editor`, "info");
    },
  });

  // -- /ww-show <text> — splat a figlet banner on the desktop --
  pi.registerCommand("ww-show", {
    description: "Show a FIGlet banner on the WibWob-DOS desktop. Usage: /ww-show HELLO WORLD",
    async handler(args, ctx) {
      const text = args?.trim() || "WIB WOB";
      const health = await api("GET", "/health");
      if (!health.ok) {
        ctx.ui.notify("WibWob-DOS not running", "error");
        return;
      }
      await api("POST", "/view/figlet/open-default", { text });
      ctx.ui.notify(`Banner: ${text}`, "info");
    },
  });

  // -- /ww-screenshot — capture the desktop and paste it into pi's editor --
  pi.registerCommand("ww-screenshot", {
    description: "Capture WibWob-DOS screen as text and paste into pi editor",
    async handler(args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) {
        ctx.ui.notify("WibWob-DOS not running", "error");
        return;
      }
      const r = await api("GET", "/screenshot/text");
      if (r.ok) {
        ctx.ui.pasteToEditor(r.text);
        ctx.ui.notify("Desktop screenshot pasted into editor", "info");
      } else {
        ctx.ui.notify("Screenshot failed", "error");
      }
    },
  });

  // -- /ww-tile — tile all windows neatly --
  pi.registerCommand("ww-tile", {
    description: "Tile all WibWob-DOS windows",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/commands/run", { id: "window.tile" });
      ctx.ui.notify("Windows tiled", "info");
    },
  });

  // -- /ww-art — open generative art --
  pi.registerCommand("ww-art", {
    description: "Open generative art on the WibWob-DOS desktop",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/commands/run", { id: "art.open" });
      ctx.ui.notify("Art opened", "info");
    },
  });

  // -- /ww-primer <path> — open a primer --
  pi.registerCommand("ww-primer", {
    description: "Open an ASCII art primer in WibWob-DOS. Usage: /ww-primer path/to/art.txt",
    async handler(args, ctx) {
      const filePath = args?.trim();
      if (!filePath) {
        ctx.ui.notify("Usage: /ww-primer <path-to-primer.txt>", "warning");
        return;
      }
      const resolved = filePath.startsWith("/")
        ? filePath
        : `${ctx.cwd}/${filePath}`;
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/view/primer/open", { filePath: resolved });
      ctx.ui.notify(`Primer opened: ${filePath}`, "info");
    },
  });

  // -- /ww-say <message> — send a message to Wib&Wob --
  pi.registerCommand("ww-say", {
    description: "Send a message to the Wib&Wob Agent chat. Usage: /ww-say hello from pi!",
    async handler(args, ctx) {
      const text = args?.trim();
      if (!text) {
        ctx.ui.notify("Usage: /ww-say <message>", "warning");
        return;
      }
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }

      // Find agent window
      const stateR = await api("GET", "/state");
      const s = stateR.json as any;
      const agentWin = (s?.windows ?? []).find(
        (w: any) => w.kind === "agent" || w.title?.includes("Wib") || w.title?.includes("Agent"),
      );
      if (!agentWin) {
        ctx.ui.notify("No Wib&Wob Agent window found — opening one", "info");
        await api("POST", "/commands/run", { id: "agent.open" });
        // Wait a beat for it to appear
        await new Promise(r => setTimeout(r, 500));
      }

      // Re-fetch state to get the window id
      const stateR2 = await api("GET", "/state");
      const s2 = stateR2.json as any;
      const win = (s2?.windows ?? []).find(
        (w: any) => w.kind === "agent" || w.title?.includes("Wib") || w.title?.includes("Agent"),
      );
      if (!win) {
        ctx.ui.notify("Could not find agent window", "error");
        return;
      }

      await api("POST", "/windows/agent-message", {
        id: win.id,
        text,
        sender: "pi",
      });
      ctx.ui.notify(`Sent to Wib&Wob: ${text.slice(0, 50)}`, "info");
    },
  });

  // -- /ww-pet — pet the cat --
  pi.registerCommand("ww-pet", {
    description: "Pet Scramble the cat",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/scramble/pet");
      ctx.ui.notify("🐱 *purrs*", "info");
    },
  });

  // -- /ww-meow — make the cat meow --
  pi.registerCommand("ww-meow", {
    description: "Make Scramble meow",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/scramble/meow");
      ctx.ui.notify("🐱 meow!", "info");
    },
  });

  // -- /ww-theme — cycle WibWob-DOS theme --
  pi.registerCommand("ww-theme", {
    description: "Cycle the WibWob-DOS theme",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/commands/run", { id: "theme.cycle" });
      ctx.ui.notify("Theme cycled", "info");
    },
  });

  // -- /ww-close-all — close all windows except agent --
  pi.registerCommand("ww-close-all", {
    description: "Close all WibWob-DOS windows except the agent chat",
    async handler(_args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }

      const stateR = await api("GET", "/state");
      const s = stateR.json as any;
      const windows = s?.windows ?? [];
      const toClose = windows.filter(
        (w: any) => w.kind !== "agent" && !w.title?.includes("Wib&Wob") && !w.title?.includes("Scramble"),
      );

      if (toClose.length === 0) {
        ctx.ui.notify("Nothing to close", "info");
        return;
      }

      const ops = toClose.map((w: any) => ({ id: w.id, close: true }));
      await api("POST", "/windows/batch", { ops });
      ctx.ui.notify(`Closed ${toClose.length} windows`, "info");
    },
  });

  // -- /ww-browse <url> — open a URL in WibWob-DOS browser --
  pi.registerCommand("ww-browse", {
    description: "Open a URL in the WibWob-DOS Chrome Browser. Usage: /ww-browse https://...",
    async handler(args, ctx) {
      const url = args?.trim();
      if (!url) {
        ctx.ui.notify("Usage: /ww-browse <url>", "warning");
        return;
      }
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/commands/run", { id: "chrome.open", args: { url } });
      ctx.ui.notify(`Browsing: ${url}`, "info");
    },
  });

  // -- /ww-music <path> — open music player --
  pi.registerCommand("ww-music", {
    description: "Open the WibWob-DOS music player, optionally with a file. Usage: /ww-music [path]",
    async handler(args, ctx) {
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      const body: Record<string, unknown> = {};
      if (args?.trim()) {
        const p = args.trim();
        body.filePath = p.startsWith("/") ? p : `${ctx.cwd}/${p}`;
      }
      await api("POST", "/view/music-player/open", body);
      ctx.ui.notify("Music player opened", "info");
    },
  });

  // -- /ww-save <name> — save workspace --
  pi.registerCommand("ww-save", {
    description: "Save the current WibWob-DOS workspace layout. Usage: /ww-save my-layout",
    async handler(args, ctx) {
      const name = args?.trim();
      if (!name) { ctx.ui.notify("Usage: /ww-save <name>", "warning"); return; }
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/workspace/save", { name });
      ctx.ui.notify(`Workspace saved: ${name}`, "info");
    },
  });

  // -- /ww-load <name> — load workspace --
  pi.registerCommand("ww-load", {
    description: "Load a saved WibWob-DOS workspace layout. Usage: /ww-load my-layout",
    async handler(args, ctx) {
      const name = args?.trim();
      if (!name) { ctx.ui.notify("Usage: /ww-load <name>", "warning"); return; }
      const health = await api("GET", "/health");
      if (!health.ok) { ctx.ui.notify("WibWob-DOS not running", "error"); return; }
      await api("POST", "/workspace/load", { name });
      ctx.ui.notify(`Workspace loaded: ${name}`, "info");
    },
  });

  // =========================================================================
  // PROMPT GUIDELINES: teach the LLM about the desktop
  // =========================================================================

  // Inject desktop awareness into system prompt when tools are active
  pi.on("before_agent_start", async (_event, ctx) => {
    const r = await api("GET", "/health");
    if (!r.ok) return;

    const stateR = await api("GET", "/state");
    if (!stateR.json) return;

    const state = stateR.json as any;
    const { screen, windows } = state;
    const lines = [
      `[WibWob-DOS Desktop ${screen?.width}x${screen?.height} | ${windows?.length ?? 0} windows]`,
    ];
    for (const w of windows ?? []) {
      const focus = w.focused ? " *focused*" : "";
      lines.push(
        `  #${w.id} ${w.kind} "${w.title}" ${w.width}x${w.height}@${w.left},${w.top}${focus}`,
      );
    }

    return {
      message: {
        customType: "wibwob-desktop-state",
        content: lines.join("\n"),
        display: false,
      },
    };
  });
}
