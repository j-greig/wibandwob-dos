# Handover — Sunday 8 March 2026 → Monday Studio Session

No prior context needed. Everything is in main. Read this top to bottom.

---

## State of main

Clean. Typecheck passes. All branches merged. One open PR: none.

Kanban board: https://github.com/users/j-greig/projects/2
Run `bun run planning:inbox` to see what needs action before starting.

---

## What shipped today (Sunday)

### Tide Pool microapp
New ecosystem simulator window — 5 species, Shannon diversity, era/tide cycle.
14/14 smoke tests pass. Smoke runner: `tests/tidepool-smoke/run.sh`
Open via: `POST /commands/run {"id":"microapp.wibwob.tidepool.open"}`

### E021 VPS fixes (all live on VPS now — Pi 2 confirmed clean)
- `deployProfile` now in `/state` app object (was only in `/health`)
- `WELCOME.md` copied into Docker image — Help → README works
- `window.close/focus/move/resize` now discoverable registry commands
- `windows/batch` op field table added to `.agents/control-api.md`

### Music player — bundled tracks
Three chiptune tracks now ship with the app in `content/music/`:
- `001-berlin-warehouse-techno.mp3`
- `003-ambient-presence-v4.mp3`
- `004-hyperpop-reggae-reggae.mp3`
Available in Docker. `resolveAudioPath` now checks `content/music/` as fallback.
**TODO: smoke test music player on running app with human ears.**

### GlitchBox TUI MVP brief
`.planning/spikes/spk-glitchbox-tui/mvp-brief.md` — concrete buildable spec:
- 5 named poses, 7 ACs, no webcam/Python, VPS-safe
- Agents send `glitchbox.pose preset:jump`, skeleton moves through generative field
- Monster Cam (E004) now has fat LOCAL ONLY warning — do not confuse the two
- Skeleton renderer is shared: AC-6 (e004) = AC-1 (glitchbox) — build once

### Planning system tidy
- Three-tier model codified in AGENTS.md + `.planning/AGENTS.md` + `.planning/README.md`
- `bun run planning:inbox` — sweeps GH issues + stale todos
- GitHub kanban board live with all 6 active epics
- GH issues #113 still needs closing/promoting (TV→TS spike — see below)

---

## Open work (in priority order)

### 1. GlitchBox TUI — build it
Brief: `.planning/spikes/spk-glitchbox-tui/mvp-brief.md`
Skills to load: `composable-engines`, `new-window-type`, `ww-ops`
Branch from: `main` → `spike/spk-glitchbox-tui`
No blockers. This is the Monday morning build.

### 2. Music player smoke test
Start the app, open music player, verify bundled tracks show up and play.
`bash scripts/restart.sh` then open Music Player from the menu.

### 3. E022 — WibWobWorld Restore (S03, S05, S06 still open)
S03: ISO serialises terrain params not file path
S05: Hybrid iso right pane fill parity
S06: Ordering contract
Brief: `.planning/epics/e022-wibwobworld-restore-layout-fidelity/e022-brief.md`

### 4. Close GH #113 (TV→TS parity spike)
Either: create `.planning/spikes/spk-tv-ts-parity/` brief, or close as parked.
`bun run planning:inbox` will flag it.

---

## Blocked / not starting

- **E021 VPS** — blocked on 3 structural gaps (terrain seed, API identity, auto-open). Do not touch.
- **E004 Monster Cam** — LOCAL ONLY. No webcam on VPS. See GlitchBox instead.
- **E001 Codified Context** — stalled on design questions. Needs human direction first.

---

## Branch hygiene

Active branches to leave alone (open work):
- `spike/touchlab-inner-window-colors` — TouchLab inner window title bar fix, unmerged

Stale branches (review for deletion later, not urgent):
`codex/feat-touchlab-mvp`, `codex/spike-module-runtime-reload`,
`epic/e021-vps-multi-agent-world`, `feat/agent-mailbox`,
`feat/e011-desktop-shell`, `fix/connect-sh-env-autoload`,
`fix/parity-guardrails-v2`, `last-days-of-tvision`, `spike/spk-808-drum-machine`

---

## Key commands

```bash
bash scripts/restart.sh          # restart app clean
bun run typecheck                # minimum gate before any commit
bun run planning:status          # epic overview
bun run planning:inbox           # what needs action
bun run planning:sync            # regenerate EPIC_STATUS.md
curl -s http://127.0.0.1:8099/health  # check app is up
```

---

## One-liner for the day

GlitchBox: agents get to jump.
