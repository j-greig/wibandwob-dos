#!/usr/bin/env node
/**
 * MCP Bridge — stdio server (for pi) ↔ httpStream client (for wwdos)
 *
 * pi spawns this. Presents as MCP server on stdin/stdout, forwards
 * to wwdos fastmcp httpStream. Auto-reconnects on error.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT_OFFSET = 10;
const controlPort = parseInt(process.env.WIBWOB_CONTROL_PORT || "8099", 10);
const mcpPort = controlPort + PORT_OFFSET;
const mcpUrl = new URL(`http://localhost:${mcpPort}/mcp`);

// ── persistent wwdos client with lazy reconnect ──────────────────────────

let _client = null;

async function connect() {
  const c = new Client({ name: "wibwob-bridge", version: "1.0.0" });
  c.onerror = (err) => console.error(`[wibwob-mcp] client error: ${err}`);
  const t = new StreamableHTTPClientTransport(mcpUrl);
  await c.connect(t);
  console.error(`[wibwob-mcp] connected to ${mcpUrl}`);
  return c;
}

async function getClient() {
  if (!_client) _client = await connect();
  return _client;
}

async function withRetry(fn) {
  try {
    return await fn(await getClient());
  } catch (err) {
    console.error(`[wibwob-mcp] reconnecting: ${err.message}`);
    _client = null;
    return await fn(await getClient());
  }
}

// ── pi-facing stdio server ───────────────────────────────────────────────

const server = new Server(
  { name: "wibwob-dos", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () =>
  withRetry(c => c.listTools()),
);

server.setRequestHandler(CallToolRequestSchema, (request) =>
  withRetry(c => c.callTool(request.params)),
);

server.setRequestHandler(ListResourcesRequestSchema, async () =>
  ({ resources: [] }),
);

server.setRequestHandler(ListPromptsRequestSchema, async () =>
  ({ prompts: [] }),
);

// ── start ────────────────────────────────────────────────────────────────

const stdioTransport = new StdioServerTransport();
await server.connect(stdioTransport);
console.error(`[wibwob-mcp] ready — bridging stdio ↔ ${mcpUrl}`);

// Keep event loop alive
setInterval(() => {}, 30_000);
