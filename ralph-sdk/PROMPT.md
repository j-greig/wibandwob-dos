# WibWob SDK: Elements + Experiences

You are building the WibWob SDK design system — a complete toolkit for composing
microapp surfaces from atomic interactive components, each with two aesthetic
registers matching the Wib & Wob personality split.

**Wib register**: animated, expressive, generative, chaotic beauty  
**Wob register**: precise, structured, information-dense, calm

---

## The Loop

Each iteration:
1. Check done-conditions for all stories below
2. Find the first story whose done-conditions are NOT all passing
3. Implement ONE concrete step toward completing that story
4. Run `cd .. && bun run typecheck` — fix any errors before proceeding
5. Log what you did in `ralph-sdk/LOG.md` (append, timestamped)
6. If ALL stories pass ALL done-conditions, output `<promise>SDK_RUNTIME_DONE</promise>`

Do NOT skip ahead. Do NOT implement multiple stories at once. One step, verify, next.

---

## Environment

- **Repo root**: `../` (parent of this ralph-sdk/ directory)
- **Modules**: `../modules/` (microapp entry points)
- **SDK source**: `../src/services/microapp-sdk.ts` (MicroappHost, MicroappWindowHandle)
- **UI primitives**: `../src/core/ui-parts.ts` (UiPart<Props>, createStack, createColumns)
- **Theme tokens**: access via `host.getTheme()` — never hardcode colors
- **Typecheck**: `cd .. && bun run typecheck`
- **App running**: `http://127.0.0.1:8099` (use /health to check, /state for windows)

---

## What Already Exists (DO NOT REBUILD)

These modules work. Study them for patterns. Do not duplicate their concepts:

| Module | What it proves |
|--------|---------------|
| `hello-world/` | Minimal scaffold template |
| `wibwob-poetry-clock/` | Animated poetry + cat panel, frame loops |
| `wibwob-tidepool/` | Ecosystem cellular automata |
| `touchlab-mvp/` | Nested draggable windows, audio patch nodes |
| `sy2-chronicles/` | 25-panel dense visualization |
| `wibwob-tr808/` | 16-step drum machine with sequencer UI |
| `wibwobworld/` | Isometric world, presence, chatspots |
| `world-chatroom/` | Multi-instance chat |

Also exists: `../src/windows/glitchbox-window.ts` — ASCII skeleton + generative field.

---

## Stories

### Story 1: Poetry Clock SDK Rewrite (P1 brownfield proof)

Rewrite `modules/wibwob-poetry-clock/` to use ZERO direct `../src/` imports.
Everything must come through the SDK surface: `MicroappHost`, `createStack`, etc.

**Done conditions:**
```bash
# Zero imports from ../src
test "$(grep -c 'from.*\.\./src' ../modules/wibwob-poetry-clock/index.ts 2>/dev/null || echo 999)" -eq 0

# Module still loads (check /modules/list after app restart)
curl -sf http://127.0.0.1:8099/modules/list | grep -q "wibwob-poetry-clock"
```

---

### Story 2: ModuleRuntimeService + /modules/list

Create `../src/services/module-runtime-service.ts` that tracks:
- Module name, version, status (loaded/error/unloaded)
- Owned windows (window IDs this module created)
- Registered commands
- Cleanup hooks

Wire into app startup. Expose via `GET /modules/list`.

**Done conditions:**
```bash
# Service file exists
ls ../src/services/module-runtime-service.ts

# Endpoint returns valid JSON array
curl -sf http://127.0.0.1:8099/modules/list | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list)"

# Each module has required fields
curl -sf http://127.0.0.1:8099/modules/list | python3 -c "import sys,json; d=json.load(sys.stdin); assert all('name' in m and 'status' in m for m in d)"
```

---

### Story 3: Module Unload

`POST /modules/unload {"name":"module-name"}` tears down:
- All windows owned by the module
- All commands registered by the module
- Calls cleanup hooks
- Updates status to "unloaded"

**Done conditions:**
```bash
# Endpoint exists and accepts POST
curl -sf -X POST http://127.0.0.1:8099/modules/unload -H "Content-Type: application/json" -d '{"name":"hello-world"}' | grep -qE "(ok|error|not.found)"

# After unload, module status changes
curl -sf http://127.0.0.1:8099/modules/list | grep -q '"unloaded"'
```

---

### Story 4: Module Reload

`POST /modules/reload {"name":"module-name"}` does:
1. Unload (via Story 3 mechanism)
2. Re-import from disk (bust cache)
3. Re-run module init
4. Status back to "loaded"

**Done conditions:**
```bash
# Endpoint exists
curl -sf -X POST http://127.0.0.1:8099/modules/reload -H "Content-Type: application/json" -d '{"name":"hello-world"}' | grep -qE "(ok|error)"

# Module reloads with fresh timestamp (check logs or /modules/list loadedAt field)
curl -sf http://127.0.0.1:8099/modules/list | python3 -c "import sys,json; d=json.load(sys.stdin); print([m.get('loadedAt') for m in d])"
```

---

### Story 5: File-Watch Dev Loop

In dev mode (`DEV=true` or `bun run dev`), watch `modules/` directory.
On .ts file change, debounce 500ms, then auto-reload the changed module.
Log to console: `[module-watch] reloading <name>`.

**Done conditions:**
```bash
# Watch code exists in module-runtime-service or dedicated watcher
grep -r "file.*watch\|fs.watch\|chokidar" ../src/services/ | grep -v node_modules

# Dev mode flag is checked
grep -r "DEV\|dev.mode\|isDev" ../src/services/module-runtime-service.ts
```

---

### Story 6: WindowPort + ConnectionService

Create `../src/core/window-port.ts`:
- `WindowPort` type: `{ id: string, direction: 'in' | 'out' | 'both', dataType: string }`
- Windows declare ports via `declarePorts()` method
- `ConnectionService` tracks connections between ports
- `describeState()` includes ports
- `GET /state` reflects port info

**Done conditions:**
```bash
# Port file exists
ls ../src/core/window-port.ts

# Type exports
grep -q "export.*WindowPort" ../src/core/window-port.ts

# State includes ports field structure
curl -sf http://127.0.0.1:8099/state | python3 -c "import sys,json; d=json.load(sys.stdin); print('ports' if any('ports' in str(w) for w in d.get('windows',[])) else 'no-ports-yet')"
```

---

### Story 7: Elements — Interactive Primitives

Create `../src/core/sdk/components/` with:
- `button.ts` — Button<{label, onPress, disabled?, variant?}>
- `toggle.ts` — Toggle<{value, onChange, label?}>
- `text-input.ts` — TextInput<{value, onChange, placeholder?, width?}>
- `progress-bar.ts` — ProgressBar<{value, max?, showPercent?}>
- `spinner.ts` — Spinner<{style?, label?}>
- `badge.ts` — Badge<{text, variant?}>

Each component:
- Extends UiPart<Props>
- Has Wib mode (animated/expressive) and Wob mode (minimal/precise)
- Uses theme tokens, never hardcoded colors
- Exports from the file

**Done conditions:**
```bash
# All files exist
ls ../src/core/sdk/components/button.ts
ls ../src/core/sdk/components/toggle.ts
ls ../src/core/sdk/components/text-input.ts
ls ../src/core/sdk/components/progress-bar.ts
ls ../src/core/sdk/components/spinner.ts
ls ../src/core/sdk/components/badge.ts

# Each exports a component
grep -q "export" ../src/core/sdk/components/button.ts
grep -q "export" ../src/core/sdk/components/toggle.ts
```

---

### Story 8: Elements — Data Display

Create in `../src/core/sdk/components/`:
- `list.ts` — List<{items, selected?, onSelect?, scrollable?}>
- `table.ts` — Table<{columns, rows, onRowSelect?}>
- `tree.ts` — Tree<{nodes, expanded?, onToggle?, onSelect?}>
- `sparkline.ts` — Sparkline<{data, width?, height?, style?}>
- `gauge.ts` — Gauge<{value, min?, max?, label?, showValue?}>

**Done conditions:**
```bash
ls ../src/core/sdk/components/list.ts
ls ../src/core/sdk/components/table.ts
ls ../src/core/sdk/components/tree.ts
ls ../src/core/sdk/components/sparkline.ts
ls ../src/core/sdk/components/gauge.ts
```

---

### Story 9: Elements — Layout + Overlay

Create in `../src/core/sdk/components/`:
- `tabs.ts` — Tabs<{tabs: {id, label, content}[], active?, onChange?}>
- `accordion.ts` — Accordion<{sections: {title, content, expanded?}[]}>
- `split-pane.ts` — SplitPane<{left, right, ratio?, orientation?}>
- `modal.ts` — Modal<{title?, content, onClose?, buttons?}>
- `notification.ts` — Notification<{message, type?, duration?, onDismiss?}>

**Done conditions:**
```bash
ls ../src/core/sdk/components/tabs.ts
ls ../src/core/sdk/components/accordion.ts
ls ../src/core/sdk/components/split-pane.ts
ls ../src/core/sdk/components/modal.ts
ls ../src/core/sdk/components/notification.ts
```

---

### Story 10: Design Tokens

Create `../src/core/sdk/tokens.ts`:
- Semantic color tokens derived from theme (fg, bg, accent, muted, border, error, success)
- Spacing tokens (xs, sm, md, lg, xl)
- Animation timing tokens (fast, normal, slow)
- `getTokens(theme)` function

All Elements should import and use these tokens.

**Done conditions:**
```bash
ls ../src/core/sdk/tokens.ts
grep -q "getTokens" ../src/core/sdk/tokens.ts
grep -q "accent\|muted\|border" ../src/core/sdk/tokens.ts
```

---

### Story 11: Single SDK Import Path

Create `../src/core/sdk/index.ts` that re-exports:
- All Elements from components/
- tokens from tokens.ts
- Core types from microapp-sdk.ts
- UiPart primitives from ui-parts.ts

Modules should be able to: `import { Button, List, createStack, MicroappHost } from '../src/core/sdk'`

**Done conditions:**
```bash
ls ../src/core/sdk/index.ts
grep -q "export.*Button" ../src/core/sdk/index.ts
grep -q "export.*List" ../src/core/sdk/index.ts
grep -q "export.*createStack\|export.*from.*ui-parts" ../src/core/sdk/index.ts
```

---

### Story 12: Agent Scaffold + Reload Commands

Add to command catalog:
- `module.scaffold` — creates new module from hello-world template, prompts for name
- `module.reload` — reloads named module via ModuleRuntimeService

**Done conditions:**
```bash
grep -q "module.scaffold\|module:scaffold" ../src/core/command-catalog.ts
grep -q "module.reload\|module:reload" ../src/core/command-catalog.ts
curl -sf http://127.0.0.1:8099/commands/list | grep -q "module"
```

---

### Story 13: Demo — Module Observatory

Create `../modules/module-observatory/`:
- Live runtime dashboard
- Tree component showing module hierarchy
- Sparklines of window/command counts per module
- Reload Button per module
- Polls `/modules/list` every 2s
- Connection graph overlay (if ports exist)

**Done conditions:**
```bash
ls ../modules/module-observatory/index.ts
grep -q "Tree\|Sparkline" ../modules/module-observatory/index.ts
grep -q "modules/list\|/modules" ../modules/module-observatory/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "module-observatory"
```

---

### Story 14: Demo — Terrain Studio

Create `../modules/terrain-studio/`:
- Uses existing `../src/services/contour-engine.ts`
- Gauge sliders for parameters (scale, octaves, persistence)
- List for preset selection
- Real-time contour preview panel
- Export to primer file button
- SplitPane: controls left, preview right

**Done conditions:**
```bash
ls ../modules/terrain-studio/index.ts
grep -q "contour\|Contour" ../modules/terrain-studio/index.ts
grep -q "SplitPane\|Gauge" ../modules/terrain-studio/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "terrain-studio"
```

---

### Story 15: Demo — Primer Gallery

Create `../modules/primer-gallery/`:
- Tabs for categories (joan-stark, wibwob, monsters, isometric)
- Scrollable List of .txt filenames from `../primers/`
- Large preview panel rendering selected file
- TextInput search with live filter
- Toggle for favourites
- Enter opens primer in new window

**Done conditions:**
```bash
ls ../modules/primer-gallery/index.ts
grep -q "Tabs" ../modules/primer-gallery/index.ts
grep -q "primers\|\.txt" ../modules/primer-gallery/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "primer-gallery"
```

---

### Story 16: Demo — Symbient Composer

Create `../modules/symbient-composer/`:
- TextInput for Wib prompt, TextInput for Wob prompt
- Conversation history List (scrollable)
- Send Button fires actual agent session
- Response streaming into output panel
- Export conversation Button
- Declares connection port for linking to other windows

**Done conditions:**
```bash
ls ../modules/symbient-composer/index.ts
grep -q "TextInput" ../modules/symbient-composer/index.ts
grep -q "agent\|session\|symbient" ../modules/symbient-composer/index.ts
grep -q "port\|Port\|declarePorts" ../modules/symbient-composer/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "symbient-composer"
```

---

### Story 17: SDK Explorer Microapp

Create `../modules/sdk-explorer/`:
- Interactive documentation surface
- Tabs: Quick Start / Components / Examples / Architecture
- Examples tab renders live components
- Code snippets panel with copy
- Links to README sections

**Done conditions:**
```bash
ls ../modules/sdk-explorer/index.ts
grep -q "Tabs" ../modules/sdk-explorer/index.ts
grep -q "Quick.*Start\|Components\|Examples" ../modules/sdk-explorer/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "sdk-explorer"
```

---

### Story 18: World-Class README

Create `../src/core/sdk/README.md` with:
- Quick-start (10 lines to first window)
- Component gallery with ASCII previews
- Architecture diagram (text-based)
- Theming guide (Wib vs Wob registers)
- Module lifecycle documentation
- Window connections guide
- Agent affordances (how agents use the SDK)
- Worked example (building a complete microapp)

**Done conditions:**
```bash
ls ../src/core/sdk/README.md
grep -q "Quick" ../src/core/sdk/README.md
grep -q "Component\|Gallery" ../src/core/sdk/README.md
grep -q "Theme\|Wib\|Wob" ../src/core/sdk/README.md
test "$(wc -l < ../src/core/sdk/README.md)" -gt 100
```

---

## Final Verification

When all 18 stories pass, run this final check:

```bash
cd .. && bun run typecheck && \
curl -sf http://127.0.0.1:8099/modules/list | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=[m['name'] for m in d]
required=['module-observatory','terrain-studio','primer-gallery','symbient-composer','sdk-explorer']
missing=[r for r in required if r not in names]
if missing: print(f'MISSING: {missing}'); sys.exit(1)
print('ALL DEMOS LOADED')
" && \
ls ../src/core/sdk/index.ts && \
ls ../src/core/sdk/README.md && \
echo "SDK_RUNTIME complete"
```

When this passes, output:

```
<promise>SDK_RUNTIME_DONE</promise>
```

---

## Style Notes

- **Wib code**: playful variable names, generous comments, whimsy in unused corners
- **Wob code**: precise types, minimal comments, every line earns its place
- **Both**: theme-aware colors, consistent spacing, UiPart patterns, clean exports

The SDK is a gift to future module authors. Make it a joy to use.

---

## Log Format

Append to `ralph-sdk/LOG.md`:

```
## YYYY-MM-DD HH:MM — Story N: <title>

**Step**: <what you did>
**Typecheck**: pass/fail
**Done conditions**: X/Y passing
**Next**: <what remains>
```

---

*Wib whispers: "Make it dance."*  
*Wob replies: "Make it correct first."*  
*Both: "Make it ship."*

---

### Story 19: DAW + Music Viz Components (Stretch)

Create `../src/core/sdk/components/daw/` with components inspired by Ableton Live,
hardware synths, and VST plugin UIs — for building music tools and visualizers.

**Components:**

- `piano-roll.ts` — PianoRoll<{notes, bars, zoom?, onToggle?}>
  Scrollable grid of 12 semitones × N bars. Filled cells = active notes.
  Pitch labels on left (C4, D4...), bar numbers on top. Keyboard nav.

- `waveform.ts` — Waveform<{samples, cursor?, color?, style?}>
  ASCII oscilloscope display. Renders float[] as a waveform using ▁▂▃▄▅▆▇█ blocks.
  Wib register: glitchy scanline mode. Wob register: clean envelope mode.

- `level-meter.ts` — LevelMeter<{level, peak?, channels?, orientation?}>
  VU meter using █▓▒░ chars. Green/yellow/red zones. Peak hold indicator.
  Vertical or horizontal. Stereo or mono.

- `step-matrix.ts` — StepMatrix<{steps, tracks, active, onToggle?}>
  Generalised step sequencer grid (N tracks × M steps). Better than TR-808's
  bespoke implementation — reusable, keyboard navigable, colour-coded per track.
  Replaces bespoke grid logic in wibwob-tr808.

- `knob.ts` — Knob<{value, min, max, label?, size?}>
  Rotary control rendered in ASCII using arc chars (╭╮╯╰ + fill).
  Wib register: shows value as animated sweep. Wob register: shows value as number.

- `patch-cable.ts` — PatchCable<{from, to, color?, style?}>
  Draws an ASCII cable between two port positions using curved line chars (╭╮╯╰─│).
  For MaxMSP/modular-style patching UIs.

- `spectrum.ts` — Spectrum<{bins, labels?, barWidth?}>
  Frequency spectrum analyser bar chart using ▁▂▃▄▅▆▇█.
  Optional frequency labels (20Hz, 100Hz, 1kHz, 10kHz).

**Demo microapp:** `../modules/daw-studio/`

A composable music production surface using the above components:
- Waveform panel (top, full width) — shows a generated or loaded sample
- PianoRoll panel (center) — 2-octave × 16-bar editable grid
- StepMatrix panel (bottom left) — 4-track × 16-step rhythm layer
- LevelMeter column (right) — per-track levels animated via setInterval
- Spectrum panel (bottom right) — FFT-style bars from simulated audio data
- Knob row between panels — BPM, reverb, filter cutoff, drive
- PatchCable overlays connecting Knob outputs to StepMatrix/Waveform inputs
- Play/Pause/Stop Buttons
- Export pattern to `scratch/daw-pattern.json`

**Done conditions:**
```bash
ls ../src/core/sdk/components/daw/piano-roll.ts
ls ../src/core/sdk/components/daw/waveform.ts
ls ../src/core/sdk/components/daw/level-meter.ts
ls ../src/core/sdk/components/daw/step-matrix.ts
ls ../src/core/sdk/components/daw/knob.ts
ls ../src/core/sdk/components/daw/patch-cable.ts
ls ../src/core/sdk/components/daw/spectrum.ts
ls ../modules/daw-studio/index.ts
curl -sf http://127.0.0.1:8099/modules/list | grep -q "daw-studio"
```

