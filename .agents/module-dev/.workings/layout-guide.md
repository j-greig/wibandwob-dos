# Layout Primitives Guide

<codexfeedback>
Constructive review from Codex:

What is working:
- The guide has the right top-level teaching shape: mental model, API, responsive section, patterns, lifecycle, then examples.
- The Poetry Clock example is a strong teaching choice because it demonstrates nested flex and `visible()` cleanly.
- The guide correctly rejects compass alignment as SDK vocabulary and correctly frames `LayoutPart` as the composition contract.

Highest-priority fixes:
- The `## Open feedback` section should not stay at the top in its current form. Several items directly contradict the settled E034 handover and will confuse implementers before they reach the actual guide. Either remove it or replace it with a short “resolved decisions” note.
- The guide is internally inconsistent on grid naming. It uses `rows/cols/templateRows/templateColumns` in one section, but the settled future API is `rows/columns/rowSizes/columnSizes`. Pick one vocabulary and use it everywhere.
- The guide is internally inconsistent on `createGrid.set`. Earlier it implies future `LayoutPart` children, but examples still use the old positional signature `grid.set(0, 0, 1, 1, child)`. If the guide is documenting future-state SDK, it should show the future object form consistently.
- The dashboard section does not satisfy its own promise. It says “full example” / “what it WILL look like”, but only rewrites one tab and simplifies the original 12x12 layout into a coarser 4x2 sketch. That weakens the document because the main grid example stops being a faithful port.
- The guide says examples should feel CSS-aligned, but the opening feedback argues for renaming `createStack` to `createColumn`. That is no longer an open question. Leaving that argument in place makes the document read like a design debate instead of a finished guide.

Secondary fixes:
- The breakpoint example omits `xl` even though the canon naming section says `xs/sm/md/lg/xl`. Show all five tiers or explain why the example intentionally uses only four.
- The “Alignment” section currently defines `justify` as horizontal and `align` as vertical without stating axis dependence. In flex and grid, main/cross axis semantics matter. Clarify whether this API is logical-axis based or fixed screen-axis based.
- The “What is NOT in the SDK” section states “flex-wrap — not needed” too absolutely. The settled decision is “not in scope now,” not “never needed.” Rephrase to avoid future contradiction.
- The Poetry Clock example is not actually verbatim: explanatory layout comments were inserted and the live module still uses `createColumns`. If the guide claims verbatim inclusion, it should be truly verbatim, then annotate below it instead of editing the source inline.
- The dashboard example currently mixes two goals: documenting SDK API and proposing a redesign of the dashboard topology. Those should be separated. First show a faithful API port; only then discuss optional semantic simplification.

Suggested rewrite strategy:
1. Delete the unresolved “Open feedback” block and replace it with a short “Canon decisions” block.
2. Normalize the API section to `LayoutPart`, `createStack`, `createRow`, `createGrid`, `rowSizes`, `columnSizes`, `gap: { row, column }`, `Breakpoint`.
3. Update every example to the same future-state `createGrid` API shape.
4. Keep Poetry Clock truly verbatim.
5. Replace the partial dashboard sketch with either the full future-state port or label it honestly as a “partial tab port sketch”.

Overall assessment:
- Strong structure, but currently too mixed between draft debate, settled canon, and speculative example code. Tightening that distinction would make it much more trustworthy for both humans and agents.
</codexfeedback>

## Open feedback (resolve before implementing)

1. NAMING: "createStack" does not obviously mean "vertical flex column" to
   a reader. "Stack" suggests a pile, but does not communicate direction.
   Consider createColumn (flex-direction: column) + createRow (flex-direction:
   row) as the pair — this is what CSS actually calls them.

2. SIZING: "basis: number" and "basis: Nfr" sound abstract and devoid of
   CSS/layout meaning. Should we use more CSS-native vocabulary? CSS uses
   flex-basis, fr units, and fixed lengths. The fr syntax is correct but
   "basis" as the property name could be "size" or "flex" or stay as "basis"
   (which IS the CSS term — flex-basis). Needs a decision.

3. GAP: Should use row-gap and column-gap (CSS property names), not a
   { row, column } object. The HANDOVER proposed { row, column } but the
   CSS names are row-gap and column-gap. In TypeScript that would be
   { rowGap, columnGap } or separate properties. Decide which form.

4. FLEX-WRAP: This guide says flex-wrap is not needed. WRONG. Terminal
   windows WILL be flowing layouts and we WILL need flex-wrap. Do not
   defer this — design the type to accommodate it from day one even if
   the implementation comes later. At minimum reserve the option in the
   API surface.

5. COLUMN LAYOUT: The guide says layoutColumns is domain-specific and not
   SDK. But if we build a CSS-canon column layout primitive (like CSS
   columns / column-count), that IS a reusable SDK concept. The question
   is whether the zine layoutColumns can be cleaned up into something
   CSS-aligned, or whether a new clean primitive should exist alongside it.
   If columns is a real CSS concept, the SDK should probably have it.

6. createColumns CLARITY: This guide is muddled on createColumns. The
   current createColumns does horizontal flex (flex-direction: row). The
   HANDOVER says rename it to createRow and deprecate createColumns. But
   if we also want a CSS columns primitive (column-count), then "columns"
   means something real and different. The naming needs to be:
     createRow     = flex-direction: row
     createColumn  = flex-direction: column  (currently createStack)
     createColumns = CSS columns / multi-column layout  (new or cleaned-up)
   OR keep createStack and accept the non-CSS name. Decide.

---

How to lay out microapp windows in WibWob-DOS.

The SDK gives you two layout primitives — flex and grid — plus responsive
breakpoints. Everything else is a pattern built from these two.

If you have used CSS flexbox and grid, this will feel familiar. The naming
is deliberately aligned to CSS/Tailwind so you can reason about it without
a translation layer.

---

## Mental model

Two primitives. Pick the right one:

    FLEX (1D)  — children flow along ONE axis
      createStack  = vertical   (flex-direction: column)
      createRow    = horizontal (flex-direction: row)

    GRID (2D)  — children placed in a ROW x COLUMN matrix
      createGrid   = CSS Grid with fr/fixed tracks, spans, gaps

Decision rule:
  - Header + body + footer?  createStack (vertical flex)
  - Sidebar + main?          createRow (horizontal flex)
  - Dashboard with cells?    createGrid
  - Content flowing into magazine columns?  Domain-specific, not SDK

If your layout is one-dimensional (things stacked or things side-by-side),
use flex. If you need to place things at specific row/column intersections,
use grid.

---

## The composition contract: LayoutPart

Every layout primitive accepts LayoutPart children and returns a LayoutPart.
This means you can nest them freely: a stack inside a grid cell, a grid
inside a row, etc.

```typescript
type Rect = { top: number; left: number; width: number; height: number };

type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};
```

Every SDK widget (createHeaderBar, createTextBlock, createStatusBar, etc.)
returns a LayoutPart, so they all compose with flex and grid.

---

## Flex: createStack and createRow

Both take a parent node and an array of children. Each child has a key,
a basis (sizing), and a part (any LayoutPart).

```typescript
type StackChild = {
  key: string;
  basis: number | `${number}fr`;
  part: LayoutPart<any>;
  visible?: () => boolean;
};
```

Sizing rules (same as CSS flex-basis + fr units):
  - basis: 1          fixed 1 row/column
  - basis: 5          fixed 5 rows/columns
  - basis: "1fr"      take 1 share of remaining space
  - basis: "2fr"      take 2 shares (twice as much as "1fr")

Visibility: if visible() returns false, the child is hidden and takes
no space. Other children expand to fill the gap. Use this for conditional
sections (dividers, sidebars, panels that appear in certain modes).

### createStack (vertical)

```typescript
const root = createStack(win.body, [
  { key: "header",  basis: 1,     part: headerBar },
  { key: "body",    basis: "1fr", part: mainContent },
  { key: "status",  basis: 1,     part: statusBar },
]);

// Drive layout from window body dimensions:
root.layout({ top: 0, left: 0, width: innerW, height: innerH });
```

This produces:
    ┌──────────────────────┐
    │ header (1 row)       │
    │ body (fills rest)    │
    │                      │
    │                      │
    │ status (1 row)       │
    └──────────────────────┘

### createRow (horizontal)

```typescript
const row = createRow(win.body, [
  { key: "sidebar", basis: 20,    part: sidebarPanel },
  { key: "divider", basis: 1,     part: verticalRule },
  { key: "main",    basis: "1fr", part: mainContent },
]);
```

This produces:
    ┌────────┬─┬───────────┐
    │sidebar │ │ main      │
    │ 20cols │ │ (rest)    │
    └────────┴─┴───────────┘

### Nesting

Flex composes by nesting. A row inside a stack, or a stack inside a row:

```typescript
const body = createRow(win.body, [
  { key: "cat",  basis: 15,    part: catPanel },
  { key: "poem", basis: "1fr", part: poemBlock },
]);

const root = createStack(win.body, [
  { key: "header",  basis: 1,     part: dateHeader },
  { key: "figlet",  basis: 5,     part: figletTime },
  { key: "divider", basis: 1,     part: divider },
  { key: "body",    basis: "1fr", part: body },      // <-- nested row
  { key: "status",  basis: 1,     part: statusBar },
]);
```

---

## Grid: createGrid

For 2D layouts where children occupy specific cells in a matrix.

```typescript
type TrackSize = number | `${number}fr`;
// Reserved for future: "auto" (content-sized tracks)

interface GridOptions {
  rows: number;
  cols: number;
  templateRows?: TrackSize[];
  templateColumns?: TrackSize[];
  gap?: number | { row?: number; column?: number };
}
```

CSS mapping:
  templateRows     = grid-template-rows
  templateColumns  = grid-template-columns
  gap              = gap / row-gap / column-gap

Track sizes work exactly like CSS:
  - 3          fixed 3 rows/columns
  - "1fr"      1 fractional unit of remaining space
  - "2fr"      2 fractional units

If you provide fewer sizes than rows/cols, they cycle. So
templateColumns: ["1fr"] on a 4-col grid means all columns are equal.

### Basic usage

```typescript
const grid = createGrid(win.body, {
  rows: 3,
  cols: 3,
  templateColumns: ["1fr", "2fr", "1fr"],
  templateRows: ["1fr", "1fr", "1fr"],
  gap: { row: 1, column: 1 },
});

// Place children at row, col with optional spans:
grid.set(0, 0, 1, 1, topLeftWidget);     // row 0, col 0, span 1x1
grid.set(0, 1, 1, 2, topRightWidget);    // row 0, col 1, span 1x2 (spans 2 cols)
grid.set(1, 0, 2, 1, tallLeftWidget);    // row 1, col 0, span 2x1 (spans 2 rows)
grid.set(1, 1, 1, 1, centerWidget);
grid.set(2, 1, 1, 2, bottomRightWidget);

// Drive layout:
grid.layout({ top: 0, left: 0, width: innerW, height: innerH });
```

### Grid with LayoutPart children

When the grid is extracted to the SDK, grid.set will accept LayoutPart
children (not just raw blessed nodes). This means you can put a
createStack inside a grid cell:

```typescript
const cellContent = createStack(win.body, [
  { key: "label", basis: 1,     part: labelBar },
  { key: "chart", basis: "1fr", part: chartWidget },
]);

grid.set(0, 0, 1, 1, cellContent);  // LayoutPart in grid cell
```

The grid calls cellContent.layout(rect) with the cell's computed rect,
so the stack inside fills the cell and lays out its own children.

---

## Responsive: pickBreakpoint

Respond to window resize by switching between layout modes.

```typescript
type Breakpoint<T> = {
  minWidth?: number;
  minHeight?: number;
  value: T;
};

function pickBreakpoint<T>(
  breakpoints: Breakpoint<T>[],
  width: number,
  height: number,
): T | undefined;
```

Breakpoints are checked in ORDER — first match wins. Put the LARGEST
first so the biggest applicable breakpoint is chosen:

```typescript
type LayoutMode = "lg" | "md" | "sm" | "xs";

const BREAKPOINTS: Breakpoint<LayoutMode>[] = [
  { minWidth: 95,  minHeight: 26, value: "lg" },
  { minWidth: 65,  minHeight: 18, value: "md" },
  { minWidth: 40,  minHeight: 12, value: "sm" },
  { value: "xs" },  // no minimum — always matches as fallback
];

// In your render function:
const mode = pickBreakpoint(BREAKPOINTS, innerW, innerH) ?? "xs";

if (mode === "lg") {
  // 2-column grid layout
} else if (mode === "md") {
  // single column with sidebar
} else {
  // compact stack
}
```

Naming convention: xs/sm/md/lg/xl, ascending like Tailwind. "xs" is the
smallest terminal, "xl" is a huge widescreen terminal.

---

## Alignment: justify and align

For positioning content within a container, use a two-axis object:

```typescript
type Alignment = {
  justify: "start" | "center" | "end";   // horizontal axis
  align: "start" | "center" | "end";     // vertical axis
};
```

This maps directly to CSS justify-content + align-items.

The old compass system (NW/N/NE/W/C/E/SW/S/SE) is NOT an SDK concept.
It lives inside hello-world as demo vocabulary for its toolbar buttons.
The SDK speaks CSS.

---

## Naming reference

| SDK name          | CSS equivalent                    | Notes                        |
|-------------------|-----------------------------------|------------------------------|
| createStack       | flex-direction: column            | vertical 1D layout           |
| createRow         | flex-direction: row               | horizontal 1D layout         |
| createGrid        | display: grid                     | 2D row/col matrix            |
| templateRows      | grid-template-rows                |                              |
| templateColumns   | grid-template-columns             |                              |
| basis: number     | flex-basis (fixed px)             | fixed rows or columns        |
| basis: "Nfr"      | flex-basis with fr unit           | fractional share of space    |
| gap               | gap / row-gap / column-gap        | object form: { row, column } |
| pickBreakpoint    | @media (min-width: ...)           | responsive mode switching    |
| xs/sm/md/lg/xl    | Tailwind breakpoint tiers         | ascending size order         |
| justify + align   | justify-content + align-items     | two-axis alignment           |
| LayoutPart        | React component / CSS box         | composition interface        |
| Rect              | DOMRect                           | { top, left, width, height } |

---

## What is NOT in the SDK (and why)

- flex-wrap — not needed; terminal layouts are fixed-size, not flowing
- min/max constraints on tracks — reserved for future ("auto" track size)
- overflow / scroll on layout containers — handled by individual widgets
- margin / padding on LayoutPart — use inset properties on the blessed node
- compass positioning (NW/SE) — demo vocabulary, not SDK
- layoutColumns (magazine flow) — domain-specific to zine, not reusable
- "auto" track size — reserved in the TrackSize type, not yet implemented

---

## Patterns (not primitives)

These are common layouts built FROM the two primitives. They are not
separate SDK exports — they are just patterns you follow:

### Sidebar pattern

```typescript
const layout = createRow(win.body, [
  { key: "sidebar", basis: 24,    part: sidebarList },
  { key: "divider", basis: 1,     part: verticalRule },
  { key: "main",    basis: "1fr", part: mainContent },
]);
```

(The SDK also has createSidebarPanel for more complex sidebar needs
with toggle, overflow guards, and width policies.)

### Header-body-footer pattern

```typescript
const layout = createStack(win.body, [
  { key: "header", basis: 1,     part: headerBar },
  { key: "body",   basis: "1fr", part: bodyContent },
  { key: "footer", basis: 1,     part: statusBar },
]);
```

### Dashboard pattern

```typescript
const grid = createGrid(win.body, {
  rows: 4, cols: 3,
  templateColumns: ["1fr", "1fr", "1fr"],
  gap: { row: 1, column: 1 },
});

grid.set(0, 0, 2, 1, cpuChart);    // tall left panel
grid.set(0, 1, 1, 2, networkBar);  // wide top-right
grid.set(1, 1, 1, 1, diskDonut);
grid.set(1, 2, 1, 1, healthGauge);
grid.set(2, 0, 2, 3, latencyLine); // full-width bottom
```

---

## Lifecycle

Every LayoutPart follows the same lifecycle:

1. CREATE — call createStack/createRow/createGrid, get back a LayoutPart
2. LAYOUT — call root.layout(rect) on resize or initial render
3. UPDATE — call part.update(props) to change content
4. RESTYLE — call root.restyle() when theme changes (cascades to children)
5. DESTROY — call root.destroy() on window close (cascades to children)

Wire these into the window lifecycle:

```typescript
win.onResize(render);            // calls root.layout(...)
win.onRestyle(() => {
  root.restyle();
  host.screen.render();
});
win.onCleanup(() => {
  root.destroy();
});
```

---

## Deprecation note: createColumns

The old name createColumns still works but is deprecated. It does exactly
what createRow does — horizontal flex layout. The name was misleading
because "columns" suggests multi-column magazine layout (which is what
layoutColumns in the zine subsystem does). Use createRow instead.

---

## Full example: Poetry Clock (flex only)

This module uses createStack (vertical) and createRow (horizontal) with
conditional visibility. It is the gold-standard flex example.

```typescript
// modules/wibwob-poetry-clock/index.ts
/**
 * Poetry Clock — a microapp that tells the time as a tiny poem every minute.
 * Inspired by Poem/1 by Matt Webb / Acts Not Facts.
 *
 * Two modes:
 *   clock    — plain time display, no inference
 *   sentient — AI-generated poem each minute via Anthropic Haiku (pi OAuth)
 *
 * Sentient mode has three voices:
 *   plain    — observational, quiet
 *   liminal  — backrooms temporal drift
 *   scramble — from Scramble the cat's perspective
 *
 * Falls back to clock mode if auth is unavailable.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  type AnimatedPanelPlayer,
  createContourPlayer,
  createLazyMountedPlayer,
  readNodeViewport,
  terrainNames,
  renderFiglet,
  type ContourMode,
  type MicroappHost,
} from "../../src/services/microapp-sdk.js";

type ClockMode = "clock" | "sentient";
type Voice = "plain" | "liminal" | "scramble" | "terrain";

const VOICE_CYCLE: Voice[] = ["plain", "liminal", "scramble", "terrain"];
const VOICE_LABELS: Record<Voice, string> = {
  plain: "poet",
  liminal: "backrooms",
  scramble: "scramble",
  terrain: "terrain",
};

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

const FIGLET_FONT = "chunky";

function renderFigletTime(time: string): string {
  const rendered = renderFiglet(time, FIGLET_FONT);
  if (!rendered || rendered.includes("(figlet")) return `  ${time}`;
  return rendered;
}

const SCRAMBLE_FRAMES: string[][] = [
  [
    "  /\\_/\\   ",
    " ( o.o )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( -.- )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( o.o )  ",
    "  > ~ <   ",
    "  |   |   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( ^.^ )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
];

function createScramblePlayer(host: MicroappHost): AnimatedPanelPlayer & { setRunning(running: boolean): void } {
  let target: Parameters<NonNullable<AnimatedPanelPlayer["attachTarget"]>>[0] | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let running = false;

  const renderFrame = () => {
    if (!target) {
      return;
    }
    target.setContent(SCRAMBLE_FRAMES[frameIndex].join("\n"));
    host.screen.render();
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    if (timer || !target) {
      return;
    }
    timer = setInterval(() => {
      frameIndex = (frameIndex + 1) % SCRAMBLE_FRAMES.length;
      renderFrame();
    }, 2_000);
  };

  return {
    attachTarget(nextTarget) {
      target = nextTarget;
      frameIndex = 0;
      renderFrame();
      if (running) {
        start();
      }
    },
    setRunning(nextRunning) {
      running = nextRunning;
      if (!running) {
        stop();
        frameIndex = 0;
        renderFrame();
        return;
      }
      renderFrame();
      start();
    },
    destroy() {
      stop();
      target = null;
    },
  };
}

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";
const AUTH_FILE = join(homedir(), ".pi", "agent", "auth.json");

const VOICE_PROMPTS: Record<Voice, string> = {
  plain:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a pattern, a cultural echo, a feeling, the shape of the digits, bingo calls, " +
    "something numerical, anything. Let that secret be the spine of the poem. " +
    "Observational, quiet. No title, no explanation. Maximum 120 characters.",
  liminal:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a pattern, an echo, a wrongness specific to this exact time. " +
    "3am is not the same as 3pm. Let that particular strangeness haunt the poem. " +
    "Surreal, backrooms-flavoured. No title, no explanation. Maximum 120 characters.",
  scramble:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "is it feeding time, nap time, the witching hour, a suspicious number? " +
    "Scramble the cat has noticed something about this particular time. " +
    "Simple, funny, catlike. No title, no explanation. Maximum 120 characters.",
  terrain:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a ridge, a valley, an erosion pattern, a geological age, a contour line. " +
    "The landscape shifts with the hour. What does this time look like as terrain? " +
    "Geological, atmospheric, vast. No title, no explanation. Maximum 120 characters.",
};

function readOAuthToken(): string | null {
  try {
    const auth = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    const token = auth?.anthropic?.access;
    if (!token || typeof token !== "string") {
      return null;
    }
    const expires = auth?.anthropic?.expires;
    if (expires && Date.now() > expires) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function timeContext(time: string): string {
  const [hStr] = time.split(":");
  const h = parseInt(hStr, 10);
  if (h >= 5 && h < 8)   return "early morning, the day barely started, cool and quiet";
  if (h >= 8 && h < 12)  return "morning, the working day underway";
  if (h >= 12 && h < 14) return "midday, the sun at its height, a pause";
  if (h >= 14 && h < 17) return "afternoon, the slow stretch after lunch";
  if (h >= 17 && h < 20) return "evening, the day winding down";
  if (h >= 20 && h < 23) return "night, the world going quiet";
  return "the small hours, deep night, most people asleep";
}

async function generatePoem(time: string, voice: Voice): Promise<string | null> {
  const token = readOAuthToken();
  if (!token) {
    return null;
  }

  const prompt = VOICE_PROMPTS[voice].replace(/\{time\}/g, time);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
        system: `You are a poet. The current time is ${time} — ${timeContext(time)}. Write only the poem, nothing else. No preamble, no title.`,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((item) => item.type === "text")?.text?.trim();
    if (!text) {
      return null;
    }

    if (text.startsWith("\"") && text.endsWith("\"")) {
      return text.slice(1, -1);
    }
    return text;
  } catch {
    return null;
  }
}

const CONTOUR_MODES: ContourMode[] = ["chaos", "order", "hybrid"];

function createTerrainPlayer(host: MicroappHost): AnimatedPanelPlayer & { setRunning(running: boolean): void; shuffle(): void } {
  function randomContourConfig() {
    return {
      mode: CONTOUR_MODES[Math.floor(Math.random() * CONTOUR_MODES.length)],
      seed: Math.floor(Math.random() * 100000),
      terrainIdx: Math.floor(Math.random() * terrainNames.length),
      nLevels: 3 + Math.floor(Math.random() * 6),
      fps: 8,
    };
  }

  const bridge = createLazyMountedPlayer({
    create(target) {
      return createContourPlayer({
        ...randomContourConfig(),
        getViewport: () => readNodeViewport(target, { minWidth: 12, minHeight: 6, fallbackWidth: 12, fallbackHeight: 6 }),
        onFrame: (content) => { target.setContent(content); host.screen.render(); },
      });
    },
    render: () => host.screen.render(),
    clearOnStop: true,
  });

  return {
    ...bridge,
    shuffle() {
      bridge.setRunning(false);
      bridge.setRunning(true);
    },
  };
}

export default function setup(host: MicroappHost) {
  // Active clock controller — set when a clock window is open, cleared on close
  let clockControl: { setMode: (mode: ClockMode, voice?: Voice) => void } | undefined;

  function openClock(args?: Record<string, unknown>) {
    const restoreMode = args?.mode as ClockMode | undefined;
    const restoreVoice = args?.voice as Voice | undefined;

    let mode: ClockMode = restoreMode ?? "clock";
    let voice: Voice = restoreVoice ?? "plain";
    let lastPoem = "";
    let lastTime = "";
    let lastDate = "";
    let generating = false;
    let lastGeneratedMinute = -1;

    clockControl = {
      setMode(targetMode: ClockMode, targetVoice?: Voice) {
        mode = targetMode;
        if (targetVoice) voice = targetVoice;
        lastPoem = "";
        if (mode === "sentient") {
          requestPoem();
        } else {
          voice = "plain";
          render();
        }
      },
    };

    const win = host.createWindow({
      title: "Poetry Clock",
      width: 64,
      height: 17,
    });

    const dateHeader = host.ui.createHeaderBar(win.body, { leftInset: 2 });
    const figletTime = host.ui.createFigletDisplay(win.body, { renderText: renderFigletTime, leftInset: 2 });
    const divider = host.ui.createRule(win.body, { axis: "horizontal", inset: 2 });
    const catPlayer = createScramblePlayer(host);
    const catPanel = host.ui.createAnimatedPanel(win.body, { player: catPlayer });
    const catRule = host.ui.createRule(win.body, { axis: "vertical" });
    const terrainPlayer = createTerrainPlayer(host);
    const terrainPanel = host.ui.createAnimatedPanel(win.body, { player: terrainPlayer });
    const terrainRule = host.ui.createRule(win.body, { axis: "vertical" });
    const poemBlock = host.ui.createTextBlock(win.body, { paddingLeft: 2, paddingTop: 1 });
    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 2 });

    // LAYOUT: horizontal row with conditional side panels
    //
    // ┌─cat─┬─┬──poem──┬─┬─terrain─┐
    // │ 15  │1│  fill   │1│  3fr    │
    // └─────┴─┴────────┴─┴─────────┘
    //
    // cat + cat-rule only visible in scramble voice
    // terrain-rule + terrain only visible in terrain voice
    const body = host.ui.createColumns(win.body, [
      {
        key: "cat",
        basis: 15,
        part: catPanel,
        visible: () => mode === "sentient" && voice === "scramble",
      },
      {
        key: "cat-rule",
        basis: 1,
        part: catRule,
        visible: () => mode === "sentient" && voice === "scramble",
      },
      {
        key: "poem",
        basis: "1fr",
        part: poemBlock,
      },
      {
        key: "terrain-rule",
        basis: 1,
        part: terrainRule,
        visible: () => mode === "sentient" && voice === "terrain",
      },
      {
        key: "terrain",
        basis: "3fr",
        part: terrainPanel,
        visible: () => mode === "sentient" && voice === "terrain",
      },
    ]);

    // LAYOUT: vertical stack — the whole window
    //
    // ┌─────────────────────────┐
    // │ date header       1 row │
    // │ figlet time      5 rows │
    // │ ──────────────── 1 row  │  (hidden in clock mode)
    // │ body (row above)  fill  │
    // │ status bar        1 row │
    // └─────────────────────────┘
    const root = host.ui.createStack(win.body, [
      { key: "date", basis: 1, part: dateHeader },
      { key: "figlet", basis: 5, part: figletTime },
      {
        key: "divider",
        basis: 1,
        part: divider,
        visible: () => mode !== "clock",
      },
      { key: "body", basis: "1fr", part: body },
      { key: "status", basis: 1, part: statusBar },
    ]);

    const cycleMode = () => {
      if (mode === "clock") {
        mode = "sentient";
        voice = "plain";
        lastPoem = "";
        requestPoem();
        return;
      }

      const voiceIndex = VOICE_CYCLE.indexOf(voice);
      if (voiceIndex >= VOICE_CYCLE.length - 1) {
        mode = "clock";
        voice = "plain";
        lastPoem = "";
        render();
        return;
      }

      voice = VOICE_CYCLE[voiceIndex + 1];
      lastPoem = "";
      requestPoem();
    };

    async function requestPoem() {
      if (generating) {
        return;
      }

      if (voice === "terrain") {
        terrainPlayer.shuffle();
      }

      generating = true;
      render();

      const now = new Date();
      const poem = await generatePoem(formatTime(now), voice);
      generating = false;

      if (poem) {
        lastPoem = poem;
        lastGeneratedMinute = now.getHours() * 60 + now.getMinutes();
      } else if (mode === "sentient" && !lastPoem) {
        mode = "clock";
        voice = "plain";
      }

      render();
    }

    function render() {
      const now = new Date();
      lastTime = formatTime(now);
      lastDate = formatDate(now);

      const innerW = Number(win.body.width) || 0;
      const innerH = Number(win.body.height) || 0;
      const scrambleVisible = mode === "sentient" && voice === "scramble";
      const terrainVisible = mode === "sentient" && voice === "terrain";

      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      dateHeader.update({ left: lastDate });
      figletTime.update({ value: lastTime });
      divider.update({ visible: mode !== "clock" });
      catRule.update({ visible: scrambleVisible });
      catPlayer.setRunning(scrambleVisible);
      terrainRule.update({ visible: terrainVisible });
      terrainPlayer.setRunning(terrainVisible);

      if (mode === "clock") {
        poemBlock.update({ text: "" });
        statusBar.update({ left: "", right: "[m]ode" });
      } else if (generating) {
        poemBlock.update({ text: "..." });
        statusBar.update({ left: VOICE_LABELS[voice], right: "[m]ode" });
      } else {
        poemBlock.update({ text: lastPoem });
        statusBar.update({ left: VOICE_LABELS[voice], right: "[m]ode" });
      }

      host.screen.render();
    }

    function tick() {
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      render();
      if (mode === "sentient" && currentMinute !== lastGeneratedMinute && !generating) {
        requestPoem();
      }
    }

    win.onResize(render);
    statusBar.node.on?.("click", cycleMode);
    win.body.key(["m"], cycleMode);
    win.body.key(["q", "escape"], () => win.close());

    render();
    if (mode === "sentient") {
      requestPoem();
    }

    const timer = setInterval(tick, 15_000);

    win.onCleanup(() => {
      clearInterval(timer);
      root.destroy();
      clockControl = undefined;
    });

    win.onRestyle(() => {
      root.restyle();
      host.screen.render();
    });

    win.describeState(() => ({
      summary: mode === "clock"
        ? "Poetry clock — clock mode"
        : `Poetry clock — ${voice} voice`,
      mode,
      voice,
      currentTime: lastTime,
      currentDate: lastDate,
      currentPoem: lastPoem || undefined,
      generating,
    }));

    win.captureText(() => {
      if (mode === "clock") {
        return `${lastDate}  ${lastTime}\n\n[CLOCK]`;
      }
      return `${lastDate}  ${lastTime}\n\n${lastPoem || "(generating...)"}\n\n[${VOICE_LABELS[voice]}]`;
    });
  }

  host.registerCommand({
    id: "open",
    label: "Open Poetry Clock",
    description: "A clock that tells the time — plain or as AI-generated poems",
    action: openClock,
    menu: [{ category: "demos", order: 30, label: "Poetry Clock" }],
    palette: { order: 50, label: "Poetry Clock" },
  });

  host.registerCommand({
    id: "set-mode",
    label: "Set Poetry Clock Mode",
    description: 'Set clock mode. args: { mode: "clock"|"sentient", voice?: "plain"|"liminal"|"scramble"|"terrain" }. Opens clock if not already open.',
    direct: true,
    action: (args) => {
      const targetMode = (args?.mode as ClockMode | undefined) ?? "sentient";
      const targetVoice = args?.voice as Voice | undefined;
      if (clockControl) {
        clockControl.setMode(targetMode, targetVoice);
      } else {
        openClock({ mode: targetMode, voice: targetVoice ?? "plain" });
      }
    },
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return {
        mode: state.mode ?? "clock",
        voice: state.voice ?? "plain",
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", {
        mode: payload.mode,
        voice: payload.voice,
      });
    },
  });
}
```

What to notice:
- createStack arranges date, figlet, divider, body, status vertically
- The body is itself a createRow (here still called createColumns) arranging
  cat, poem, terrain horizontally
- Conditional visibility on the divider (hidden in clock mode) and side panels
  (cat only in scramble voice, terrain only in terrain voice)
- When hidden children take no space, the poem block expands to fill
- Lifecycle: onResize calls render (which calls root.layout), onCleanup
  calls root.destroy, onRestyle calls root.restyle

---

## Full example: Dashboard (grid port — what it WILL look like)

This shows the System Overview tab rewritten to use createGrid instead of
blessed-contrib's grid. The current code uses `new contrib.grid({ rows: 12,
cols: 12, screen: container })` and `grid.set(row, col, rowSpan, colSpan,
Widget, opts)`. The port replaces that with SDK createGrid.

Note: only Tab 1 (System Overview) is shown rewritten. The full module has
7 tabs — the pattern is the same for each.

```typescript
// modules/dashboard/index.ts — Tab 1 rewritten with SDK createGrid
//
// BEFORE (blessed-contrib):
//   const grid = new contrib.grid({ rows: 12, cols: 12, screen: container });
//   const line = grid.set(0, 0, 4, 6, contrib.line, { ... });
//   const bar  = grid.set(0, 6, 4, 6, contrib.bar, { ... });
//   // ... manual 12x12 grid placement
//
// AFTER (SDK createGrid):

import { createGrid, type TrackSize } from "../../src/services/microapp-sdk.js";
import contrib from "blessed-contrib";

function buildSystemTab(container: blessed.Widgets.BoxElement) {
  // 12x12 grid replaced with semantic rows and columns.
  // The old 12-unit grid was: rows 0-3 (charts), 4-5 (spark/donut/gauge),
  // 6-8 (log/table), 9-11 (latency). That maps to a 4-row grid:
  const grid = createGrid(container, {
    rows: 4,
    cols: 2,
    templateRows: ["4fr", "2fr", "3fr", "3fr"],
    templateColumns: ["1fr", "1fr"],
    gap: { row: 0, column: 0 },
  });

  // Row 0: CPU line chart (left), Network bar (right)
  const line = contrib.line({
    label: " CPU & Memory ", showLegend: true, legend: { width: 12 },
    style: { line: "cyan", text: "white", baseline: "white" },
  });
  grid.set(0, 0, 1, 1, line);

  const bar = contrib.bar({
    label: " Network I/O (KB/s) ", barWidth: 6, barSpacing: 2, maxHeight: 100,
    style: { fg: "green" },
  });
  grid.set(0, 1, 1, 1, bar);

  // Row 1: sparkline (left half), donut + gauge (right half)
  // For the right half we would use a nested createRow or a finer grid.
  // Here we keep it as 2 columns for simplicity:
  const spark = contrib.sparkline({
    label: " Load Average ", tags: true, style: { fg: "cyan" },
  });
  grid.set(1, 0, 1, 1, spark);

  const donut = contrib.donut({
    label: " Disk Usage ", radius: 8, arcWidth: 3,
    remainColor: "black", yPadding: 1,
  });
  grid.set(1, 1, 1, 1, donut);

  // Row 2: log (left), table (right)
  const log = contrib.log({
    label: " System Log ", fg: "green", selectedFg: "green", bufferLength: 30,
  });
  grid.set(2, 0, 1, 1, log);

  const table = contrib.table({
    label: " Process Table ", columnSpacing: 2,
    columnWidth: [18, 8, 8, 10],
    fg: "white", selectedFg: "white", selectedBg: "blue",
  });
  grid.set(2, 1, 1, 1, table);

  // Row 3: latency chart (full width, spans both columns)
  const latencyLine = contrib.line({
    label: " Request Latency (ms) ",
    style: { line: "yellow", text: "white", baseline: "white" },
    xLabelPadding: 3, xPadding: 5,
  });
  grid.set(3, 0, 1, 2, latencyLine);  // spans 2 columns

  // Return grid + widgets for update function
  return { grid, line, bar, spark, donut, log, table, latencyLine,
    cpu: randHistory(H, 20, 80),
    mem: randHistory(H, 40, 90),
    lat: randHistory(H, 5, 120),
    /* ... same data as before ... */
  };
}

// In the tab build callback:
// tabs: [{ name: "System", build: (c) => {
//   systemState = buildSystemTab(c);
//   // Drive initial layout:
//   const w = Number(c.width) || 0;
//   const h = Number(c.height) || 0;
//   systemState.grid.layout({ top: 0, left: 0, width: w, height: h });
// }}]
```

What changed:
- No more `new contrib.grid({ rows: 12, cols: 12, screen: container })`
- The 12x12 grid collapses to a semantic 4x2 grid with fr-sized rows
- grid.set uses row/col/rowSpan/colSpan — same mental model, cleaner sizes
- The latency chart spans 2 columns with colSpan: 2
- Layout is driven by grid.layout(rect) on resize, not blessed-contrib magic

What stayed the same:
- All the contrib widgets (line, bar, sparkline, donut, gauge, log, table)
- The data simulation and update logic
- The visual result

---

## Decision flowchart

    Do your children flow in ONE direction?
    ├─ YES → Is it vertical (top to bottom)?
    │        ├─ YES → createStack
    │        └─ NO  → createRow
    └─ NO  → Do children occupy specific row/col positions?
             ├─ YES → createGrid
             └─ NO  → You probably have a domain-specific layout.
                      Write it locally, don't force it into the SDK.
