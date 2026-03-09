#!/usr/bin/env bun
/**
 * MCP stdio bridge for wibandwob-dos control API.
 *
 * Wraps the REST API on http://127.0.0.1:8099 as MCP tools so that
 * Claude Code (via --mcp-config) can drive the TUI.
 *
 * Usage: bun run server.ts
 * Transport: stdio (required by claude --print --mcp-config)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.WIBWOB_API ?? "http://127.0.0.1:8099";
const API_TOKEN = process.env.WIBWOB_TOKEN ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(method: string, path: string, body?: unknown): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_TOKEN) headers["Authorization"] = `Bearer ${API_TOKEN}`;
  const opts: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    const text = await res.text();
    if (!res.ok) return `HTTP ${res.status}: ${text}`;
    return text;
  } catch (e: any) {
    return `Connection error: ${e.message} — is wibandwob-dos running on ${API_BASE}?`;
  }
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "wibwob-dos",
  version: "0.1.0",
});

// -- Reads ------------------------------------------------------------------

server.tool("get_state", "Get full live desktop state (windows, focus, theme)", {}, async () => {
  return ok(await api("GET", "/state"));
});

server.tool("get_health", "Health check — confirms app is running", {}, async () => {
  return ok(await api("GET", "/health"));
});

server.tool(
  "list_commands",
  "List all registered commands with descriptions",
  { surface: z.string().describe("Filter by surface: menu, palette, api, or agent").optional() },
  async ({ surface }) => {
    const qs = surface ? `?surface=${surface}` : "";
    return ok(await api("GET", `/commands/list${qs}`));
  },
);

server.tool(
  "get_window_text",
  "Get text content of a window by id",
  { id: z.number().describe("Window id from /state") },
  async ({ id }) => {
    return ok(await api("GET", `/windows/text?id=${id}`));
  },
);

server.tool(
  "screenshot_text",
  "Get text screenshot of a window",
  { id: z.number().describe("Window id from /state") },
  async ({ id }) => {
    return ok(await api("GET", `/screenshot/text?id=${id}`));
  },
);

// -- Commands ---------------------------------------------------------------

server.tool(
  "run_command",
  "Run a registered command by id (use list_commands to discover)",
  {
    id: z.string().describe("Command id (e.g. 'primer.open', 'theme.set')"),
    args: z.record(z.unknown()).optional().describe("Command arguments"),
  },
  async ({ id, args }) => {
    return ok(await api("POST", "/commands/run", { id, args: args ?? {} }));
  },
);

// -- Window Management ------------------------------------------------------

server.tool(
  "batch_windows",
  "Move, resize, or close multiple windows in one call",
  {
    ops: z
      .array(
        z.object({
          id: z.number(),
          x: z.number().optional(),
          y: z.number().optional(),
          w: z.number().optional(),
          h: z.number().optional(),
          close: z.boolean().optional(),
        }),
      )
      .describe("Array of window operations"),
  },
  async ({ ops }) => {
    return ok(await api("POST", "/windows/batch", { ops }));
  },
);

server.tool(
  "send_text",
  "Send text input to a window (append \\r to submit)",
  {
    id: z.number().describe("Window id"),
    input: z.string().describe("Text to send (use \\r to submit)"),
  },
  async ({ id, input }) => {
    return ok(await api("POST", "/windows/input", { id, input }));
  },
);

server.tool(
  "send_agent_message",
  "Send an agent message to a window",
  {
    id: z.number().describe("Window id"),
    text: z.string().describe("Message text"),
    sender: z.string().optional().describe("Sender name"),
  },
  async ({ id, text, sender }) => {
    return ok(await api("POST", "/windows/agent-message", { id, text, sender: sender ?? "wibwob" }));
  },
);

server.tool(
  "focus_window",
  "Focus a window by id",
  { id: z.number() },
  async ({ id }) => {
    return ok(await api("POST", "/windows/focus", { id }));
  },
);

server.tool(
  "close_window",
  "Close a window by id",
  { id: z.number() },
  async ({ id }) => {
    return ok(await api("POST", "/windows/close", { id }));
  },
);

// -- Window Openers ---------------------------------------------------------

server.tool(
  "open_figlet",
  "Open a figlet text banner window",
  {
    text: z.string().describe("Text to display"),
    font: z.string().optional().describe("Figlet font name"),
  },
  async ({ text, font }) => {
    return ok(await api("POST", "/view/figlet/open", { text, font }));
  },
);

server.tool(
  "open_editor",
  "Open a text editor window",
  { filePath: z.string().describe("Absolute file path") },
  async ({ filePath }) => {
    return ok(await api("POST", "/view/editor/open", { filePath }));
  },
);

server.tool(
  "open_primer",
  "Open a primer (text art / content) window",
  {
    filePath: z.string().describe("Absolute path to primer file"),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().optional(),
    h: z.number().optional(),
  },
  async ({ filePath, x, y, w, h }) => {
    return ok(await api("POST", "/view/primer/open", { filePath, x, y, w, h }));
  },
);

server.tool(
  "open_wibwob_agent",
  "Open the Wib&Wob Agent chat window",
  {},
  async () => {
    return ok(await api("POST", "/view/wibwob-agent/open", {}));
  },
);

server.tool(
  "open_art",
  "Open the art viewer",
  {},
  async () => {
    return ok(await api("POST", "/view/art/open", {}));
  },
);

// -- Workspace --------------------------------------------------------------

server.tool(
  "save_workspace",
  "Save current window layout as named workspace",
  { name: z.string() },
  async ({ name }) => {
    return ok(await api("POST", "/workspace/save", { name }));
  },
);

server.tool(
  "load_workspace",
  "Load a saved workspace by name",
  { name: z.string() },
  async ({ name }) => {
    return ok(await api("POST", "/workspace/load", { name }));
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
