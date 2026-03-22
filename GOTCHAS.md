---
title: WibWob-DOS — Gotchas
description: Non-obvious failure modes. Add when something burns you, not preemptively.
audience: agents
---

# GOTCHAS.md — Non-Obvious Failure Modes

> Things LLMs get wrong here that they wouldn't get wrong in a standard repo.
> Don't include things that an LLM would alreay know from its training data,
  eg common coding/dev knowledge.
> Intake buffer — add when something burns you, not preemptively.
> Review periodically: promote stable entries to their parent CAPS file, delete what's absorbed.

---

## Documentation

**Never edit generated files directly.** They carry `do-not-edit: true` in their YAML frontmatter.
Fix via the generator script, then regenerate. Direct edits are silently overwritten.

**Never list watched file mappings in prose.** The canonical source is the `@watches` header in each gen script. `bash scripts/doc-sync.sh --list` prints the manifest. A prose list will drift.

**Never restate standard patterns.** Delta principle: if a competent LLM already knows it,
cut it. The test: "would this sentence appear in any TypeScript project's docs?" If yes — cut.

**Never make two doc changes in one autoresearch run.** Score delta must be attributable
to a single change or the loop can't learn.

---

## Microapps

**Never import from `src/core/` or `src/services/` directly.** Only
`src/services/microapp-sdk.js` is the stable import surface. Everything else is a COAT violation.

**Never change a microapp's `id` field carelessly.** It's the key into the command registry.
Changing it silently breaks all commands, workspace saves, and API paths for that microapp.

**Never mix CompositionHelpers and LayoutParts in `createStack`.** TypeScript's `LayoutPart<any>`
silently accepts CompositionHelper handles (they lack `.layout()`) — no type error, but the
window renders blank. Use only LayoutParts in `createStack`, or use only CompositionHelpers
and skip `createStack` entirely. When in doubt: CompositionHelpers only.

**`captureText` must return non-empty text.** Returning `gridToText(emptyGrid)` = spaces/newlines
= 0 meaningful chars. Add a fallback: `return content.trim() || "AppName — blank state description"`.
Agents read this. A blank return breaks `wibwob read <id>` and `validate-microapp.sh`.

**`createAnimationClock` starts immediately.** Call `clock.pause()` on the next line after creation.
At >10fps with grid-canvas rendering, the blessed render loop saturates and the HTTP API stops
responding (87% CPU observed). Max safe rate: 8fps. Always `clock.destroy()` in `onCleanup`.

**Never use raw `fs.*` in microapps.** Use `safeWriteFile` / `safeReadJSON` from `microapp-sdk.js`.
They handle dir creation and swallow errors safely. Raw `fs.*` violates ARCHITECTURE invariant 7.

**`registerSnapshot` is the right persistence primitive, not files.** Use it for workspace
restore. Use `safeWriteFile` only for user-visible file exports or data that outlives sessions.

**Scaffolded microapps don't appear until registered.** After `scaffold-microapp.sh`,
you must add `"wibwob.<id>": "beta"` to `src/core/microapp-registry.ts` and restart.
Without it the app loads silently but has no menu entry, no command, no API path. Nothing errors.

**`reload-microapp.sh` doesn't cover host-side changes.** Editing `src/services/*` or
`src/core/*` requires full restart. Mixed state causes "Unknown command" with no obvious cause.

**`createInputLine` has blessed modal focus.** Textbox enters edit mode on focus, Esc exits.
Platform constraint — no workaround.

---

## Adding a command

**Adding one command touches 4+ files.** This is the COAT architecture tax:
1. `src/core/command-catalog.ts` — command definition + `AppMenuActions` interface
2. `src/domain/command-definition.ts` — add to `AppCommandGroup` union if new group
3. `src/core/app-controller.ts` — action implementation in the actions object
4. `src/services/control-api.ts` — HTTP route handler (if API-exposed)

A scaffold script is planned — see `.planning/autopoietic-next/README.md §5`.

---

## Bash scripting

**`grep -c` returns multiline output.** Always pipe through `| tail -1 | tr -d " \n"` or
use `|| echo 0`. Raw `grep -c` breaks bash arithmetic (`[[ $count -gt 0 ]]`) silently.
This has bitten us three times.

---

## Cloud / Linux agents

**`bun install` fails in cloud containers.** The `canvas` native module fails to compile.
Always use `bun install --ignore-scripts`. Nothing in the critical path needs canvas.

**`--direct` mode fails on Linux.** Default startup uses macOS `script -q /dev/null` syntax.
Linux `script` uses `-qfc`. The startup scripts now auto-detect headless (`TERM=dumb` or no TTY)
and fall back to `--tmux`. Explicit: always use `bash scripts/ensure-running.sh --tmux` in agents.

**`curl` without `--max-time` hangs forever against an unresponsive API.** Always:
`curl -sf --max-time 5 http://127.0.0.1:8099/health`. A hung API + no timeout = silent zombie.

---

## Ops

**Never `kill -9` the wibwob process as first resort.** blessed needs clean shutdown to
release mouse tracking escape codes. Use `SIGTERM` (`kill $PID`). If terminal mangles: `reset`.

---

## Gen scripts

**Gen scripts don't auto-run on save.** Run `bash scripts/doc-sync.sh` to regen stale outputs, or the pre-commit hook catches it via `--check`.

---

## CAPS files

**If a CAPS file needs >3 generated-output links, split it.** More than 3 bold `→` links means the file covers multiple concerns — create a new CAPS file at root for the second concern.

---

## Agent behaviour

**Never expand a terse-but-correct description for "readability."** Terse is correct here.
Expansion adds tokens, dilutes signal, fails the delta test.

**Never trust API responses alone as proof.** Visual verification is mandatory —
open the thing, screenshot it, read its state.

---

## Blessed widget ordering — Bun TDZ crashes `[HIGH]`

**`const`/`let` declared after the function that references them → TDZ crash at runtime.**
Bun's TS loader doesn't hoist like tsc would. No compile error — the app just crashes on open.
Blessed widget declarations must be ordered BEFORE any render functions that reference them.

---

## Blessed list style crash on theme switch `[HIGH]`

**`restyleAll` must include `item` and `scrollbar` keys in list style or blessed crashes.**
`restyleAll` setting `listBox.style = { ...th.body, selected: {...} }` without `item`/`scrollbar`
causes blessed to crash internally (`self.style.item[name]`, `this.style.scrollbar.fg`).
Fix: always include `item: { fg, bg }` and `scrollbar: { fg }` in any list/scrollable box style,
including inside `onRestyle` handlers. Applies to any scrollable `blessed.box`, not just lists.

---

## `desktop.clear-all` race — windows not in state for ~500ms `[HIGH]`

**Open windows immediately after `desktop.clear-all` and their IDs are missing from `/state`.**
`wibwob move/resize` silently no-ops on unknown IDs. Always `sleep 0.5` after `desktop.clear-all`
before spawning or positioning new windows.

---

## Figlet window `.kind` is `"microapp"`, not `"figlet"` `[HIGH]`

**Every choreography script gets this wrong.**
`jq '.[] | select(.kind=="figlet")'` returns nothing — all microapp windows have `.kind="microapp"`.
Must filter on `.appType`: `select(.appType=="wibwob.figlet")`. Batch move/resize silently no-ops
when IDs are never captured. Same applies to any microapp window.

---

## Workspace restore crash → boot loop `[HIGH]`

**If a microapp crashes during render and was open when workspace was saved, the restore
re-triggers the crash on every startup.** Error appears in the tmux pane, not the API.
Fix: `rm -f scratch/workspace.json` then restart before debugging the microapp.

---

## Direct/background mode → 1×1 screen, recording captures nothing `[HIGH]`

**WibWob running backgrounded with no real PTY reports `screen.width/height` as 1×1.**
`wibwob-record.sh` captures 1×1 frames with no warning. Must run in tmux with explicit dims:
`tmux new-session -x 205 -y 55`. No auto-detect or error from the record script.

---

## `blessed.list.setItems()` / `.selected` need `(list as any)` cast `[MEDIUM]`

**`blessed.Widgets.ListElement` is typed as `BoxElement` — `setItems` and `selected` exist
at runtime but not in the type definitions.** Every list-touching microapp needs `(list as any).setItems()`
and `(list as any).selected`. Not fixable without patching `@types/blessed`. If this cast appears
in three microapps, it's correct — not a bug.

---

## `blessed.list.setItems` fires `select item` event → recursion `[MEDIUM]`

**Calling `list.setItems([...])` to refresh triggers the `select item` handler.**
If that handler refreshes, which calls `setItems`, infinite loop. Guard with a boolean:
`let rendering = false; if (rendering) return; rendering = true; list.setItems(...); rendering = false`.

---

## `registerSnapshot` restore = re-run `open`, not state injection `[MEDIUM]`

**The two-arg `restore: (_snap, payload)` signature implies diffing. It doesn't.**
`payload` is passed to `host.runCommand("open", payload)`. Restore is just re-opening with saved args.
State must be fully reconstructable from the open-command payload alone — don't rely on
in-memory state surviving across restore.

---

## `blessed.textarea` is fully modal `[MEDIUM]`

**`inputOnFocus: true` makes the textarea own all keys including Tab, Esc, and arrow keys.**
No "textarea with normal focus" mode exists. Key bindings registered elsewhere work
(`textarea.key(["tab"], ...)`) but focus UX is jarring. Platform constraint — no workaround.
For multi-line input there is no SDK helper; you must use raw `blessed.textarea`.

---

## `multiInstance: true` required for re-openable microapps `[MEDIUM]`

**Without `"multiInstance": true` in `microapp.json`, running `open` a second time silently
no-ops — the existing window is not brought to focus, nothing happens.**
Not in the quick-start section of `SDK-MICROAPP-DEV.md`. Discover it by running open twice
and getting confused. Set it if the app should be openable while already open.

---

## `setImmediate(refresh)` required after textarea keypress `[MEDIUM]`

**`textarea.on("keypress", refresh)` reads stale value** — blessed hasn't processed the keypress yet.
Defer one tick: `textarea.on("keypress", () => setImmediate(refresh))`. Direct handler gives
the state before the keystroke.

---

## Worktree / alt-instance may bind a different port `[MEDIUM]`

**Cinema worktrees and second `ensure-running.sh` instances get a different port (e.g. 8101).**
Scripts hardcoded to `8099` silently talk to the wrong instance or get ECONNREFUSED with no
helpful error. Use `$WW_API` env var or read port from `/health`. Never hardcode `8099`.

---

## `safeReadJSON` returns `undefined`, not a typed default `[LOW]`

**`safeReadJSON<T>()` returns `T | undefined`.** Every persistence-using microapp needs a
`loadData()` wrapper with a fallback object. Verbose but expected — plan for it.

---

## `host.promptValue` focus not restored after dismiss `[LOW]`

**After the modal closes, focus does NOT return to the triggering widget.** No `onDismiss`
callback. User must Tab or click to re-focus. Platform constraint.

---

## Emoji appear as `?` in text screenshot API and `validate-microapp.sh` `[LOW]`

**Not a real bug** — terminal encoding issue in text extraction. Emoji render correctly
in a live terminal. During agentic validation, read `?` as "emoji was here", not corruption.
Don't add fallback ASCII replacements to pass validation — the TUI is correct.

---

## `canvas.element` is the key-binding surface for `createTextViewer` `[LOW]`

**`createTextViewer` returns `{ element, update, destroy, getContent }`.** Key bindings go on
`element` (the raw blessed node), not on the textviewer object. Focus also requires:
`win.setFocusTarget(canvas.element); win.focus()`. The SDK wrapper does not expose key-binding
or focus methods directly.

---

## `createTextViewer` positional `%` strings cause TypeScript complaints `[LOW]`

**Passing `top: "40%"` works at runtime but TypeScript flags it** — the `ViewerOpts` type
declares some positional fields as `number` only, despite blessed accepting `number | string`.
Use `as any` cast or pass integer pixel values. A future SDK fix should widen the type.
