# AGENTS.md
WibWob-DOS — terminal desktop. Bun + blessed + HTTP API on :8099.

CAPS `.md` at root = sole doc surface. Don't create docs elsewhere.
`grep -r AUTO-GENERATED .` before editing any generated file → run `bash scripts/doc-sync.sh` instead.

## Orient fast
```
ls *.md          # PHILOSOPHY ARCHITECTURE GOTCHAS SDK-MICROAPP-DEV
cat .pi/skills/skills.md
curl localhost:8099/state
```

## Rules
- NEVER commit to `main`
- Visual verification mandatory — API responses are not proof
- Bun-first — no Node-only assumptions
- Confused by a pattern → `scripts/devlog.sh "note"`

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
