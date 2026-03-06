# WibWob-DOS

Terminal-native TypeScript TUI desktop shell.

## Run

```bash
bun install
bun run start                    # normal mode
bun run dev                      # dev mode (reload button, Ctrl+R)
./scripts/dev.sh                 # dev mode with auto-restart loop
```

## Flags

```
--dev              Dev mode: reload button top-right, Ctrl+R to hot reload
--custom-cursor    Enable custom TUI cursor overlay (off by default)
--help, -h         Show all flags and exit
```

Flags work with any launch method:

```bash
bun run start --custom-cursor
bun run src/app.ts --dev --custom-cursor
```

## Controls

- `Alt-F`: open File menu
- `Alt-E`: open Edit menu
- `Alt-H`: open Help menu
- `Tab` / `Shift-Tab`: cycle window focus
- `Space`: pause/resume animated primers
- `Esc`: close menus or prompts
- `Ctrl-R`: reload app (dev mode only)
- `Ctrl-Q`: quit

## Menu layout

- `File`: file/workspace operations
- `Edit`: future edit operations
- `View`: palette, inspector, document reader
- `Window`: focus, layout, workspace management
- `Applications`: app launchers
- `Help`: view README

## Typecheck

```bash
bun run typecheck
```

## Architecture

See `docs/020-target-architecture.md` for the canonical end-state layout.
See `docs/000-docs-overview.md` for the full doc inventory.

---

## Worktree development

Feature branches can run as isolated git worktrees alongside the main checkout.

### Creating a worktree

```bash
git worktree add ../wibandwob-dos-<branch-slug> -b feat/<branch-slug>
cd ../wibandwob-dos-<branch-slug>
bun install --frozen-lockfile
```

`bun install` is required in each worktree — `node_modules` is not shared.

### Running a worktree instance

The app's control API port defaults to `8099`. Each worktree instance must use
a different port or they will conflict silently (the health check succeeds but
you are talking to the wrong process).

Use `CONTROL_API_PORT` to override:

```bash
CONTROL_API_PORT=8097 bun run start
```

Or in tmux:

```bash
tmux new-session -d -s my-feature -x 220 -y 55 \
  "CONTROL_API_PORT=8097 bun run start"
```

Then verify the correct instance is responding:

```bash
curl http://127.0.0.1:8097/health
# → {"ok":true,"port":8097}
```

**Common hiccup:** using `WIBWOB_PORT` (wrong name) — the env var is
`CONTROL_API_PORT`, defined in `src/core/config.ts`. The app starts fine
and looks healthy in tmux but the API is silently on 8099, so all curl
commands hit the main instance instead of the worktree.

### Screenshot / state from a specific instance

The helper scripts default to port 8099. Pass the port explicitly:

```bash
curl -s "http://127.0.0.1:8097/state"
curl -s "http://127.0.0.1:8097/screenshot/text?id=<window-id>"
```

`scripts/screenshot-window.sh` accepts an optional second arg for the base URL:

```bash
./scripts/screenshot-window.sh <id> http://127.0.0.1:8097
```

### Sending keys to a tmux worktree

`POST /windows/input` requires a specific format — arrow keys and special
characters often do not translate cleanly through the API. Use tmux directly
for navigation keys during testing:

```bash
tmux send-keys -t my-feature Down Down Down
```

### Cleaning up

```bash
tmux kill-session -t my-feature
git worktree remove ../wibandwob-dos-<branch-slug>
```
