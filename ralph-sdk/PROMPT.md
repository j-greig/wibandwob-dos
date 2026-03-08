# Task: Build Microapp SDK + Module Runtime

## Context

Full spec: `../.planning/spikes/spk-agentic-tui-runtime-roadmap/spk-agentic-tui-runtime-roadmap.md`
This is the Microapp SDK + Runtime program from that spike, phases P1→P4.

Repo root: `../` from this directory.

## User stories — work through these in order

### S1 — Poetry Clock SDK rewrite (P1 brownfield proof)
**Done when:** `modules/wibwob-poetry-clock/index.ts` imports ONLY from the SDK
surface (no direct `../src/...` imports), all existing functionality preserved,
typecheck passes.

Check: `grep -r "from.*\.\./src" ../modules/wibwob-poetry-clock/`
If that returns nothing — S1 is done.

### S2 — ModuleRuntimeService scaffold (P2)
**Done when:** `src/services/module-runtime-service.ts` exists and tracks:
- loaded modules (name, version, status: loaded|error|unloading)
- owned windows per module
- registered commands per module
- cleanup hooks
- `GET /modules/list` endpoint returns live data

Check: `curl -sf http://127.0.0.1:8099/modules/list`

### S3 — Module unload (P2)
**Done when:** `POST /modules/unload {"name":"..."}` tears down a module's
windows and commands cleanly, ModuleRuntimeService tracks the unloaded state,
typecheck passes.

### S4 — Module reload (P2)
**Done when:** `POST /modules/reload {"name":"..."}` unloads then reloads a
module from disk, existing windows for that module are replaced, no app restart
needed. Use Poetry Clock as the proof — edit it, reload it, see changes.

### S5 — Module file-watch dev loop (P2)
**Done when:** dev mode (`NODE_ENV=development` or a flag) watches `modules/`
dirs and auto-reloads on file change. Should debounce (500ms). Log to console.

### S6 — WindowPort model (P3)
**Done when:** `src/core/window-port.ts` defines `WindowPort` and
`ConnectionService`, windows can declare named input/output ports,
`describeState()` includes `{ ports: [...] }` where ports exist,
`GET /state` reflects port data.

### S7 — Agent scaffold/reload commands (P4)
**Done when:** Two new commands exist in command-catalog.ts:
- `module.scaffold` — creates a new module from hello-world template, takes `name` arg
- `module.reload` — reloads a named module via ModuleRuntimeService
Both callable via `POST /commands/run`. Typecheck passes.

---

## Each iteration

1. **Read** the full spike doc: `../.planning/spikes/spk-agentic-tui-runtime-roadmap/spk-agentic-tui-runtime-roadmap.md`

2. **Check** each story's done-condition in order (S1 → S7). Find the first incomplete one.

3. **Implement** ONE concrete thing toward that story:
   - Edit or create files in `../src/` or `../modules/`
   - Register commands in `../src/core/command-catalog.ts` if needed
   - Wire in `../src/core/app-controller.ts` if needed
   - Extend `../src/services/module-loader.ts` NOT replace it

4. **Typecheck**: `cd .. && bun run typecheck` — fix ALL errors before continuing.

5. **Log** one line to `logs/sdk-build.log`:
   ```
   [YYYY-MM-DD HH:MM] iter N: {story ID} — {what was implemented}
   ```

6. **Diary** entry to `diary/changelog.md`:
   - Which story, what was done, what remains, any decisions made

## Completion

When ALL 7 stories pass their done-conditions AND typecheck is clean, output:

<promise>SDK_RUNTIME_DONE</promise>

Only output this when every done-condition can be verified. No cheating.
