# Handover — feat/fastmcp-api-adapter

## Context

You are taking over `feat/fastmcp-api-adapter`. Your job: implement the fastmcp adapter that wraps the existing HTTP control-api as an MCP server so external agents can control wwdos.

## What exists

- **Plan:** `.planning/mcp-fastmcp-adapter/PLAN.md` — read it first, it is the source of truth.
- **Current branch:** `feat/fastmcp-api-adapter` in `~/Repos/wibandwob-dos-mcp/`
- **Source repo:** `/Users/james/Repos/wibandwob-dos` (original, not this worktree)

## How wwdos works

- HTTP control-api lives on port **8099** (or next available)
- Serves `GET /openapi.json` — this is the spec you will auto-generate MCP tools from
- Route table in `src/services/control-api.ts` — flat array of `RouteDefinition` objects
- Each route: `method + path + handler` (commandId, get, or post)
- Runtime wiring in `src/runtime/runtime-node.ts`

## What to build

Three files, in order:

### 1. `src/services/mcp-server.ts` (new, ~200 lines)

```typescript
// Structure:
import { FastMCP } from "fastmcp";
import { z } from "zod";

export function createMcpServer(apiBaseUrl: string): FastMCP { ... }

// The generator:
// - fetch GET ${apiBaseUrl}/openapi.json
// - for each path, create a tool:
//   - name = path.replace("/", "_").replace(/-/g, "_")  (e.g. windows_move, get_state)
//   - params = deriveZodSchemaFromOpenApiBody(route.body)
//   - execute = (args) => fetch(`${apiBaseUrl}${route.path}`, { method, body: JSON.stringify(args) })
// - SSE /events → MCP resource("sse://events")
// - start with stdio + httpStream transports
```

Key decisions baked into the plan:
- **Tool naming:** slashes → underscores, leading slash dropped
- **Query params:** inlined as tool args
- **POST bodies:** Zod schema from `requestBody.content["application/json"].schema`
- **GET routes:** no body, query params become args
- **Auth:** none — loopback only
- **Errors:** HTTP errors → `UserError` from fastmcp

### 2. `src/runtime/runtime-node.ts` (modified)

After the HTTP API starts listening (after `startHttpOnly()` succeeds):
```typescript
// Add after line ~200 (where actualPort is set)
const mcpServer = createMcpServer(`http://127.0.0.1:${actualPort}`);
mcpServer.start({ transportType: "stdio" });
mcpServer.start({ transportType: "httpStream", httpStream: { port: actualPort + 10 } });
```

### 3. `package.json`

```bash
bun add fastmcp
```

## Known risks (from plan)

1. **OpenAPI→Zod is non-trivial** for complex nested types. Start with a naive converter (handle `type: "string"`, `type: "number"`, `type: "boolean"`, top-level arrays/objects). Skip or stub anything complex — it can be refined later.
2. **Port conflicts:** MCP httpStream uses `actualPort + 10`. If that's taken, fastmcp auto-finds next available.
3. **The MCP server must start AFTER the HTTP API** — pass the resolved port, not the requested port.

## What NOT to do

- Don't hand-wire MCP tools — the generator must read from `GET /openapi.json`
- Don't add authentication — this is loopback-only
- Don't modify the control-api itself — this is a pure adapter
- Don't touch `src/core/command-catalog.ts` or add new commands

## Verification steps

1. `bun add fastmcp && bun run typecheck` — no errors
2. `bun run start` — wwdos starts, MCP server starts alongside HTTP API
3. `curl http://127.0.0.1:8099/state` and `curl http://127.0.0.1:<mcp-port>/health` both work
4. `npx fastmcp inspect src/services/mcp-server.ts` — shows generated tools

## Orientation checklist

- [ ] Read `.planning/mcp-fastmcp-adapter/PLAN.md`
- [ ] Read `src/services/control-api.ts` (top 100 lines + route table structure)
- [ ] Read `src/runtime/runtime-node.ts` (find where `startHttpOnly()` is called)
- [ ] Run `curl http://127.0.0.1:8099/openapi.json` to see what you're generating from
- [ ] `bun add fastmcp` and verify the import works
- [ ] Implement `src/services/mcp-server.ts`
- [ ] Wire in `src/runtime/runtime-node.ts`
- [ ] Run typecheck, start wwdos, verify
