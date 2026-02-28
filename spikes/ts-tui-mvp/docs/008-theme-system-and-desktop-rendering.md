# 008 — Theme System & Desktop Rendering

Developer handover for theming, desktop backgrounds, chrome, and gallery mode.
Written against the C++ codebase as of Feb 28 2026, with notes on the existing
TS spike and recommendations for the rebuild.

---

## 1. Theme modes and variants

### Data model (C++)

```
ThemeMode   { Light, Dark }
ThemeVariant{ Monochrome, DarkPastel }
```

**Source:** `app/theme_manager.h`, `app/theme_manager.cpp`

`ThemeManager` is a pure-functional static class — no mutable state. You call
`getColor(role, mode, variant)` and get back a `TColorAttr`. Current mode and
variant are stored externally (the app keeps them, the command API toggles them).

### Semantic roles

Nine `ThemeRole` values define the colour vocabulary:

| Role                | Monochrome        | DarkPastel             |
|---------------------|-------------------|------------------------|
| `Background`        | 0x07 (grey/black) | `#d0d0d0` on `#000000` |
| `Foreground`        | 0x07              | `#d0d0d0` on `#000000` |
| `ForegroundSecondary`| 0x08 (dark grey) | `#cfcfcf` on `#000000` |
| `AccentPrimary`     | 0x0F (bright white)| `#57c7ff` on `#000000` |
| `AccentSecondary`   | 0x0E (yellow)     | `#f07f8f` on `#000000` |
| `AccentTertiary`    | 0x0A (lt green)   | `#b7ff3c` on `#000000` |
| `Frame`             | 0x07              | `#cfcfcf` on `#000000` |
| `Selection`         | 0x70 (inverse)    | `#000000` on `#57c7ff` |
| `Warning`           | 0x0C (lt red)     | `#f07f8f` on `#000000` |

### Commands

| Command              | Params   | Notes |
|----------------------|----------|-------|
| `set_theme_mode`     | `mode`   | `"light"` or `"dark"` |
| `set_theme_variant`  | `variant`| `"monochrome"` or `"dark_pastel"` |

**Important caveat:** in `wwdos_app.cpp`, the `api_set_theme_mode` and
`api_set_theme_variant` functions currently validate the string but do nothing
with it (`(void)app`). The theme mode/variant isn't wired into runtime palette
switching yet — it was scaffolded for future use. The palette is permanently
monochrome (`cpMonochrome`):

```cpp
TPalette& TWwdosApp::getPalette() const {
    static TPalette palette(cpMonochrome, sizeof(cpMonochrome)-1);
    return palette;
}
```

The DarkPastel colours are consumed by individual views that explicitly call
`ThemeManager::getColor()`, not via the global palette chain.

---

## 2. TColorAttr / TColorRGB — Turbo Vision's colour model

Turbo Vision supports **two colour modes** in the same API:

### Classic 4-bit (CGA/EGA)

```cpp
TColorAttr(0x07)    // single byte: high nibble = bg, low = fg
TColorAttr(fg, bg)  // uchar fg, uchar bg — values 0-15
```

The 16 CGA colours map to the standard VGA text-mode palette:
0=black, 1=blue, 2=green, 3=cyan, 4=red, 5=magenta, 6=brown, 7=lightgrey,
8=darkgrey, 9=ltblue, 10=ltgreen, 11=ltcyan, 12=ltred, 13=ltmagenta,
14=yellow, 15=white.

### True-colour RGB

```cpp
TColorRGB(0xFF, 0x00, 0x00)  // red
TColorAttr(TColorRGB(fg), TColorRGB(bg))  // fg+bg as 24-bit RGB
```

The `hexToRGB(uint32_t)` helper converts `0xRRGGBB` packed hex.

### How it propagates

Turbo Vision's palette system is a chain: each view has a `TPalette` that maps
abstract **palette indices** (1-based) to concrete `TColorAttr` values. During
`draw()`, a view calls `getColor(index)` which walks up the owner chain,
remapping at each level.

Custom views bypass this by overriding `mapColor(uchar index)`:

```cpp
// TCustomMenuBar::mapColor — forces true black-on-white for menu items
case 1: case 3: case 4: case 6:
    return TColorAttr(TColorRGB(0,0,0), TColorRGB(255,255,255));
```

Similarly `TCustomStatusLine::mapColor` forces the status bar to
true-black-on-white for all indices.

### TS rebuild implication

In a terminal environment (blessed/ink/raw ANSI) you have:
- 16 named colours (ANSI 0-15)
- 256-colour mode (ESC[38;5;Nm)
- True-colour (ESC[38;2;R;G;Bm)

The palette-chain concept doesn't exist natively. You need a **theme token
resolver** instead (see §9).

---

## 3. Desktop background: patterns, textures, fill characters, colour pairs

### TWibWobBackground

**Source:** `app/wibwob_background.h`, `app/wibwob_background.cpp`

Extends Turbo Vision's `TBackground`. The desktop fill is defined by three
properties:

| Property    | Type       | Description |
|-------------|------------|-------------|
| `pattern`   | `char`     | The fill character (e.g. `░` `▒` `▓` ` `) |
| `fgColor`   | `uchar`    | Foreground 0-15 CGA index |
| `bgColor`   | `uchar`    | Background 0-15 CGA index |
| `useRgb_`   | `bool`     | If true, use `rgbFg_`/`rgbBg_` instead of CGA indices |
| `rgbFg_`    | `uint32_t` | 0xRRGGBB foreground |
| `rgbBg_`    | `uint32_t` | 0xRRGGBB background |

The `draw()` override fills every row with the same character+colour:

```cpp
void TWibWobBackground::draw() {
    TDrawBuffer b;
    TColorAttr color;
    if (useRgb_) {
        color = TColorAttr(TColorRGB(rgbFg_), TColorRGB(rgbBg_));
    } else {
        color = TColorAttr(fgColor, bgColor);
    }
    b.moveChar(0, pattern, color, size.x);
    writeLine(0, 0, size.x, size.y, b);
}
```

### Context menu

Right-clicking the desktop (`evMouseDown` with button 2) opens a popup menu
with:
- **Preset ▶** — submenu listing all named presets
- **Gallery Mode** — toggles gallery mode (see §6)

The popup is built dynamically from `getDesktopPresets()` and uses command IDs
`cmDeskPresetBase + i` for each preset.

---

## 4. Desktop presets (named combinations)

Nine built-in presets defined in `wibwob_background.h`:

| Name           | Char | FG  | BG  | RGB?  | RGB FG     | RGB BG     | Notes |
|----------------|------|-----|-----|-------|------------|------------|-------|
| `default`      | `▒`  | 7   | 1   | no    | —          | —          | Classic TV: light grey on blue |
| `jet_black`    | ` `  | 0   | 0   | yes   | `#000000`  | `#000000`  | True black |
| `dark_grey`    | ` `  | 8   | 0   | yes   | `#555555`  | `#333333`  | Subtle dark |
| `terminal`     | `░`  | 8   | 0   | yes   | `#555555`  | `#000000`  | CRT effect |
| `cga_cyan`     | `▒`  | 15  | 3   | yes   | `#FFFFFF`  | `#00AAAA`  | Retro cyan |
| `cga_green`    | `░`  | 10  | 0   | yes   | `#55FF55`  | `#000000`  | Green monitor |
| `noise`        | `%`  | 8   | 0   | yes   | `#555555`  | `#000000`  | Grungy texture |
| `white_paper`  | ` `  | 15  | 15  | yes   | `#FFFFFF`  | `#FFFFFF`  | Clean white |
| `gallery_wall` | ` `  | 0   | 0   | yes   | `#000000`  | `#000000`  | Exhibition mode |

### Commands

| Command            | Params        | Notes |
|--------------------|---------------|-------|
| `desktop_preset`   | `preset`      | Set by name; validates against preset list |
| `desktop_texture`  | `char`        | Single character — first byte of string |
| `desktop_color`    | `fg`, `bg`    | CGA 0-15 range; disables RGB mode |
| `desktop_get`      | (none)        | Returns JSON: `{char, fg, bg, gallery, preset}` |
| `desktop_gallery`  | `on`          | `true`/`false` — see §6 |

### Workspace serialization

Desktop state is persisted inside workspace save files:

```json
{
  "desktop": {
    "preset": "terminal",
    "char": "░",
    "fg": 8,
    "bg": 0,
    "gallery": false
  }
}
```

On load, preset is tried first; if absent, individual `char`/`fg`/`bg` fields
are restored. Gallery mode is restored last.

---

## 5. Status bar and menu bar chrome rendering

### TCustomMenuBar

**Source:** `wwdos_app.cpp` (inline class ~lines 430-540)

- Overrides `mapColor()` to force **true black-on-white** (`TColorRGB(0,0,0)`
  on `TColorRGB(255,255,255)`) for palette indices 1, 3, 4, 6.
- Other indices fall through to default `TMenuBar::mapColor`.
- Draws a **kaomoji mascot** in the right corner of the menu bar: `つ◕‿◕‿◕༽つ`
- Kaomoji has mood states (NEUTRAL, EXCITED, THINKING, SLEEPY, CURIOUS, MEMORY,
  GEOMETRIC, SURPRISED) and a blink animation (3-6 second random interval,
  150ms blink duration).
- Mood is set via `setMood(mood, durationMs)` and auto-reverts to NEUTRAL.

### TCustomStatusLine

**Source:** `wwdos_app.cpp` (inline class ~lines 540-560+)

- Overrides `mapColor()` to force true black-on-white for indices 1-4.
- Draws **LLM indicator** and **API indicator** after the standard status items.
- LLM indicator shows auth mode: "LLM AUTH" / "LLM KEY" / "LLM OFF" with
  colour-coded dot.
- API indicator shows health check status.

### Key rendering detail

Both chrome views use `TDrawBuffer` + `writeBuf()` for overlay content
(kaomoji, indicators). They call the parent `draw()` first, then paint
their custom bits on top.

---

## 6. Gallery mode: hide chrome for exhibition-style display

Gallery mode removes the menu bar and status line, giving the desktop and its
windows the full terminal area — useful for displaying ASCII art galleries
without UI clutter.

### Implementation

```cpp
std::string api_desktop_gallery(TWwdosApp& app, bool on) {
    app.galleryMode_ = on;
    app.menuBar->setState(sfVisible, !on);      // hide menu bar
    app.statusLine->setState(sfVisible, !on);    // hide status line

    TRect r = app.getExtent();
    if (!on) {
        r.a.y = 1;   // row 1 (menu bar takes row 0)
        r.b.y--;      // status line takes last row
    }
    // else: full extent — row 0 to bottom
    app.deskTop->changeBounds(r);
    app.deskTop->drawView();
    return "ok";
}
```

### What changes

| Aspect        | Normal          | Gallery         |
|---------------|-----------------|-----------------|
| Menu bar      | visible (row 0) | hidden          |
| Status line   | visible (last)  | hidden          |
| Desktop top   | row 1           | row 0           |
| Desktop bottom| row (h-2)       | row (h-1)       |
| `galleryMode_`| `false`         | `true`          |

Gallery mode is persisted in workspace state and the `desktop_get` JSON.

### Trigger points
- Right-click desktop → "Gallery Mode"
- `desktop_gallery` command with `on: true/false`
- `cmDeskGallery` command event broadcast

---

## 7. How themes propagate to window interiors (palette system)

### Turbo Vision palette chain

In TV, colour resolution works bottom-up through the view hierarchy:

```
TApplication → TDeskTop → TWindow → TView
 cpAppColor     (maps)    cpBlueWindow  (maps to concrete attrs)
```

Each view has a `TPalette` — an array of bytes. When a view calls
`getColor(index)`, the index is looked up in the view's palette to get a
*parent index*, which is then looked up in the parent's palette, continuing
up to the application. The application palette contains the concrete
`TColorAttr` values.

**WibWob-DOS bypasses this** in two ways:

1. **Global palette is monochrome:** `getPalette()` returns `cpMonochrome`,
   meaning all standard TV views get monochrome colours.

2. **Custom views use direct colours:** Views that need themed colours call
   `ThemeManager::getColor()` directly or override `mapColor()` to inject
   `TColorRGB` values, skipping the palette chain entirely.

This means the palette chain is vestigial — colours are either:
- Monochrome defaults (standard TV views)
- Hardcoded RGB (custom menu bar, status line)
- Theme-role-driven (via `ThemeManager::getColor()`)

### Window frames and interior colours

Standard `TWindow` subclasses get their frame colours from the palette chain
(monochrome). Custom drawing inside windows (gradients, paint canvas, ASCII
art viewers) does its own colour work independently.

---

## 8. The existing TS spike's approach to theming

**Source:** `spikes/ts-tui-mvp/src/core/app-controller.ts`

The TS spike uses **blessed** with inline `style` objects. There is no theme
system — colours are hardcoded per widget:

```typescript
this.menuBar = blessed.box({
  style: { fg: "black", bg: "white" }
});
this.desktop = blessed.box({
  style: { fg: "blue", bg: "blue" }
});
this.statusLine = blessed.box({
  style: { fg: "black", bg: "white" }
});
```

Window factories scatter more inline styles:

```typescript
style: { fg: "white", bg: "black" }           // default window
style: { fg: "black", bg: "cyan" }            // dialog headers
style: { fg: "white", bg: "blue" }            // buttons
style: { fg: "white", bg: "black",
         selected: { fg: "black", bg: "white" } }  // lists
```

### What exists
- Named colour strings (blessed's 16-colour names)
- No theme switching capability
- No desktop presets or texture system
- No gallery mode
- `BackroomsChannel` has a `theme` field, but that's the *backrooms session
  theme* (narrative prompt), not a UI theme

### What's missing for parity
- Theme mode/variant switching
- Semantic colour roles
- Desktop background patterns and presets
- RGB/true-colour support
- Chrome visibility toggle (gallery mode)
- Kaomoji mascot rendering
- LLM/API status indicators in status line
- Workspace-persisted desktop state

---

## 9. Recommendations for the TS rebuild

### 9.1 CSS-like theme tokens (recommended)

Replace the TV palette chain with a **flat token map** — essentially CSS
custom properties for the terminal:

```typescript
interface ThemeTokens {
  // Desktop
  desktopFg: Color;
  desktopBg: Color;
  desktopFillChar: string;

  // Chrome
  menuBarFg: Color;
  menuBarBg: Color;
  statusLineFg: Color;
  statusLineBg: Color;

  // Semantic roles (map 1:1 from ThemeRole)
  background: Color;
  foreground: Color;
  foregroundSecondary: Color;
  accentPrimary: Color;
  accentSecondary: Color;
  accentTertiary: Color;
  frame: Color;
  selection: Color;
  selectionText: Color;
  warning: Color;

  // Window chrome
  windowFrameActive: Color;
  windowFrameInactive: Color;
  windowTitleFg: Color;
  windowTitleBg: Color;
}

type Color = string; // "#RRGGBB" | "ansi:N" | named
```

### 9.2 Theme resolver

```typescript
interface Theme {
  name: string;
  mode: "light" | "dark";
  variant: string;
  tokens: ThemeTokens;
}

const THEMES: Record<string, Theme> = {
  monochrome: { ... },
  dark_pastel: { ... },
};

function resolveColor(color: Color): string {
  if (color.startsWith("#")) return `\x1b[38;2;${r};${g};${b}m`;
  if (color.startsWith("ansi:")) return `\x1b[38;5;${n}m`;
  return blessedNameToAnsi(color);
}
```

### 9.3 Desktop presets — port directly

The preset table is pure data. Port it as-is:

```typescript
interface DesktopPreset {
  name: string;
  fillChar: string;
  fg: Color;
  bg: Color;
}

const DESKTOP_PRESETS: DesktopPreset[] = [
  { name: "default",      fillChar: "▒", fg: "ansi:7",  bg: "ansi:1" },
  { name: "jet_black",    fillChar: " ", fg: "#000000",  bg: "#000000" },
  { name: "terminal",     fillChar: "░", fg: "#555555",  bg: "#000000" },
  { name: "cga_cyan",     fillChar: "▒", fg: "#FFFFFF",  bg: "#00AAAA" },
  { name: "cga_green",    fillChar: "░", fg: "#55FF55",  bg: "#000000" },
  { name: "noise",        fillChar: "%", fg: "#555555",  bg: "#000000" },
  { name: "white_paper",  fillChar: " ", fg: "#FFFFFF",  bg: "#FFFFFF" },
  { name: "gallery_wall", fillChar: " ", fg: "#000000",  bg: "#000000" },
  // dark_grey omitted for brevity
];
```

### 9.4 Gallery mode — straightforward

Gallery mode is just:
1. Hide menuBar and statusLine elements
2. Expand desktop region to fill terminal
3. Set a boolean flag for state serialization

In blessed/ink, this is toggling `element.hide()` / `element.show()` and
resizing the desktop box.

### 9.5 Gradient views — use half-block trick

The C++ gradient views use full-block `█` (0xDB) with fg=bg=interpolated
colour, effectively a solid colour per cell. In a terminal TS environment,
the same technique works: set both fg and bg to the gradient colour and write
`█`, or use the **half-block trick** (`▀` U+2580) where fg=top colour,
bg=bottom colour to get 2× vertical resolution.

### 9.6 Palette chain → token lookup (migration path)

| TV concept              | TS equivalent                      |
|-------------------------|------------------------------------|
| `TPalette` chain        | `theme.tokens[key]` lookup         |
| `getColor(index)`       | `theme.resolve(tokenName)`         |
| `mapColor()` override   | Component-level token overrides    |
| `cpMonochrome` / `cpColor` | Theme variant selection          |
| `TColorAttr(fg, bg)`    | `{ fg: Color, bg: Color }` pair    |
| `TColorRGB(r,g,b)`      | `"#RRGGBB"` string                 |

### 9.7 Kaomoji mascot

The kaomoji system is self-contained: mood enum, blink timer, draw overlay.
Port as a standalone component that renders into the rightmost cells of the
menu bar. The blink timer (3-6s random, 150ms duration) drives a
`setInterval` / `requestAnimationFrame` equivalent.

### 9.8 Status indicators

The LLM and API health indicators render as coloured dots + labels in the
status line's right side. In TS, these become components within the status
bar layout that poll or subscribe to service health state.

---

## 10. Key source files reference

| File | What it owns |
|------|-------------|
| `app/theme_manager.h` | `ThemeMode`, `ThemeVariant`, `ThemeRole` enums |
| `app/theme_manager.cpp` | `getColor()` — role→colour lookup |
| `app/wibwob_background.h` | `DesktopPreset` struct, preset table, `TWibWobBackground` class |
| `app/wibwob_background.cpp` | Desktop fill rendering, right-click menu, preset application |
| `app/gradient.h` / `.cpp` | `TGradientView` hierarchy (horizontal, vertical, radial, diagonal) |
| `app/wwdos_app.cpp:430-560` | `TCustomMenuBar` (kaomoji, mapColor), `TCustomStatusLine` |
| `app/wwdos_app.cpp:2605` | `getPalette()` — monochrome palette |
| `app/wwdos_app.cpp:5302-5400` | `api_set_theme_*`, `api_desktop_*`, `api_desktop_gallery` |
| `app/command_registry.cpp:153-222` | Command registration for theme and desktop commands |

---

## 11. Risks and open questions

1. **Theme mode/variant is a stub.** The C++ `set_theme_mode` / `set_theme_variant`
   APIs accept values but don't change any rendering. The TS rebuild should
   implement this properly from day one with the token system.

2. **Palette chain is vestigial.** No standard TV views actually benefit from
   palette-chain resolution in WibWob-DOS; everything uses hardcoded colours
   or `mapColor` overrides. The TS rebuild should not attempt to replicate the
   palette chain — use tokens instead.

3. **CGA vs RGB duality.** Desktop presets carry both CGA indices and RGB
   values with a `useRgb` flag. In TS, normalise everything to `#RRGGBB`
   strings; map CGA indices to their canonical RGB equivalents at load time.

4. **Terminal colour capability detection.** Not all terminals support
   true-colour. The theme system should detect `COLORTERM=truecolor` and
   fall back to 256-colour or 16-colour approximation. Libraries like
   `chalk` or `ansi-styles` handle this.

5. **Desktop fill performance.** Filling the entire desktop with a repeated
   character on every redraw is fine in TV's direct buffer model. In a
   terminal with ANSI escape sequences, avoid re-emitting the full desktop
   on every frame — only redraw on resize or preset change.

6. **Gallery mode z-order.** When chrome is hidden, keyboard shortcuts that
   normally open menus (Alt+F, etc.) need to be suppressed or redirected.
   The C++ version handles this implicitly because the menu bar view is
   hidden. In blessed, hidden elements still capture events unless explicitly
   disabled.
