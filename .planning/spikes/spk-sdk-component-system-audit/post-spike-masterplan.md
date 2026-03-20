# Post-Spike Masterplan
## spk-sdk-component-system-audit → what comes next

_Written: 2026-03-20. Synthesises gstack-inspiration-notes, product-owner-cuts,
gap-triage, state-of-the-codebase, and session friction from W12 reflections._

---

## What the spike proved

1. **Composition helpers work.** 11 helpers, 872 lines, SDK-only import, no blessed
   leak. Third-party microapp authors have a real path now.
2. **Runtime reliability matters more than component count.** Control manifest,
   reload invalidator, crash-bundle, toEvenCellWidth, motion safeCall — all higher
   leverage than adding more components.
3. **Triad agents + doc-refiner delegation works.** Running microapp-doc-refiner
   as a sidecar freed the main session for implementation. Worth repeating.
4. **The docs owner model holds.** quick-start → task guides → reference, one owner
   per concept, progressive disclosure. No major contradictions found in S7 audit.

---

## What was NOT done (honest gap list)

| Item | Why deferred | Priority |
|------|-------------|----------|
| Generated SDK docs blocks (gstack E) | Script infrastructure needed | Medium |
| Stage-aware sprint dashboard (gstack D) | Pi extension work, not core | Low |
| Guard mode for risky ops (gstack F) | Nice-to-have, not blocking | Low |
| knip + madge in devDependencies | 30 min task, easy | High |
| music-player-window.ts migration (1227 lines) | Big lift, own spike | Medium |
| 24 remaining raw fs calls → safe-fs | Mechanical, parallelisable | Medium |
| platform-commands + audio-process + append-log wrappers | Mechanical | Low |
| sdk-showcase full validation (all components rendering) | Needs visual pass | Medium |
| Hero 7 data-dashboard + file-manager validation | Needs instance with right screen | Medium |
| Skeleton↔webcam + capability↔chrome-browser circular deps | Not re-checked | Medium |

---

## Smaller, sharper agent fleet

Current fleet has grown unevenly. Post-spike target:

### Keep (sharp, used regularly)
| Agent | Role | Model |
|-------|------|-------|
| `microapp-product-owner` | Ruthless scope/keep/cut calls | sonnet-4-6 |
| `microapp-developer` | Implement smallest safe slice | sonnet-4-6 |
| `microapp-doc-refiner` | Doc owner model, DRY, progressive disclosure | sonnet-4-6 |
| `ops` | Runtime diagnosis, instance issues, crash triage | opus-4-6 |
| `arch-reviewer` | COAT compliance, circular deps, invariant audits | sonnet-4-6 |
| `code-reviewer` | Pattern quality, type safety, cleanup pass | sonnet-4-6 |

### Retire / consolidate
- `haiku` / `sonnet` / `opus` bare tier aliases — only use for explicit cost-routing,
  not as default workhorse picks. Document when each tier is justified.
- `pi-bridge` — keep but document it's for cross-session pi protocol only.

### Add (post-spike gaps)
- **`codebase-gardener`** (sonnet-4-6) — runs `bun run health`, `knip`, `madge`,
  finds dead exports, circular deps, oversized files. Output: triage report.
  Trigger: weekly or before merging any epic branch.
- **`doc-drift-detector`** (haiku-4-5) — greps for stale file paths, missing
  microapps, broken cross-references in `.agents/guides/` and `docs/`. Fast, cheap,
  run after every batch of code changes.

---

## Scripts + hooks to keep src on track

### Must-have (short work, high ROI)

**`scripts/health-full.sh`** — the one gate
```bash
bun run typecheck
bun run test
bun run check-coat
npx madge --circular --extensions ts src/   # madge in devDeps
npx knip --reporter compact                 # knip in devDeps
echo "✅ clean"
```
Replaces the ad-hoc `bun run health` that downloads madge via npx each time.

**`scripts/doc-drift-check.sh`** — fast agent sidecar script
- Grep all `.agents/guides/microapp/*.md` for microapp dir references
- Verify each referenced `microapps/<name>/` exists
- Verify each code symbol mentioned exists in SDK exports
- Exit 1 with diffs if any broken. Run in CI or before doc commits.

**`scripts/sdk-export-index.sh`** — generated section (gstack E, simplified)
- Grep `src/services/microapp-sdk.ts` for all `export` lines
- Group by `@public` / `@beta` / `@internal` JSDoc tags
- Output markdown table to `docs/sdk-export-index.md`
- Run manually before releases; compare to catch drift

**`scripts/microapp-audit.sh`** — hero 7 smoke
```bash
for app in demo-hello-world notepad runtime-inspector figlet-banner \
           demo-layout-stress-test command-lab data-dashboard; do
  # open via wibwob cmd, read describeState, captureText, close
done
```
Binary: pass/fail. Catches lifecycle regressions.

### Nice-to-have
- **pre-commit hook** — runs typecheck + test on `src/` changes (< 5s)
- **`scripts/find-blessed-direct.sh`** — counts microapps importing blessed directly;
  track the number down over time (currently 21/44)
- **`scripts/circular-deps-report.sh`** — madge output formatted for agent consumption

---

## Pi agent config hygiene

Post-spike rules to stop fleet drift:

1. **MODELS.md is source of truth.** Never hardcode a model string in an agent
   without updating MODELS.md first.
2. **One skill per job.** Before creating a new skill, check if an existing one
   covers 80% of the use case. Merge if so.
3. **Quarterly audit cadence.** Use `pi-usage-audit` skill every 4 weeks.
   Any skill/extension unused for 30+ days → archive or delete.
4. **Skill descriptions must be trigger-phrase first.** The description field
   is the routing key — if it doesn't match the user's likely phrasing, it
   won't be selected. Review descriptions when a skill keeps being missed.
5. **Agents are specialists, not generalists.** Each `.pi/agents/*.md` should
   answer "what do I NOT do?" as clearly as "what do I do?".

### Skills to audit / consolidate (post-spike)

| Skill | Status | Action |
|-------|--------|--------|
| `autoresearch` + `autoresearch-create` | Two skills for same flow | Merge |
| `chiptune` + `chiptune-cover` + `chiptune-studio` | Three overlapping | Consolidate to one with modes |
| `wibwobdos` + `ww-ops` + `wibwobdos-cinema` | Partial overlap | Keep but clarify boundaries |
| `simplify` + `simplify-docs` + `simplify-planning` | Fine-grained, clear | Keep as-is |
| `session-archaeology` + `pi-session-log-explorer` | Near-identical | Merge |

---

## Docs ownership going forward

Canonical owner map (enforced):

| Topic | Owner file | Who updates it |
|-------|-----------|----------------|
| SDK API surface | `.agents/guides/microapp/sdk-reference.md` | microapp-developer + doc-refiner |
| Component contract | `.agents/guides/microapp/component-contract.md` | arch-reviewer |
| Pitfalls | `.agents/guides/microapp/pitfalls.md` | microapp-developer (on every crash found) |
| Layout system | `.agents/guides/microapp/layout.md` | microapp-developer |
| Persistence | `.agents/guides/microapp/persistence.md` | microapp-developer |
| Example tiers | `.agents/guides/microapp/examples-by-tier.md` | doc-refiner (after hero 7 validation) |
| Shell invariants | `.agents/guides/shell/invariants.md` | arch-reviewer only |
| COAT | `.agents/guides/shell/control-api.md` | arch-reviewer only |
| State of codebase | `.planning/state-of-the-codebase-*.md` | Agent at start of each sprint |

**Rule:** doc-drift-check.sh validates these refs on every PR. Stale refs fail CI.

---

## Immediate next tasks (post-spike, ordered)

### Session 1 — tooling baseline (1h)
1. `bun add -d knip madge` — stop relying on npx
2. Write `scripts/health-full.sh`
3. Run knip, fix/suppress the 28 unused exports
4. Run madge, verify remaining 2 circular deps (#5 skeleton↔webcam, #6 capability↔chrome)
5. Commit: `chore(tooling): install knip+madge, establish health-full gate`

### Session 2 — Hero 7 close-out (1–2h)
1. Validate `data-dashboard` + `file-manager` microapps on real instance (4af)
2. `microapp-developer` smoke: open → describeState → captureText → close each
3. Update `examples-by-tier.md` Hero 7 section when validated
4. Commit: `feat(hero7): validate data-dashboard and file-manager`

### Session 3 — generated SDK index (1h)
1. Write `scripts/sdk-export-index.sh`
2. Generate `docs/sdk-export-index.md`
3. Wire into `bun run health` or standalone `bun run sdk:index`
4. Add to doc-drift-check.sh: warn if sdk-export-index.md is >7 days stale
5. Commit: `feat(docs): generated SDK export index from microapp-sdk.ts`

### Session 4 — remaining infra wrappers (1h)
1. `platform-commands.ts` — 6 call sites
2. `append-log.ts` — 5 call sites
3. `audio-process.ts` — 6 call sites
4. Knock remaining 24 raw fs calls down, re-count
5. Commit: `feat(infra): platform/audio/log wrappers, reduce raw fs calls`

### Session 5 — music-player migration (half-day)
1. Own spike or mini-spike: `spk-music-player-migration`
2. Extract from `src/windows/music-player-window.ts` (1227 lines) → `microapps/music-player/`
3. Full lifecycle hooks, describeState, captureText

---

## The compounding bet

Each session above makes the next one faster:
- Tooling gate → clean imports → infra wrappers land cleanly
- Hero 7 validated → examples-by-tier.md fully accurate
- Generated SDK index → doc-drift-check catches stale refs automatically
- Agents/scripts enforce quality → less manual audit per session

**Target by end of Q1 2026:**
- `bun run health-full` exits 0 cleanly
- 0 unused exports (knip clean)
- 0 circular deps (madge clean)
- 0 raw fs calls outside wrappers
- Hero 7 all validated
- blessed-direct imports < 10/44 microapps
