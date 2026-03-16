# .agents/ — Agent Home

COAT architecture: Command Once, Adapt Thin. Four shared seams, thin adapters.
Full explanation: `AGENTS.md` § COAT.

## Quick start

```bash
bash scripts/discover.sh          # what's available, organized by lens
bash scripts/discover.sh ops      # just ops lens
bun run typecheck                 # minimum gate
bash scripts/ensure-running.sh    # start the app
```

## Six lenses

Agents aren't departments — they're lenses. Same tools, same API, different focus.

| # | Lens | Focus | Key scripts |
|---|------|-------|-------------|
| 0 | **shell-architect** | Host runtime + COAT integrity | check-coat, check-themes, gen-primitives |
| 1 | **microapp-builder** | Build & migrate microapps | scaffold-microapp, reload-microapp, watch-microapp |
| 2 | **ops** | Process lifecycle, health, screenshots | ensure-running, restart, attach, minimap |
| 3 | **quality** | Tests, parity, verification | cli-parity-check, runtime-parity-check, smoke-api |
| 4 | **creative** | Visual composition, art, music | replay-scpt, wibwob-record, ghostty-shader |
| 5 | **planner** | Planning docs, epics, what's next | handover |

Full lens model + script mapping: `agent-master-plan.md`

## Directory map

```
.agents/
  agent-master-plan.md        ← COAT lenses, script mapping, desktop.compose vision
  microapp-dev/               ← build microapps (7 docs, start: quick-start.md)
  shell-dev/                  ← host runtime (specs, architecture, devlog)
    devlogs/W{nn}.md          ← weekly devlog (new file each Monday)
    devlogs/standing.md       ← rolling notes, prune when items land
    specs/                    ← subsystem specs (read before touching src/)
  skills/                     ← project-level agent skills
```

## Devlog

Write to this week's file: `/Users/james/Repos/wibandwob-dos/.agents/shell-dev/devlogs/W{nn}.md`
Pattern: `## YYYY-MM-DD — Title` then bullet observations.
Standing notes (not weekly): `/Users/james/Repos/wibandwob-dos/.agents/shell-dev/devlogs/standing.md` — prune when items land.

**You are encouraged to write to the devlog during any session.** Don't wait to be asked.
Good entries: process friction, skills or scripts that could be better, patterns that
caused confusion, things that worked well, ideas for improving the dev loop.
This is meta — observations about how we work, not just what we shipped.

## Script rules

1. Every script has `@name` and `@desc` in the first 3 lines after shebang
2. `bash scripts/list-scripts.sh` is the discovery surface
3. Scripts are API clients where possible (COAT-aligned)
4. New script test: "Is this a script or a command?" If it could be a catalog
   command, make it a command.
5. Max 35 scripts. Audit before adding.

## Progressive disclosure

Every important concept has three layers:

| Layer | Size | When loaded |
|-------|------|-------------|
| **1-line** | @name/@desc or frontmatter | Always (system prompt) |
| **1-paragraph** | Top of file summary | When task identified |
| **1-page** | Full document | When deep work starts |

Example — COAT:
- 1-line: "Command Once, Adapt Thin — four shared seams, thin adapters"
- 1-para: AGENTS.md § COAT (diagram + test)
- 1-page: gist masterplan (full refactor plan)
