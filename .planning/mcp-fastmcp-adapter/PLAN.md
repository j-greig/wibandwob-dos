# Feature: fastmcp adapter over control-api

**Status:** Planned
**Created:** 2026-03-25

## One-liner

Auto-generate fastmcp tools from `GET /openapi.json` at startup so external agents can control wwdos via MCP over HTTP — wrapping the existing control-api, not replacing it.

## Why

External agents (pi, Claude Code, any MCP client) have no standard protocol to talk to wwdos. The control-api is HTTP/JSON only. fastmcp adds MCP transport (stdio + httpStream) as a thin adapter over the existing API surface.

## Files

| File | Change |
|------|--------|
| `src/services/mcp-server.ts` | **new** — OpenAPI→MCP generator, fastmcp stdio + httpStream transports |
| `src/runtime/runtime-node.ts` | wire mcp-server start after HTTP API is listening |
| `package.json` | add `fastmcp` dependency |

**Blast radius: 3 files, ~230 lines.**

## Design decisions

1. **Transport:** `stdio` (local/subprocess agents) + `httpStream` on a dedicated port (remote agents)
2. **Tool naming:** `GET /state` → `get_state`, `POST /windows/move` → `windows_move`
3. **Query params:** Inlined as tool args — `/windows/text?id=N` → `id?: number`
4. **JSON bodies:** Zod schema derived from OpenAPI `requestBody`
5. **Auth:** None — loopback-only local agent adapter
6. **SSE routes:** `/events` → MCP resource (`sse://events`)
7. **Error handling:** HTTP errors surface as `UserError`

## Evidence

- Tool discovery: `npx fastmcp inspect src/services/mcp-server.ts`
- Tool call: HTTP POST to MCP httpStream port returns same JSON as `curl http://127.0.0.1:8099/<route>`
- wwdos still works: `wibwob health` unchanged

## Steps

### Phase 1 — Foundation
- [ ] `bun add fastmcp`
- [ ] Create `src/services/mcp-server.ts`
- [ ] `bun run typecheck`

### Phase 2 — Integration
- [ ] Wire in `src/runtime/runtime-node.ts`
- [ ] Verify wwdos starts: `wibwob health`
- [ ] Confirm MCP port: `curl http://127.0.0.1:<port>/health`

### Phase 3 — Validation
- [ ] Tool discovery: `npx fastmcp dev src/services/mcp-server.ts`
- [ ] Test `get_state` = `curl http://127.0.0.1:8099/state`
