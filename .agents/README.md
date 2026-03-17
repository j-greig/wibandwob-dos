# .agents/ — Agent-Facing Documentation

Start at `AGENTS.md` in the repo root. This directory has the deep-dive docs.

## What's here

- **guides/microapp/** — 7-doc guide to building microapps
- **guides/shell/** — architecture, invariants, control API
- **specs/** — subsystem specs (read before touching listed files)
- **reflections/** — weekly agent self-reflection: pain → why → fix
- **reference/** — research docs, API surface, concepts

## Quick start

```bash
bash scripts/discover.sh          # full discovery index
bun run typecheck                 # minimum gate
bash scripts/ensure-running.sh    # start the app
```
