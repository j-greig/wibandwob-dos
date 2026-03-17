---
id: E042-B4
title: "Infra Wrappers"
status: not-started
depends_on: [E042-B1]
---

# E042-B4 — Infra Wrappers

**Sessions**: 1 · **Can parallelise with**: B2–B3

## Why Fourth

Codebase cleaner from B1–B3, wrappers easier to validate. Completes the `src/application/` and `src/runtime/` vision from the Codex READMEs.

## Context

From commit a651c839 side-effect inventory. `src/application/` already has 4 service stubs (`runtime-command-service.ts`, `runtime-inspection-service.ts`, `runtime-window-service.ts`, `runtime-workspace-service.ts`). `src/runtime/` has `runtime-node.ts`. These provide the architectural home for extracted wrappers.

## Wrappers

| Wrapper | Call Sites | Files | Effort |
|---|---|---|---|
| ✅ clipboard.ts | 4 | 4 | **Done** |
| safe-fs.ts | 50+ | 12+ | Small |
| platform-commands.ts | 6 | 3 | Trivial |
| append-log.ts | 5 | 4 | Trivial |
| audio-process.ts | 6 | 3 | Small |
| animation-loop-unify | 4 | 4 | Small (compat check) |

## Tasks

- [ ] `src/core/safe-fs.ts` — safeReadFile, safeReadJSON, safeWriteFile, safeUnlink, listDir
- [ ] `src/core/platform-commands.ts` — reveal-in-finder, open-external, quicklook
- [ ] `src/core/append-log.ts` — services bypassing app-logger
- [ ] `src/services/audio-process.ts` — ffplay/ffmpeg spawn boilerplate
- [ ] Animation loop audit — check createFramePlayer compat with plasma/contour/motion

## Acceptance

- `grep -r 'readFileSync\|writeFileSync' src/ --include='*.ts'` only hits wrapper files
- `grep -r 'execSync\|spawnSync' src/ --include='*.ts'` only hits wrapper + CLI files
- `bun run typecheck` clean

## Autoresearch

Harness at `autoresearch/infra-wrappers/`. Primary metric: raw call count outside wrappers (lower is better).
