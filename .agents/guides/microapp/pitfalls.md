# Microapp Pitfalls

Common mistakes and gotchas when building microapps. Check this if something
isn't working and you can't see why.

## Lifecycle hooks

| Mistake | What happens | Fix |
|---------|-------------|-----|
| Missing `describeState()` | Window shows no summary in /state, agents can't read it | Always return at least `{ summary: "..." }` |
| Missing `captureText()` | Text export and /windows/text return empty | Return the visible text content |
| Missing `onCleanup()` | Timers and connections leak when window closes | Clear all timers, destroy tree widgets, close connections |
| Missing `onRestyle()` | Window keeps old colours when theme changes | Re-apply `host.theme()` to all styled widgets |

The scaffold generates an empty `onCleanup()` stub. Fill it in when your
microapp creates timers, players, subscriptions, or any resource that outlives
a function call.

## Timers

| Mistake | Fix |
|---------|-----|
| Raw `setInterval` / `setTimeout` | Use `createTimer(fn, ms, timers)` from the SDK |
| Forgetting the timer set | `const timers = new Set<ReturnType<typeof setInterval>>()` at module scope |
| Untracked one-shot `setTimeout` in motion helpers | Store timeout handles in the same `timers` set so `clearTimers(timers)` cancels them on close |
| Cleanup without `clearTimers` | `win.onCleanup(() => clearTimers(timers))` |
| Timer tick or resize callback races window teardown | Add an `isClosing` flag checked in render/update/focus callbacks, set it at start of `onCleanup` |
| Restyle/select callbacks still fire while teardown begins | Guard `onRestyle` and selection handlers with close-phase checks (`if (isClosing) return`) |
| Multiple close triggers (keys/buttons) cause duplicate close attempts | Route all close paths through one `requestClose()` guard that no-ops when already closing |
| Demo windows lack local exit keys, forcing external close flow | Bind `q`/`escape` to `requestClose()` for reliable in-window exit and parity with status hints |
| Button callback throws crash the interaction flow | Use resilient button primitives (SDK `createButton`) and keep callback side-effects isolated |
| Per-app ad-hoc button styling drift | Use SDK `createButton` variants (`primary`/`secondary`/`ghost`/`destructive`) for consistent design-system semantics |
| Reimplementing single-choice mode pickers with custom key handling | Prefer SDK `createSegmentedControl` for compact mode/density/theme selectors |
| Reimplementing boolean mode flags as ad-hoc text widgets | Prefer SDK `createToggleSwitch` for explicit on/off semantics and keyboard parity |
| Checkbox `onChange` callback throws destabilise interactions | Prefer SDK `createCheckbox` callback isolation and keep side-effects guarded |
| Radio/select `onChange` callback throws destabilise interactions | Prefer SDK `createRadioGroup` / `createSelect` callback isolation and keep side-effects guarded |
| Filterable-list callbacks (`onSelect`/`onHighlight`/`onCancel`) throw destabilise interactions | Prefer SDK `createFilterableList` callback isolation and keep side-effects guarded |
| Destroy order races in complex widget trees | Unsubscribe/clear timers first, then use SDK `safeDestroyAll(...)` / `safeDestroy(...)` for best-effort teardown so one destroy failure does not abort the rest |
| Switching live demo panes can fail when previous pane teardown throws | Wrap per-pane teardown callbacks (`activeDestroy`) in best-effort guards before mounting next pane |

## Motion / Tween

| Mistake | What happens | Fix |
|---------|-------------|-----|
| Motion callback (`onUpdate`, `onComplete`, `onCycle`, `onStepComplete`) throws | Previously killed the tween loop silently | Callbacks are now isolated via internal `safeCall` — a throw logs `[motion] <fn> threw: <err>` to the console and the loop continues. If a tween appears to stop mid-way, check the console for these messages. |
| Passing `steps: []` to `tweenSequence` | `tweenSequence` emits a `console.warn` and no-ops | Always supply at least one step. Don't pass empty steps expecting silence — the warn is intentional. |
| Calling `safeCall` directly in microapp code | Not exported — internal to the motion engine | Handle errors inside your callbacks. The engine guarantees your callback won't crash the loop; you own your own state cleanup. |

## Widget parenting

| Mistake | Fix |
|---------|-----|
| Widgets added to `win.frame` | Always add to `win.body` |
| Grandchildren of scrollable box render blank | Set `fixed: true` on grandchildren — blessed's `_getCoords` double-subtracts scroll offset |
| `setContent` on a scrollable node with width=0 | Infinite loop — blessed word-wrap divides by width. Guard: `if (Number(node.width) > 0)` |
| blessed-contrib canvas crash (`this.ctx._canvas` undefined) | Initial render race before attach. Guard widget render until `ctx` exists, guard `setData()`/draw calls with `widget?.ctx?._canvas`, clamp chart widths with SDK `toEvenCellWidth(...)` before drawille-backed init, and best-effort destroy contrib widgets in cleanup if they expose `destroy()` |
| Drawille-backed contrib widget crashes with `Width must be multiple of 2!` | Import `toEvenCellWidth` from the SDK and apply it to the computed width before creating any drawille-backed canvas or chart: `const w = toEvenCellWidth(Number(panel.width) - 2)`. Drawille requires even pixel widths; odd layout widths (common after resize) trigger this crash. |

## Theme

| Mistake | Fix |
|---------|-----|
| `host.theme()` called once at startup, stored in variable | Call `host.theme()` fresh inside `onRestyle` and in render functions |
| `win.screen` for rendering | Use `host.screen` — there is no `win.screen` |
| Passing partial nested `style` objects to raw blessed widgets | Normalize nested shapes like `style.item` / `style.selected` before constructing the widget, or blessed can crash on missing fields |

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
| Importing from `src/services/syntax-highlight.js` | Use `highlightCode` from the SDK |
| Importing from `src/core/theme/types.js` | Use `ThemeVariant` from the SDK |
| Importing from `src/services/figlet-service.js` | Use `renderFigletLines` etc from the SDK (already re-exported) |
| `spawnSync("figlet", ...)` | Use `renderFiglet` from the SDK — cached, safe fallback |
| Hardcoded `/scratch/...` asset paths in microapps | Ship assets inside the microapp (`microapps/<app>/assets/*`) and resolve via `import.meta.dir` |
| Re-running expensive external CLIs every keypress/switch | Memoize deterministic command output (e.g. chafa previews) to reduce UI stalls/timeouts |
| Copy-pasted ANSI conversion regex chains across tests/views | Centralise conversion helpers (e.g. `convertAnsiRgbToBlessedTags`) to keep behaviour consistent and simplify debugging |
| Assuming list selection indices are always valid after restyle/update | Clamp/normalise selected indices before dereferencing and avoid unnecessary teardown/rebuild when selection did not change |
| Status/help line advertises keys that are not actually bound | Keep UI hints and key bindings in lockstep (e.g. if status says `q/esc close`, bind both) |
| Assuming optional binaries always exist (e.g. `chafa`) | Catch process failures and render stable fallback text instead of noisy stack traces in UI |
| Hand-built tab bar + key bindings | Use `createTabs` from the SDK |
| Copy-pasting pattern generators | Import from `PATTERNS` or individual named exports |

## Persistence

| Mistake | Fix |
|---------|-----|
| `persist: true` in manifest but no `registerSnapshot` | Either add the handler or set `persist: false` |
| Serializing widget state directly | Serialize your own state model, not blessed widget properties |

## Interstitial pickers and prompts (API automation)

| Mistake | Fix |
|---------|-----|
| Opening flow starts with a local blessed picker/prompt but exposes no command hooks | Add microapp commands for picker state + actions (e.g. `picker.info`, `picker.select`, `picker.confirm`, `picker.cancel`) |
| Picker exists outside shared overlay manager, so `overlay.confirm/cancel` do nothing | Either use shared overlay primitives, or provide microapp-local confirm/cancel commands explicitly |
| "Open" command returns ok but no final app window appears (stuck on interstitial) | Treat interstitial as first-class state: expose current selection + deterministic next-step commands |
| Automation can open only default/first option | Support index-based selection in commands (`args.index`) before confirm |

## Multi-command microapps

| Mistake | Fix |
|---------|-----|
| Two commands in one microapp both create different windows, but only one opens | `focusOrCreate` uses `microappId` as the key — if `multiInstance` is false (the default), the second command just focuses the first command's existing window. Set `multiInstance: true` on commands that create distinct windows, or provide args that skip the picker entirely. |
| Microapp manifest has `multiInstance: false` but commands set `multiInstance: true` | The command-level flag wins — `def.multiInstance ?? manifest.multiInstance ?? false`. But check both levels if windows aren't opening. |

## Testing and restarts

| Mistake | Fix |
|---------|-----|
| Code changes have no effect after restart | The old process is still alive on the port. Check the session ID: `bun run wibwob health` — if it matches the old one, the kill didn't work. Use `kill -9 $(lsof -ti:8099)` as last resort, then `reset` the terminal. |
| `kill $(cat scratch/wibwob.pid)` and restart, but same session ID | Legacy PID file may be stale. Prefer instance-scoped PID (`<DATA_ROOT>/instances/<instanceId>/wibwob.pid`) and always verify the session ID changed after restart. |

## Input ownership

| Mistake | Fix |
|---------|-----|
| Assuming bare `Tab` is reserved by the shell for app cycling | It is microapp territory now. Use `Tab` locally when helpful. Shell-level app cycling moved to `Meta-Tab` / `Meta-Shift-Tab`. |
