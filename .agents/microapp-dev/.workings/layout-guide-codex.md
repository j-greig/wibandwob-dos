# WibWob-DOS Layout Guide

<pifeedback>

## Pi review — what Codex got right, wrong, and missed

### What is genuinely better than the pi version

1. OBJECT-FORM grid.set — Codex uses grid.set({ key, row, column, rowSpan,
   columnSpan, part }) instead of positional args. This is unambiguously
   better. Named fields prevent row/col/span confusion. Pi version used
   grid.set(row, col, rowSpan, colSpan, part) which is fragile.

2. FULL DASHBOARD REWRITE — Codex rewrote all 7 tabs, not just Tab 1. This
   is the right call for a guide that includes verbatim source. Pi only
   showed Tab 1 and handwaved the rest.

3. GridChild / FlexChild DISTINCT TYPES — separating the child type for
   flex (has basis) from grid (has row/column/span) is correct. Pi used
   StackChild for both which is muddled.

4. TabPart PATTERN — the LayoutPart + tick() extension for dashboard tabs
   is a practical bridge pattern that would be useful to document.

5. widgetPart HELPER — wrapping blessed-contrib widgets as LayoutPart via
   createNodePart is the right bridge and Codex made it explicit.

6. DECISION FLOWCHART — the "are you about to write manual top/left math?
   Stop and use createGrid" branch is better than the pi version.

### What is wrong

1. rowSizes / columnSizes — CONTRADICTS the HANDOVER. The agreed naming
   is templateRows / templateColumns (matching CSS grid-template-rows /
   grid-template-columns). Codex ignored this decision. The naming table
   even maps rowSizes to "grid-template-rows" while using the wrong name.

2. POETRY CLOCK IS CORRUPTED — the verbatim source has escaped characters
   throughout: \\n instead of \n, \\" instead of \", \\_ in the cat art.
   This is a Codex copy artifact. An agent following this guide would
   produce broken code if they copied these strings.

3. FLEX-WRAP RULED OUT — Codex says "No module audit justified it." The
   human explicitly said terminal windows WILL be flowing and flex-wrap
   IS needed. This is a design constraint from the project owner, not
   something an audit can overrule. At minimum the API types should
   reserve wrap as an option even if unimplemented.

4. layoutColumns EXCLUDED without nuance — Codex correctly says the zine
   layoutColumns is not SDK material. But it does not address whether a
   CLEAN CSS-aligned column-count/column-flow primitive should exist in
   the SDK. The human feedback says: if it is a real CSS concept (and it
   is — CSS columns property), the SDK should probably have it. This
   question is unresolved, not closed.

### What is missing

5. NO LIFECYCLE SECTION — the pi version has a lifecycle section showing
   how layout/update/restyle/destroy wire into window hooks (onResize,
   onRestyle, onCleanup). Codex skips this entirely. For a guide aimed
   at microapp authors, this is critical — it is how you actually USE
   the layout system.

6. NO RESPONSIVE SECTION WITH EXAMPLES — pickBreakpoint is mentioned in
   the types and briefly in "important constraints" but there is no
   section showing how to wire breakpoints to layout switching with a
   real code example. The pi version has a full section with pattern.

7. NO ALIGNMENT EXAMPLES — { justify, align } is declared in the types
   but never shown in use. How do you center content in a grid cell?
   How do you right-align a status bar? No examples.

8. NO COMPOSITION EXAMPLES WITH layout(rect) — the composition section
   shows flex-in-grid and grid-in-flex structurally but never shows the
   actual layout(rect) call chain. A microapp author needs to understand
   that root.layout(rect) cascades to children.

9. GAP NAMING — uses { row, column } which matches the HANDOVER but the
   human feedback asked whether we should use rowGap / columnGap (the
   actual CSS property names). This question is open and Codex did not
   surface it.

10. createStack NAMING NOT QUESTIONED — the human said "createStack does
    not suggest columns to me." Codex just says "keep this name" without
    acknowledging the tension. The CSS term is flex-direction: column.
    Should the function be called createColumn? This is an open question.

### Comparison verdict

Codex is stronger on: API surface design (object-form grid.set, distinct
child types, widgetPart bridge), completeness of the dashboard example,
and the decision flowchart.

Pi is stronger on: naming correctness (templateRows not rowSizes), lifecycle
documentation, responsive design patterns, alignment examples, and surfacing
open questions from human feedback rather than prematurely closing them.

Neither version addresses all six feedback items from the human review.
Both need revision before becoming the canon guide.

</pifeedback>

This is the canonical layout guide for microapp authors after E034 lands.

The mental model is simple:

- `createStack` is flexbox in one dimension, top to bottom.
- `createRow` is flexbox in one dimension, left to right.
- `createGrid` is grid in two dimensions, rows and columns together.

Use flex when content naturally reads as a sequence. Use grid when placement
is about panels, spans, dashboards, or explicit coordinates. If you are
thinking "header / body / footer", start with flex. If you are thinking
"top-left card spans two rows", start with grid.

## The two primitives

### Flex: `createStack` and `createRow`

Flex is for one-axis layout:

- vertical flow: `createStack`
- horizontal flow: `createRow`
- children get a `basis`
- optional `visible()` gates allow responsive hide/show without destroying parts
- nesting is the normal way to express real screens

### Grid: `createGrid`

Grid is for two-axis layout:

- explicit rows and columns
- fixed tracks or `fr` tracks
- row/column spanning
- exact panel placement
- best for dashboards, mosaics, inspector panes, mixed panel sizes

## Future SDK surface

These are the target types and names microapp authors should code against.

```ts
import blessed from "blessed";

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

export type FlexBasis = number | `${number}fr`;
export type TrackSize = number | `${number}fr`;

export type LayoutAxisAlign = "start" | "center" | "end";
export type LayoutAlignment = {
  justify?: LayoutAxisAlign;
  align?: LayoutAxisAlign;
};

export type Gap = {
  row?: number;
  column?: number;
};

export type FlexChild = {
  key: string;
  basis: FlexBasis;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: LayoutAlignment;
};

export type GridChild = {
  key: string;
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: LayoutAlignment;
};

export type StackOptions = {
  gap?: Gap;
  align?: LayoutAlignment;
};

export type GridOptions = {
  rows: number;
  columns: number;
  rowSizes?: TrackSize[];
  columnSizes?: TrackSize[];
  gap?: Gap;
  align?: LayoutAlignment;
};

export type GridHandle = LayoutPart<void> & {
  set(child: GridChild): void;
  clear(): void;
};

export type BreakpointName = "xs" | "sm" | "md" | "lg" | "xl";

export type Breakpoint<T> = {
  minWidth?: number;
  minHeight?: number;
  value: T;
};

export declare function applyRect(
  node: blessed.Widgets.BoxElement,
  rect: Rect,
): void;

export declare function createNodePart(
  node: blessed.Widgets.BoxElement,
  opts?: { restyle?: () => void },
): LayoutPart<Record<string, never>>;

export declare function createStack(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  opts?: StackOptions,
): LayoutPart<void>;

export declare function createRow(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  opts?: StackOptions,
): LayoutPart<void>;

/**
 * Deprecated compatibility wrapper.
 * Same behavior as createRow().
 */
export declare function createColumns(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  opts?: StackOptions,
): LayoutPart<void>;

export declare function createGrid(
  parent: blessed.Widgets.Node,
  opts: GridOptions,
): GridHandle;

/**
 * Returns the first matching breakpoint.
 * Pass breakpoints from most-specific to least-specific.
 */
export declare function pickBreakpoint<T>(
  breakpoints: Breakpoint<T>[],
  width: number,
  height: number,
): T | undefined;
```

### Important constraints

- `LayoutPart`, not `UiPart`, is the public composition contract.
- `createColumns` remains only as a deprecation wrapper.
- Breakpoint names are `xs/sm/md/lg/xl`.
- Alignment is `{ justify, align }`, not compass directions.
- `TrackSize` is `number | \`${number}fr\``.
- `auto` is intentionally reserved for a later release.
- Grid gap uses object form: `{ row, column }`.
- `layoutColumns` is not an SDK primitive.

## Canon naming

| WibWob name | Meaning | CSS mental model | Notes |
|---|---|---|---|
| `createStack` | vertical flex container | `display:flex; flex-direction:column` | keep this name |
| `createRow` | horizontal flex container | `display:flex; flex-direction:row` | new canon name |
| `createColumns` | deprecated alias for `createRow` | none | compatibility only |
| `createGrid` | two-dimensional layout | `display:grid` | use for panel placement |
| `basis` | preferred child size on main axis | `flex-basis` | `number` = fixed cells, `fr` = share |
| `rowSizes` | row tracks | `grid-template-rows` | fixed or `fr` |
| `columnSizes` | column tracks | `grid-template-columns` | fixed or `fr` |
| `rowSpan` | spans N rows | `grid-row: span N` | defaults to `1` |
| `columnSpan` | spans N columns | `grid-column: span N` | defaults to `1` |
| `gap.row` | vertical gap | `row-gap` | integer cells |
| `gap.column` | horizontal gap | `column-gap` | integer cells |
| `justify` | main-axis alignment | `justify-content` / `justify-self` | start, center, end |
| `align` | cross-axis alignment | `align-items` / `align-self` | start, center, end |
| `pickBreakpoint` | responsive matcher | media-query selection | first match wins |
| `xs/sm/md/lg/xl` | breakpoint names | Tailwind-style ascending names | name order is ascending, matching order is still most-specific first |

## When to use which

Use `createStack` / `createRow` when:

- the layout reads linearly
- the screen is mostly headers, body blocks, sidebars, status bars
- responsiveness is mostly show/hide/reorder by nesting
- you can describe the layout as "split this strip into sections"

Use `createGrid` when:

- multiple panels share both axes
- spans matter
- the layout would otherwise require manual `top/left/width/height` math
- the module resembles a dashboard, board, matrix, or tiled canvas

## Responsive design with `pickBreakpoint`

Breakpoint names are ascending:

- `xs` smallest
- `sm`
- `md`
- `lg`
- `xl` largest

But `pickBreakpoint()` still returns the first match, so declare the array from
largest to smallest:

```ts
type LayoutMode = "xs" | "sm" | "md" | "lg" | "xl";

const BREAKPOINTS: Breakpoint<LayoutMode>[] = [
  { minWidth: 95, minHeight: 26, value: "xl" },
  { minWidth: 80, minHeight: 22, value: "lg" },
  { minWidth: 65, minHeight: 18, value: "md" },
  { minWidth: 40, minHeight: 12, value: "sm" },
  { value: "xs" },
];

const mode = pickBreakpoint(BREAKPOINTS, width, height) ?? "xs";
```

Use breakpoints to switch between whole layouts, not to sprinkle ad-hoc size
checks throughout the render path.

Good:

- `xl`: grid with side panels
- `md`: stack with condensed header
- `xs`: single-column fallback

Bad:

- twenty separate `if (w < 63)` checks scattered across widgets

## Composition patterns

### Flex inside grid

Use grid for the page skeleton, then flex inside a cell:

```ts
const grid = createGrid(win.body, {
  rows: 2,
  columns: 2,
  rowSizes: ["1fr", "1fr"],
  columnSizes: ["2fr", "1fr"],
  gap: { row: 1, column: 1 },
});

const inspector = createStack(win.body, [
  { key: "title", basis: 1, part: headerPart },
  { key: "body", basis: "1fr", part: bodyPart },
  { key: "status", basis: 1, part: statusPart },
]);

grid.set({ key: "main", row: 0, column: 0, rowSpan: 2, columnSpan: 1, part: mainPart });
grid.set({ key: "inspector", row: 0, column: 1, rowSpan: 2, columnSpan: 1, part: inspector });
```

### Grid inside flex

Use flex for the macro structure, then a grid in the content region:

```ts
const dashboardGrid = createGrid(win.body, {
  rows: 12,
  columns: 12,
  gap: { row: 1, column: 1 },
});

const root = createStack(win.body, [
  { key: "header", basis: 1, part: headerPart },
  { key: "toolbar", basis: 1, part: toolbarPart, visible: () => mode !== "xs" },
  { key: "content", basis: "1fr", part: dashboardGrid },
  { key: "status", basis: 1, part: statusPart },
]);
```

This is the default composition pattern for real modules.

## Deliberately not in the SDK

These are out of scope on purpose:

- Compass alignment (`nw`, `se`, etc.). That is demo vocabulary from `hello-world`, not platform vocabulary.
- `layoutColumns()`. That is a zine/magazine layout helper, not a general primitive.
- CSS-complete grid features such as `auto`, named areas, subgrid, minmax, auto-placement.
- Flex wrap. No module audit justified it.
- Min/max track constraints. Add them only when a real module forces the need.
- Absolute-position helper DSLs. If you need absolute positioning, use Blessed directly.

The bar here is reuse proven by multiple modules, not theoretical completeness.

## Gold-standard flex example

`wibwob-poetry-clock` is the reference example for nested flex composition.

- top-level screen: `createStack`
- middle body split: `createColumns` today, `createRow` after E034
- visibility-gated side panels
- no manual pixel math
- clean `layout()`, `restyle()`, `destroy()` lifecycle

Below is the complete current module source. After E034, the only material
layout change is replacing `host.ui.createColumns` with `host.ui.createRow`.

```ts
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
    "  /\\\\_/\\\\   ",
    " ( o.o )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\\\_/\\\\   ",
    " ( -.- )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\\\_/\\\\   ",
    " ( o.o )  ",
    "  > ~ <   ",
    "  |   |   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\\\_/\\\\   ",
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
    target.setContent(SCRAMBLE_FRAMES[frameIndex].join("\\n"));
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

  const prompt = VOICE_PROMPTS[voice].replace(/\\{time\\}/g, time);

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

    if (text.startsWith("\\"") && text.endsWith("\\"")) {
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
        return `${lastDate}  ${lastTime}\\n\\n[CLOCK]`;
      }
      return `${lastDate}  ${lastTime}\\n\\n${lastPoem || "(generating...)"}\\n\\n[${VOICE_LABELS[voice]}]`;
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

## Future grid example

The dashboard is the main `createGrid` candidate. The point of the port is not
to remove `blessed-contrib`; it is to remove `blessed-contrib`'s layout system.
Charts can stay. Layout math moves into the SDK.

This is what the module should look like after the port: the widgets remain,
but each tab becomes a `createGrid` layout with `LayoutPart` children.

```ts
/**
 * Dashboard v3 — same widgets, SDK-owned layout.
 *
 * The charts still come from blessed-contrib.
 * The layout no longer comes from contrib.grid.
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import type { MicroappHost, TabbedContainerHandle, LayoutPart, GridHandle } from "../../src/services/microapp-sdk.js";
import {
  createTabs,
  createTimer,
  clearTimers,
  createGrid,
  createNodePart,
  renderFiglet,
  PATTERNS,
  sinWave,
  randHistory,
  xLabels,
  ansiGradientLine,
} from "../../src/services/microapp-sdk.js";

const H = 40;
const XL = xLabels(H);

function widgetPart(
  node: blessed.Widgets.BoxElement,
  restyle?: () => void,
): LayoutPart<Record<string, never>> {
  return createNodePart(node, { restyle });
}

function lineWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.line({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function barWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.bar({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function sparklineWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.sparkline({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function donutWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.donut({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function gaugeWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.gauge({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function gaugeListWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.gaugeList({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function logWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.log({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function tableWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.table({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function mapWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.map({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

function lcdWidget(parent: blessed.Widgets.Node, options: Record<string, unknown>) {
  return contrib.lcd({
    parent: parent as any,
    ...options,
  }) as blessed.Widgets.BoxElement & any;
}

type TabPart = LayoutPart<void> & { tick(tick: number): void };

function buildSystemTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 12,
    columns: 12,
    gap: { row: 1, column: 1 },
  });

  const line = lineWidget(container, {
    label: " CPU & Memory ",
    showLegend: true,
    legend: { width: 12 },
    style: { line: "cyan", text: "white", baseline: "white" },
  });
  const bar = barWidget(container, {
    label: " Network I/O (KB/s) ",
    barWidth: 6,
    barSpacing: 2,
    maxHeight: 100,
    style: { fg: "green" },
  });
  const spark = sparklineWidget(container, {
    label: " Load Average ",
    tags: true,
    style: { fg: "cyan" },
  });
  const donut = donutWidget(container, {
    label: " Disk Usage ",
    radius: 8,
    arcWidth: 3,
    remainColor: "black",
    yPadding: 1,
  });
  const gauge = gaugeWidget(container, {
    label: " Uptime Health ",
    stroke: "green",
    fill: "white",
  });
  const log = logWidget(container, {
    label: " System Log ",
    fg: "green",
    selectedFg: "green",
    bufferLength: 30,
  });
  const table = tableWidget(container, {
    label: " Process Table ",
    columnSpacing: 2,
    columnWidth: [18, 8, 8, 10],
    fg: "white",
    selectedFg: "white",
    selectedBg: "blue",
  });
  const line2 = lineWidget(container, {
    label: " Request Latency (ms) ",
    style: { line: "yellow", text: "white", baseline: "white" },
    xLabelPadding: 3,
    xPadding: 5,
  });

  grid.set({ key: "line", row: 0, column: 0, rowSpan: 4, columnSpan: 6, part: widgetPart(line) });
  grid.set({ key: "bar", row: 0, column: 6, rowSpan: 4, columnSpan: 6, part: widgetPart(bar) });
  grid.set({ key: "spark", row: 4, column: 0, rowSpan: 2, columnSpan: 6, part: widgetPart(spark) });
  grid.set({ key: "donut", row: 4, column: 6, rowSpan: 2, columnSpan: 3, part: widgetPart(donut) });
  grid.set({ key: "gauge", row: 4, column: 9, rowSpan: 2, columnSpan: 3, part: widgetPart(gauge) });
  grid.set({ key: "log", row: 6, column: 0, rowSpan: 3, columnSpan: 6, part: widgetPart(log) });
  grid.set({ key: "table", row: 6, column: 6, rowSpan: 3, columnSpan: 6, part: widgetPart(table) });
  grid.set({ key: "line2", row: 9, column: 0, rowSpan: 3, columnSpan: 12, part: widgetPart(line2) });

  let cpu = randHistory(H, 20, 80);
  let mem = randHistory(H, 40, 90);
  let lat = randHistory(H, 5, 120);
  const logMsgs = [
    "sshd: accepted publickey for admin",
    "nginx: GET /api/health 200 2ms",
    "cron: scheduled backup started",
    "docker: container wibwob-web healthy",
    "postgres: checkpoint complete",
    "redis: background save finished",
    "bun: hot reload triggered",
    "k8s: pod wibwob-api-7f ready",
  ];
  const procs = [
    ["wibwob-api", "node", "148MB", "2.3%"],
    ["postgres", "postgres", "312MB", "1.1%"],
    ["nginx", "root", "24MB", "0.4%"],
    ["redis-server", "redis", "86MB", "0.2%"],
    ["bun", "bun", "96MB", "3.7%"],
    ["dockerd", "root", "204MB", "0.8%"],
  ];

  return {
    ...grid,
    tick(tick) {
      cpu.push(Math.max(5, Math.min(100, cpu[cpu.length - 1]! + (Math.random() - 0.48) * 12)));
      cpu.shift();
      mem.push(Math.max(20, Math.min(100, mem[mem.length - 1]! + (Math.random() - 0.5) * 6)));
      mem.shift();
      line.setData([
        { title: "CPU %", x: XL, y: cpu.map(Math.round), style: { line: "cyan" } },
        { title: "Mem %", x: XL, y: mem.map(Math.round), style: { line: "magenta" } },
      ]);
      const nl = ["eth0↓", "eth0↑", "lo↓", "lo↑", "wg0↓", "wg0↑"];
      bar.setData({ titles: nl, data: nl.map(() => Math.round(Math.random() * 80 + 5)) });
      spark.setData(["1m", "5m"], [
        sinWave(tick, 30, 2, 0.2).map(v => Math.round(Math.abs(v) * 10 + 10)),
        sinWave(tick * 0.5, 30, 1.5, 0.15).map(v => Math.round(Math.abs(v) * 10 + 8)),
      ]);
      const du = 55 + Math.round(Math.sin(tick * 0.05) * 15);
      donut.setData([{ label: "Used", percent: du, color: du > 80 ? "red" : "cyan" }]);
      gauge.setPercent(Math.min(100, Math.max(0, 92 + Math.round(Math.sin(tick * 0.03) * 8))));
      if (tick % 3 === 0) log.log(`${new Date().toISOString().slice(11, 19)} ${logMsgs[Math.floor(Math.random() * logMsgs.length)]}`);
      const sh = [...procs]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5)
        .map(([n, u, m, c]) => [n, u, `${parseInt(m as string, 10) + Math.round((Math.random() - 0.5) * 20)}MB`, `${(parseFloat(c as string) + (Math.random() - 0.5) * 1.5).toFixed(1)}%`]);
      table.setData({ headers: ["Process", "User", "Memory", "CPU"], data: sh });
      lat.push(Math.max(1, Math.min(200, lat[lat.length - 1]! + (Math.random() - 0.5) * 30)));
      lat.shift();
      line2.setData([{ title: "p99", x: XL, y: lat.map(Math.round), style: { line: "yellow" } }]);
    },
  };
}

function buildNetworkTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 12,
    columns: 12,
    gap: { row: 1, column: 1 },
  });

  const bw = lineWidget(container, {
    label: " Bandwidth (Mbps) ",
    showLegend: true,
    legend: { width: 14 },
    style: { line: "green", text: "white", baseline: "white" },
  });
  const connGauge = gaugeWidget(container, {
    label: " Active Connections ",
    stroke: "cyan",
    fill: "white",
  });
  const pktSpark = sparklineWidget(container, {
    label: " Packets/sec ",
    tags: true,
    style: { fg: "green" },
  });
  const connLog = logWidget(container, {
    label: " Connection Log ",
    fg: "cyan",
    selectedFg: "cyan",
    bufferLength: 40,
  });
  const portTable = tableWidget(container, {
    label: " Open Ports ",
    columnSpacing: 2,
    columnWidth: [8, 12, 10, 14],
    fg: "white",
    selectedFg: "white",
    selectedBg: "blue",
  });
  const errLine = lineWidget(container, {
    label: " Error Rate (per min) ",
    style: { line: "red", text: "white", baseline: "white" },
  });

  grid.set({ key: "bw", row: 0, column: 0, rowSpan: 5, columnSpan: 8, part: widgetPart(bw) });
  grid.set({ key: "connGauge", row: 0, column: 8, rowSpan: 2, columnSpan: 4, part: widgetPart(connGauge) });
  grid.set({ key: "pktSpark", row: 2, column: 8, rowSpan: 3, columnSpan: 4, part: widgetPart(pktSpark) });
  grid.set({ key: "connLog", row: 5, column: 0, rowSpan: 4, columnSpan: 6, part: widgetPart(connLog) });
  grid.set({ key: "portTable", row: 5, column: 6, rowSpan: 4, columnSpan: 6, part: widgetPart(portTable) });
  grid.set({ key: "errLine", row: 9, column: 0, rowSpan: 3, columnSpan: 12, part: widgetPart(errLine) });

  let dlHist = randHistory(H, 10, 90);
  let ulHist = randHistory(H, 5, 40);
  let errHist = randHistory(H, 0, 30);
  const connMsgs = [
    "TCP 192.168.1.42:443 ESTABLISHED",
    "UDP 10.0.0.1:53 → dns.google",
    "TCP 172.16.0.5:8080 SYN_RECV",
    "TCP 192.168.1.100:22 ESTABLISHED",
    "ICMP 8.8.8.8 echo reply 14ms",
    "TCP 10.0.0.50:3000 FIN_WAIT",
    "UDP 224.0.0.1:5353 mDNS",
    "TCP 172.16.0.12:443 TIME_WAIT",
  ];
  const ports = [
    ["80", "nginx", "LISTEN", "0.0.0.0:80"],
    ["443", "nginx", "LISTEN", "0.0.0.0:443"],
    ["22", "sshd", "LISTEN", "0.0.0.0:22"],
    ["5432", "postgres", "LISTEN", "127.0.0.1:5432"],
    ["6379", "redis", "LISTEN", "127.0.0.1:6379"],
    ["3000", "bun", "LISTEN", "0.0.0.0:3000"],
    ["8099", "wibwob", "LISTEN", "127.0.0.1:8099"],
    ["9222", "chrome", "LISTEN", "127.0.0.1:9222"],
  ];

  return {
    ...grid,
    tick(tick) {
      dlHist.push(Math.max(0, Math.min(100, dlHist[dlHist.length - 1]! + (Math.random() - 0.5) * 15)));
      dlHist.shift();
      ulHist.push(Math.max(0, Math.min(60, ulHist[ulHist.length - 1]! + (Math.random() - 0.5) * 10)));
      ulHist.shift();
      bw.setData([
        { title: "Download", x: XL, y: dlHist.map(Math.round), style: { line: "green" } },
        { title: "Upload", x: XL, y: ulHist.map(Math.round), style: { line: "yellow" } },
      ]);
      connGauge.setPercent(Math.min(100, Math.max(10, 45 + Math.round(Math.sin(tick * 0.08) * 30))));
      pktSpark.setData(["IN", "OUT"], [
        sinWave(tick, 20, 500, 0.3).map(v => Math.round(Math.abs(v) + 200)),
        sinWave(tick * 0.7, 20, 300, 0.25).map(v => Math.round(Math.abs(v) + 100)),
      ]);
      if (tick % 2 === 0) connLog.log(`${new Date().toISOString().slice(11, 19)} ${connMsgs[Math.floor(Math.random() * connMsgs.length)]}`);
      portTable.setData({ headers: ["Port", "Service", "State", "Address"], data: [...ports].sort(() => Math.random() - 0.5).slice(0, 6) });
      errHist.push(Math.max(0, Math.min(50, errHist[errHist.length - 1]! + (Math.random() - 0.5) * 8)));
      errHist.shift();
      errLine.setData([{ title: "5xx", x: XL, y: errHist.map(Math.round), style: { line: "red" } }]);
    },
  };
}

function buildAppMetricsTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 12,
    columns: 12,
    gap: { row: 1, column: 1 },
  });

  const lcdOpts = (label: string, elems: number, color: string) => ({
    label: ` ${label} `,
    segmentWidth: 0.06,
    segmentInterval: 0.11,
    strokeWidth: 0.1,
    elements: elems,
    display: "0".repeat(elems),
    elementSpacing: 4,
    elementPadding: 2,
    color,
  });

  const lcd = lcdWidget(container, lcdOpts("Requests/sec", 5, "green"));
  const lcd2 = lcdWidget(container, lcdOpts("Active Users", 4, "cyan"));
  const lcd3 = lcdWidget(container, lcdOpts("Queue Depth", 3, "yellow"));
  const gaugeList = gaugeListWidget(container, {
    label: " Service Health ",
    gauges: [{ stack: [95] }, { stack: [88] }, { stack: [99] }, { stack: [72] }],
    style: { fg: "white" },
  });
  const respLine = lineWidget(container, {
    label: " Response Times (ms) ",
    showLegend: true,
    legend: { width: 10 },
    style: { line: "cyan", text: "white", baseline: "white" },
  });
  const deployLog = logWidget(container, {
    label: " Deploy Log ",
    fg: "magenta",
    selectedFg: "magenta",
    bufferLength: 30,
  });
  const featureTable = tableWidget(container, {
    label: " Feature Flags ",
    columnSpacing: 2,
    columnWidth: [22, 10, 10, 12],
    fg: "white",
    selectedFg: "white",
    selectedBg: "blue",
  });
  const throughput = lineWidget(container, {
    label: " Throughput (req/min) ",
    style: { line: "green", text: "white", baseline: "white" },
  });

  grid.set({ key: "lcd", row: 0, column: 0, rowSpan: 3, columnSpan: 4, part: widgetPart(lcd) });
  grid.set({ key: "lcd2", row: 0, column: 4, rowSpan: 3, columnSpan: 4, part: widgetPart(lcd2) });
  grid.set({ key: "lcd3", row: 0, column: 8, rowSpan: 3, columnSpan: 4, part: widgetPart(lcd3) });
  grid.set({ key: "gaugeList", row: 3, column: 0, rowSpan: 3, columnSpan: 6, part: widgetPart(gaugeList) });
  grid.set({ key: "respLine", row: 3, column: 6, rowSpan: 3, columnSpan: 6, part: widgetPart(respLine) });
  grid.set({ key: "deployLog", row: 6, column: 0, rowSpan: 3, columnSpan: 6, part: widgetPart(deployLog) });
  grid.set({ key: "featureTable", row: 6, column: 6, rowSpan: 3, columnSpan: 6, part: widgetPart(featureTable) });
  grid.set({ key: "throughput", row: 9, column: 0, rowSpan: 3, columnSpan: 12, part: widgetPart(throughput) });

  let p50 = randHistory(H, 5, 50);
  let p95 = randHistory(H, 20, 150);
  let p99 = randHistory(H, 50, 300);
  let tput = randHistory(H, 500, 2000);
  let rps = 1200;
  let users = 340;
  let queue = 12;

  const deployMsgs = [
    "v2.14.3 deployed to production",
    "canary: 10% traffic shifted",
    "rollback: v2.14.2 restored",
    "feature: dark-mode enabled 50%",
    "hotfix: memory leak patched",
    "scale: +2 pods (CPU > 80%)",
    "build: image wibwob:latest pushed",
    "test: 847/847 passed",
  ];
  const features = [
    ["dark-mode", "enabled", "50%", "experiment"],
    ["new-editor", "enabled", "100%", "released"],
    ["ai-assist", "enabled", "25%", "canary"],
    ["v3-api", "disabled", "0%", "dev"],
    ["websockets", "enabled", "100%", "released"],
    ["markdown-v2", "enabled", "75%", "rollout"],
    ["image-cache", "enabled", "100%", "released"],
    ["lazy-load", "disabled", "0%", "planned"],
  ];

  return {
    ...grid,
    tick(tick) {
      rps = Math.max(100, Math.min(9999, rps + Math.round((Math.random() - 0.5) * 200)));
      users = Math.max(10, Math.min(9999, users + Math.round((Math.random() - 0.5) * 50)));
      queue = Math.max(0, Math.min(999, queue + Math.round((Math.random() - 0.5) * 5)));
      lcd.setDisplay(String(rps).padStart(5, "0"));
      lcd2.setDisplay(String(users).padStart(4, "0"));
      lcd3.setDisplay(String(queue).padStart(3, "0"));
      gaugeList.setGauges([
        { stack: [Math.min(100, Math.max(50, 95 + Math.round((Math.random() - 0.5) * 10)))] },
        { stack: [Math.min(100, Math.max(50, 88 + Math.round((Math.random() - 0.5) * 15)))] },
        { stack: [Math.min(100, Math.max(70, 99 + Math.round((Math.random() - 0.5) * 5)))] },
        { stack: [Math.min(100, Math.max(30, 72 + Math.round((Math.random() - 0.5) * 20)))] },
      ]);
      p50.push(Math.max(1, Math.min(80, p50[p50.length - 1]! + (Math.random() - 0.5) * 10)));
      p50.shift();
      p95.push(Math.max(10, Math.min(200, p95[p95.length - 1]! + (Math.random() - 0.5) * 20)));
      p95.shift();
      p99.push(Math.max(30, Math.min(400, p99[p99.length - 1]! + (Math.random() - 0.5) * 40)));
      p99.shift();
      respLine.setData([
        { title: "p50", x: XL, y: p50.map(Math.round), style: { line: "green" } },
        { title: "p95", x: XL, y: p95.map(Math.round), style: { line: "yellow" } },
        { title: "p99", x: XL, y: p99.map(Math.round), style: { line: "red" } },
      ]);
      if (tick % 4 === 0) deployLog.log(`${new Date().toISOString().slice(11, 19)} ${deployMsgs[Math.floor(Math.random() * deployMsgs.length)]}`);
      featureTable.setData({ headers: ["Feature", "Status", "Rollout", "Type"], data: [...features].sort(() => Math.random() - 0.5).slice(0, 6) });
      tput.push(Math.max(100, Math.min(3000, tput[tput.length - 1]! + (Math.random() - 0.5) * 200)));
      tput.shift();
      throughput.setData([{ title: "req/min", x: XL, y: tput.map(Math.round), style: { line: "green" } }]);
    },
  };
}

function buildWorldMapTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 12,
    columns: 12,
    gap: { row: 1, column: 1 },
  });

  const map = mapWidget(container, {
    label: " Global Traffic ",
    style: { shapeColor: "cyan" },
  });
  const regionGauge = gaugeListWidget(container, {
    label: " Region Load ",
    gauges: [{ stack: [65] }, { stack: [82] }, { stack: [45] }],
    style: { fg: "white" },
  });
  const regionSpark = sparklineWidget(container, {
    label: " Latency by Region ",
    tags: true,
    style: { fg: "yellow" },
  });
  const geoLog = logWidget(container, {
    label: " Geo Events ",
    fg: "green",
    selectedFg: "green",
    bufferLength: 30,
  });
  const cdnTable = tableWidget(container, {
    label: " CDN Nodes ",
    columnSpacing: 2,
    columnWidth: [14, 10, 10, 12],
    fg: "white",
    selectedFg: "white",
    selectedBg: "blue",
  });
  const globalLine = lineWidget(container, {
    label: " Global Requests/sec ",
    showLegend: true,
    legend: { width: 10 },
    style: { line: "cyan", text: "white", baseline: "white" },
  });

  grid.set({ key: "map", row: 0, column: 0, rowSpan: 6, columnSpan: 8, part: widgetPart(map) });
  grid.set({ key: "regionGauge", row: 0, column: 8, rowSpan: 3, columnSpan: 4, part: widgetPart(regionGauge) });
  grid.set({ key: "regionSpark", row: 3, column: 8, rowSpan: 3, columnSpan: 4, part: widgetPart(regionSpark) });
  grid.set({ key: "geoLog", row: 6, column: 0, rowSpan: 3, columnSpan: 6, part: widgetPart(geoLog) });
  grid.set({ key: "cdnTable", row: 6, column: 6, rowSpan: 3, columnSpan: 6, part: widgetPart(cdnTable) });
  grid.set({ key: "globalLine", row: 9, column: 0, rowSpan: 3, columnSpan: 12, part: widgetPart(globalLine) });

  const cities = [
    { lon: -73.94, lat: 40.67, name: "New York" },
    { lon: -0.12, lat: 51.5, name: "London" },
    { lon: 139.69, lat: 35.68, name: "Tokyo" },
    { lon: -122.41, lat: 37.77, name: "San Francisco" },
    { lon: 2.35, lat: 48.85, name: "Paris" },
    { lon: 13.40, lat: 52.52, name: "Berlin" },
    { lon: 151.21, lat: -33.87, name: "Sydney" },
    { lon: 103.85, lat: 1.35, name: "Singapore" },
    { lon: -46.63, lat: -23.55, name: "São Paulo" },
  ];
  const geoMsgs = cities.map(c => `${c.name}: ${Math.round(Math.random() * 500 + 100)} req/s`);
  const cdnNodes = [
    ["us-east-1", "Virginia", "active", "32ms"],
    ["eu-west-1", "Ireland", "active", "18ms"],
    ["ap-northeast-1", "Tokyo", "active", "45ms"],
    ["ap-southeast-1", "Singapore", "active", "52ms"],
    ["sa-east-1", "São Paulo", "active", "78ms"],
    ["eu-central-1", "Frankfurt", "active", "22ms"],
  ];
  let euHist = randHistory(H, 200, 800);
  let usHist = randHistory(H, 300, 1200);
  let apHist = randHistory(H, 100, 500);

  return {
    ...grid,
    tick(tick) {
      const active = [0, 1, 2].map(() => cities[Math.floor(Math.random() * cities.length)]!);
      map.clearMarkers();
      for (const c of active) {
        map.addMarker({ lon: c.lon + (Math.random() - 0.5) * 2, lat: c.lat + (Math.random() - 0.5) * 2, color: "red", char: "X" });
      }
      regionGauge.setGauges([
        { stack: [Math.min(100, Math.max(20, 65 + Math.round((Math.random() - 0.5) * 30)))] },
        { stack: [Math.min(100, Math.max(20, 82 + Math.round((Math.random() - 0.5) * 25)))] },
        { stack: [Math.min(100, Math.max(20, 45 + Math.round((Math.random() - 0.5) * 20)))] },
      ]);
      regionSpark.setData(["EU", "US", "AP"], [
        sinWave(tick, 20, 30, 0.2).map(v => Math.round(Math.abs(v) + 15)),
        sinWave(tick * 0.8, 20, 25, 0.25).map(v => Math.round(Math.abs(v) + 20)),
        sinWave(tick * 0.6, 20, 40, 0.15).map(v => Math.round(Math.abs(v) + 30)),
      ]);
      if (tick % 2 === 0) geoLog.log(`${new Date().toISOString().slice(11, 19)} ${geoMsgs[Math.floor(Math.random() * geoMsgs.length)]}`);
      const sn = [...cdnNodes].map(([id, loc, st, lat]) => [id, loc, st, `${parseInt(lat as string, 10) + Math.round((Math.random() - 0.5) * 10)}ms`]);
      cdnTable.setData({ headers: ["Node", "Location", "Status", "Latency"], data: sn });
      euHist.push(Math.max(50, Math.min(1000, euHist[euHist.length - 1]! + (Math.random() - 0.5) * 100)));
      euHist.shift();
      usHist.push(Math.max(100, Math.min(1500, usHist[usHist.length - 1]! + (Math.random() - 0.5) * 120)));
      usHist.shift();
      apHist.push(Math.max(50, Math.min(800, apHist[apHist.length - 1]! + (Math.random() - 0.5) * 80)));
      apHist.shift();
      globalLine.setData([
        { title: "EU", x: XL, y: euHist.map(Math.round), style: { line: "cyan" } },
        { title: "US", x: XL, y: usHist.map(Math.round), style: { line: "green" } },
        { title: "AP", x: XL, y: apHist.map(Math.round), style: { line: "yellow" } },
      ]);
    },
  };
}

function buildCreativeTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 24,
    columns: 12,
    gap: { row: 1, column: 1 },
  });

  const clockBox = blessed.box({
    parent: container,
    label: " Figlet Clock ",
    border: { type: "line" },
    style: { fg: "cyan", border: { fg: "cyan" } },
  });
  const gradientBox = blessed.box({
    parent: container,
    label: " Colour Gradients ",
    border: { type: "line" },
    style: { fg: "white", border: { fg: "magenta" } },
  });
  const artBox = blessed.box({
    parent: container,
    label: " Animated Art ",
    border: { type: "line" },
    style: { fg: "green", border: { fg: "green" } },
  });
  const marqueeBox = blessed.box({
    parent: container,
    label: " Figlet Marquee ",
    border: { type: "line" },
    style: { fg: "yellow", border: { fg: "yellow" } },
  });

  grid.set({ key: "clock", row: 0, column: 0, rowSpan: 8, columnSpan: 12, part: widgetPart(clockBox) });
  grid.set({ key: "gradient", row: 8, column: 0, rowSpan: 8, columnSpan: 6, part: widgetPart(gradientBox) });
  grid.set({ key: "art", row: 8, column: 6, rowSpan: 8, columnSpan: 6, part: widgetPart(artBox) });
  grid.set({ key: "marquee", row: 16, column: 0, rowSpan: 8, columnSpan: 12, part: widgetPart(marqueeBox) });

  const words = ["WIBWOB", "DOS", "SYMBIENT", "DASHBOARD", "BLESSED", "CONTRIB"];
  const artFrames = [
    ["    ╔══╗    ", "    ║◉◉║    ", "    ║──║    ", "    ╚══╝    ", "   /│  │\\\\   ", "  / │  │ \\\\  ", " ╱  └──┘  ╲ "],
    ["    ╔══╗    ", "    ║◉ ║    ", "    ║──║    ", "    ╚══╝    ", "  ─/│  │\\\\─  ", "  / │  │ \\\\  ", " ╱  └──┘  ╲ "],
    ["    ╔══╗    ", "    ║ ◉║    ", "    ║──║    ", "    ╚══╝    ", "   /│  │\\\\   ", "  ─ │  │ ─  ", " ╱  └──┘  ╲ "],
    ["    ╔══╗    ", "    ║◉◉║    ", "    ║▬▬║    ", "    ╚══╝    ", "   /│  │\\\\   ", "  / │  │ \\\\  ", " ╱  └──┘  ╲ "],
  ];

  return {
    ...grid,
    tick(tick) {
      clockBox.setContent(renderFiglet(new Date().toTimeString().slice(0, 8), "big"));
      const w = (gradientBox.width as number || 50) - 2;
      const lines: string[] = [];
      for (let row = 0; row < 8; row++) {
        const hueStart = (tick * 5 + row * 40) % 360;
        lines.push(ansiGradientLine(w, hueStart, hueStart + 180));
      }
      gradientBox.setContent(lines.join("\\n"));
      const frame = artFrames[tick % artFrames.length]!;
      artBox.setContent("\\n" + frame.join("\\n"));
      const wordIdx = Math.floor(tick / 5) % words.length;
      marqueeBox.setContent(renderFiglet(words[wordIdx]!, "slant"));
    },
  };
}

function buildMosaicTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 8,
    columns: 6,
    gap: { row: 1, column: 1 },
  });

  const layout = [
    { key: "symbient", row: 0, column: 0, rowSpan: 2, columnSpan: 3, type: "figlet", text: "SYMBIENT", font: "slant" },
    { key: "p0", row: 0, column: 3, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 0 },
    { key: "p1", row: 0, column: 4, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 1 },
    { key: "p2", row: 0, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 2 },
    { key: "p3", row: 1, column: 3, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 3 },
    { key: "p4", row: 1, column: 4, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 4 },
    { key: "p5", row: 1, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 5 },
    { key: "p6", row: 2, column: 0, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 6 },
    { key: "wibwob", row: 2, column: 1, rowSpan: 2, columnSpan: 3, type: "figlet", text: "WIBWOB", font: "big" },
    { key: "p7", row: 2, column: 4, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 7 },
    { key: "p8", row: 2, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 8 },
    { key: "p9", row: 3, column: 0, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 9 },
    { key: "p10", row: 3, column: 4, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 10 },
    { key: "p11", row: 3, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 0 },
    { key: "p12", row: 4, column: 0, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 1 },
    { key: "p13", row: 4, column: 1, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 2 },
    { key: "dos", row: 4, column: 2, rowSpan: 2, columnSpan: 3, type: "figlet", text: "DOS", font: "banner3" },
    { key: "p14", row: 4, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 3 },
    { key: "p15", row: 5, column: 0, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 4 },
    { key: "p16", row: 5, column: 1, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 5 },
    { key: "p17", row: 5, column: 5, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 6 },
    { key: "blessed", row: 6, column: 0, rowSpan: 2, columnSpan: 2, type: "figlet", text: "BLESSED", font: "small" },
    { key: "p18", row: 6, column: 2, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 7 },
    { key: "p19", row: 6, column: 3, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 8 },
    { key: "contrib", row: 6, column: 4, rowSpan: 2, columnSpan: 2, type: "figlet", text: "CONTRIB", font: "small" },
    { key: "p20", row: 7, column: 2, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 9 },
    { key: "p21", row: 7, column: 3, rowSpan: 1, columnSpan: 1, type: "pattern", patternIdx: 10 },
  ] as const;

  const cells = layout.map((def) => {
    const box = blessed.box({
      parent: container,
      border: { type: "line" },
      style: { fg: def.type === "figlet" ? "cyan" : "white", border: { fg: def.type === "figlet" ? "cyan" : "gray" } },
      tags: false,
    });
    if (def.type === "figlet") {
      box.setContent(renderFiglet(def.text, def.font));
    }
    grid.set({
      key: def.key,
      row: def.row,
      column: def.column,
      rowSpan: def.rowSpan,
      columnSpan: def.columnSpan,
      part: widgetPart(box),
    });
    return { ...def, box };
  });

  return {
    ...grid,
    tick(tick) {
      for (const cell of cells) {
        if (cell.type !== "pattern") continue;
        const fn = PATTERNS[(cell.patternIdx ?? 0) % PATTERNS.length]!;
        const bw = Math.max(1, (cell.box.width as number || 10) - 2);
        const bh = Math.max(1, (cell.box.height as number || 5) - 2);
        cell.box.setContent(fn(bw, bh, tick).join("\\n"));
      }
    },
  };
}

type EmojiTest = {
  label: string;
  note: string;
  chars: string[];
  fill?: boolean;
};

const EMOJI_TESTS: EmojiTest[] = [
  { label: "Basic Emoji", note: "EAW:W — should be 2 cols each", chars: ["😀", "😎", "🔥", "💀", "👻", "🎉", "🚀", "⭐", "❤️", "🌈"], fill: true },
  { label: "Skin Tone Modifiers", note: "Base + modifier = 1 glyph, 2 cols", chars: ["👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿", "👍🏻", "👍🏿"] },
  { label: "ZWJ Sequences", note: "Multiple codepoints, 1 glyph, 2 cols", chars: ["👨‍👩‍👧‍👦", "👩‍💻", "🏳️‍🌈", "👨‍🎤", "🧑‍🚀", "👩‍🔬"] },
  { label: "Variation Selectors", note: "VS16 makes text emoji render as graphic", chars: ["☺️", "☺", "❤️", "❤", "✨", "⭐", "☠️", "☠"] },
  { label: "CJK Ideographs", note: "EAW:W — 2 cols, well-supported", chars: ["漢", "字", "日", "本", "語", "中", "文", "東", "京", "道"], fill: true },
  { label: "Hangul Syllables", note: "EAW:W — 2 cols", chars: ["한", "글", "가", "나", "다", "라", "마", "바", "사", "아"], fill: true },
  { label: "Box Drawing", note: "EAW:N — 1 col, safe", chars: ["┌", "─", "┐", "│", "└", "┘", "├", "┤", "┬", "┴", "┼", "═", "║", "╔", "╗", "╚", "╝"], fill: true },
  { label: "Block Elements", note: "EAW:A — ambiguous, usually 1 col", chars: ["░", "▒", "▓", "█", "▀", "▄", "▌", "▐", "▍", "▎", "▏", "▊", "▋"], fill: true },
  { label: "Braille Patterns", note: "EAW:N — 1 col, safe", chars: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠿", "⣿", "⣶", "⣤", "⣀"], fill: true },
  { label: "Misc Symbols", note: "EAW:N/A — width varies by terminal", chars: ["♠", "♣", "♥", "♦", "♪", "♫", "☆", "★", "○", "●", "◎", "□", "■"], fill: true },
  { label: "Dingbats", note: "EAW:N — but some terminals render wide", chars: ["✓", "✗", "✦", "✧", "✩", "✪", "✫", "✬", "✭", "✮", "✯", "✰"], fill: true },
  { label: "Math Symbols", note: "EAW:A/N — usually 1 col", chars: ["∀", "∃", "∅", "∇", "∈", "∉", "∋", "∏", "∑", "√", "∞", "∧", "∨"], fill: true },
  { label: "Arrows", note: "EAW:N — 1 col", chars: ["←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓", "⇔", "➜", "➤"], fill: true },
  { label: "Trigrams (EAW:W!)", note: "EAW:W — these BREAK blessed layout", chars: ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"] },
  { label: "Flags", note: "Regional indicators, 2 codepoints each", chars: ["🇬🇧", "🇺🇸", "🇯🇵", "🇫🇷", "🇩🇪", "🇧🇷", "🇦🇺"] },
  { label: "Keycaps", note: "Digit + VS16 + combining enclosing keycap", chars: ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "#️⃣", "*️⃣"] },
  { label: "Animal Emoji", note: "EAW:W — fill test", chars: ["🐱", "🐶", "🐸", "🐙", "🦊", "🐝", "🦋", "🐢", "🐬", "🐧"], fill: true },
  { label: "Food Emoji", note: "EAW:W — fill test", chars: ["🍕", "🍔", "🌮", "🍣", "🍩", "🎂", "🍺", "☕", "🧁", "🥐"], fill: true },
  { label: "Weather/Nature", note: "Mix of EAW:W and N", chars: ["🌞", "🌙", "⛅", "🌧️", "❄️", "⚡", "🌊", "🍃", "🌸", "🌻"], fill: true },
  { label: "ASCII Baseline", note: "Control — plain ASCII baseline", chars: ["A", "B", "C", "1", "2", "3", "#", "@", "&", "%", "!", "?"], fill: true },
];

function buildEmojiTab(container: blessed.Widgets.BoxElement): TabPart {
  const grid = createGrid(container, {
    rows: 4,
    columns: 5,
    gap: { row: 1, column: 1 },
  });

  const cells = EMOJI_TESTS.slice(0, 20).map((test, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const box = blessed.box({
      parent: container,
      border: { type: "line" },
      label: ` ${test.label} `,
      tags: false,
      style: { fg: "white", border: { fg: "gray" } },
    });
    grid.set({ key: `emoji-${index}`, row, column, rowSpan: 1, columnSpan: 1, part: widgetPart(box) });
    return { box, test };
  });

  return {
    ...grid,
    tick(tick) {
      for (const { box, test } of cells) {
        const bw = Math.max(1, (box.width as number || 20) - 2);
        const bh = Math.max(1, (box.height as number || 8) - 2);
        const lines: string[] = [test.note, ""];
        if (test.fill) {
          for (let y = 0; y < bh - 2; y++) {
            let line = "";
            let col = 0;
            while (col < bw) {
              line += test.chars[(col + y + tick) % test.chars.length]!;
              col++;
            }
            lines.push(line);
          }
        } else {
          let line = "";
          for (const ch of test.chars) {
            line += ch + " ";
            if (line.length > bw - 4) {
              lines.push(line);
              line = "";
            }
          }
          if (line) lines.push(line);
        }
        box.setContent(lines.join("\\n"));
      }
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dashboard",
    menu: [{ category: "applications", order: 55, label: "Dashboard" }],
    palette: { order: 220, label: "Dashboard" },
    action: () => {
      const win = host.createWindow({ title: "Dashboard", width: 140, height: 48 });
      const screen = host.screen;
      const timers = new Set<ReturnType<typeof setInterval>>();
      let tick = 0;

      let systemTab: TabPart;
      let networkTab: TabPart;
      let appMetricsTab: TabPart;
      let worldMapTab: TabPart;
      let creativeTab: TabPart;
      let mosaicTab: TabPart;
      let emojiTab: TabPart;

      const tabHandle: TabbedContainerHandle = createTabs(win.body, [
        { name: "System", build: (c) => { systemTab = buildSystemTab(c); }, update: () => systemTab.tick(tick) },
        { name: "Network", build: (c) => { networkTab = buildNetworkTab(c); }, update: () => networkTab.tick(tick) },
        { name: "App Metrics", build: (c) => { appMetricsTab = buildAppMetricsTab(c); }, update: () => appMetricsTab.tick(tick) },
        { name: "World Map", build: (c) => { worldMapTab = buildWorldMapTab(c); }, update: () => worldMapTab.tick(tick) },
        { name: "Creative", build: (c) => { creativeTab = buildCreativeTab(c); }, update: () => creativeTab.tick(tick) },
        { name: "Mosaic", build: (c) => { mosaicTab = buildMosaicTab(c); }, update: () => mosaicTab.tick(tick) },
        { name: "Emoji", build: (c) => { emojiTab = buildEmojiTab(c); }, update: () => emojiTab.tick(tick) },
      ]);

      createTimer(() => {
        tick++;
        tabHandle.tickActive();
        screen.render();
      }, 1000, timers);

      tabHandle.tickActive();
      screen.render();

      win.onCleanup(() => {
        clearTimers(timers);
        tabHandle.destroy();
      });

      win.describeState(() => ({
        summary: `Dashboard tab ${tabHandle.active + 1}/7 — tick ${tick}`,
      }));

      win.captureText(() => `Dashboard — tick ${tick}`);
      win.onRestyle(() => {
        tabHandle.renderBar();
        screen.render();
      });
      win.focus();
    },
  });
}
```

## Common decisions

### Choose flex first when:

- there is one obvious reading direction
- most children are full-width or full-height bands
- you can express the screen by nesting 2-3 strips

### Choose grid first when:

- two children need to align across both axes
- multiple spans matter
- you would otherwise compute rectangles manually
- you are replacing a contrib grid or hand-built dashboard

### Use both when:

- the page shell is linear, but a content region is panel-based
- one grid cell contains a header/body/footer mini-layout

## Decision flowchart

```text
Start
  |
  |-- Is the layout fundamentally one-dimensional?
  |      |
  |      |-- Yes --> Use flex
  |      |             |
  |      |             |-- Vertical sequence? ---> createStack
  |      |             |
  |      |             |-- Horizontal sequence? -> createRow
  |      |
  |      |-- No --> Do children need explicit row/column placement or spans?
  |                     |
  |                     |-- Yes --> createGrid
  |                     |
  |                     |-- No --> Start with flex and nest
  |
  |-- Are you about to write manual top/left/width/height math?
         |
         |-- Yes --> Stop and use createGrid
         |
         |-- No --> Your current primitive is probably correct
```

Rule of thumb: if you can name the layout as bands, use flex. If you can name
cells and spans, use grid.
