---
name: microapp-creator
description: >
  Scaffold, register, and dev-loop a new WibWob-DOS microapp end-to-end.
  Use when: "create a microapp", "new microapp", "scaffold a microapp",
  "add a microapp", "build a new app for wibwob", "make a wibwob app".
---

# Microapp Creator

Full workflow: scaffold → register → implement required hooks → hot-reload verify.

## 1. Scaffold

```bash
bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>
```

Creates `microapps/<name>/index.ts` + `microapp.json`. Default `menuOrder` is 120.

## 2. Register

Add to `src/core/microapp-registry.ts` → `REGISTRY`. **The microapp won't appear until you do this.**

```typescript
import { MyMicroapp } from "../../microapps/my-microapp/index.js";
// in REGISTRY array:
{ tier: "core", factory: () => new MyMicroapp() }
// tiers: core = menu + API visible · beta = API only
```

## 3. Implement required hooks

Every window needs all four — missing any is the most common failure mode:

```typescript
win.describeState(() => ({ summary: "..." }))  // agents read this
win.captureText(() => "content text")           // wibwob read <id>
win.onCleanup(() => { /* stop timers */ })
win.onRestyle(() => { /* re-apply host.theme() */ })
```

Import only from `../../src/services/microapp-sdk.js` — never from `src/core/` directly.

## 4. Verify

```bash
bash scripts/reload-microapp.sh <id>
wibwob -i <label> cmd wibwob.<id>.open
wibwob -i <label> read <windowId>
```

## 5. Dev loop (optional)

```bash
bun run scripts/watch-microapp.ts microapps/<name>
```

Auto-reloads and reopens the microapp on file change.

## Reference

Full SDK, layout, pitfalls: `ARCHITECTURE.md §The microapp model`
Examples by complexity: `microapps/demo-hello-world` → `microapps/runtime-inspector`
