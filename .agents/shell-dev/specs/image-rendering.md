# Image Rendering in Blessed

## Overview

Images in WibWob-DOS are rendered as coloured block characters via
[chafa](https://hpjansson.org/chafa/). Chafa converts raster images
(JPEG, PNG, GIF, WebP) to Unicode block art with ANSI colour codes.

## Constraints — blessed colour support

Blessed (the TUI framework) has limited ANSI colour fidelity:

| Mode | Flag | Blessed rendering |
|------|------|-------------------|
| 24-bit truecolor | `-c full` | BROKEN — colours quantised badly, desaturated |
| 256-colour | `-c 256` | WORKS — correct colour mapping |
| 16-colour | `-c 16` | BROKEN — wrong palette mapping |
| Named tags | `{red-fg}` | WORKS perfectly |
| Hex tags | `{#rrggbb-fg}` | BROKEN — same as 24-bit, bad quantisation |

**Always use `-c 256` with chafa.** This was proven via the ANSI Lab
test suite (`microapps/demo-ansi-lab/`).

## Chafa flags

Required flags for blessed compatibility:

```
chafa -f symbols -c 256 -s WxH --symbols block <file>
```

- `-f symbols` — force Unicode symbol output (not sixel/kitty/iterm)
- `-c 256` — 256-colour palette (blessed-compatible)
- `-s WxH` — output size in columns × rows
- `--symbols block` — half-block characters (▀▄█) for best visibility

**Do not use:**
- `-c full` (24-bit truecolor) — blessed renders wrong colours
- `--symbols braille` — nearly invisible without colour at terminal scale
- `--color-space rgb` — unnecessary with 256-colour mode
- No `-f` flag — chafa may auto-detect sixel and output graphics protocol

## Symbol modes

| Mode | Characters | Visibility | Detail |
|------|-----------|------------|--------|
| `block` | ▀▄█▌▐▍▎ | HIGH — works without colour | Medium |
| `braille` | ⠀⠁⠂...⣿ | LOW — dots nearly invisible | High |

Default is `block`. Configurable via `imageSymbols` property on
`ChromeBrowserService`.

## Pipeline — browser image rendering

```
Navigate → Readability → Turndown → renderMarkdown → hydrate → splice
```

1. **Turndown** emits `![alt](url)` for each `<img>` tag
2. **renderMarkdown** converts `![alt](url)` to plain `alt` text (placeholder)
3. **Hydrator subprocess** (`image-hydrator.mjs`) runs under Node (not Bun):
   - Reads markdown on stdin
   - For each `![alt](url)`: curl → file check → sips dimensions → chafa
   - Outputs markdown with chafa ANSI replacing image syntax
4. **Splice** finds alt-text placeholder lines in rendered content,
   replaces with raw chafa ANSI output
5. **Cache** stores chafa blocks keyed by alt text — survives resize/rerender

### Why a subprocess?

Blessed's event loop is single-threaded. Spawning curl + chafa processes
from the main thread (even async) caused the TUI to hang. The subprocess
isolates all image I/O from blessed entirely.

### Why splice instead of re-render?

`renderMarkdown()` runs `wrapTextWithAnsi()` on every line. Chafa output
is 30-40KB of dense ANSI per image. Processing that through the wrapper
blocks the event loop for 15+ seconds. Splicing bypasses the markdown
renderer entirely for image content.

## Size and filtering

- **Min dimensions**: 150×150 pixels — skip icons, spacers, tracking pixels
- **Max images per page**: no cap — all images rendered
- **Max columns**: 60 — fits comfortably in browser window
- **Aspect ratio**: terminal chars are ~2:1, so rows = cols × aspect / 2
- **Timeout**: 3s per curl, 5s per chafa, 30s total for hydrator subprocess

## Files

| File | Role |
|------|------|
| `src/services/image-hydrator.mjs` | Standalone Node subprocess — curl+chafa per image |
| `src/services/chrome-browser-service.ts` | `renderImagesAsAscii()` spawns hydrator, `imageToAscii()` fallback |
| `src/windows/chrome-browser-window.ts` | `postProcessImages()` async hydration, `spliceImages()` cache-aware splice |
| `microapps/demo-ansi-lab/` | 10-test colour rendering diagnostic module |

## Agent Notes

| Date | Finding |
|------|---------|
| 2026-03-11 | blessed `{#hex-fg}` tags produce wrong colours — same quantisation bug as 24-bit ANSI |
| 2026-03-11 | chafa auto-detects sixel on macOS Terminal/tmux — must force `-f symbols` |
| 2026-03-11 | figlet cache in markdown-service prevents spawnSync overhead on re-render after hydration |
| 2026-03-11 | Resize destroys spliced images — fixed with cachedChafaBlocks persistent cache |
