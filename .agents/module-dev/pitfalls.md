# Module Pitfalls

Common mistakes and gotchas when building modules. Check this if something
isn't working and you can't see why.

## Lifecycle hooks

| Mistake | What happens | Fix |
|---------|-------------|-----|
| Missing `describeState()` | Window shows no summary in /state, agents can't read it | Always return at least `{ summary: "..." }` |
| Missing `captureText()` | Text export and /windows/text return empty | Return the visible text content |
| Missing `onCleanup()` | Timers and connections leak when window closes | Clear all timers, destroy tree widgets, close connections |
| Missing `onRestyle()` | Window keeps old colours when theme changes | Re-apply `host.theme()` to all styled widgets |

The scaffold generates an empty `onCleanup()` stub. Fill it in when your
module creates timers, players, subscriptions, or any resource that outlives
a function call.

## Timers

| Mistake | Fix |
|---------|-----|
| Raw `setInterval` / `setTimeout` | Use `createTimer(fn, ms, timers)` from the SDK |
| Forgetting the timer set | `const timers = new Set<ReturnType<typeof setInterval>>()` at module scope |
| Cleanup without `clearTimers` | `win.onCleanup(() => clearTimers(timers))` |

## Widget parenting

| Mistake | Fix |
|---------|-----|
| Widgets added to `win.frame` | Always add to `win.body` |
| Grandchildren of scrollable box render blank | Set `fixed: true` on grandchildren — blessed's `_getCoords` double-subtracts scroll offset |
| `setContent` on a scrollable node with width=0 | Infinite loop — blessed word-wrap divides by width. Guard: `if (Number(node.width) > 0)` |

## Theme

| Mistake | Fix |
|---------|-----|
| `host.theme()` called once at startup, stored in variable | Call `host.theme()` fresh inside `onRestyle` and in render functions |
| `win.screen` for rendering | Use `host.screen` — there is no `win.screen` |

## Commands

| Mistake | Fix |
|---------|-----|
| Query command returns `{ok:true}` but caller gets nothing | Add `direct: true` to `registerCommand` — without it, `focusOrCreate` wraps the action and swallows the return value |
| `host.windowManager()` | Use `host.windows` |

## Imports

| Mistake | Fix |
|---------|-----|
| Importing from `src/core/app-controller.ts` | Never — use the host API |
| Importing from `src/core/*` directly | Import from `../../src/services/microapp-sdk.js` — if something is missing, add the re-export there |
| `spawnSync("figlet", ...)` | Use `renderFiglet` from the SDK — cached, safe fallback |
| Hand-built tab bar + key bindings | Use `createTabs` from the SDK |
| Copy-pasting pattern generators | Import from `PATTERNS` or individual named exports |

## Persistence

| Mistake | Fix |
|---------|-----|
| `persist: true` in manifest but no `registerSnapshot` | Either add the handler or set `persist: false` |
| Serializing widget state directly | Serialize your own state model, not blessed widget properties |
