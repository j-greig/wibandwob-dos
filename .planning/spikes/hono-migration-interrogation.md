# Should control-api.ts migrate to Hono?

Adversarial interrogation of the TODO comment at the top of `src/services/control-api.ts`.

---

## The Claim

> Migrate to Hono + @modelcontextprotocol/hono when route count exceeds ~15 or when MCP agent support is needed.

Route count is now **75 catalogue entries**, **53 if-branches**, and the single `handleRequest` method is **674 lines**. By the stated trigger, migration is overdue. But the trigger was wrong. Let's find out why.

---

## What Hono Would Actually Replace

| Component | Lines | Hono replaces? |
|-----------|-------|----------------|
| `ENDPOINT_CATALOGUE` (docs array) | 87 | No — or it moves into Zod schemas, which is more code not less |
| OpenAPI spec builder | 29 | Yes — `@hono/zod-openapi` generates this. But requires Zod schemas for all 75 endpoints |
| Scalar HTML embed | 31 | No |
| Server lifecycle (port probe, unix socket, PID, discovery, manifest) | 274 | **No** — Hono doesn't own `Bun.serve()`. You still call `Bun.serve({ fetch: app.fetch })`. The port-probing loop, dual HTTP+unix socket setup, PID sidecar writes, cleanup handlers — all stay. |
| `handleRequest` if-chain | 674 | **Partially** — the routing dispatch becomes `app.get("/health", ...)` etc. But the handler bodies are identical. |
| Rate limiter | 15 | Becomes middleware. Marginal improvement. |
| Helpers | ~30 | No |

**Honest delta: you replace ~674 lines of if-chains with ~674 lines of route registrations.** The handler logic inside each branch doesn't change. You're swapping `if (request.method === "GET" && url.pathname === "/health")` for `app.get("/health", (c) =>`. The bodies are the same.

---

## What Hono Would Add

### Real benefits

1. **Named route handlers** — each route becomes a function instead of an if-branch. This is the actual readability win. But you can get this without Hono (the `viewRoutes` map already does it for 22 routes).

2. **Middleware composition** — rate limiting, logging, error handling become composable layers. Currently rate limiting is a single wrapper. There's no auth, no CORS, no content negotiation. One middleware concern does not justify a framework.

3. **Type-safe request parsing** — with `@hono/zod-openapi`, request bodies get validated against Zod schemas and the OpenAPI spec is auto-generated. This is genuinely useful. But you'd need to write Zod schemas for all 75 endpoints. The ENDPOINT_CATALOGUE already serves as lightweight docs. The command registry already validates args via Zod for `/commands/run`.

### Real costs

1. **New dependency** — `hono` + `@hono/zod-openapi` + `zod` (zod already present? No — only used internally by command params). Adds to the 27 production deps. PHILOSOPHY.md §1 Radical simplicity: "Does this add a new primitive, or compose from existing ones?"

2. **Bun.serve() integration complexity** — the current setup does things Hono's standard adapter doesn't:
   - **Port probing** (tries 5 ports sequentially)
   - **Dual listeners** (HTTP port + unix socket serving the same handler)
   - **Dynamic runtime** (`Bun` is accessed via `globalThis` cast — the code handles the case where Bun doesn't exist)
   
   With Hono you'd still need `Bun.serve({ fetch: app.fetch })` twice (HTTP + unix), still need the port probing loop, still need the PID sidecar writes. Hono owns the routing, not the transport. The integration glue stays.

3. **SSE stream** — the `/events` endpoint creates a raw `ReadableStream`. Hono has SSE helpers (`hono/streaming`) but they're a different API shape. Migration is possible but it's rewriting working stream code for no behavioral gain.

4. **Class method access** — every handler accesses `this.deps.*`, `this.identity.*`, `this.runApiCommand()`. With Hono, route handlers are standalone functions. You'd need to either:
   - Close over `this` in the constructor (messy)
   - Pass a context object to every handler (verbose)
   - Use Hono's `c.set()`/`c.get()` DI pattern (framework coupling)
   
   Currently `this.deps.windows.focus(id)` is direct. With Hono it becomes `deps.windows.focus(id)` after some wiring. Same logic, more indirection.

5. **The ENDPOINT_CATALOGUE becomes redundant or duplicated** — today it's a single array that generates both the `/` help response and the OpenAPI spec. With `@hono/zod-openapi`, routes define their own schemas, and the catalogue is either deleted (losing the clean overview) or kept (now duplicated). The catalogue-as-source-of-truth is actually a nice pattern.

---

## The MCP Argument

The TODO mentions `@modelcontextprotocol/hono` for agent tool support. Interrogating this:

- **Nobody uses MCP to talk to WibWob-DOS today.** Zero references in the codebase outside this comment.
- **Agents talk to WibWob-DOS via the REST API + `wibwob` CLI.** This works. The command registry is already the single source of truth. Adding MCP means exposing the same commands through a second protocol.
- **MCP requires a Zod schema per tool.** The command catalog already has optional Zod params. But most commands (39 of them) have no schema — they use the loose `args?: Record<string, unknown>` pattern. You'd need to add schemas to all of them.
- **MCP is a transport concern, not a routing concern.** You could add MCP alongside the current REST API without Hono. `@modelcontextprotocol/server` works standalone — the Hono middleware is convenience, not necessity.

**Verdict: MCP is a separate decision from Hono. Don't bundle them.**

---

## The Real Problem

The actual pain in `control-api.ts` is not the routing framework. It's:

1. **674-line method with 53 if-branches** — this is the readability problem. But Hono doesn't solve it; it redistributes it into 53 route registrations that contain the same logic.

2. **39 direct `this.deps.*` calls vs 16 `runApiCommand` calls** — some routes go through the command registry (clean) and some bypass it to call deps directly (messy). The fix is to route more things through commands, not to change the HTTP framework.

3. **The ENDPOINT_CATALOGUE is manually maintained** — 75 entries that must match the actual handlers. Adding a route means editing two places. This is the duplication that actually hurts. But Hono with `@hono/zod-openapi` trades one duplication (catalogue ↔ handlers) for another (Zod schemas ↔ handler logic).

---

## What Would Actually Help

**Without adding any dependency:**

1. **Expand the `viewRoutes` pattern.** 22 routes already use a `Record<string, { id, argsMapper }>` map. Most of the remaining POST handlers are thin command-registry dispatch. Move them into the map. This collapses maybe 15 more if-branches into table entries.

2. **Extract GET handlers into a similar map.** The GET routes that just return `Response.json(this.deps.inspection.something())` can become a `Record<string, () => Response>` table.

3. **Route more deps calls through the command registry.** The 39 direct `this.deps.*` calls are the real COAT smell — they bypass the command seam. Each one converted to `runApiCommand` removes a handler and adds a command (which is useful for all surfaces, not just HTTP).

4. **Delete the ENDPOINT_CATALOGUE and generate it from the route map.** If routes are declared as data (map entries with descriptions), the catalogue becomes derived. No more two-place edits.

These changes keep the same `Bun.serve()` setup, keep the unix socket integration, keep the port probing, and produce the same readability improvement that Hono promises — without a framework.

---

## Decision

| Question | Answer |
|----------|--------|
| Does Hono solve the actual problem (674-line method)? | No — it redistributes it, same total logic |
| Does Hono add capabilities we need today? | No — no middleware needs beyond rate limiting |
| Does MCP require Hono? | No — standalone SDK works fine |
| Does the port-probe + dual-listener setup survive? | Yes — Hono doesn't own transport |
| Does PHILOSOPHY.md support this? | No — §1 "compose from existing", §5 "small composable tool, not framework" |
| Is there a cheaper path to the same readability? | Yes — expand the existing route-map pattern |

**Kill the TODO.** Replace it with a note about the route-map expansion strategy. If MCP becomes a real requirement, evaluate it independently — it's a protocol addition, not a framework migration.
