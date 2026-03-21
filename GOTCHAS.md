# GOTCHAS.md — Non-Obvious Failure Modes

> Things LLMs get wrong here that they wouldn't get wrong in a standard repo.
> Don't include things that an LLM would alreay know from its training data,
  eg common coding/dev knowledge.
> Intake buffer — add when something burns you, not preemptively.
> Review periodically: promote stable entries to their parent CAPS file, delete what's absorbed.

---

## Documentation

**Never edit generated files directly.** They carry `<!-- AUTO-GENERATED -->` headers.
Fix via the generator script, then regenerate. Direct edits are silently overwritten.

**Never list watched file mappings outside gen scripts.** The `@watches` header in each
`scripts/gen-*` file is the single source of truth. A duplicate list anywhere else will drift.

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

**Gen scripts don't auto-run on save.** They run at commit time via the pre-commit hook.
A `doc-sync.sh --watch` mode (fswatch/fs.watch on `@watches` paths) would make docs
always-current. Standard pattern (webpack, tsc --watch, tailwind). Not built yet.

---

## CAPS files

**If a CAPS file needs >3 `<progressive-disclosure>` tags, split it.** More than 3 means
the file covers multiple concerns — create a new CAPS file at root for the second concern.

---

## Agent behaviour

**Never expand a terse-but-correct description for "readability."** Terse is correct here.
Expansion adds tokens, dilutes signal, fails the delta test.

**Never trust API responses alone as proof.** Visual verification is mandatory —
open the thing, screenshot it, read its state.
