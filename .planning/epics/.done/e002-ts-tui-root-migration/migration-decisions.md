# E002 Migration Decisions

Confirmed answers to all 10 pre-flight questions. These are binding for the
migration execution.

## 1. Branch and tag strategy

- Tag current HEAD: `pre-e002-root-migration`
- Work on branch: `codex/e002-root-migration`
- Merge to main only after smoke verification passes

## 2. .pi directory collision

- Root `.pi/` wins as canonical location
- Merge spike `.pi/` content selectively into root `.pi/`:
  - keep/merge: `APPEND_SYSTEM.md`
  - deduplicate theme JSON (one canonical copy)
- Delete spike `.pi/` after merge
- Dedicated `.pi` curation pass happens post-migration, not during

## 3. Vendor submodule dedup

- DROP C++ runtime submodules:
  - `vendor/tvision`
  - `vendor/tvterm`
  - `vendor/MicropolisCore`
- KEEP `vendor/claude-system` (still referenced by root tooling)
- DO NOT promote spike `vendor/pi-mono` or `vendor/piclaw` to root
  - they are reference/research, not runtime deps
  - only keep if proven necessary

## 4. .gitmodules cleanup

- Rewrite completely after keep/drop decisions
- Current file has invalid duplicate absolute-path tvision entry
- Target: only surviving submodules listed

## 5. PartyKit disposition

- DELETE outright (not .trash/)
- Too large for tracked quarantine
- Git tag + history is sufficient recovery path

## 6. Spike docs destination

- Active docs (015, 018, 019, 020, 021, refactor-epoch-plan) -> root `docs/`
- Stale/reference/review docs -> `.planning/epics/e002-ts-tui-root-migration/legacy-docs/`
- Do not bury active architecture docs in migration folders

## 7. NOTES.md at root

- Keep short-term as working glossary
- Long-term: absorb into root README.md or AGENTS.md, then delete

## 8. .codex-logs at root

- Keep as local ephemeral, not canonical repo content
- Add to .gitignore if not already
- Do not plan around it

## 9. exports/ disposition

- Keep for now as user/output artifacts
- Contains real generated outputs (contour, generative, paintings, rooms)
- Later prune subfolders for removed features
- Formalize, don't trash yet

## 10. Commit strategy

Three commits:
1. `chore(engine): git mv structural lift` — git mv only, preserve blame
2. `fix(engine): path and config fixes for root build` — imports, tsconfig, package.json
3. `chore(engine): prune legacy and disposition cleanup` — deletions, .gitmodules rewrite, doc moves
