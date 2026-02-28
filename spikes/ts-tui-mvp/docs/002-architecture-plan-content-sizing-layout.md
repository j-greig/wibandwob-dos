# 002 — Architecture Plan: Content Sizing & Layout

TS rebuild architecture for parcels P1-P7 from overview.md.
Written against the existing spike code as of Feb 28 2026.

## Current state of the spike

The TS spike has a working TUI desktop with 17 window types, drag/resize,
z-order, workspaces, a REST API, and state introspection. Services are
well-factored (backrooms, content, figlet, state, workspace, control-api).

What it does NOT have:
- Content measurement (P1) — zero. Primers open at 72x20 regardless.
- Chrome abstraction (P2) — magic numbers per window factory.
- Cell aspect (P3) — absent entirely.
- Universal content metadata (P4) — describeState() exists but is unstructured.
- Layout engine (P5) — only tile and cascade.
- Resize contracts (P6) — no onResize protocol, no aspect ratios.
- Pre-open sizing (P7) — not implemented at all.

The god class `TsTuiMvpApp` (2435 lines) owns every window factory
method inline. This is the main structural obstacle.

## Architecture: three new core modules

### core/content-measurement.ts

Single source of truth for "how big is this content."

```ts
interface ContentDimensions {
  lines: number       // rendered line count (excluding # comments)
  columns: number     // max display-column width (Unicode-aware)
  hasFrames: boolean  // contains ---- or === frame delimiters
  animated: boolean   // hasFrames with > 1 frame
}

function measureTextFile(path: string): ContentDimensions
function measureFigletOutput(rendered: string): ContentDimensions
function measureTerminalBuffer(cols: number, rows: number): ContentDimensions
function measureContent(source: ContentSource): ContentDimensions
```

Key decisions:
- Display column width via `string-width` npm package (equivalent to strwidth).
- Lines starting with `#` skipped (LLM metadata, never rendered).
- Frame delimiter detection for animated primers.
- One function per content type, one generic dispatcher.
- NO chrome offsets here — measurement is pure content.

### core/window-chrome.ts

Translates content dimensions to window dimensions.

```ts
type ChromeMode = 'standard' | 'frameless' | 'figlet' | 'minimal'

interface ChromeConfig {
  borderW: number   // horizontal border total (standard = 2)
  borderH: number   // vertical border total (standard = 2)
  paddingW: number  // extra horizontal padding (figlet = 4)
  paddingH: number  // extra vertical padding (figlet = 1)
}

const CHROME: Record<ChromeMode, ChromeConfig> = {
  standard:  { borderW: 2, borderH: 2, paddingW: 0, paddingH: 0 },
  frameless: { borderW: 0, borderH: 0, paddingW: 0, paddingH: 0 },
  figlet:    { borderW: 2, borderH: 2, paddingW: 4, paddingH: 1 },
  minimal:   { borderW: 2, borderH: 2, paddingW: 0, paddingH: 0 },
}

function contentToWindowSize(
  content: ContentDimensions,
  chrome: ChromeMode,
): { width: number, height: number }
```

The +2 lives in exactly one place. Forever.

### core/desktop-geometry.ts

Canvas awareness for everything.

```ts
interface DesktopGeometry {
  width: number          // columns
  height: number         // rows
  cellAspect: number     // height:width ratio of a cell (default 2.0)
  usableWidth: number    // minus margins/shadows
  usableHeight: number   // minus status bar/shadows
}

class Desktop {
  static geometry: DesktopGeometry
  static onResize(cb: (g: DesktopGeometry) => void): void
  static measureCellAspect(): number  // try to derive from terminal
}
```

cellAspect starts at 2.0, can be measured or configured.
All layout code reads from Desktop.geometry, never from screen directly.

## Upgrades to existing modules

### types.ts — add ContentMetadata to WindowRecord

```ts
interface ContentMetadata {
  contentWidth: number
  contentHeight: number
  animated?: boolean
  scrollable?: boolean
  interactive?: boolean
}

interface WindowRecord {
  // existing fields...
  contentMetadata?: () => ContentMetadata  // universal contract
}
```

Every window factory sets this. describeState() calls it.
State API always includes content dimensions.

### window-manager.ts — Resizable protocol + layout engine

```ts
interface Resizable {
  onResize(width: number, height: number): void
  aspectRatio?: { w: number, h: number }  // preserved on resize
}
```

Named aspect ratios: 16:9, 4:3, golden (1.618:1), A4, portrait, square.
Resize grip respects aspectRatio if set.

Layout engine:

```ts
type LayoutAlgorithm = (
  desktop: DesktopGeometry,
  pieces: LayoutPiece[],
  options?: LayoutOptions,
) => LayoutResult[]

interface LayoutPiece {
  id: string
  content: ContentDimensions
  chrome: ChromeMode
  minWidth?: number
  minHeight?: number
}

interface LayoutResult {
  id: string
  x: number, y: number, w: number, h: number
}
```

Algorithms are pure functions. Registered in a map.
Gallery and arrange share the same engine — gallery provides
content-measured pieces, arrange provides desktop-proportional ones.

### content-service.ts — add measurement

```ts
// existing: collectPrimerEntries(), collectGalleryEntries()
// ADD:
function getPrimerInfo(name: string): ContentDimensions & { path: string }
function getEnrichedGalleryList(tab?: string): EnrichedPrimer[]

interface EnrichedPrimer {
  name: string
  lines: number
  width: number
  recommended_w: number  // content + chrome
  recommended_h: number
  animated: boolean
}
```

gallery_list returns enriched objects. primer_info returns dimensions.
Same pattern as the C++ commands, but built on the shared measurer.

### control-api.ts — add sizing endpoints

```
GET  /primers/:name/info     → ContentDimensions + recommended size
GET  /primers                → EnrichedPrimer[] (gallery_list equivalent)
POST /layout                 → compute layout without opening windows
POST /layout/apply           → compute + open/move windows
```

Agents measure before they open. Layout is a first-class API.

## Migration path from god class

The `TsTuiMvpApp` monolith should decompose into:

1. **WindowFactoryRegistry** — map of WindowKind to factory function.
   Each factory is a standalone module in `src/windows/`.
   Factory receives `(content, chrome, desktop)` and returns a WindowRecord.

2. **CommandRegistry** — map of command names to handlers.
   Each command is pure function `(args, context) => result`.

3. **AppController** — thin orchestrator that wires factories,
   commands, services, and the window manager.

This decomposition is not blocking for P1-P7 but prevents them
from making the god class worse.

## Priority order

1. **P1 + P2** together — measurement + chrome. Foundation for everything.
2. **P3** — desktop geometry. Required by layout.
3. **P7** — pre-open sizing workflow. Immediate agent value.
4. **P4** — universal contentMetadata on WindowRecord. State enrichment.
5. **P5** — layout engine. Biggest feature surface.
6. **P6** — resize contracts. Quality-of-life, not blocking.

## What NOT to do

- Don't port the 8 gallery layout algorithms yet. Get the engine
  interface right with masonry + poetry, add the rest incrementally.
- Don't try to measure cellAspect from the terminal on day one.
  Start with 2.0, make it configurable, measure later.
- Don't decompose the god class first. Add the three core modules
  alongside it, then gradually move factory methods out.
- Don't duplicate measurement in multiple languages. The TS spike
  should have one measurer. If there's a Python API layer, it calls
  the TS measurer via the control API, not its own implementation.
