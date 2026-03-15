# WibMux Autoresearch — Session Handover

## What this is

Ghostty-native tmux replacement for WibWob-DOS. Uses AppleScript API (Ghostty 1.3+).

## Where you are

- **Worktree:** `~/Repos/wibandwob-dos-wibmux`
- **Branch:** `autoresearch/wibmux-2026-03-15`
- **Main repo:** `~/Repos/wibandwob-dos` (on `epic/e042-solid-foundations`, don't touch)

## What's done

- Spike brief: `.planning/spikes/spk-wibmux/spk-wibmux-brief.md`
- Community triage: `.planning/spikes/spk-wibmux/ghostty-community-triage.md`
  (107 Ghostty discussion comments scored by reactions, triaged into WibMux relevance)
- Autoresearch harness: `autoresearch/wibmux/` (md, sh, checks.sh, ideas.md)
- Benchmark tests 10 operations, metric is `capability_count` (0–10, higher better)

## What to do next

1. `bun install --ignore-scripts` (worktree needs node_modules)
2. Read `autoresearch/wibmux/autoresearch.md` — the full spec
3. Create `autoresearch/wibmux/wibmux.sh` — the CLI script (main deliverable)
4. Start autoresearch loop: `init_experiment` → baseline → loop forever

## The 10 operations to implement

1. create, 2. list, 3. focus, 4. attach, 5. close,
6. send, 7. read, 8. layout, 9. shader, 10. shader-list

## Key files to read

- Ghostty SDEF: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
- Existing shader script: `scripts/ghostty-shader.sh` (prior art for shader ops)
- Existing attach logic: `src/cli/wibwob.ts` (grep "attach")
- Process manager: `scripts/lib/process-manager.sh`

## WibWob-DOS must be running

The `read` and `attach` operations need WibWob API on port 8099.
There's a tmux session `wibwob-cinema` running it from the main repo.
Check: `curl -s http://127.0.0.1:8099/health`

## Delete this file when you're oriented

It's not tracked in git. It's just for you.
