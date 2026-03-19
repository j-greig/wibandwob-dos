# Experimental Scripts — Verification Log

Verifiably logged runs of `scripts/experimental/*.sh` and `scripts/fx/*.sh`.

## Structure

```
.planning/experiments/
  README.md                  ← this file
  suite-runner.sh            ← run one or all scripts with logging
  runs/                      ← one subdir per run session
    YYYY-MM-DD/              ← date-stamped run
      run.log                ← stdout + stderr of the suite runner
      <script>.json          ← structured result per script
      <script>-output.txt    ← raw stdout/stderr capture
      summary.json           ← suite-level aggregation
    .env                     ← instance API URL (generated)
```

## This session's environment

> **This session's repo:** `~/Repos/wibwob-zine-moodboard`
> **This session's instance:** `mwg` (port 8100)
> **Terminal:** iTerm (NOT Ghostty — Ghostty-specific tools are irrelevant here)
>
> Always `cd ~/Repos/wibwob-zine-moodboard` before running.
> Always use `--instance mwg` (or `-i mwg` on the wibwob CLI).

### Terminal / capture note

This Mac runs **iTerm**, not Ghostty. The following are **not applicable**:
- `scripts/lib/find-ghostty-window` — Ghostty CGWindowList helper (skip)
- `scripts/capture-tui-png.sh` — Ghostty screenshot capture (skip)
- Ghostty GPU shaders

The primary visual capture method is the `/screenshot/ansi` API
via `wibwob -i mwg screenshot` or `ww_curl /screenshot/ansi`.

### Common commands

```bash
cd ~/Repos/wibwob-zine-moodboard

# Health check
bun run src/cli/wibwob.ts -i mwg health --json

# Open a window
bun run src/cli/wibwob.ts -i mwg cmd "microapp.wibwob.notepad.open" --text "hello"

# Check open windows
bun run src/cli/wibwob.ts -i mwg windows

# Text screenshot (the working capture on iTerm)
bun run src/cli/wibwob.ts -i mwg screenshot

# Run experimental suite (skip PNG/Ghostty tests)
cd ~/Repos/wibwob-zine-moodboard
bash .planning/experiments/suite-runner.sh <script> --instance mwg

# Quick API smoke
export WIBWOB_API="http://127.0.0.1:8100"
source scripts/lib/runtime-env.sh
ww_curl /screenshot/ansi | wc -l   # text capture
```

### Architecture notes

- `scripts/lib/runtime-env.sh` — `ww_curl`, `ww_api_base()`, etc.
  Uses `WIBWOB_API` if set, else auto-detects via port scan.
  **bash 3.2 fix:** all curl functions use temp vars to avoid `$1` scoping bug:
  `local _url; _url="$(ww_api_base)"; curl -sf "${_url}/path"`

- `suite-runner.sh` — prepends `scratch/wrap-ww/wibwob` to PATH so all
  child `wibwob` calls auto-get `-i <instance>`. Also sources `WIBWOB_API`
  into child shells via a launcher script. No script modifications needed.

## Running

```bash
# Auto-detect first available instance
bash .planning/experiments/suite-runner.sh smoke-screenshot-pipeline

# Explicit instance target (injects -i <instance> into all wibwob calls)
bash .planning/experiments/suite-runner.sh smoke-screenshot-pipeline --instance mwg

# Full experimental suite
bash .planning/experiments/suite-runner.sh all --label "v1-before-refactor"

# FX suite — pure text transforms, no TUI required
bash .planning/experiments/suite-runner.sh fx --label "text-fx-tests"

# One specific script with label
bash .planning/experiments/suite-runner.sh lava-lamp --instance mwg --label "acid-test"
```

## How instance targeting works

The suite-runner creates a `scratch/wrap-ww/wibwob` wrapper that intercepts every `wibwob` call in child scripts:

```bash
#!/usr/bin/env bash
exec bun run src/cli/wibwob.ts -i "$INSTANCE_ID" "$@"
```

It prepends this wrapper to `PATH` before running any script. **Scripts need zero changes** — any `wibwob cmd ...`, `wibwob windows ...`, etc. automatically gets `-i <instance>` injected.

| Instance | Port | Note |
|----------|------|------|
| `mwg` | 8100 | Local zine-moodboard instance (this repo) |
| `444` | 8099 | Shared wibwob-dos instance (another agent's session) |
| `main` | 8099 | Alias for the default instance |

To add a new instance: update the port mapping in `suite-runner.sh` (`--instance` case block).
To add a new fx script: drop it in `scripts/fx/` — it appears in the `fx` suite automatically.

## Result format

Each `<script>.json`:
```json
{
  "script": "smoke-screenshot-pipeline",
  "ran_at": "2026-03-19T14:22:00Z",
  "instance": "mwg",
  "api_port": 8100,
  "exit_code": 0,
  "duration_ms": 3200,
  "summary": "7/7 checks pass",
  "checks": {
    "find-ghostty-window binary": "PASS",
    "CGWindowList finds Ghostty": "PASS",
    "capture-tui-png (auto)": "PASS"
  }
}
```

## Scripts under test

### experimental/ — require a running WibWob-DOS instance

| Script | What it tests |
|--------|--------------|
| `smoke-screenshot-pipeline` | Screenshot/capture pipeline: CGWindowList, capture-tui-png, /screenshot/ansi, minimap |
| `desktop-compose` | Declarative multi-window layout from JSON recipe |
| `desktop-save` | Snapshot current desktop to recipe JSON |
| `dvd-screensaver` | DVD-bounce figlet, fixed window size |
| `dvd-screensaver-v2` | DVD-bounce figlet, auto-sized, theme cycle on bounce |
| `dvd-screensaver-v3` | DVD-bounce + Ghostty shader backdrop |
| `dvd-wib-to-wob` | WIB↔WOB alternating figlet + SFX + macOS TTS |

### fx/ — pure text transforms, mostly stdin→stdout

| Script | What it does |
|--------|-------------|
| `breed` | Character-level merge of two ASCII art files (xor, density, blend, random, interleave modes) |
| `glitch` | Random character displacement filter |
| `flip` | Vertical flip (v), horizontal mirror (h), or both |
| `mirror` | Kaleidoscope: paste original + reversed side-by-side |
| `shear` | Diagonal text displacement |
| `repeat` | Tile text horizontally and/or vertically |
| `upside-down` | Vertical flip — Stranger Things effect |
| `crop` | Crop text to bounding box |
| `zoo` | Opens Joan Stark animal ASCII art as a grid of windows |
| `kaleidoscope` | 4-quadrant mirror of desktop screenshot |
| `lava-lamp` | Recursive self-melting desktop — screenshot → distort → replace → repeat |
| `tui-acid` | Rapid theme cycling + glitch + shear compounds |
| `pinball` | Bouncing figlet with trail accumulation |
| `liquid-shear` | Progressive shear cascade of live desktop |
| `diagonal-trail` | DVD ghost trail — stamps art on persistent canvas, no per-frame clear |
| `jgsbreeder` | Breed two Joan Stark pieces through all modes, open as tiled windows |
