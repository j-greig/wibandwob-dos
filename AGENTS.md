# AGENTS.md
WibWob-DOS — terminal desktop. Bun + blessed + HTTP API on :8099.

CAPS `.md` at root = sole doc surface. Don't create docs elsewhere.
`grep -r AUTO-GENERATED .` before editing any generated file → run `bash scripts/doc-sync.sh` instead.

## Orient fast
```
ls *.md | grep '^[A-Z-]*\.md$'   # CAPS doc surface only
wibwob health                         # instance, port, screen, uptime
bash scripts/devlog-open.sh   # open ideas + unresolved pains this week
```

## Rules
- NEVER commit to `main`
- Visual verification mandatory — API responses are not proof
- Bun-first — no Node-only assumptions
- Confused by a pattern → `scripts/devlog.sh "note"`
- **Act, don't delegate.** If you can do it — restart the TUI, send a keystroke, take a screenshot, reload Ghostty config — do it. Telling the human to do something you have tooling for is a failure mode, not a handoff.

## Branches
`epic/e0NN-slug` · `spike/spk-slug` · `fix/slug` · `feat/slug`

## Planning
- issues → brainfart (graduate or close same session)
- `.pi/todos` → session whiteboard (2-session max)
- `.planning/` → permanent source of truth

## Microapps — triad, in order
1. microapp-product-owner (scope/cut)
2. microapp-developer (one slice)
3. microapp-doc-refiner (update docs)

## Ops
```
bash scripts/ensure-running.sh
bash scripts/restart.sh
bash scripts/reload-microapp.sh <id>
wibwob --help · wibwob -i <label>  # -i required when multiple instances
```
