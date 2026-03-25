# COAT Command Gaps C4-C7 — Final Plan

## Decision summary

| Gap | Route | Decision | Reason |
|-----|-------|----------|--------|
| C4 | `/windows/editor/write` | **Keep as deps call** | `writeEditorText` (replace buffer) ≠ `editor.write` command (type/append text). Two distinct operations. |
| C5 | `/windows/input` | **New command `window.input`** | Generic sendInput — should be discoverable via command surface. |
| C5 | `/windows/agent-message` | **New command `window.agent-message`** | Targeted send with sender attribution — used by cross-session routing. |
| C6 | `/workspace/save` | **Fix action → return result → commandId** | Action already calls the same underlying method. Just return the result instead of discarding it. |
| C6 | `/workspace/load` | **Fix action → return result → commandId** | Same. |
| C7 | GET inspection routes | **Keep as deps calls** | ARCHITECTURE.md defines Inspection as a separate seam from Command. Queries read, commands mutate. Forcing reads through the command registry violates this separation. |

## Files

**`src/core/command-catalog.ts`**
- Add `window.input` command (actionKey: `windowInput`, api+agent surface)
- Add `window.agent-message` command (actionKey: `agentMessage`, api+agent surface)
- Add `windowInput` and `agentMessage` to `AppMenuActions` type

**`src/core/app-controller.ts`**
- Add `windowInput` action: `(args) => sendInput(id, text, sender)` returning `{ ok }` or `{ ok: false, error }`
- Add `agentMessage` action: same shape but reads `text ?? input` for backward compat
- Fix `saveWorkspace` action: return `runtimeWorkspace.save(name)` result
- Fix `loadWorkspace` action: return `runtimeWorkspace.load(name)` result

**`src/services/control-api.ts`**
- `/windows/input` → `commandId: "window.input"` with argsMapper
- `/windows/agent-message` → `commandId: "window.agent-message"` with argsMapper
- `/workspace/save` → `commandId: "workspace.save"` with argsMapper
- `/workspace/load` → `commandId: "workspace.load"` (or `workspace.load_named`)

**`.planning/chores/code-quality-refactor.md`**
- C4+C7: status `[-]` with "by design" note
- C5+C6: status `[x]`

**[Phase 4 — optional] `src/core/command-catalog.ts` + `src/services/control-api.ts`**
- Fix `editor.write` description: "Type text into an editor window (appends, does not replace)"
- Fix `/windows/editor/write` description: "Replace editor buffer content"

## Blast radius

4 files modified (+ 1 planning doc). ~50 lines changed. 0 new files.

## Evidence

| Check | Command |
|-------|---------|
| Type safety | `bun run typecheck` |
| COAT boundary | `bun run check-coat` |
| API smoke: window.input | `curl -X POST localhost:8099/commands/run -d '{"id":"window.input","args":{"id":1,"input":"test"}}'` |
| API smoke: workspace.save | `curl -X POST localhost:8099/workspace/save -d '{"name":"test"}' ` — verify `{ ok, name, path, windows }` shape |
| API smoke: workspace.load | Same shape check |
| Integration tests | `bun test src/tests/integration/` — no new failures |

## Steps

### Phase 1 — Actions + types
- [ ] Add `windowInput` and `agentMessage` to `AppMenuActions` in command-catalog.ts
- [ ] Add `windowInput` action in app-controller.ts
- [ ] Add `agentMessage` action in app-controller.ts
- [ ] Fix `saveWorkspace` action to return result
- [ ] Fix `loadWorkspace` action to return result
- [ ] `bun run typecheck`

### Phase 2 — Catalog entries
- [ ] Add `window.input` command definition
- [ ] Add `window.agent-message` command definition
- [ ] `bun run typecheck`

### Phase 3 — Route rewiring
- [ ] `/windows/input` → `commandId: "window.input"`
- [ ] `/windows/agent-message` → `commandId: "window.agent-message"`
- [ ] `/workspace/save` → `commandId: "workspace.save"`
- [ ] `/workspace/load` → `commandId: "workspace.load"`
- [ ] `bun run typecheck` + `bun run check-coat`
- [ ] Restart + API smoke tests
- [ ] `bun test src/tests/integration/` — verify no new failures

### Phase 4 — Docs
- [ ] Update planning doc C4-C7 status
- [ ] [Optional] Fix editor.write descriptions
- [ ] Commit
