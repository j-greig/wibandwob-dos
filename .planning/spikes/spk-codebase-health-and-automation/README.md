---
status: ready
owner: agent
branch: spike/spk-codebase-health-and-automation
created: 2026-03-20
depends-on: spike/spk-sdk-component-system-audit (complete)
---

# spk-codebase-health-and-automation

> **The bet:** a codebase that enforces its own quality doesn't need heroic cleanup sessions.
> Install the gate once. Run it forever. Let agents do the gardening.

---

## TL;DR (read this, skip the rest if obvious)

The previous spike proved the SDK composition layer works. This spike installs
the **infrastructure that keeps it working** — automatically, repeatably, and
visibly — across every future session.

Five sessions. One output per session. All compound.

| Session | Output | Unlocks |
|---------|--------|---------|
| 1 | `scripts/health-full.sh` + knip + madge in devDeps | Every session starts clean |
| 2 | Hero 7 validated (data-dashboard + file-manager) | `examples-by-tier.md` accurate |
| 3 | `scripts/sdk-export-index.sh` + `docs/sdk-export-index.md` | Docs drift caught automatically |
| 4 | platform/audio/log wrappers + 24 raw fs calls removed | Safe-fs coverage complete |
| 5 | music-player-window.ts → `microapps/music-player/` | Last host-side god-window gone |

**Gate target:** `bun run health-full` exits 0. No manual audit needed. Ever again.

---

## Why this spike exists

The previous spike (`spk-sdk-component-system-audit`) was a one-time rescue.
We inventoried the SDK, cut naming noise, hardened reliability (control manifest,
reload invalidator, crash-bundle), and wrote docs. All by hand.

The problem: without automation, every session starts with "what state are we in?"
and ends with "did we break anything?". Agents spend tokens on archaeology instead
of delivery. Humans repeat the same cleanup rituals.

This spike installs the **self-enforcing floor** so we never have to do the
rescue session again.

---

## The 5 Whys of `health-full.sh`

_Why does a single gate script change everything?_

**Why 1 — Because the codebase can't tell you when it's broken.**
Right now, you find out something's wrong when an agent hits a circular import,
a microapp crashes on odd widths, or a doc references a path that moved three
sprints ago. The gap between "broke" and "noticed" is a whole session.
`health-full.sh` closes that gap to seconds.

**Why 2 — Because agents waste 20–30% of a session on orientation.**
Every session: check instances, typecheck, scan for obvious issues, ask "is the
branch clean?". That's orientation tax. A gate that exits 0 or exits 1 with
a named failure replaces all of that with one line. Agents go straight to delivery.

**Why 3 — Because knip and madge aren't run unless they're zero-friction.**
Both tools exist. `knip.json` exists. But knip isn't installed, madge uses npx.
So neither gets run. Dead exports accumulate. Circular deps stay hidden. The cost
of "just check it" needs to be zero or it won't happen. Installing them as proper
devDeps and wiring them into one script removes the friction entirely.

**Why 4 — Because COAT compliance only matters if it's checked.**
`bun run check-coat` runs 6 automated checks. But it's not in anyone's workflow.
The gate makes it automatic: every `health-full` run verifies COAT, typecheck,
tests, dead code, and circular deps in sequence. COAT goes from aspiration to
enforcement.

**Why 5 — Because "it works on my machine" is the wrong unit.**
The runtime is ephemeral (tmux, instances, sockets). What's stable is the source.
A gate that verifies the source — not the runtime — is the thing that survives
restarts, new instances, new agents, new contributors. It's the thing that
accumulates trust over time. Every green run is a deposit. Every broken run is
caught immediately.

---

## Vision: what "done" looks like

**Session start ritual (today):**
```
→ check instances
→ typecheck
→ hope nothing's broken
→ start working
→ find out later that docs had a stale ref
→ lose 20 minutes fixing it
```

**Session start ritual (after this spike):**
```
→ bun run health-full   # 15 seconds
→ green or named failure
→ start working
```

**The compound effect over time:**

```
Week 1:  gate installed, 28 dead exports found and killed
Week 2:  circular deps 6→2, knip runs clean
Week 4:  doc-drift-check catches a stale ref before PR merge
Week 8:  new agent joins, runs health-full, knows the codebase is clean
Week 12: sdk-export-index auto-generates on sdk change, drift impossible
```

The gate is also the **handoff artefact**. When a new session opens — human or
agent — `bun run health-full` is the one thing they run to know they can trust
the floor. It replaces the state-of-the-codebase doc as the live signal.

---

## Session 1 — Tooling baseline (1h)

**Goal:** `bun run health-full` runs and tells the truth.

### Steps
1. `bun add -d knip madge` — devDeps, not npx
2. Write `scripts/health-full.sh`:
```bash
#!/usr/bin/env bash
set -e
echo "▶ typecheck..."
bun run typecheck

echo "▶ tests..."
bun run test

echo "▶ COAT..."
bun run check-coat

echo "▶ circular deps (madge)..."
CYCLES=$(node_modules/.bin/madge --circular --extensions ts src/ 2>&1 | grep -c "^[0-9])" || true)
[ "$CYCLES" = "0" ] && echo "  ✅ no circular deps" || (echo "  ❌ $CYCLES circular deps found"; node_modules/.bin/madge --circular --extensions ts src/; exit 1)

echo "▶ dead exports (knip)..."
node_modules/.bin/knip --reporter compact

echo ""
echo "✅ health-full clean"
```
3. Add to `package.json`:  `"health-full": "bash scripts/health-full.sh"`
4. Run knip. Suppress microapp dynamic imports in `knip.json`. Fix or document
   each of the 28 dead exports.
5. Run madge. Fix or document remaining 2 circular deps (skeleton↔webcam,
   capability↔chrome-browser).
6. Gate exits 0.

### Acceptance (binary)
```bash
bun run health-full   # exits 0
```

### Commit
`chore(tooling): install knip+madge, add health-full gate`

---

## Session 2 — Hero 7 close-out (1–2h)

**Goal:** All 7 reference microapps open, describe state, and capture text cleanly.

### Current state
| # | App | Status |
|---|-----|--------|
| 1 | demo-hello-world | ✅ 33 lines, validated |
| 2 | notepad | ✅ validated |
| 3 | runtime-inspector | ✅ validated |
| 4 | figlet-banner | ✅ validated |
| 5 | demo-layout-stress-test | ✅ contrib crash fixed |
| 6 | data-dashboard | ⚠️ exists, not smoke-tested |
| 7 | file-manager | ⚠️ exists in microapps/, not smoke-tested |

### Steps
1. On instance `4af` (real Ghostty screen, 159x54):
```bash
wibwob -i 4af cmd microapp.wibwob.data-dashboard.open
wibwob -i 4af read <id>   # captureText
wibwob -i 4af state | jq '.windows[] | select(.appType | test("data-dashboard"))'
```
2. Same for file-manager.
3. Each must return non-empty describeState + captureText.
4. Update `examples-by-tier.md` to confirm both validated.
5. Write `scripts/microapp-smoke.sh` — open → describeState → captureText → close
   for all 7 heroes. Exit 1 if any lifecycle hook missing.

### Acceptance
```bash
bash scripts/microapp-smoke.sh   # all 7 pass
```

### Commit
`feat(hero7): validate data-dashboard and file-manager, add microapp-smoke script`

---

## Session 3 — Generated SDK export index (1h)

**Goal:** docs cannot drift from code because the index is generated from code.

### The problem
`sdk-reference.md` has a component table. It was written by hand. It will drift.
When a new export lands, the docs don't know. When an export is deprecated, the
docs still show it as active. The only fix is generation.

### Steps
1. Write `scripts/sdk-export-index.sh`:
```bash
#!/usr/bin/env bash
# Extract all exports from microapp-sdk.ts grouped by @public/@beta/@internal
# Output: docs/sdk-export-index.md
node - <<'JS'
const fs = require('fs');
const src = fs.readFileSync('src/services/microapp-sdk.ts', 'utf8');
// Parse @public/@beta/@internal blocks + export names
// Group, format as markdown table
// Write to docs/sdk-export-index.md
JS
echo "✅ docs/sdk-export-index.md updated"
```
2. Generate `docs/sdk-export-index.md` with columns: `name | tier | source file`.
3. Add `"sdk:index": "bash scripts/sdk-export-index.sh"` to package.json.
4. Add to `health-full.sh`: warn if `docs/sdk-export-index.md` is >7 days stale.
5. Add `scripts/doc-drift-check.sh`:
   - grep all `.agents/guides/microapp/*.md` for microapp/ references
   - verify each path exists
   - grep for SDK symbol names and warn if not in sdk-export-index.md
   - exit 1 on failures

### Acceptance
```bash
bun run sdk:index    # exits 0, file updated
bash scripts/doc-drift-check.sh   # exits 0
```

### Commit
`feat(docs): generated SDK export index, doc-drift-check script`

---

## Session 4 — Infra wrappers + raw fs cleanup (1h)

**Goal:** no raw `fs.readFileSync/writeFileSync/appendFileSync` calls outside
`src/core/safe-fs.ts`. Every I/O failure is a graceful undefined, not a crash.

### Current state
- `safe-fs.ts` exists with 8 exported functions ✅
- 24 raw fs calls remain in `src/` outside safe-fs.ts
- 3 wrappers not yet created: `platform-commands.ts`, `audio-process.ts`, `append-log.ts`

### Steps
1. Create `src/core/platform-commands.ts` — wrap `open`, `xdg-open`, `start` OS commands
2. Create `src/core/audio-process.ts` — wrap ffplay/afplay spawn with graceful fallback
3. Create `src/core/append-log.ts` — wrap `fs.appendFileSync` calls for structured logging
4. Migrate the 24 raw fs call sites to `safeReadFile`/`safeWriteFile`/`safeAppendFile`
5. Add to `health-full.sh`:
```bash
RAW=$(grep -rn 'fs\.readFileSync\|fs\.writeFileSync\|fs\.appendFileSync' src/ \
  --include='*.ts' | grep -v 'safe-fs.ts' | wc -l | tr -d ' ')
[ "$RAW" = "0" ] && echo "  ✅ no raw fs calls" || echo "  ⚠️ $RAW raw fs calls remain"
```

### Acceptance
```bash
grep -rn 'fs\.readFileSync\|fs\.writeFileSync' src/ --include='*.ts' \
  | grep -v 'safe-fs.ts'   # empty
```

### Commit
`feat(infra): platform/audio/log wrappers, eliminate raw fs calls in src/`

---

## Session 5 — Music-player migration (half-day)

**Goal:** `src/windows/music-player-window.ts` (1227 lines) extracted to
`microapps/music-player/`. Last non-trivial god-window gone from `src/windows/`.

### Why this is the last big one
`src/windows/` contains host-side windows that haven't been migrated to the
microapp pattern. All the blessed-heavy implementation logic lives there.
`file-manager-window.ts` (1859 lines) is the other remaining one — that's a
separate spike. Music-player is the right size for a single session.

### Steps
1. New spike or treat as contained: `spike/spk-music-player-migration`
2. Create `microapps/music-player/index.ts` using `setup(host)` pattern
3. Full lifecycle hooks: `describeState`, `captureText`, `onCleanup`, `onRestyle`,
   `onResize`, `registerSnapshot`
4. Register in `src/core/microapp-registry.ts`
5. Delete `src/windows/music-player-window.ts`
6. Verify: `wibwob cmd microapp.wibwob.music-player.open` works

### Acceptance
```bash
[ ! -f src/windows/music-player-window.ts ]   # gone
wibwob -i 4af cmd microapp.wibwob.music-player.open   # opens
wibwob -i 4af read <id>   # returns content
```

### Commit
`feat(microapp): migrate music-player from src/windows/ to microapps/`

---

## Agent fleet (post-spike target)

### Core six (keep, clarify charters)

| Agent | Model | Does | Does NOT |
|-------|-------|------|----------|
| `microapp-product-owner` | sonnet-4-6 | Keep/cut scope, COAT compliance, category coherence | Write code or edit docs directly |
| `microapp-developer` | sonnet-4-6 | Implement smallest safe slice, SDK patterns, lifecycle hooks | Architecture decisions, doc rewrites |
| `microapp-doc-refiner` | sonnet-4-6 | DRY docs, progressive disclosure, owner model, stale ref fixes | Feature implementation |
| `ops` | opus-4-6 | Runtime diagnosis, crash triage, instance/socket issues | Feature work, doc edits |
| `arch-reviewer` | sonnet-4-6 | COAT audits, circular deps, invariant checks | Implementation |
| `code-reviewer` | sonnet-4-6 | Pattern quality, type safety, cleanup pass | Architecture, docs |

### Add (gaps proven by this spike)

**`codebase-gardener`** (sonnet-4-6)
- Trigger: "garden the codebase", "run the health gate", "find dead code"
- Runs: `bun run health-full`, `knip`, `madge`
- Output: triage report with actionable next steps
- Does NOT: make code changes — reports only

**`doc-drift-detector`** (haiku-4-5)
- Trigger: "check docs for drift", "are the docs stale", "validate doc refs"
- Runs: `scripts/doc-drift-check.sh`
- Output: list of broken refs, stale symbols, missing microapp paths
- Fast and cheap — run after every code change batch

### Retire / archive
- `haiku` / `sonnet` / `opus` bare tier aliases → document cost-routing rules,
  don't use as defaults. They're escape hatches, not workhorses.

### Skills to consolidate

| Current | Action | Why |
|---------|--------|-----|
| `autoresearch` + `autoresearch-create` | Merge → `autoresearch` with modes | Same flow, split for no reason |
| `chiptune` + `chiptune-cover` + `chiptune-studio` | Merge → `chiptune` with submodes | 3 triggers for one creative domain |
| `session-archaeology` + `pi-session-log-explorer` | Merge → `session-archaeology` | Near-identical capability |
| `wibwobdos` + `ww-ops` + `wibwobdos-cinema` | Keep but add "does NOT" to each | Overlapping but different axes |
| `simplify` + `simplify-docs` + `simplify-planning` | Keep as-is | Fine-grained, clearly differentiated |

**Fleet hygiene rule**: run `pi-usage-audit` every 4 weeks. Any skill unused 30+ days
gets archived or merged. Skills are load-bearing; dead ones mislead the router.

---

## Docs ownership rules (enforce going forward)

| Topic | Owner file | Updated by |
|-------|-----------|-----------|
| SDK API surface | `.agents/guides/microapp/sdk-reference.md` | microapp-developer + doc-refiner |
| Component contract | `.agents/guides/microapp/component-contract.md` | arch-reviewer |
| Pitfalls | `.agents/guides/microapp/pitfalls.md` | microapp-developer (on every crash found) |
| Layout system | `.agents/guides/microapp/layout.md` | microapp-developer |
| Persistence | `.agents/guides/microapp/persistence.md` | microapp-developer |
| Example tiers | `.agents/guides/microapp/examples-by-tier.md` | doc-refiner |
| Shell invariants | `.agents/guides/shell/invariants.md` | arch-reviewer only |
| COAT | `.agents/guides/shell/control-api.md` | arch-reviewer only |
| State of codebase | `.planning/state-of-the-codebase-*.md` | Agent at start of sprint |

**Enforcement**: `doc-drift-check.sh` validates path refs. `sdk-export-index.sh`
validates SDK symbol references. Both run in `health-full.sh`. Broken docs → gate fails.

---

## Acceptance criteria (spike-level, binary)

- [ ] AC-1: `bun run health-full` exits 0 from clean checkout
- [ ] AC-2: `knip` reports 0 unused exports after suppressions configured
- [ ] AC-3: `madge --circular` reports 0 circular deps
- [ ] AC-4: `bash scripts/microapp-smoke.sh` passes all 7 Hero apps
- [ ] AC-5: `docs/sdk-export-index.md` exists and is generated (not hand-written)
- [ ] AC-6: `bash scripts/doc-drift-check.sh` exits 0 on clean docs state
- [ ] AC-7: 0 raw `fs.readFileSync/writeFileSync/appendFileSync` in `src/` outside `safe-fs.ts`
- [ ] AC-8: `src/windows/music-player-window.ts` deleted; `microapps/music-player/` exists

---

## The compounding bet (extended)

```
Session 1  health-full gate installed
           ↓ every future session starts with a 15s truth signal
Session 2  Hero 7 validated
           ↓ examples-by-tier.md becomes permanently accurate
Session 3  SDK index auto-generated
           ↓ docs can never silently drift from code again
Session 4  all raw fs calls wrapped
           ↓ I/O errors are graceful everywhere in src/
Session 5  music-player migrated
           ↓ src/windows/ only has file-manager-window.ts left
           ↓ one more spike closes it completely

Beyond these 5:
  - file-manager migration (own spike, ~half day)
  - blessed-direct imports: 21→10→0 over time (microapp-developer, incremental)
  - circular deps: 2→0 once skeleton/capability coupling resolved
  - knip dead exports: 28→0 after suppressions + removals
  - `bun run health-full` becomes the session-open ritual for every agent
```

---

## What success feels like

A new agent joins. They clone the repo. They run `bun run health-full`.
It's green. They read `AGENTS.md`. They read `docs/sdk-export-index.md`.
They open a microapp. It works. They build a feature. They run `health-full`.
It's still green.

No archaeology. No "what's the state of things?". No "is this doc current?".
No "wait, is that a circular dep?". Just: green gate, clear docs, working SDK.

That's the vision. Five sessions to get there.
