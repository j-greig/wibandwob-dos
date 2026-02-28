# Backrooms TV (Turbo Vision)

Streams live ASCII art from the `wibandwob-backrooms` CLI into a scrolling TUI window. Primers steer the LLM's aesthetic — select from a library of saved ASCII art files, paste raw text, or split a multi-chunk paste on `---` separators.

---

## Architecture

### C++ layer (`backrooms_tv_view.h/.cpp`)

- **`BackroomsChannel`** — config struct: theme, primer names (CSV), turns, model, optional inline custom text.
- **`BackroomsBridge`** — manages the CLI subprocess lifecycle: `fork()`/`exec()` of `npx tsx cli-v3.ts`, non-blocking stdout pipe, `SIGTERM`/`SIGKILL` cleanup.
- **`TBackroomsTvView`** (`TScroller`) — 50ms timer polls the pipe, appends to a 500-line ring buffer, renders with jet-black background. Status bar shows LIVE/PAUSED/IDLE, theme, turns, primer names, log path.
- **`TBackroomsTvWindow`** (`TWindow`) — tileable wrapper hosting the view + vertical scrollbar.
- **`TBackroomsTvDialog`** — config dialog: 3-column list (Available | Preview | Selected), custom primer editor.
- **`TBktvListBox`** — `TListBox` subclass with shift-select range tracking and configurable broadcast command. Used for both Available and Selected lists.

### CLI layer (`wibandwob-backrooms`)

`src/ui/cli-v3.ts` — Pi SDK inference handler. Accepts `--primers "name1,name2"`, `--turns N`, `--model haiku|sonnet|opus`, `--raw` (stream deltas to stdout only). Primers are loaded from `primers/` relative to the backrooms repo root.

---

## Primer system

### File primers

Scanned at app startup and again when the config dialog opens:

1. `wibandwob-backrooms/primers/` — native primer files (dedup base).
2. `modules-private/*/primers/` — module-sourced primers, symlinked into backrooms `primers/` on demand.

`syncModulePrimers()` runs at startup to pre-create symlinks for all module primers.

### Custom text primers

Pasted directly into the editor pane at the bottom of the config dialog:

- Type or paste any text (ASCII art, prose, contour maps, whatever).
- Use `---` (3+ dashes on a line) as a separator to split the paste into multiple independent primers.
- **"Add custom →"** writes each chunk as `_custom_N.txt` in the backrooms `primers/` dir, adds the names to the Selected list, and clears the editor. Repeat to accumulate many custom primers.
- If text remains in the editor when Play is clicked it is auto-split and prepended to the primer list as `_custom_N.txt` files.

### Primer size

The backrooms CLI previously capped primer loading at 15 000 chars — raised to 500 000 to accommodate large contour maps and multi-panel ASCII art.

---

## Config dialog

| Control | Action |
|---------|--------|
| Theme | Free-text generation theme |
| Turns | Number of LLM turns (1–20) |
| Model | Haiku / Sonnet / Opus |
| Available list | All primers found. Shift+↑↓ or Shift+click selects a range. |
| Preview (centre) | Shows content of focused item in Available or Selected list. |
| Selected list | Primers to use. Click any item to preview it. |
| Add → | Add focused item (or shift-selected range) to Selected. |
| ← Remove | Remove focused item from Selected. |
| +3 / +6 / +9 rnd | Additively pick N random primers not already selected. |
| Clear | Empty the Selected list. |
| Custom primer editor | Paste raw text; `---` splits into chunks. |
| Add custom → | Commit editor text to Selected list as `_custom_N` entries. |
| Play | Write any remaining editor text, start the generator. |

---

## Keyboard shortcuts (inside the TV window)

| Key | Action |
|-----|--------|
| Space | Pause / resume |
| N | Next (restart same channel) |
| R | Open config dialog with new channel |
| Esc | Close window |
| ↑ ↓ PgUp PgDn | Scroll (disables auto-scroll) |

Auto-scroll re-engages when you scroll back to the bottom.

---

## Logs

Each session writes a timestamped log to `logs/backrooms-tv/<timestamp>_<theme>.txt` (raw LLM deltas, including triple-backtick fences stripped from display).

---

## Module primer path resolution

```
WIBWOB_BACKROOMS_PATH          → explicit override
WIBWOB_REPO_ROOT/../wibandwob-backrooms  → sibling repo (set by start_api_server.sh)
../wibandwob-backrooms         → hardcoded fallback (common dev layout)
```

---

## Adding new primer sources

Any directory structure matching `modules-private/<name>/primers/*.txt` is automatically picked up by `scanPrimerNames()` and `syncModulePrimers()` — no code changes required.
