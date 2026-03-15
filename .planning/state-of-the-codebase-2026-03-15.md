# State of the Codebase — 2026-03-15

## TL;DR

v1.3 refactor ~45% done. COAT seams, CLI surface, multi-instance, workspace snapshots, plumb — shipped. SDK still a re-export bag, blessed leaks into every microapp, zero hero sample apps, no code health tooling beyond typecheck+COAT. 6 circular dependencies found. 28 dead exports. Next: knip+madge cleanup, SDK primitives, 7 hero apps, infra wrappers, test harness.

---

## 1. Where v1.3 Plan Stands

| v1.3 Phase | Status | Notes |
|---|---|---|
| **P1 Architecture mapping** | ✅ Done | COAT seams, dependency graph, god-file audit |
| **P2 Extract pure logic** | 🟡 ~60% | `src/domain/` has 3 modules. Layout rules, workspace schema still in host |
| **P3 Isolate side effects** | 🟡 ~15% | clipboard.ts extracted. 5 wrappers remain (~70 call sites) |
| **P4 Application services** | 🟡 ~50% | `src/application/` has workspace service. Missing: unified command dispatch, event bus |
| **P5 Instance-scoped state** | ✅ Done | Instance labels, sockets, `--instance` targeting, `/health` enriched |
| **P6 Extract SDK** | 🔴 ~25% | `microapp-sdk.ts` exists (48 exports, 351 lines) but is a re-export bag. No real primitives layer. blessed leaks everywhere |
| **P7 Migrate microapps** | 🟡 ~60% | 39 manifests, 9 core tier. 4 host windows remain (music-player, backrooms, companion, terrain-lab) |
| **P8 Remove legacy** | 🟡 ~40% | browser-windows eliminated, monster-cam migrated, dead code persists |
| **P9 Post-refactor** | 🟡 Partial | Multi-instance done. Telepresence/VPS/registry not started |

### Where it Diverged
- v1.3 assumed clean SDK primitives (Screen, Window, Panel, Text, List...) — we have none
- v1.3 assumed declarative rendering — microapps do imperative blessed widget creation
- v1.3 assumed lifecycle hooks (init/activate/render/deactivate/dispose) — we have `setup(host)` only
- v1.3 tooling stack (biome, knip, dep-cruiser, madge, vitest, hyperfine) — **none installed**

### What We Added Beyond v1.3
- COAT enforcement (`check-coat` — 6 automated checks)
- Plan 9 plumb/read/write (unix pipe model between windows)
- VJ timeline system, chiptune studio
- 6 agent lenses + discover.sh
- Autoresearch harness pattern

---

## 2. SDK Reality Check

**Current**: `microapp-sdk.ts` = 351 lines of re-exports. 34/34 non-disabled microapps `import blessed from "blessed"` directly.

SDK provides:
- `MicroappHost` (registerCommand, createWindow, promptValue, theme, screen)
- `MicroappWindowHandle` (body, close, setFocusTarget, describeState, onCleanup, onRestyle, onInput, captureText)
- Re-exported engines (figlet, contour, plasma, webcam)
- Re-exported utilities (ui-parts, ansi-utils, animation-service)

Missing (per v1.3 §10–12): canonical primitives, declarative layout, storage API, event subscription, logger, capability system.

**Key insight**: blessed IS the rendering engine. v1.3 said "no blessed exposure" — unrealistic after 18 months. Two paths:
- **A)** Build real primitives wrapping blessed (big, slow, breaks everything)
- **B)** Accept blessed as primitive layer, SDK provides *composition helpers* on top (pragmatic, incremental)

**Recommendation: B.** `createStatusBar()`, `createListPanel()`, `createSplitView()` standardise patterns. Hero apps demonstrate. Direct blessed becomes "advanced mode".

---

## 3. Code Health Findings

### Knip (dead code)
- **28 unused exports** — real dead code from extractions (DEV_RELOAD_EXIT_CODE, old config paths, unused ui-parts, unused engine exports)
- **38 unused exported types**
- 12,302 "unused files" — noise from dynamic microapp loading, needs config

### Madge (circular deps)
**6 circular dependencies found:**
1. `microapp-sdk.ts → canvas-types.ts → sy2-chronicles/panel-types.ts` — **microapp leaking INTO sdk!**
2. `ui-parts.ts → ui-parts-data.ts` — barrel re-export cycle
3. `ui-parts.ts → ui-parts-feedback.ts` — same
4. `ui-parts.ts → ui-parts-forms.ts` — same
5. `skeleton-renderer.ts → webcam-renderer.ts` — renderer cross-dep
6. `capability-service.ts → chrome-browser-service.ts` — service cross-dep

\#1 is critical — an app's types polluting the SDK. #2-4 are barrel-import artifacts. #5-6 are real coupling.

### Biggest files
| File | Lines | Issue |
|---|---|---|
| ui-parts.ts | 2395 | utility god-file, re-exports 3 sub-modules creating cycles |
| app-controller.ts | 2334 | composition root, 108 methods, audited — thin dispatchers |
| file-manager-window.ts | 1622 | single 1588-line function |
| music-player-window.ts | 1224 | FFT+4 viz modes, pending microapp migration |
| command-catalog.ts | 1219 | data file, acceptable |

---

## 4. Microapp Quality Audit

### Core Tier (9 apps)
| App | Lines | describeState | captureText | writeInput | Quality |
|---|---|---|---|---|---|
| figlet-banner | ~400 | ✅ | ✅ | ✅ | **Hero** |
| contour-studio | ~350 | ✅ | ✅ | ❌ | Good |
| command-lab | ~200 | ✅ | ✅ | ❌ | Good |
| runtime-inspector | ~425 | ✅ | ✅ | ❌ | **Hero** |
| wibwobworld | 981 | ✅ | ✅ | ✅ | Complex |
| terminal | ~200 | ✅ | ✅ | ✅ | Good |
| world-chatroom | ~300 | ✅ | ✅ | ❌ | OK |
| journal | 1427 | ✅ | ❌ | ❌ | Bloated |
| notepad | ~130 | ✅ | ✅ | ✅ | **Hero** — cleanest |

### Problems
- 34/34 microapps import blessed directly
- 14 "demo-" prefixed apps = experiments, not demos
- Several 1000+ line microapps — entire apps, not "micro"
- `.disabled/` has 14 dead microapps
- No consistent error handling, keyboard shortcuts, or status bars
- scaffold-microapp.sh generates wrong manifest format (broke monster-cam today)

---

## 5. Infra Wrappers Remaining

| Wrapper | Call Sites | Files | Status |
|---|---|---|---|
| ✅ clipboard.ts | 4 | 4 | **Done** |
| safe-fs.ts | 50+ | 12+ | Not started — highest volume |
| platform-commands.ts | 6 | 3 | Not started — trivial |
| audio-process.ts | 6 | 3 | Not started — small |
| append-log.ts | 5 | 4 | Not started — trivial |
| animation-loop-unify | 4 | 4 | Not started — compat check needed |

---

## 6. Hero 7

Seven reference microapps. Progressively complex. Each demonstrates SDK best practice. Code quality = "if an external dev only read this one file, they'd know how to build for the platform."

| # | App | Lines | Shows | Status |
|---|---|---|---|---|
| 1 | **hello-world** | ~30 | Minimum viable: createWindow, describeState | Rewrite (current is 494 lines!) |
| 2 | **notepad** | ~130 | Read/write buffer, captureText, onInput, plumb | Exists, cleanup pass |
| 3 | **runtime-inspector** | ~425 | Live state, command introspection, tree views | Exists, review |
| 4 | **figlet-banner** | ~400 | Multi-command, font picker, prompts, writeHandlers | Exists, cleanup |
| 5 | **layout-stress-test-pi** | ~464 | Responsive layout, breakpoints, contrib grid, animation | Exists, rename+promote |
| 6 | **data-dashboard** | ~200 | Live-updating panels, timers, split layout, theming | New build |
| 7 | **file-manager** | ~1622 | Full app: search, preview, sort, icon/list modes | Migrate from src/windows/ |

**Progression**: trivial → buffer → introspection → creative tool → layout proof → dashboard → full app.

---

## 7. Other Improvements Worth Considering

Beyond the buckets — things that compound quality:

- **Fix scaffold-microapp.sh** — generates wrong manifest, discovered today. Every new microapp starts broken.
- **Nuke `.disabled/`** — 14 dead apps, 0 value, cognitive load for agents scanning microapps/
- **README.md refresh** — stale, doesn't reflect SDK or CLI surface
- **`bun run health`** — single command: typecheck + coat + lint + knip + madge. The "are we clean?" gate.
- **Consistent keyboard conventions doc** — q=close, space=toggle, /=search. Currently ad-hoc per app.
- **ui-parts.ts barrel breakup** — 2395 lines, causes 3 of 6 circular deps. Split into direct imports.
- **sy2-chronicles panel-types leak** — microapp types in SDK import chain. Critical architecture violation.
- **Agent skill path audit** — skills reference hardcoded paths that moved during refactor
- **Workspace restore coverage** — most microapps don't implement snapshot/restore

---

<auto-research>

## Bucket 1: Dead Code + Circular Dep Cleanup (1 session)

**Why first**: removes noise, fixes architecture violations, establishes clean baseline.

**Tools**: knip, madge

**Tasks**:
- Configure `knip.json` (ignore microapps/, .pi/, scripts/, .trash/)
- Kill 28 unused exports + 38 unused types
- Fix 6 circular deps (critical: sy2-chronicles leaking into SDK)
- Break ui-parts.ts barrel cycle (direct imports instead of re-exports)
- Add `bun run health` script (typecheck + coat + lint + knip + madge)
- Fix scaffold-microapp.sh manifest format

**Metric**: `knip --reporter compact | grep "Unused exports" → 0` + `madge --circular → 0`

**Autoresearch shape**: run knip+madge, count findings, fix, re-run, track to zero.

---

## Bucket 2: SDK Composition Helpers (1–2 sessions)

**Why second**: hero apps need these to demonstrate best practice.

**Tasks**:
- `src/services/sdk-primitives.ts` — typed composition helpers:
  - `createStatusBar(parent, opts)` → themed status bar with left/right text
  - `createSplitView(parent, opts)` → left/right panes with divider
  - `createListPanel(parent, opts)` → selectable list with theme
  - `createTextViewer(parent, opts)` → scrollable text box
  - `createButtonBar(parent, buttons)` → bottom toolbar
- Each: typed options, theme-aware, returns simple handle
- Export from `microapp-sdk.ts`
- Document in `docs/sdk-primitives.md`

**Metric**: primitive count, typecheck clean, hero apps using them

**Autoresearch shape**: build primitive → typecheck → use in notepad → verify renders → next primitive.

---

## Bucket 3: Hero 7 (1–2 sessions)

**Why third**: uses new primitives, becomes the canonical reference.

**Tasks**:
- Rewrite hello-world (494→~30 lines)
- Cleanup notepad (use SDK primitives where applicable)
- Review runtime-inspector (already good, minor polish)
- Cleanup figlet-banner
- Rename+promote layout-stress-test-pi (drop "demo-" prefix)
- Build data-dashboard (new)
- Migrate file-manager to microapp (biggest lift — 1622 lines from host)
- Every hero: describeState + captureText + consistent keyboard shortcuts
- Document in `docs/microapp-examples.md`

**Metric**: hero count complete, total lines, blessed-direct-import count in heroes

**Autoresearch shape**: build/clean each hero → typecheck → open via API → describeState → captureText → plumb test → next.

---

## Bucket 4: Infra Wrappers (1 session)

**Why fourth**: codebase cleaner, wrappers easier to validate.

**Tasks**:
- safe-fs.ts (50+ call sites, 12+ files)
- platform-commands.ts (6 sites)
- append-log.ts (5 sites)
- audio-process.ts (6 sites)

**Metric**: direct fs.readFileSync/writeFileSync/execSync outside wrappers → 0

**Autoresearch shape**: grep baseline → extract wrapper → update consumers → re-grep → track to zero.

---

## Bucket 5: Test + Benchmark Harness (1 session)

**Why fifth**: codebase is clean, worth protecting with regression gates.

**Tasks**:
- Consolidate 17 existing test files, ensure all pass
- Add hero app smoke tests (open → describeState → captureText → close)
- Install hyperfine, benchmark: boot time, CLI latency, typecheck time
- `bun run test` as CI-ready gate
- Stretch: node-pty TUI integration test for one hero app

**Metric**: test count, pass rate, boot time ms, CLI latency ms

**Autoresearch shape**: run tests → fix failures → add hero smoke tests → benchmark → track.

</auto-research>

---

## 8. Summary

| Bucket | Sessions | Key Metric | Depends On |
|---|---|---|---|
| 1. Dead code + cycles | 1 | 0 unused exports, 0 circular deps | Nothing |
| 2. SDK primitives | 1–2 | 5+ composition helpers exported | Bucket 1 (clean imports) |
| 3. Hero 7 | 1–2 | 7 reference apps, consistent quality | Bucket 2 (primitives exist) |
| 4. Infra wrappers | 1 | 0 raw fs/exec outside wrappers | Bucket 1 (clean baseline) |
| 5. Test harness | 1 | 17+ tests passing, benchmarks tracked | Buckets 1–3 (stable code) |

**Total**: 5–7 sessions. Strict ordering for 1→2→3. Bucket 4 can parallelise with 2–3. Bucket 5 goes last.

**The compounding insight**: each bucket makes agents faster at the next one. Dead code removal → cleaner imports → primitives land cleanly → heroes build fast → wrappers obvious → tests meaningful.
