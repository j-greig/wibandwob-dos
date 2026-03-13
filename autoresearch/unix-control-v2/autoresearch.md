# Unix Control v2 — Autoresearch Brief

Optimisation target: completion count across 10 backlog items from BACKLOG.md.
Each item scores 0 (not done) or 1 (done). Primary metric: sum out of 10.
Graduate when 7+ items done.

## Scoring Rubric

| # | Item | Test method | Score |
|---|------|-------------|-------|
| 1 | Zod param schemas on AppCommandDefinition | `params` field exists in interface + validation returns 400 on bad args | 0/1 |
| 2 | Return type hints | `returns` field exists in AppCommandDefinition interface | 0/1 |
| 3 | CI parity script | CI config or script exists that runs test suite | 0/1 |
| 4 | Benchmark: CLI vs curl vs MCP | Benchmark script exists and runs | 0/1 |
| 5 | Per-command --help | `wibwob window.move --help` prints flag info | 0/1 |
| 6 | Tab completion | `wibwob completions` generates shell completions | 0/1 |
| 7 | wibwob watch (event streaming) | `GET /events` endpoint exists or `wibwob watch` works | 0/1 |
| 8 | Naming hygiene: wibwob not ww | `grep -rn '\bww\b' src/cli/` returns zero matches | 0/1 |
| 9 | Update SURFACE_PARITY_ARCHITECTURE.md | Doc says wibwob not ww, reflects HTTP-only approach | 0/1 |
| 10 | Dogfood: use wibwob in test suite | Test suite uses wibwob commands, not raw curl (except 1 parity check) | 0/1 |

## Graduation

Primary metric >= 7 → graduate. Items 1, 3, 5 are highest priority.
Items 4, 6, 7 are lower priority and may be deferred beyond graduation.
