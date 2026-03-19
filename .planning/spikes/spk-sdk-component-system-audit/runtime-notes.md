# Runtime Notes — 2026-03-19

## Boot sequence completed

- Created tmux session: `wibwob`
- Launched app in tmux:
  - `cd /Users/james/Repos/wibandwob-dos && bun run dev:world`
- Verified instances:
  - `bun run src/cli/wibwob.ts instances`

## Active instance snapshot

- instanceId: `9fa0c2e8`
- instanceDisplayId: `9fa`
- instanceLabel: `main`
- port: `8100`
- canonical CLI target used: `-i 9fa`
- health command:
  - `bun run src/cli/wibwob.ts -i 9fa health`

## Crash/recovery snippets (tmux-controlled)

```bash
# health + instance list
bun run src/cli/wibwob.ts instances
bun run src/cli/wibwob.ts -i 775 health

# graceful restart via script
bash scripts/restart.sh
bun run src/cli/wibwob.ts instances

# manual tmux recovery (if needed)
tmux ls
tmux send-keys -t wibwob C-c
sleep 1
tmux send-keys -t wibwob 'cd /Users/james/Repos/wibandwob-dos && bun run dev:world' Enter
sleep 8
bun run src/cli/wibwob.ts -i 775 health
```

## Mouse click smoke (Ghostty AppleScript)

Commands tested via script:
- `scripts/experimental/ghostty-menu-click-smoke.sh`
- clicks sent:
  - File menu guess: `(x=20,y=10)`
  - Applications menu guess: `(x=125,y=10)`

Observed result (via `/runtime/inspection`):
- `snapshot.ui.menu.open` stayed `false` for both clicks.

Interpretation:
- AppleScript command path works, but clicks did not hit active WibWob surface in this run context.
- Most likely cause: runtime is in detached tmux; Ghostty terminal target not attached to that tmux pane.

Next step before retrying mouse smoke:
1. Attach Ghostty terminal to tmux session running WibWob (`tmux attach -t wibwob`).
2. Re-run `scripts/experimental/ghostty-menu-click-smoke.sh`.
3. Tune click coords if needed and record successful coordinates.
