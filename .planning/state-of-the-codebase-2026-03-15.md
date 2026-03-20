# State of the Codebase — 2026-03-15
## Last updated: 2026-03-20

## TL;DR

v1.3 refactor ~55% done. SDK composition helpers layer now exists (11 helpers, 872 lines). Runtime reliability hardened (control manifest, reload invalidator, crash-bundle). 21/44 microapps still import blessed directly (was 34/34). ui-parts.ts barrel cycle broken (25 lines now, was 2395). sy2-chronicles→SDK circular dep resolved. Hero 7 partially done. Infra wrappers partially done. No knip/madge installed yet. 47 unit tests passing.

---

## 1. Where v1.3 Plan Stands

| v1.3 Phase | Status | Notes |
|---|---|---|
| **P1 Architecture mapping** | ✅ Done | COAT seams, dependency graph, god-file audit |
| **P2 Extract pure logic** | 🟡 ~60% | `src/domain/` has 4 modules. Layout rules, workspace schema still in host |
| **P3 Isolate side effects** | 🟡 ~25% | clipboard.ts + safe-fs.ts (8 fns) extracted. 24 raw fs calls remain outside wrappers. platform-commands, audio-process, append-log not started |
| **P4 Application services** | 🟡 ~60% | `src/application/` has 5 services. Missing: unified command dispatch, event bus |
| **P5 Instance-scoped state** | ✅ Done | Instance labels, sockets, `--instance` targeting, control manifest, reload invalidator |
| **P6 Extract SDK** | 🟡 ~55% | `microapp-sdk.ts` 449 lines/48 exports. `src/sdk/composition-helpers.ts` 872 lines/11 helpers. SDK circular dep fixed. blessed still leaks into 21/44 microapps |
| **P7 Migrate microapps** | 🟡 ~65% | 44 active microapps (was 39). file-manager in microapps/ now exists. music-player-window still in src/windows/ (1227 lines) |
| **P8 Remove legacy** | 🟡 ~50% | ui-parts.ts barrel broken (25 lines now vs 2395). .disabled/ has 10 apps (was 14). Dead exports not yet audited with knip |
| **P9 Post-refactor** | 🟡 Partial | Multi-instance done. Control manifest + crash-bundle added. Telepresence/VPS/registry not started |

### Where it Diverged
- v1.3 assumed clean SDK primitives (Screen, Window, Panel, Text, List...) — we have composition helpers instead (pragmatic B path)
- v1.3 assumed declarative rendering — microapps still do imperative blessed widget creation, composition helpers reduce but don't eliminate this
- v1.3 assumed lifecycle hooks (init/activate/render/deactivate/dispose) — we have `setup(host)` only
- v1.3 tooling stack (biome, knip, dep-cruiser, madge, vitest, hyperfine) — **knip.json exists but knip/madge not installed**

### What We Added Beyond v1.3
- COAT enforcement (`check-coat` — 6 automated checks)
- Plan 9 plumb/read/write (unix pipe model between windows)
- VJ timeline system, chiptune studio
- 6 agent lenses + microapp triad (product-owner / developer / doc-refiner) on claude-sonnet-4-6
- Autoresearch harness pattern
- Runtime control manifest + reload invalidator + crash-bundle command
- Motion service: tweenPingPong, tweenSequence, callback isolation via safeCall
- toEvenCellWidth guard (drawille even-width crash prevention)

---

## 2. SDK Reality Check

**Current**: `microapp-sdk.ts` = 449 lines, 48 exports. `src/sdk/composition-helpers.ts` = 872 lines, 11 helpers.

**Composition helpers (all exist):**
`createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`, `createButtonBar`, `createHeaderBar`, `createScrollView`, `createTabs`, `createRule`, `createInputLine`, `createCanvas`

**Path B chosen and implemented**: SDK provides composition helpers on top of blessed. Direct blessed = "advanced mode". Heroes demonstrate.

**Blessed leak**: 21/44 microapps still `import blessed from 'blessed'` directly (was 34/34 in March). Progress but not resolved.

**Circular deps**: sy2-chronicles panel-types leak fixed — types moved to `src/core/canvas-types.ts`. ui-parts.ts barrel cycle broken (now 25-line re-export shim). Only comments reference microapps paths in sdk now.

Missing (per v1.3 §10–12): declarative layout, storage API, event subscription, logger, capability system.

---

## 3. Code Health Findings

### Knip (dead code)
- **knip.json exists** but `knip` not installed in node_modules
- 28 unused exports / 38 unused types from March audit — **status unknown, not re-run**
- Run `bun add -d knip && npx knip` to re-baseline

### Madge (circular deps)
- **madge not installed** — `bun run health` uses `npx madge` (downloads on demand)
- March findings: 6 circular deps
- **Fixed this session**: sy2-chronicles→SDK (#1), ui-parts barrel cycles (#2-4)
- **Status of #5-6** (skeleton↔webcam, capability↔chrome-browser): unknown, not re-checked

### File sizes
| File | Lines | Change from March | Issue |
|---|---|---|---|
| ui-parts.ts | **25** | was 2395 ✅ | Barrel broken, re-exports shim only |
| app-controller.ts | 2313 | ~same | Composition root, acceptable |
| file-manager-window.ts | 1859 | was 1622 📈 | Still in src/windows/, grew |
| music-player-window.ts | 1227 | ~same | Pending microapp migration |
| command-catalog.ts | 1321 | ~same | Data file, acceptable |

---

## 4. Microapp Quality Audit

**Total active**: 44 (was 39 in March). Disabled: 10 (was 14).

### Hero 7 status
| # | App | Lines | Status |
|---|---|---|---|
| 1 | **demo-hello-world** | **33** ✅ | Rewritten (was 494) — hero |
| 2 | **notepad** | ~130 | Exists, cleanup pass done |
| 3 | **runtime-inspector** | ~425 | Exists, good |
| 4 | **figlet-banner** | ~650 | Exists, favourites + view-all added |
| 5 | **demo-layout-stress-test** | ~464 | Exists, contrib crash fixed |
| 6 | **data-dashboard** | exists | In microapps/ — not yet validated |
| 7 | **file-manager** | exists | In microapps/ — not yet validated |

### Problems (updated)
- 21/44 microapps still import blessed directly (down from 34/34)
- `demo-` prefix still on experiment microapps (14 → cleaner but not addressed)
- scaffold-microapp.sh exists and was fixed
- `.disabled/` down to 10 (was 14)
- `microapps/sdk-showcase/` now exists as composition helper demo

---

## 5. Infra Wrappers

| Wrapper | Call Sites | Status |
|---|---|---|
| ✅ clipboard.ts | 4 | Done |
| ✅ safe-fs.ts | 8 exports | Done — but 24 raw `fs.readFileSync/writeFileSync/appendFileSync` calls remain outside it in src/ |
| platform-commands.ts | 6 | ❌ Not started |
| audio-process.ts | 6 | ❌ Not started |
| append-log.ts | 5 | ❌ Not started |

---

## 6. Runtime Reliability (new section — added since March)

| Feature | Status |
|---|---|
| Runtime control manifest (`~/.wibwob/runtime/control-manifest.json`) | ✅ Done |
| Reload invalidator (blocks `microapps.reload` when host files changed) | ✅ Done |
| `wibwob crash-bundle` command | ✅ Done |
| `wibwob status` alias for health | ✅ Done |
| Health scan de-duplicates phantom instances by PID | ✅ Done |
| Motion callback isolation (safeCall try/catch) | ✅ Done |
| drawille even-width guard (toEvenCellWidth) in dashboards-v2 | ✅ Done |

---

## 7. Tooling Gate (`bun run health`)

Current `bun run health` runs: `test && typecheck && check-coat && npx madge --circular`

| Check | Status |
|---|---|
| `bun run test` | ✅ 47 pass, 0 fail |
| `bun run typecheck` | ✅ Clean |
| `bun run check-coat` | ✅ (assumed passing — not re-verified today) |
| `npx madge --circular` | ⚠️ Uses npx download — madge not in devDependencies |
| knip dead-code scan | ❌ Not in health script |

---

## 8. Remaining Buckets (revised)

| Bucket | Sessions | Key Metric | Status |
|---|---|---|---|
| **1. Dead code + cycles** | 1 | 0 unused exports, 0 circular deps | 🟡 ~60% — barrel fixed, sy2 fixed, knip not run |
| **2. SDK composition helpers** | ~~1–2~~ | 11 helpers exported | ✅ Done |
| **3. Hero 7** | 1 | 7 reference apps validated | 🟡 ~65% — 5/7 verified, data-dashboard + file-manager unvalidated |
| **4. Infra wrappers** | 1 | 0 raw fs/exec outside wrappers | 🟡 ~25% — safe-fs done, 3 wrappers not started, 24 raw calls remain |
| **5. Test harness** | 1 | 17+ tests, hero smokes, benchmarks | 🟡 ~30% — 47 unit tests passing, no hero smoke tests, no benchmarks |

**Next highest-value work:**
1. Install knip + madge properly into devDependencies, re-run dead code audit
2. Validate data-dashboard + file-manager microapps (Hero 7 close-out)
3. Migrate music-player-window.ts (1227 lines) out of src/windows/
4. 24 remaining raw fs calls → safe-fs wrappers
