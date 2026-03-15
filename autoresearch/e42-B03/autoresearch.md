> **E042 Solid Foundations** — Bucket 3 of 6
> ← Previous: [`e42-B02` SDK Composition Helpers](../e42-B02/autoresearch.md)
> → Next: [`e42-B04` Infra Wrappers](../e42-B04/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B03 — Hero 7

## Objective

Canonicalize 7 hero microapps as the teaching progression for the platform. Each hero
is a reference document — "if an external dev only read this one file, they'd know how
to build for the platform." Uses SDK primitives from B02.

Progression: trivial → buffer → introspection → creative tool → layout proof → dashboard → full app.

## Metrics

- **Primary**: `hero_pass_count` (count out of 7, higher is better) — hero apps that
  open via API and return valid `describeState` + `captureText`
- **Secondary**:
  - `hello_world_lines` — line count of hello-world main .ts (target: ≤40)
  - `hero_sdk_usage` — total SDK composition helper calls across all 7 heroes
  - `doc_exists` — 1 if docs/microapp-examples.md exists, 0 otherwise
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| App | Directory | Current State | Target |
|-----|-----------|---------------|--------|
| hello-world | `microapps/hello-world/` or scaffold | 494 lines — bloated | ~30 lines, minimum viable |
| notepad | `microapps/notepad*/` | Exists | Cleanup, use SDK primitives |
| runtime-inspector | `microapps/runtime-inspector*/` | Exists, good | Minor polish |
| figlet-banner | `microapps/figlet-banner*/` | Exists | Standardise keys |
| layout-stress-test | `microapps/demo-layout-stress-test-pi/` | Exists, wrong name | Rename, promote to beta |
| data-dashboard | New | Doesn't exist | ~200 lines, new build |
| file-manager | `src/windows/file-manager-window.ts` | In src/windows/ | Migrate to microapp |
| `docs/microapp-examples.md` | New | Doesn't exist | What each hero teaches |

## Off Limits

- Shell internals (src/core/, src/services/) — only microapp code
- Other microapps outside the hero 7
- Blessed internals

## Constraints

- `bun run typecheck` must pass
- Every hero must have `describeState()` and `captureText()`
- Consistent keyboard shortcuts: q=close, /=search where applicable
- B02 (SDK primitives) should be complete first
- All heroes must open and close cleanly via `wibwob` CLI

## Execution Steps

1. Rewrite hello-world → ~30 lines absolute minimum viable
2. Cleanup notepad → use createStatusBar + createTextViewer from SDK
3. Review runtime-inspector → minor polish, ensure describeState/captureText
4. Cleanup figlet-banner → standardise keyboard shortcuts
5. Rename demo-layout-stress-test-pi → layout-stress-test, promote tier
6. New build: data-dashboard (~200 lines, system info panels, timers)
7. Migrate file-manager from src/windows/ to microapp
8. Verify all 7 via `wibwob run open <id>` → `wibwob state` → close
9. Write docs/microapp-examples.md

## What's Been Tried

_Nothing yet — fresh start._
