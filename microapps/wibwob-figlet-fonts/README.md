# wibwob-figlet-fonts

Categorised FIGlet font catalogue for WibWob-DOS ASCII art typography.

## What's in here

**`fonts.json`** — a structured catalogue of 148 FIGlet fonts with:

- **7 categories** (5 by size, 2 by style — fonts can appear in multiple)
- **20 favourites** for quick-access menus
- **Per-font metadata** (rendered height and width for the glyph pair `Ag`)

## Categories

| ID | Name | Fonts | Height | Use case |
|----|------|------:|--------|----------|
| `compact` | Compact | 15 | 1–3 lines | Tight layouts, status bars |
| `small` | Small | 36 | 4–5 lines | Readable at small sizes |
| `standard` | Standard | 30 | 6 lines | Classic FIGlet — `standard`, `slant`, `doom` |
| `large` | Large | 44 | 7–8 lines | Headers, titles, bold presence |
| `huge` | Huge | 24 | 9+ lines | Maximum impact, needs big windows |
| `data` | Data / Code | 6 | varies | Counters, clocks, dashboards |
| `decorative` | Decorative | 25 | varies | Artistic flair over readability |

Size categories are mutually exclusive (every font is in exactly one).
Style categories (`data`, `decorative`) overlap with size categories by design.

## Favourites

The `favourites` array is a curated shortlist of 20 fonts for right-click menus
and other quick-access surfaces where showing all 148 would be unwieldy:

```
standard, big, banner, block, doom, slant, shadow, small, mini, digital,
graffiti, gothic, script, lean, speed, starwars, larry3d, isometric1, thin, bubble
```

## Usage

### From C++ (WibWob-DOS)

The module is discovered at startup via the standard module scan. Any code that
needs font data reads `fonts.json` from the module path:

```cpp
// figlet_utils.h provides the accessor
const FigletFontCatalogue& figlet::catalogue();

// Categories for submenu building
for (auto& cat : catalogue.categories) {
    // cat.id, cat.name, cat.fonts[]
}

// Favourites for quick-pick menu
for (auto& font : catalogue.favourites) {
    // ...
}

// Per-font metadata for layout decisions
auto& meta = catalogue.font_metadata["doom"];
// meta.height == 8, meta.width == 13
```

### From Python (FastAPI / MCP)

```python
import json
from pathlib import Path

catalogue = json.loads(
    (Path("microapps/wibwob-figlet-fonts/fonts.json")).read_text()
)
for cat in catalogue["categories"]:
    print(f"{cat['name']}: {len(cat['fonts'])} fonts")
```

### From IPC

```
cmd:exec_command name=figlet_list_fonts
```

Returns all available fonts. The catalogue adds category structure on top.

## How the data was generated

Font heights and widths were measured by rendering `Ag` through `pyfiglet`
(Python FIGlet library) for all 148 fonts from the
[monodraw-maker](https://github.com/user/monodraw-maker) curated set.
Categories were assigned by height range with manual curation for the
style-based groups (data, decorative).

## Consumers

This catalogue is designed to be consumed by multiple surfaces:

| Surface | What it uses |
|---------|-------------|
| Right-click font picker | `favourites` (quick menu) + `categories` (submenus) |
| Edit → Font menu | `categories` (submenus) + "More Fonts..." (full list) |
| `TListBox` font browser | `font_metadata` (height/width for preview sizing) |
| Paint tool text mode | `favourites` or `compact` category |
| IPC `figlet_list_fonts` | All fonts from `font_metadata` keys |
| Future web UI | Full `fonts.json` served as JSON endpoint |

---

<code-style-background>

## Design Pattern: Data Module as Shared Catalogue

This module follows a pattern inspired by [pi's extension architecture](https://github.com/badlogic/pi-mono):

**Separation of data from UI.** The font catalogue is a plain JSON file in a
module directory — not embedded in C++ code, not coupled to any specific menu
or view. Multiple consumers read the same data through a single accessor.

### Pi parallels

| Pi concept | WibWob-DOS equivalent |
|-----------|----------------------|
| Extension registers tools/data | Module provides `fonts.json` |
| Multiple events consume registered tools | Multiple UI surfaces read the catalogue |
| `pi.registerTool()` makes data available to any handler | `figlet::catalogue()` makes data available to any view |
| Extension directory auto-discovery | Module directory auto-scan at startup |
| `package.json` declares capabilities | `microapp.json` declares `provides` |

### Why this matters

1. **DRY** — One source of truth for font categories. Adding a font or changing
   a category updates every menu, dialog, and API response automatically.

2. **Loose coupling** — The right-click menu, Edit menu, TListBox dialog, and
   IPC endpoint don't know about each other. They all just read `fonts.json`.

3. **Extensibility** — A new module (or a private override in `microapps-private/`)
   can provide a different `fonts.json` with custom categories, additional fonts,
   or project-specific favourites. No C++ recompilation needed.

4. **Portability** — The same JSON file works for C++ (parsed at startup),
   Python (FastAPI endpoint), JavaScript (future web client), or any other
   consumer. The data format is the contract.

### Pattern summary

```
microapps/wibwob-figlet-fonts/
├── microapp.json          ← declares "I provide fonts data"
├── fonts.json           ← the shared catalogue (categories, metadata, favourites)
└── README.md            ← documents the contract

app/figlet_utils.h       ← C++ accessor: figlet::catalogue()
                            loads fonts.json once, returns structured data
                            consumed by: menus, dialogs, IPC handlers, views
```

The module is the **single source of truth**. The accessor is a **thin adapter**.
The UI surfaces are **independent consumers**. This is the same shape as pi's
`registerTool()` → event handlers pattern, adapted for a compiled TUI app with
a JSON data layer.

</code-style-background>
