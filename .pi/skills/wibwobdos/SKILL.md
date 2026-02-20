---
name: wibwobdos
description: Build, run, and operate WibWobDOS (C++ tvision TUI + FastAPI) in Docker. Screenshots, cross-platform C++ debugging, ARM64 Linux builds, container health.
---

# WibWobDOS Operations

C++ Turbo Vision TUI app + Python FastAPI server, running headless in Docker on ARM64 Linux.

## Screenshot

```bash
scripts/screenshot.sh                  # stdout (pipeable)
scripts/screenshot.sh -o file.txt      # save to file
scripts/screenshot.sh -f ansi          # ANSI color output
scripts/screenshot.sh -f ansi | convert # pipe to renderer
```

## Build & run

```bash
make up-real                          # real C++ backend
make up                               # mock (default)
make up-real && make provision && make deploy && make test   # full gate
```

## Quick health check

```bash
docker compose exec substrate bash -c 'curl -sf $WIBWOBDOS_URL/health'
docker compose logs wibwobdos         # startup log
```

## References

- [Cross-platform C++ build guide](references/cross-platform-cpp.md) — Linux deps, transitive include gotchas, CMake linking
- [Docker operations](references/docker-ops.md) — startup sequence, SIGWINCH fix, troubleshooting table
- [Screenshot workflows](references/screenshots.md) — piping patterns, formats, full open-windows-and-capture workflow

## Key files

| File | Purpose |
|---|---|
| `scripts/screenshot.sh` | Host-side screenshot capture (in skill dir) |
| `scripts/start-wibwobdos.sh` | Container entrypoint (build + TUI + API) |
| `Dockerfile.wibwobdos` | Real mode image |
| `docker-compose.real.yml` | Real mode override |
| `skills/wibwobdos-api/SKILL.md` | Symbient-facing API skill (separate) |
