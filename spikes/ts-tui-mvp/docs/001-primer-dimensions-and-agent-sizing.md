# Primer Dimensions & Agent Sizing

Dev handover note — Feb 28 2026

## Problem

Agents opening primer windows had no idea how big the content was. They'd guess sizes, clip art, or waste desktop space. Emoji and Unicode meant byte counts were wrong for column widths. Lines starting with `#` (metadata comments for LLMs) inflated line counts even though they're never rendered.

## What we built

### 1. measurePrimer() — C++ content measurement

`app/core/primer_utils.h` — single inline function used everywhere.

```
struct PrimerInfo { size_t lines, width; bool hasFrames, ok; };
PrimerInfo measurePrimer(const std::string& path);
```

Key details:
- Uses tvision's `strwidth()` for display column width, NOT `line.size()` (byte count). This handles emoji, CJK, combining chars correctly. e.g. synth-faces was 104 bytes wide but only 49 display columns.
- Skips lines starting with `#` — these are metadata/comments for LLMs, never rendered by the frame player. Without this, monster-emoji measured 170 lines instead of 135.
- Detects `---`/`===` frame delimiters to flag animated primers.
- Returns max display width across all lines and total rendered line count.

### 2. gallery_list command — enriched return

`app/command_registry.cpp` — the `gallery_list` command now returns objects instead of bare filenames:

```json
[
  {"name": "folk-punk", "lines": 27, "width": 59, "recommended_w": 61, "recommended_h": 29, "animated": false},
  {"name": "synth-faces", "lines": 16, "width": 49, "recommended_w": 51, "recommended_h": 18, "animated": false}
]
```

- `recommended_w` = content width + 2 (frame border chrome)
- `recommended_h` = content lines + 2 (frame border chrome)
- `animated` = true if file contains `---`/`===` frame delimiters
- Agents use recommended_w/h directly as window size — no guessing.
- Supports tab param for paginated browsing (1-6) and search via tab=6 + search param.

### 3. primer_info command — pre-open sizing

For when you want dimensions of a specific file without opening it:

```
primer_info path=folk-punk
→ {"content_lines": 27, "content_width": 59, "has_frames": false, "file_size": 1847, "path": "/full/path/to/folk-punk.txt"}
```

Accepts bare name (resolved from primer dir) or full path.

### 4. frame_player state props — live content dimensions

Open frame_player windows now report dimensions in their state props:

```json
{"content_lines": 27, "content_width": 59, "frame_count": 1, "path": "...", "animated": false}
```

Agents can read these from `get_state` to understand existing windows.

### 5. Desktop state hook — Claude Code agent awareness

`.claude/hooks/desktop-state.sh` — fires on every `UserPromptSubmit` in Claude Code sessions. Injects compact desktop state:

```
[WibWob-DOS Desktop 200x53 | light/monochrome | 3 windows]
  format: z-order: type "name" (x,y) WxH
  z0: frame_player "folk-punk-ai.txt" (1,1) 61x29 content:27x59
  z1: wibwob "Wib&Wob Chat" (100,5) 60x30
  z2: scramble "Scramble" (0,40) 20x8
```

Includes content dimensions for frame_player windows and animated flag. Agent sees desktop size, all window positions, and content sizes without calling any tools.

### 6. Primer sizing workflow — prompt instructions

Both `.pi/APPEND_SYSTEM.md` and `modules-private/wibwob-prompts/wibandwob.prompt.md` include:

1. Call `gallery_list` — get dimensions per primer
2. Pick primers, use `recommended_w` / `recommended_h` as window size
3. NEVER shrink to fit more in — pick fewer primers instead
4. Open with `open_primer` passing path, x, y, w, h
5. For single file pre-check: `primer_info` with path param

## Key files

| File | What |
|------|------|
| `app/core/primer_utils.h` | measurePrimer() — strwidth, # skipping |
| `app/command_registry.cpp` | gallery_list enriched, primer_info command |
| `app/frame_file_player_view.cpp` | content_lines/width/frame_count in state props |
| `.claude/hooks/desktop-state.sh` | Auto-inject state per Claude Code turn |
| `.claude/settings.json` | Hook wired as UserPromptSubmit |
| `.pi/APPEND_SYSTEM.md` | Sizing workflow for pi agent |
| `modules-private/wibwob-prompts/wibandwob.prompt.md` | Sizing workflow for Wib&Wob |

## Not yet done

- Desktop state injection for Wib&Wob in-app chat (needs C++ SDK bridge change, spec at `.planning/sparks/agent-state-injection.md`)
- Pi agent must query state manually — no hook equivalent yet
- Some emoji sequences still measure differently between strwidth and tvision's renderer (edge case)
