# Scripts Audit

Inventory of `scripts/` — assessed 2026-03-12, reorganised same session.

## Main scripts/ (17 — all CURRENT)

| Script | Purpose |
|--------|---------|
| `attach.sh` | Attach to running wibwob tmux session |
| `capture-app-proof.sh` | Dual-mode capture: text + PNG evidence pipeline |
| `capture-tui-png.sh` | macOS screencapture to PNG |
| `check-describe-state.ts` | Audit all describeState() implementations |
| `check-themes.ts` | Validate all theme files |
| `dev.sh` | Dev launcher with hot-reload (exit code 75 = restart) |
| `gen-primitives.ts` | Regenerate src/core/primitives.ts barrel |
| `handover.sh` | Generate session handover markdown from live state |
| `init-submodules.sh` | Git submodule init with tvterm pinned-SHA workaround |
| `minimap.sh` | ASCII spatial map of live desktop from /state |
| `overlap-check.sh` | Window overlap detection + layout fix suggestions |
| `planning-inbox.ts` | GitHub issue triage / planning inbox |
| `play.sh` | Simple ffplay wrapper for audio playback |
| `restart.sh` | SIGTERM graceful restart in tmux, polls /health |
| `scaffold-microapp.sh` | Scaffold a new microapp module |
| `screenshot-window.sh` | TEXT crop of a single window from tmux capture |
| `start-alt-instance.sh` | Launch second instance (port 8098, label zuk) |

## Moved to skill dirs

| Script | New location |
|--------|-------------|
| `smoke-test.sh` | `.pi/skills/tui-smoke-test/scripts/` |
| `command-registry-smoke.sh` | `.pi/skills/tui-smoke-test/scripts/` |
| `fleet-test.sh` | `.pi/skills/tui-smoke-test/scripts/` |
| `test-agent-reload.sh` | `.pi/skills/tui-smoke-test/scripts/` |
| `window-state-parity-loop.sh` | `.pi/skills/tui-smoke-test/scripts/` |
| `img-to-ascii.py` | `.pi/skills/img-to-ascii/scripts/` |
| `tmux-setup.sh` | `.pi/skills/tmux-launch/scripts/` |
| `timeline-capture.ts` | `.pi/skills/vj-timeline/scripts/` |
| `timeline-dry-run.ts` | `.pi/skills/vj-timeline/scripts/` |
| `timeline-new.ts` | `.pi/skills/vj-timeline/scripts/` |
| `timeline-review.ts` | `.pi/skills/vj-timeline/scripts/` |
| `timeline-run.ts` | `.pi/skills/vj-timeline/scripts/` |
| `timeline-validate.ts` | `.pi/skills/vj-timeline/scripts/` |
| `preview-scene.ts` | `.pi/skills/vj-timeline/scripts/` |
| `render-video.sh` | `.pi/skills/vj-timeline/scripts/` |
| `smear-animate.sh` | `.pi/skills/vj-timeline/scripts/` |
| `smear.py` | `.pi/skills/vj-timeline/scripts/` |
| `ascii-fx.py` | `.pi/skills/vj-timeline/scripts/` |
| `pixelstretch.py` | `.pi/skills/vj-timeline/scripts/` |
| `world-chat-log-tail.sh` | `.agents/skills/ww-room-chat/scripts/` |
| `world-chat-status.sh` | `.agents/skills/ww-room-chat/scripts/` |
| `world-chat-tail.sh` | `.agents/skills/ww-room-chat/scripts/` |
| `dev-irc-bot-burst-active.sh` | `.agents/skills/ww-room-chat/scripts/` |
| `dev-irc-bot-burst.py` | `.agents/skills/ww-room-chat/scripts/` |
| `dev-irc-server.ts` | `.agents/skills/ww-room-chat/scripts/` |
| `wibwob-chat-v2-smoke.sh` | `.agents/skills/ww-room-chat/scripts/` |

## Moved to src/

| Script | New location | Reason |
|--------|-------------|--------|
| `browser-start.sh` | `src/services/browser-start.sh` | Co-located with chrome-browser-service.ts it supports |

## Archived (scripts/.archive/) — 8 dead scripts

| Script | Why archived |
|--------|-------------|
| `arrange.sh` | Stale — layout API has evolved past this |
| `backrooms-feedback-loop.sh` | Orphan — unreferenced, automated prompt loop |
| `check-surface-parity.sh` | Stale — shell wrapper, .ts companion does the work |
| `check-surface-parity.ts` | Stale — command catalog shape has evolved |
| `dev-loop.sh` | Superseded by dev.sh hot-reload pattern |
| `kill-cam.sh` | Orphan — tiny webcam cleanup, rarely needed |
| `layout-composer.ts` | Spike — golden-ratio window composer, works but unused |
| `xxl-viewer.ts` | Spike — Dashboard XXL HTML server, one-off |

## Nothing left to do

All 55 original scripts accounted for: 17 current in main, 27 moved to skills/src, 8 archived, 3 deleted (stale spikes with no value).
