# control-api.ts — What Would Actually Help?

Following on from [hono-migration-interrogation.md](hono-migration-interrogation.md). Hono is dead. What else is on the table?

---

## The Actual Pain

Not "we need a framework". The pain is specific:

1. **674-line `handleRequest` method** — 53 if-branches, unnavigable
2. **Dual dispatch paths** — 16 routes go through `runApiCommand` (clean COAT), 24 call `this.deps.*` directly (bypasses command seam)
3. **ENDPOINT_CATALOGUE maintained separately** — 75 entries that must match handlers manually. Two-place edits.
4. **No request validation on most routes** — only `/commands/run` validates via Zod. The 52 other routes do ad-hoc `Number(body.id)` / `String(body.text ?? "")` casting.

---

## Five Options

### A. No-dep route map expansion

Extend the existing `viewRoutes` pattern to cover all routes. No new dependencies.

```typescript
// What exists today (22 POST routes):
const viewRoutes: Record<string, { id: string; argsMapper? }> = {
  "/view/primer-browser/open": { id: "primer.browse" },
  // ... 21 more
};

// Expand to cover simple POST deps-dispatch routes too:
const postRoutes: Record<string, (body: Record<string, unknown>, deps: ControlApiDeps) => unknown> = {
  "/windows/focus":    (b, d) => ({ ok: d.windows.focus(Number(b.id)) }),
  "/windows/close":    (b, d) => ({ ok: d.windows.close(Number(b.id)) }),
  "/windows/maximize": (b, d) => ({ ok: d.windows.toggleMaximize(Number(b.id)) }),
  // ...
};

// And GET routes:
const getRoutes: Record<string, (url: URL, deps: ControlApiDeps) => unknown> = {
  "/state":              (_u, d) => d.inspection.syncState(),
  "/skin":               (_u, d) => ({ ok: true, skin: d.inspection.syncState().skin }),
  "/errors/recent":      ()     => ({ ok: true, errors: getRecentErrors() }),
  "/runtime/inspection": (_u, d) => ({ ok: true, snapshot: d.inspection.getSnapshot() }),
  // ...
};
```

**What improves:** `handleRequest` drops from 674 → ~200 lines (the complex routes with custom logic: screenshots, SSE, batch ops, /commands/run). Route tables are scannable. Adding a route is one line.

**What doesn't improve:** No request validation. ENDPOINT_CATALOGUE still separate. No type safety on handler signatures.

**Verdict: This is the minimum viable fix. Does 80% of the work with 0 deps. Should happen regardless of anything else.**

---

### B. Elysia (Bun-native framework)

Elysia is the Bun-specific answer to Hono. End-to-end type inference, built-in OpenAPI generation via `@elysiajs/swagger`, validation via TypeBox (already in our deps).

```typescript
import { Elysia, t } from 'elysia'

const app = new Elysia()
  .get('/health', () => ({ ok: true, pid: process.pid, ... }))
  .post('/windows/focus', ({ body }) => ({
    ok: deps.windows.focus(body.id)
  }), {
    body: t.Object({ id: t.Number() })
  })
  .post('/commands/run', ({ body }) => {
    // ...
  }, {
    body: t.Object({ id: t.String(), args: t.Optional(t.Record(t.String(), t.Unknown())) })
  })
```

**What improves:** Route dispatch is declarative. TypeBox validation built in (we already have the dep). OpenAPI auto-generated from route schemas — kills the ENDPOINT_CATALOGUE. End-to-end type inference means handler params are typed.

**What doesn't improve:** Same transport problem as Hono — we still need manual `Bun.serve()` for port probing + dual HTTP/unix socket. Elysia's `.listen()` doesn't support our setup. We'd need `Bun.serve({ fetch: app.handle })` just like Hono.

**Costs:**
- New dep (~2MB). 27 → 28 production deps.
- TypeBox is already installed but only used in agent-tools. Command catalog uses Zod. Now we have **two validation libraries** in the same request path. `/commands/run` validates with Zod (from command catalog), every other route validates with TypeBox (from Elysia). This is genuinely ugly.
- Elysia's plugin ecosystem assumes you use `.listen()`. Docs, examples, middleware — all assume Elysia owns the server. Our `Bun.serve()` escape hatch means we're fighting the framework's assumptions from day one.
- Elysia moves fast and breaks things. v1.0 to v1.2 had significant API changes. We'd be coupling our stable control surface to a framework that's still settling.

**Verdict: Best feature set on paper. But the dual-validation-library problem is a dealbreaker — the command catalog already chose Zod, and Elysia chose TypeBox. Mixing them in the same request flow violates §6 (Say Things Once). Would only make sense if we migrated command params to TypeBox too, which is a much larger change.**

---

### C. itty-router (micro router, ~450 bytes)

Just the dispatch layer. No validation, no OpenAPI, no middleware — pure `Request → Response` routing.

```typescript
import { Router } from 'itty-router'

const router = Router()
router.get('/health', () => Response.json({ ok: true, ... }))
router.post('/windows/focus', async (req) => {
  const body = await req.json()
  return Response.json({ ok: deps.windows.focus(Number(body.id)) })
})

// In Bun.serve:
Bun.serve({ fetch: router.fetch })
```

**What improves:** Eliminates the if-chain. 450 bytes, no ecosystem coupling. Works with `Bun.serve()` directly — port probing and unix socket setup unchanged.

**What doesn't improve:** No validation. No OpenAPI generation. No middleware. The handler bodies are identical to today. You're literally buying a `switch` statement.

**Costs:** Minimal. One tiny dep. But also minimal benefit over Option A — a hand-rolled route map does the same thing without a dependency, and the map can also generate the catalogue (itty-router can't).

**Verdict: If you want a router library, this is the right size. But Option A gives you the same dispatch improvement AND the catalogue generation, with zero deps. itty-router is a solution that's slightly too small — it solves dispatch but not the documentation/validation problems.**

---

### D. Route more through the command registry (COAT alignment)

The real architectural fix. Today 24 routes call `this.deps.*` directly. These should be commands:

```
Currently bypassing command registry:
  /windows/focus       → command "window.focus" exists but API doesn't use it
  /windows/close       → command "window.close" exists but API doesn't use it  
  /windows/maximize    → no command exists (should)
  /windows/input       → no command exists (should)
  /windows/move        → runApiCommand via /windows/move, but also direct
  /workspace/save      → command exists but API calls deps directly
  /workspace/load      → command exists but API calls deps directly
  /screenshot/text     → complex, stays as custom handler
  /screenshot/ansi     → complex, stays as custom handler
  /events (SSE)        → stays as custom handler (streaming)
  /windows/batch       → complex validation, stays as custom handler
```

If the missing commands are added and existing ones are wired through `runApiCommand`, those 24 routes collapse to:

```typescript
const commandRoutes: Record<string, string> = {
  "/windows/focus":    "window.focus",
  "/windows/close":    "window.close",
  "/windows/maximize": "window.maximize",
  "/windows/input":    "window.input",
  "/workspace/save":   "workspace.save",
  "/workspace/load":   "workspace.load",
  // ... etc
};

// Single dispatch:
const cmdRoute = commandRoutes[url.pathname];
if (cmdRoute) {
  return Response.json(this.runApiCommand(cmdRoute, body));
}
```

**What improves:** This is the COAT fix. Every route goes through the command seam. The command catalog becomes the true single source of truth — validation happens there (Zod), documentation happens there (descriptions), discoverability happens there (`/commands/list`). The API surface shrinks to: "POST any command by id" + a handful of custom GET/streaming routes.

**What doesn't improve:** Still need the if-chain for the ~15 routes that have custom logic (screenshots, SSE, batch, OpenAPI, health, etc.). Still need the ENDPOINT_CATALOGUE for those.

**Costs:**
- Need to add ~8 missing commands to command-catalog.ts
- Need Zod schemas for those commands (should have them anyway)
- Some routes have response shapes that differ from what `runApiCommand` returns (e.g., `/windows/text/export` returns `{ ok, path }` after doing file I/O). These need custom handling or the command needs to own the file export too.

**Verdict: This is the architecturally correct answer. It's not a framework choice — it's finishing the COAT migration that's already 60% done. The 16 routes through `runApiCommand` prove the pattern works. The 24 that bypass it are technical debt.**

---

### E. Typed route table with auto-generated catalogue

Combine A and D. Define routes as typed data that generates both the dispatch and the documentation:

```typescript
interface RouteDefinition {
  method: "GET" | "POST";
  path: string;
  description: string;
  // One of:
  commandId?: string;                                           // dispatch through registry
  handler?: (ctx: RouteContext) => unknown | Promise<unknown>;  // custom logic
}

const routes: RouteDefinition[] = [
  { method: "GET",  path: "/health",         description: "Instance identity", handler: (ctx) => ({ ok: true, ...ctx.identity }) },
  { method: "GET",  path: "/state",          description: "Live desktop state", handler: (ctx) => ctx.deps.inspection.syncState() },
  { method: "POST", path: "/windows/focus",  description: "Focus window by id", commandId: "window.focus" },
  { method: "POST", path: "/windows/close",  description: "Close window by id", commandId: "window.close" },
  { method: "POST", path: "/commands/run",   description: "Run command by id",  handler: commandsRunHandler },
  // ...
];

// ENDPOINT_CATALOGUE is now DERIVED:
const ENDPOINT_CATALOGUE = routes.map(r => ({ method: r.method, path: r.path, description: r.description }));

// Dispatch is DERIVED:
function handleRequest(req: Request): Response {
  const url = new URL(req.url);
  const route = routes.find(r => r.method === req.method && r.path === url.pathname);
  if (!route) return new Response("not found", { status: 404 });
  if (route.commandId) return Response.json(runApiCommand(route.commandId, body));
  return Response.json(route.handler!(ctx));
}
```

**What improves:** Single source of truth. Adding a route is one object literal. Catalogue, OpenAPI, and dispatch all derive from the same array. The 674-line method becomes a ~30-line generic dispatcher + the route table.

**What doesn't improve:** Complex routes (screenshots, SSE, batch) still need custom handler functions. But those are named functions, not anonymous if-branches.

**Costs:** This is Option A + D combined. No new deps. ~200 lines of route table replaces ~760 lines (674 handleRequest + 87 catalogue). The complex handlers move to named functions (~150 lines). Net reduction: ~400 lines.

**Verdict: This is the right answer. It's Options A and D composed, with the catalogue-as-derived-data insight. Zero deps, maximum COAT alignment, and the route table becomes both the dispatch and the documentation.**

---

## Recommendation

**Do E (typed route table) in two passes:**

### Pass 1 — Route the easy ones (low risk, high reward)

Move the ~30 routes that are simple dispatch (either through `runApiCommand` or one-liner `deps.*` calls) into a typed route table. Keep the ~15 complex routes as named handler functions called from the table. Kill the separate `ENDPOINT_CATALOGUE`. This alone cuts `handleRequest` from 674 to ~100 lines.

Estimated diff: -500 lines, +200 lines. Net -300.

### Pass 2 — Fill the command gaps (COAT completion)

Add the ~8 missing commands (`window.maximize`, `window.input`, `window.batch`, `window.editor.write`, `window.text.export`, `screenshot.text`, `screenshot.ansi`, `window.agent-message`). Move their API routes from custom handlers to `commandId` dispatch. Each migration shrinks the route table and grows the command surface.

This is independent of Pass 1 and can happen incrementally.

### What NOT to do

- Don't add Elysia, Hono, or any router framework. The transport setup (port probing, dual listener, unix sockets) means you're fighting every framework's assumptions.
- Don't add itty-router. A typed array with `.find()` is the same thing without the dep.
- Don't try to auto-generate OpenAPI from Zod schemas yet. The hand-rolled spec builder is 29 lines and works. Replace it only when all commands have Zod params (currently 14 of 104).
