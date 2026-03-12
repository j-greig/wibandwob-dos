# Scripts Audit

Inventory of every file in `scripts/` — 55 scripts total.
Assessed 2026-03-12 on branch `epic/e036-sdk-design-system`.

Status key:
  CURRENT  — actively used, referenced, maintained
  STALE    — works but outdated references, ports, or session names
  ORPHAN   — unreferenced from AGENTS.md, .agents/, skills, package.json
  SPIKE    — one-off spike artefact, never promoted to tooling
  NICHE    — works, useful, but narrow audience (VJ, IRC, video)

---

## Shell scripts (.sh)

| Script | Purpose | Status | Referenced by |
|--------|---------|--------|---------------|
| `arrange.sh` | Batch-arrange windows from a layout file | STALE | agent-session (generic word match only) |
| `attach.sh` | Attach to running wibwob tmux session | CURRENT | standalone shortcut |
| `backrooms-feedback-loop.sh` | Automated backrooms prompt loop with captures | ORPHAN | nowhere |
| `browser-start.sh` | Start Chrome with remote debugging (CDP port 9222) | NICHE | chrome-browser-window.ts |
| `capture-app-proof.sh` | Dual-mode capture: text + PNG evidence pipeline | CURRENT | standalone verification tool |
| `capture-tui-png.sh` | macOS screencapture to PNG | CURRENT | AGENTS.md |
| `check-surface-parity.sh` | Static surface parity checks (command/API/state drift) | STALE | package.json (but .ts companion does the real work) |
| `command-registry-smoke.sh` | Smoke test command registry (old port 8116) | STALE | nowhere; uses hardcoded port 8116 |
| `detect-wwdos-display.sh` | Heuristic: which macOS display shows the terminal | ORPHAN | nowhere (was written for capture-tui-png but never wired) |
| `dev-irc-bot-burst-active.sh` | Fire IRC bot burst to active channel | NICHE | nowhere |
| `dev-loop.sh` | Auto-restart dev server on crash with file watch | STALE | nowhere; superseded by `dev.sh` |
| `dev.sh` | Dev launcher with hot-reload (exit code 75 = restart) | CURRENT | package.json (`bun run dev`) |
| `fleet-test.sh` | Open all window kinds, cycle themes, capture screenshots | STALE | LINGO.md only |
| `handover.sh` | Generate session handover markdown from live state | CURRENT | AGENTS.md, package.json |
| `init-submodules.sh` | Initialise git submodules (tvterm pinned-SHA workaround) | NICHE | nowhere; run manually after clone |
| `kill-cam.sh` | Kill lingering webcam processes after TUI exit | NICHE | nowhere |
| `minimap.sh` | ASCII spatial map of live desktop from /state | CURRENT | AGENTS.md, agent slash commands, .agents/ |
| `overlap-check.sh` | Window overlap detection + layout fix suggestions | CURRENT | AGENTS.md |
| `play.sh` | Simple ffplay wrapper for audio files | NICHE | standalone |
| `render-video.sh` | Stitch capture PNGs + audio into MP4 | NICHE | standalone; VJ pipeline |
| `restart.sh` | SIGTERM graceful restart in tmux, polls /health | CURRENT | AGENTS.md (4 refs), .agents/ |
| `s07-dense-scene-smoke.sh` | Dense scene smoke test (12 animated windows) | SPIKE | nowhere |
| `scaffold-microapp.sh` | Scaffold a new microapp module | CURRENT | AGENTS.md, package.json, docs |
| `screenshot-window.sh` | TEXT crop of a single window from tmux capture | CURRENT | AGENTS.md (2 refs), .agents/ (2 refs) |
| `smear-animate.sh` | Rapid-cycle smear frames in primer window | NICHE | nowhere directly |
| `smoke-test.sh` | Open main window types, check state, clean up | CURRENT | AGENTS.md |
| `start-alt-instance.sh` | Launch second instance (port 8098, label zuk) | CURRENT | AGENTS.md |
| `test-agent-reload.sh` | Test agent.reload_prompt end-to-end | STALE | nowhere |
| `tmux-setup.sh` | Enable mouse + rename windows in tmux session | STALE | nowhere (was in skill, dropped) |
| `wibwob-chat-v2-smoke.sh` | Chat v2 smoke test (old port 8115) | STALE | nowhere; old port |
| `window-state-parity-loop.sh` | Continuous state parity checks (old port 8114) | STALE | nowhere; old port |
| `world-chat-log-tail.sh` | Tail world chat log file | NICHE | nowhere |
| `world-chat-status.sh` | Summary of active world chat channels | NICHE | nowhere |
| `world-chat-tail.sh` | Tail world chat via API polling | NICHE | nowhere |

## TypeScript scripts (.ts)

| Script | Purpose | Status | Referenced by |
|--------|---------|--------|---------------|
| `check-describe-state.ts` | Audit all describeState() implementations | CURRENT | standalone audit tool |
| `check-surface-parity.ts` | Static parity: commands vs API vs state contract | STALE | package.json |
| `check-themes.ts` | Validate all theme files | CURRENT | package.json, AGENTS.md |
| `dev-irc-server.ts` | Local IRC server for world chat dev | NICHE | package.json, .agents/ |
| `gen-primitives.ts` | Regenerate src/core/primitives.ts barrel | CURRENT | package.json, AGENTS.md |
| `layout-composer.ts` | Generate batch_layout ops from vibe + content | SPIKE | nowhere |
| `planning-inbox.ts` | GitHub issue triage / planning inbox | CURRENT | package.json |
| `preview-scene.ts` | Open timeline scene + screenshot | NICHE | .agents/, timeline tests |
| `s01-spike-markdown.ts` | Markdown rendering spike (approach A vs B) | SPIKE | nowhere |
| `timeline-capture.ts` | Capture PNG per timeline cue step | NICHE | timeline smoke tests |
| `timeline-dry-run.ts` | Dry-run timeline without audio/capture | NICHE | timeline smoke tests |
| `timeline-new.ts` | Scaffold a new timeline JSON | NICHE | nowhere |
| `timeline-review.ts` | Review timeline cues with analysis | NICHE | timeline smoke tests |
| `timeline-run.ts` | Execute a VJ timeline with audio sync | NICHE | nowhere directly |
| `timeline-validate.ts` | Validate timeline JSON schema | NICHE | timeline smoke tests |
| `xxl-viewer.ts` | Serve Dashboard XXL as full-screen HTML | SPIKE | nowhere |

## Python scripts (.py)

| Script | Purpose | Status | Referenced by |
|--------|---------|--------|---------------|
| `ascii-fx.py` | ASCII art effects: bloom, scanline, collapse, glitch | NICHE | nowhere directly; used via smear-animate.sh |
| `dev-irc-bot-burst.py` | Fire test messages to IRC server | NICHE | package.json |
| `img-to-ascii.py` | Convert images to ASCII art primers | NICHE | img-to-ascii skill (indirect) |
| `pixelstretch.py` | Pixel stretch effect for images | ORPHAN | nowhere |
| `smear.py` | Smear/glitch effect for ASCII art | NICHE | smear-animate.sh, command-catalog |

---

## Summary by status

| Status | Count | Action |
|--------|-------|--------|
| CURRENT | 16 | Keep, maintain |
| NICHE | 19 | Keep; useful for VJ/IRC/world-chat workflows |
| STALE | 9 | Review: update ports/refs or remove |
| SPIKE | 4 | Archive or remove — one-off experiments |
| ORPHAN | 3 | Remove unless someone claims them |

## Stale scripts — details

| Script | Problem |
|--------|---------|
| `arrange.sh` | Not referenced; may still work but layout API has evolved |
| `check-surface-parity.sh` | Shell wrapper for .ts; both may be outdated vs current command catalog |
| `command-registry-smoke.sh` | Hardcoded port 8116 (app uses 8099) |
| `dev-loop.sh` | Superseded by dev.sh hot-reload pattern |
| `fleet-test.sh` | Only in LINGO.md; window types may have changed |
| `test-agent-reload.sh` | Tests agent.reload_prompt which may have been renamed |
| `tmux-setup.sh` | Was referenced in a skill, no longer |
| `wibwob-chat-v2-smoke.sh` | Hardcoded port 8115 |
| `window-state-parity-loop.sh` | Hardcoded port 8114 |

## Ghost references — scripts mentioned in docs that don't exist in `scripts/`

All of these are actually skill-local scripts (e.g. `.pi/skills/wibwobdos/scripts/state.sh`)
referenced with bare `scripts/` paths in their own SKILL.md files. They are NOT missing from
the repo — the `scripts/` prefix is relative to the skill directory, not the repo root.

| Ghost reference | Actually lives at |
|----------------|-------------------|
| `scripts/bootstrap.sh` | `.pi/skills/qmd/scripts/bootstrap.sh` |
| `scripts/confusion-scan.py` | `.pi/skills/session-archaeology/scripts/` |
| `scripts/connect.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/deep-analyse.py` | `.pi/skills/session-archaeology/scripts/` |
| `scripts/discord.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/export.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/extract-sessions.py` | `.pi/skills/session-archaeology/scripts/` |
| `scripts/index-to-qmd.sh` | `.pi/skills/session-archaeology/scripts/` |
| `scripts/open.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/planning.sh` | `.claude/scripts/planning.sh` |
| `scripts/png.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/poll-window.sh` | `.pi/skills/wibwobdos/scripts/` (referenced in SKILL.md but may not exist) |
| `scripts/screenshot.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/send.sh` | `.pi/skills/wibwobdos/scripts/` |
| `scripts/state.sh` | `.pi/skills/wibwobdos/scripts/` |

## Cross-reference: AGENTS.md canon names vs actual scripts

AGENTS.md defines these canon names in the "Canon names for self-testing work" table:

| Canon name | Maps to | Match? |
|-----------|---------|--------|
| typecheck | `bun run typecheck` (not a script) | OK |
| smoke | `scripts/smoke-test.sh` | OK |
| restart | `scripts/restart.sh` | OK |
| API parity | `/state` endpoint | OK (no script) |
| screenshot | `scripts/screenshot-window.sh` | OK — but name is misleading (outputs text, not PNG) |
| minimap | `scripts/minimap.sh` | OK |
| overlap-check | `scripts/overlap-check.sh` | OK |
| handover | `scripts/handover.sh` | OK |
| planning-sync | `.claude/scripts/planning.sh sync` | OK |

## Naming concerns

| Issue | Scripts | Suggestion |
|-------|---------|------------|
| `screenshot-window.sh` outputs TEXT not images | `screenshot-window.sh` | Rename to `text-crop-window.sh` or add prominent warning (already has one) |
| `capture-tui-png.sh` vs `capture-app-proof.sh` overlap | both capture PNGs | `capture-app-proof.sh` is the superset (text + PNG); consider whether both are needed |
| `detect-wwdos-display.sh` was never wired into `capture-tui-png.sh` | both exist independently | Wire it in or remove detect-wwdos-display.sh |
| Timeline scripts (6 files) share no common prefix | `timeline-*.ts` | Already well-named; no action |
| `s01-spike-markdown.ts`, `s07-dense-scene-smoke.sh` | spike artefacts | Move to `scratch/spikes/` or delete |
| `dev-loop.sh` vs `dev.sh` | both exist | Remove dev-loop.sh (superseded) |

## Consolidation candidates

1. **Capture trio**: `capture-tui-png.sh`, `capture-app-proof.sh`, `detect-wwdos-display.sh`
   — could be one script with flags: `capture.sh [--text] [--png] [--detect-display]`

2. **Old smoke tests**: `command-registry-smoke.sh`, `wibwob-chat-v2-smoke.sh`,
   `window-state-parity-loop.sh` — all use dead ports (8114-8116). Either update to
   port 8099 or delete; `smoke-test.sh` covers the basics.

3. **World chat trio**: `world-chat-log-tail.sh`, `world-chat-status.sh`,
   `world-chat-tail.sh` — three tiny scripts that could be subcommands of one.

4. **Smear duo**: `smear.py` + `smear-animate.sh` — animate.sh just calls smear.py
   in a loop. Could be flags on smear.py.
