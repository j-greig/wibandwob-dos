# BUILD ORDER — Final (merged analysis)

Synthesised from independent review of the TS spike source and all 14
handover docs, cross-checked between two analysis passes.

## The one-line answer

**002 → 004 → 013 → 006 → 008 → 010 → 007 → 009 → 005 → 011 → 012**

This is NOT the order from 003-document-plan.md. That doc grouped by
topic similarity. This groups by architectural dependency.

## Why 003's wave order is wrong for this codebase

003 says: "Wave 1 = 004, 005, 006, 013" (structural).

The problem: 005 (LLM) depends on a stable command surface (006) and
stable state shape (013). Doing LLM integration in wave 1 means freezing
agent tool contracts against an unstable foundation. Every time you
refactor commands or state, you break prompts.

The corrected principle: **lock internal seams first, expose external
contracts second, add agent/LLM surfaces last.**

## Current state assessment

### What exists and is good (keep)

| File | Lines | Status |
|------|-------|--------|
| content-measurement.ts | 102 | Solid. Uses string-width, handles frames/comments. |
| window-chrome.ts | 35 | Correct shape. Needs more chrome modes. |
| desktop-geometry.ts | 22 | Minimal but right. Needs resize listener. |
| state-service.ts | 117 | Good pull/push model. Needs ContentMetadata. |
| control-api.ts | 142 | Clean HTTP adapter. Needs command dispatch. |
| window-manager.ts | 443 | Drag/resize/focus/z-order works. Keep as-is. |
| content-service.ts | 195 | Gallery/primer collection. Good. |
| backrooms-service.ts | 216 | Well-factored channel management. |
| figlet-service.ts | 170 | Clean figlet rendering. |

### What exists and is the problem (refactor/replace)

| File | Lines | Problem |
|------|-------|---------|
| app-controller.ts | 2561 | God class. Every factory, menu, restore, state. |
| types.ts | 182 | WindowRecord is a bag of optionals. |
| overlay-manager.ts | 648 | Coupled to controller, owns menus+palette+context. |

### What's missing (the gaps that bite you)

1. **No WindowTypeRegistry** — spawn is inline in controller
2. **No CommandRegistry** — commands are REST routes, not a typed map
3. **No typed event bus** — changes propagate via callbacks or nothing
4. **No theme tokens** — blessed styles are hardcoded in each factory
5. **No test suite** — `bun run typecheck` passes, zero runtime tests
6. **Dual terminal paths** — legacy transcript AND newer buffered, both live
7. **No screenshot/regression capture** — can't verify refactors
8. **WindowRecord is a flat union** — `editor?`, `terminal?`, `chat?` etc.
   Every new window type adds another optional field. This is the shape
   that should become module-owned state behind `describeState()`.

## The 11 steps

### Step 1: Lock contracts (doc 002)

The spike already has measurement, chrome, and geometry. This step is
about LOCKING those contracts, not building from scratch.

**Must build:**
- `ContentMetadata` interface on WindowRecord (replaces ad-hoc details)
- Resize/reflow contract (`onResize` callback protocol)
- Layout primitive types (pure function signature, not algorithms yet)
- Canonical ownership: measurement in service, chrome in core, geometry in core
- **Test harness** — add vitest/bun:test now. Content measurement unit tests.
  Screenshot/state JSON export for regression. Do NOT wait until step 3.

**Defer:** Advanced layout algorithms, full aspect ratio catalog.

**Why first:** If you extract window factories (step 2) before locking
ContentMetadata, each factory invents its own state shape. Retrofitting
is 3x the work.

### Step 2: Window type registry (doc 004)

The keystone. Nothing else should land on the god class.

**Must build:**
- `WindowTypeModule<TState>` interface: create, serialize, restore, describe
- `WindowTypeRegistry` map: slug → module
- Extract 3 pilot types: primer viewer, orbit/pattern, buffered terminal
- Registry-backed spawn replacing controller switch
- Registry-backed workspace restore replacing controller switch
- Menu/palette entries generated from registry metadata
- Extract overlay-manager from controller (it owns 648 lines of menus)

**Defer:** Extracting all 17 existing window types. Do 3 pilots, migrate
rest incrementally.

**Why second:** Every subsequent doc (006 commands, 008 themes, 009 paint)
adds window types or window-adjacent features. Without the registry,
each one grows the god class.

**Critical warning:** The `WindowRecord` bag-of-optionals must die here.
Replace with: `WindowRecord` has a generic `state: TState` that the
module owns. `editor?`, `terminal?`, `chat?` become module-internal.
If you defer this, every new module will add another optional to the
shared interface.

### Step 3: Events, persistence, infrastructure (doc 013)

**Must build:**
- Typed event bus (at minimum: window-created, window-closed, focus-changed,
  state-changed, command-executed)
- Atomic workspace writes with versioned snapshot format
- Screenshot text export (plain text capture of screen buffer)
- State JSON export (for regression diffs)
- Instance identity (port, state file path, socket/name)
- Regression fixtures: one curated workspace as a migration canary

**Defer:** tmux launcher parity, structured logger, multi-instance IPC.

**Why third:** Steps 4-11 all need to verify their work. Without
screenshot capture and workspace round-trip, you're eyeballing.

### Step 4: Command registry (doc 006)

**Must build:**
- Typed `CommandRegistry`: name → handler with schema
- `/commands` endpoint (discovery, replaces `/capabilities`)
- `/menu/command` endpoint (universal execute)
- Core commands: window CRUD, state query, workspace save/load
- Single response envelope (NO double-parse — break from C++ pattern)
- Command manifest auto-generated from registry (agents discover, not hardcode)

**Defer:** Full 96-command parity with C++. Start with ~20 core commands.

**Why fourth:** After registry (004) and events (013), commands have a
stable internal surface to dispatch against. Before this, `/state` and
the ad-hoc REST routes are the only agent surface.

**Critical warning from 014:** The C++ API has a double-parse envelope
(`outer.result` is a JSON string). The TS rebuild should NOT replicate
this. Return typed objects directly. If backward compat is needed later,
add a compatibility wrapper, not a default double-wrap.

### Step 5: Theme system (doc 008)

**Must build:**
- Theme token map: `Record<ThemeRole, Color>` with semantic names
- Theme resolver: `(role: ThemeRole, variant: ThemeVariant) => Color`
- Desktop background model (pattern char, fg, bg)
- Desktop presets (port the 9 named presets from C++)
- Tokenise window chrome: active/inactive border, titlebar, status
- Tokenise menu bar and status bar

**Defer:** Mascot, gallery exhibition mode, exotic presets, gradient fills.

**Why fifth:** Before bulk window extraction (which happens gradually
after this), chrome and background need tokens. Otherwise every extracted
window module hardcodes blessed colours, creating a second migration.

### Step 6: Browser & text rendering (doc 010)

**Must build:**
- Shared styled-text line model (text + style runs per line)
- Scrollable view base component (shared by browser, text, ANSI, editor)
- One ANSI parser (merge the two that exist in C++, don't replicate)
- Browser pipeline seam (fetch → extract → render, even if extract is stub)
- Editor document model decision (what library/approach for text editing)

**Defer:** Full browser AI tools, image gallery mode, perfect clipboard.

**Why sixth:** This forces the key shared rendering decisions. Terminal
(step 7), paint (step 8), and games (step 10) all need a text/cell
rendering model. If terminal chooses first, it picks a cell grid that
may disagree with browser/ANSI rendering. 010 is where the shared
text pipeline crystallises.

**Critical warning:** If you don't pick the editor document model here,
you will rework it in 007 (terminal), 009 (paint), and 005 (chat).
The decision is: blessed textarea (limited), CodeMirror headless
(powerful, heavy), or minimal custom model (medium effort, full control).

### Step 7: Terminal emulator (doc 007)

**Must build:**
- Adopt the buffered terminal path as the ONLY terminal
- Kill the legacy transcript terminal
- PTY spawn with proper resize propagation
- Scrollback buffer
- terminal_write / terminal_read commands (via step 4's CommandRegistry)
- Terminal state in describeState() (cols, rows, cursor position)
- Backrooms TV subprocess model (forkpty-equivalent for Bun)

**Defer:** Full VT parity, alt-screen perfection, every terminal edge case.

**Why seventh:** Depends on the text rendering model from step 6 and
the command registry from step 4.

**Critical warning:** The spike currently has TWO terminal implementations:
legacy transcript (log widget) and buffered (pty-session + terminal-buffer
+ terminal-renderer). They BOTH exist. Kill the legacy one here. If you
don't, you will maintain parallel terminal systems forever.

### Step 8: Paint canvas (doc 009)

**Must build:**
- Pure paint domain model (cell grid: char + fg + bg)
- Paint renderer (model → blessed output)
- Core paint commands via CommandRegistry: cell, text, line, rect, clear
- `.wwp` JSON codec (save/load)
- `paint_read` / `paint_export` commands
- FIGlet stamp integration

**Defer:** ANSI export polish, advanced interactive tools.

**Why eighth:** Paint is the first rich-app proof of the full architecture:
domain model + renderer + commands + persistence + agent-readable state.
It's self-contained and heavily testable. Good validation before LLM.

### Step 9: LLM integration (doc 005)

**Must build:**
- Auth cascade: Claude SDK → API key → disabled
- Single LLM client abstraction (no per-provider branching in app code)
- Two meta-tools pattern: `tui_list_commands` + `tui_menu_command`
  (backed by step 4's CommandRegistry)
- Streaming window with disposal guards
- Capability injection from live `/commands` and `/state`
- Wib & Wob chat: two-persona prompting, voice markers

**Defer:** TTS, full Scramble personality, room chat multiplayer.

**Why ninth:** Depends on stable commands (step 4), stable state (step 3),
and stable window registry (step 2). The two meta-tools pattern means
agents discover commands dynamically — so the command surface must be
real before agents use it.

**Critical warning:** If you expose agent tools before steps 2-4 are
stable, you freeze the wrong contracts. Every prompt that references
a command name or state shape becomes a backward-compat obligation.

### Step 10: Games & generative art (doc 011)

**Must build:**
- `AnimatedView` base: timer → compute → render cycle
- `CellBuffer`: 2D character grid with colour per cell
- Palette system: shared colour definitions across views
- 3-4 pilot ports: Game of Life (simplest), orbit, snake, verse

**Defer:** Monster ecosystem, contour map, generative lab, Micropolis.

**Why tenth:** By now you have: window registry, theme tokens, cell
rendering, command registry, and screenshot regression. Games are pure
rendering + timer — they validate the architecture without adding
new architectural concerns.

### Step 11: Micropolis (doc 012)

**Must build (if proceeding):**
- WASM vs pure-TS decision
- Engine bridge interface
- ASCII tile renderer
- Basic tool palette

**Why last:** Highest effort, lowest architectural leverage, separate
engine integration problem. Decide if it's even worth it for the MVP.

## Summary: what each step unlocks

| Step | Unlocks |
|------|---------|
| 1 (002) | Stable content/chrome/geometry contracts + test harness |
| 2 (004) | Window types as modules, not controller methods |
| 3 (013) | Verifiable persistence, events, regression capture |
| 4 (006) | Agent-callable command surface |
| 5 (008) | Consistent visual identity without per-window hardcoding |
| 6 (010) | Shared text rendering stack |
| 7 (007) | Real terminal |
| 8 (009) | Proof of full architecture (model + render + commands + persist) |
| 9 (005) | AI agent integration |
| 10 (011) | Fun stuff |
| 11 (012) | SimCity |

## "Regret later" checklist

Before starting each step, verify these are true:

- [ ] WindowRecord no longer has optional fields per window type (step 2)
- [ ] At least one unit test exists per core module (step 1)
- [ ] Screenshot regression capture works (step 3)
- [ ] Workspace round-trip passes for all extracted window types (step 3)
- [ ] No blessed style literals exist outside theme tokens (step 5)
- [ ] Only ONE terminal implementation exists (step 7)
- [ ] Only ONE ANSI parser exists (step 6)
- [ ] Command manifest is auto-generated, not hand-maintained (step 4)
- [ ] Agent tools reference command registry, not controller methods (step 9)
- [ ] No new code added to app-controller.ts after step 2 (ongoing)
