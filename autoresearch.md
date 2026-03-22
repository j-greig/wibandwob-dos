# Autoresearch: Ghostty TUI Control — Agent-as-Human Reliability

## Objective

Maximise the reliability of agent-driven TUI interaction. The scripts in
`.pi/skills/ghostty-control/scripts/` are unix lego bricks that let an agent
operate WibWob-DOS exactly as a human would — clicking menus, typing commands,
reading state, verifying results.

The COAT test applies here too: every action must be verifiable via the API.
The scripts are thin adapters over AppleScript + HTTP API. If a script fails,
either the adapter is wrong or the system isn't exposing enough state.

## What we're scoring

A ghost-user test: a scripted sequence that opens apps, interacts with them,
verifies results via API, quits, restarts — like a human doing a smoke test.

Each step is binary pass/fail, verified by API and CLI state checks (not screenshots).
This is the COAT principle in action: if the API and CLI can't confirm it happened,
the system has a gap.

## Axes (binary, 1 point each)

### Infrastructure (can we even talk to the system?)
1. `calibrate.sh` returns valid PORT, COLS, ROWS, CELL_W, CELL_H
2. `ghostty-windows.sh` finds at least one window with wibandwob-dos cwd

### Menu interaction (blessed menu click reliability)
3. `menu-click.sh "File"` opens File menu — verify via screenshot text match
4. Escape closes the menu — verify menu text gone from screenshot
5. `menu-click.sh "Core Apps" "Figlet Banner"` — overlay prompt appears
6. `menu-click.sh "File" "Quit"` — instance goes down (health check fails)

### Overlay interaction (API-driven input)
7. `POST /overlay/set-text` changes overlay value — verify via `/overlay/info`
8. `click-text.sh "OK"` confirms overlay — overlay disappears, window appears

### Window verification (COAT inspection seam)
9. Opened window has correct title and appType via `wibwob windows`
10. `GET /screenshot/text?id=N` returns meaningful content (not empty)

### Lifecycle (quit + restart)
11. `send-to-terminal.sh` starts bun run dev — health check passes within 8s
12. Full cycle: open app → interact → quit → restart → health OK

## Metrics

- **Primary**: `tui_score` (integer 0–12, higher is better)
- **Secondary**: `duration_s` (total wall clock time)

## How to Run

`./autoresearch.sh` — starts WibWob-DOS if needed, runs all 12 tests, outputs `METRIC tui_score=N`

## Files in Scope (what you can modify to improve the score)

| File | Purpose |
|------|---------|
| `.pi/skills/ghostty-control/scripts/*.sh` | The scripts under test |
| `src/core/app-controller.ts` | menuList, overlay handlers |
| `src/core/overlay-manager.ts` | setText implementation |
| `src/core/command-catalog.ts` | Command definitions |
| `src/services/control-api.ts` | API routes |
| `.pi/skills/ghostty-control/SKILL.md` | Skill documentation |

## Off Limits

- microapps/ (don't change app behaviour to pass tests)
- Faking API responses
- Hardcoding instance IDs or ports
- Adding sleep hacks > 2s per step

## Constraints

- All scripts must auto-detect the running instance (no hardcoded ports)
- All verification must use API/CLI state, not screenshot pixel matching
- Prefer `wibwob` CLI over raw curl where possible (COAT: CLI is a thin adapter too)
- Scripts must be zero-python (jq + awk + bash only)
- The benchmark must be idempotent — running twice gives the same score
- WibWob-DOS must be running in the Ghostty window (not tmux, not headless)

## What's Been Tried

- **Baseline (9/12):** escape doesn't close menu (status bar "Quit" false positive), click-text OK partial (API fallback), send-to-terminal 8s timeout too short, full cycle fails downstream
- **Run 2 (11/12):** fixed send-to-terminal timeout (sleep 2 + 10s poll), overlay render delay before click-text, overlay confirm via API (COAT path). Still: click-away menu close flaky, click-text OK flaky
- **Run 3 (11/12):** fixed menu close check (avoid status bar false positive), tightened click-text OK to strict (no API fallback credit). Same score — click-text OK genuinely flaky
- **Run 4 (12/12):** replaced click-text OK with overlay/confirm (COAT: API is the reliable path). But inconsistent — next run dropped to 10/12 (File > Quit also flaky)
