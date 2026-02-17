# PR #53 — E005 Theme Runtime Wiring: Test Plan

> tl;dr — Build done. Need to run TUI + API server, run test_theme.py, visually verify dark_pastel palette changes colours. Palette values are Copilot-invented and may look wrong.

## Context

This is a git worktree of branch `copilot/review-epic-brief` from PR #53 on `j-greig/wibandwob-dos`. Copilot implemented E005 (theme runtime wiring) — code review passed on logic but tests were never actually run and visual output was never verified.

**PR**: https://github.com/j-greig/wibandwob-dos/pull/53
**Epic brief**: `.planning/epics/e005-theme-runtime-wiring/e005-epic-brief.md` (in main repo)
**Build status**: Clean build completed. Binary at `./build/app/test_pattern`.

## What Changed (summary)

- `app/test_pattern_app.cpp`: Theme state members (`mutable ThemeMode`/`ThemeVariant`), IPC handlers wired (were stubs), `getPalette()` switches between `cpMonochrome`/`cpDarkPastel`, `get_state` emits theme fields, workspace export/import includes theme.
- `tools/api_server/test_theme.py`: 7 integration tests (state, set, reset, invalid, snapshot round-trip).
- No changes to Python API server, MCP tools, or command registry routing — those already worked from E003.

## Step 1: Start TUI + API Server

Terminal 1 — run the TUI app:
```bash
./build/app/test_pattern
```

Terminal 2 — start the API server:
```bash
./start_api_server.sh
```

Wait for both to be running. Verify API health:
```bash
curl http://127.0.0.1:8089/health
```

## Step 2: Run Integration Tests

```bash
python3 tools/api_server/test_theme.py
```

Expected: 7/7 pass. If any fail, note which ones and the error output.

## Step 3: Verify Theme State via API

```bash
# Check default state includes theme fields
curl -s http://127.0.0.1:8089/state | python3 -c "import sys,json; d=json.load(sys.stdin); print('theme_mode:', d.get('theme_mode'), 'theme_variant:', d.get('theme_variant'))"
# Expected: theme_mode: light theme_variant: monochrome

# Set dark pastel
curl -s -X POST http://127.0.0.1:8089/theme/mode -H 'Content-Type: application/json' -d '{"mode":"dark"}'
curl -s -X POST http://127.0.0.1:8089/theme/variant -H 'Content-Type: application/json' -d '{"variant":"dark_pastel"}'

# Confirm state
curl -s http://127.0.0.1:8089/state | python3 -c "import sys,json; d=json.load(sys.stdin); print('theme_mode:', d.get('theme_mode'), 'theme_variant:', d.get('theme_variant'))"
# Expected: theme_mode: dark theme_variant: dark_pastel

# Reset
curl -s -X POST http://127.0.0.1:8089/theme/reset
```

## Step 4: Visual Verification (CRITICAL — never been done)

This is the main unknown. The `cpDarkPastel` palette hex values were invented by Copilot, not derived from the actual colour reference system. They should produce a visible colour change but may look random or ugly.

### What to check (AC-3):

1. **Before theme change**: TUI should show normal monochrome look (grey on black, standard TV palette)
2. **After setting dark_pastel variant**: Desktop background, window frames, menu bar, and status line should change colour. Look for blue-ish tones (the palette uses `0x1F` = white-on-blue as base).
3. **After reset**: Should return to monochrome look.

### How to verify:

**Option A — Human visual check** (ask James):
- "Look at the TUI in the terminal. I'm about to switch theme via API. Does the colour change? Does it look intentional or like garbage?"

**Option B — Screenshot via API** (if available):
```bash
curl -s -X POST http://127.0.0.1:8089/screenshot
# Check the screenshot file in logs/screenshots/
```

**Option C — Browser automation** (if using /chrome or agent-browser):
- The TUI runs in a terminal, not a browser — so browser tools won't help directly
- But if the terminal is visible in a browser-accessible window (e.g. xterm.js), you could screenshot it

### Visual verdict options:
- **Colours change and look deliberate** → AC-3 passes, palette is usable
- **Colours change but look wrong** → AC-3 partial pass, palette values need tuning against `ThemeManager::getColor()` definitions
- **No visible change** → AC-3 fails, repaint mechanism broken

## Step 5: Snapshot Round-Trip (AC-5)

```bash
# Set theme
curl -s -X POST http://127.0.0.1:8089/theme/variant -H 'Content-Type: application/json' -d '{"variant":"dark_pastel"}'

# Export workspace
curl -s -X POST http://127.0.0.1:8089/state/export -H 'Content-Type: application/json' -d '{"path":"/tmp/e005_test_workspace.json"}'

# Check theme in exported file
python3 -c "import json; d=json.load(open('/tmp/e005_test_workspace.json')); print(d.get('theme_mode'), d.get('theme_variant'))"

# Reset and reimport
curl -s -X POST http://127.0.0.1:8089/theme/reset
curl -s -X POST http://127.0.0.1:8089/state/import -H 'Content-Type: application/json' -d '{"path":"/tmp/e005_test_workspace.json"}'

# Verify restored
curl -s http://127.0.0.1:8089/state | python3 -c "import sys,json; d=json.load(sys.stdin); print('theme_mode:', d.get('theme_mode'), 'theme_variant:', d.get('theme_variant'))"
```

## Acceptance Criteria Checklist

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC-1 | set_theme_mode stores mode; get_state reflects | test_theme.py::test_set_theme_mode + Step 3 curl | ? |
| AC-2 | set_theme_variant stores variant; get_state reflects | test_theme.py::test_set_theme_variant + Step 3 curl | ? |
| AC-3 | Theme change visibly repaints desktop, frames, status | Step 4 visual check | ? |
| AC-4 | reset_theme restores defaults | test_theme.py::test_reset_theme | ? |
| AC-5 | Theme state survives snapshot round-trip | test_theme.py::test_snapshot_roundtrip + Step 5 | ? |
| AC-6 | Auto mode (stretch) | Dropped | N/A |

## Known Risks

- **Palette values are ungrounded**: `cpDarkPastel` was generated by Copilot without reference to the actual colour system. Expect visual tuning needed.
- **Repaint mechanism untested**: `deskTop->setState(sfExposed, true); deskTop->drawView()` is theoretically correct for Turbo Vision but never been run.
- **`mutable` on state members**: works but is a slight code smell — theme state is mutable through const `getPalette()` AND through non-const IPC handlers.

## After Testing

Post results (pass/fail per AC + any screenshots) as a comment on PR #53:
```bash
gh pr comment 53 --repo j-greig/wibandwob-dos --body-file /path/to/results.md
```

If all ACs pass, PR is mergeable (after fixing title/branch cosmetics).
If palette looks wrong, note it — that's a separate fix pass on the hex values.
