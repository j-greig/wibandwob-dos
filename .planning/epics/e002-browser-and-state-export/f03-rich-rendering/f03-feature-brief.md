# F03: Rich Rendering (Figlet Headings + ANSI Images)

## Parent

- Epic: `e002-browser-and-state-export`
- Epic brief: `.planning/epics/e002-browser-and-state-export/e002-epic-brief.md`

## Objective

Render markdown headings as figlet ASCII art at 3 size tiers and convert web images to ANSI pixel art via chafa, with 4 display modes and a companion gallery window.

## Stories

- [x] `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/s08-figlet-headings/s08-story-brief.md` — figlet heading renderer with 3-tier font mapping and toggle modes (#21)
- [x] `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/s09-ansi-images/s09-story-brief.md` — chafa image pipeline, 4 image modes, lazy rendering, ANSI cache (#21)
- [x] `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/s10-gallery-window/s10-story-brief.md` — companion gallery TView, scroll sync, image focus (#21)

## Figlet Heading Design

### Font Mapping

| Level | Font | Height | Sample |
|-------|------|--------|--------|
| H1 | `big` | ~6 lines | Bold, readable, not absurdly wide |
| H2 | `standard` | ~6 lines | Classic figlet, slightly narrower glyphs |
| H3-5 | `small` | ~5 lines | Compact, clear step down |

### Toggle Modes (cycle with `h`)

| Mode | Behavior |
|------|----------|
| `plain` | No figlet, headings as bold/underlined text |
| `figlet_h1` | Only H1 rendered as figlet |
| `figlet_h1_h2` | H1 and H2 as figlet |
| `figlet_all` | H1, H2, and H3-5 as figlet |

### Rendering

- Python sidecar calls `pyfiglet` (or shells out to `figlet` CLI)
- Figlet output is plain text block, embedded at heading position in tui_text
- Width-aware: if heading text × font width > terminal width, fall back to smaller font or plain

## ANSI Image Design

### Image Modes (cycle with `i`, gallery toggle with `G`)

| Mode | Behavior |
|------|----------|
| `none` | No images |
| `key-inline` (default) | Hero image + first N per section, inline in text flow |
| `all-inline` | All images inline |
| `gallery` | Companion window, main browser stays text-only |

### chafa Pipeline

1. Python sidecar downloads image from URL
2. Calls `chafa --size WxH --format symbols` to convert to ANSI art
3. Returns ANSI text block in RenderBundle assets array
4. C++ embeds ANSI block at placement position in content

### Key Image Selection (`key-inline` mode)

- Hero: `<meta property="og:image">` or first `<img>` in article
- Section images: first `<img>` after each `<h2>` or `<h3>`
- Configurable max count (default: 5)

### Lazy Rendering

- Images only converted when within N lines of viewport
- Placeholder shown until rendered: `[image: alt text] (loading...)`
- Cache rendered ANSI blocks by `(url, width, image_mode)`

### Gallery Window

- Separate TView (companion to BrowserWindow)
- Shows all page images as vertically stacked ANSI blocks
- Scroll sync: gallery highlights image nearest browser scroll position
- Selecting image in gallery jumps browser to image anchor
- `Enter` on inline image opens/focuses gallery at that image

## Acceptance Criteria

- [x] **AC-1:** H1 headings render as figlet `big` font, H2 as `standard`, H3-5 as `small`
  - Test: render markdown with H1/H2/H3, assert output contains figlet-characteristic line patterns
- [x] **AC-2:** Heading toggle cycles through 4 modes and re-renders content
  - Test: toggle mode, assert rendered output changes between plain and figlet
- [x] **AC-3:** `key-inline` mode shows hero + section images as ANSI blocks inline
  - Test: render page with images, assert ANSI blocks present at correct positions
- [x] **AC-4:** Images render lazily (only near viewport)
  - Test: render long page with 10 images, assert only viewport-adjacent images are converted
- [x] **AC-5:** Gallery window syncs with browser scroll position
  - Test: scroll browser, assert gallery highlight changes; select in gallery, assert browser jumps
- [x] **AC-6:** ANSI image cache prevents re-rendering on scroll
  - Test: scroll past image, scroll back, assert chafa not called twice for same image

## Dependencies

- `chafa` CLI (brew install chafa)
- `pyfiglet` Python package (or system `figlet` CLI — already installed)
- `Pillow` for image download/preprocessing if needed

## Status

Status: `done`
GitHub issue: #21
PR: —
