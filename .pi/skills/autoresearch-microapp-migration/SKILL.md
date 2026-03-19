---
name: autoresearch-microapp-migration
description: "Autonomous migration loop for pre-refactor microapps from microapps/.disabled into live microapps/ with binary runtime checks (wibwob CLI + API + screenshot/text). Use when: migrate disabled microapps, restore archived microapp, run migration loop, revive pre-refactor microapp."
---

# Autoresearch: Microapp Migration Loop

Use this skill to migrate disabled microapps safely and repeatedly with binary checks.

## Session feedback memory (required)

- Before any work, read:
  - `.pi/skills/autoresearch-microapp-migration/feedback.log`
- When the user gives a correction/preference that generalizes, append it immediately to `feedback.log`.
- Skip one-off task trivia; keep only patterns useful for future migration loops.
- At end of each run, append 2-5 bullets: what caused failures, what gate prevented regressions, what to change next time.

Primary target: move one microapp from `microapps/.disabled/<name>/` to `microapps/<name>/`, wire it correctly, and prove it runs.

Default first testcase:
- `microapps/demo-layout-stress-test-pi/` (layout-focused candidate for future `src/sdk/` extraction)

---

## Core contract

For each migrated microapp, run an autonomous improvement loop:

1. migrate a small slice
2. run binary eval checks
3. keep if score improves; revert if worse/equal
4. log every attempt
5. repeat

Do not ship vibes. Only keep changes with verifiable pass signal.

---

## Required artifacts per run

Create (or reuse) a run directory:

- `.pi/skills/autoresearch-microapp-migration/runs/<slug>/results.tsv`
- `.pi/skills/autoresearch-microapp-migration/runs/<slug>/results.json`
- `.pi/skills/autoresearch-microapp-migration/runs/<slug>/changelog.md`
- `.pi/skills/autoresearch-microapp-migration/runs/<slug>/notes.md`

`results.json` should be dashboard-friendly and include: current status, best score, experiments list, eval breakdown.

---

## Eval source of truth

Use:
- `.pi/skills/autoresearch-microapp-migration/assets/migration-evals.json`

Keep checks binary (`pass` / `fail`).

## Loop control (max count + stop rules)

Use:
- `.pi/skills/autoresearch-microapp-migration/assets/loop-control.json`
- `.pi/skills/autoresearch-microapp-migration/scripts/stop-check.py`

Required:
- enforce `maxLoops` hard cap
- stop on `consecutiveFullPassesToStop`
- optionally stop on `noImprovementStreakStop`

The loop must write `stopReason` in `results.json` when it exits.

---

## Baseline before edits (experiment 0)

Before changing code:

1. confirm source exists in `.disabled` or already-present target state (document exact starting condition)
2. run baseline checks using the target command id (or expected command id)
3. log baseline score

If baseline already passes all checks, switch objective from "migration" to "simplification/extraction" and continue loop.

---

## Loop steps (repeat)

For each experiment N:

1. Apply one focused change.
2. Run eval checks (CLI + API + screenshot).
3. Score pass count.
4. Decision:
   - improved score -> `keep`
   - equal/worse -> `discard` and revert
5. Append changelog entry with failure deltas.

Stop when any condition is true:
- `maxLoops` reached
- full-pass score reached for `consecutiveFullPassesToStop` consecutive experiments
- no score improvement for `noImprovementStreakStop` experiments
- user stop request

Use `scripts/stop-check.py` to compute the stop decision from `results.tsv` + `loop-control.json`.

---

## Mandatory verification surface

Every experiment must include these checks (instance-targeted where possible):

1. **Typecheck pass**
   - `bun run typecheck`

2. **App runs**
   - start app (`bun run dev` or controlled harness)
   - `wibwob health`

3. **Command discoverability via CLI**
   - `wibwob commands -q | grep "microapp.wibwob.<id>.open"`

4. **Open command executes**
   - `wibwob cmd microapp.wibwob.<id>.open`

5. **Window exists in state**
   - `wibwob state | jq` assertion for matching `appType` / title / window record

6. **API screenshot/text sanity**
   - `GET /screenshot/text` contains expected microapp signal (title/content token)

7. **Applications/menu visibility signal**
   - prove command is menu-eligible (catalog/list metadata) and capture at least one textual signal from `/screenshot/text` after opening/interaction.

8. **Responsive check: default size quality**
   - `bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh default <command-id>`

9. **Responsive check: medium size adaptation**
   - `bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh medium <command-id>`

10. **Responsive check: fullscreen adaptation**
   - `bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh fullscreen <command-id>`

11. **Microapp import boundary check**
   - `bash .pi/skills/autoresearch-microapp-migration/scripts/check-microapp-imports.sh <target-dir>`

12. **SDK docs sync check (when SDK changes)**
   - `bash .pi/skills/autoresearch-microapp-migration/scripts/check-sdk-doc-sync.sh`

---

## Migration rules

- Migrate one microapp at a time.
- Prefer smallest working slice.
- Add to `src/core/microapp-registry.ts` `REGISTRY` when required for visibility (core/beta choice must be explicit).
- Avoid parallel helper systems; follow COAT + owner-extension principle.
- If layout primitives are duplicated, extract reusable parts into `src/sdk/` only after runtime behavior is proven.

## SDK extraction + docs sync gates (programmatic)

Run these on every experiment:

- `scripts/check-microapp-imports.sh <target-dir>`
  - fails if migrated microapp imports forbidden internal layers (`src/core/*`, `src/windows/*`)
- `scripts/check-sdk-doc-sync.sh`
  - if SDK surface changed (`src/sdk/*` or `src/services/microapp-sdk.ts`), requires updates in:
    - `.agents/guides/microapp/sdk-reference.md`
    - `docs/building-custom-microapps.md`
- `bun run typecheck`
- targeted runtime checks (CLI + API + screenshot)

These gates enforce microapp-guide + shell-architecture constraints while the loop runs.

---

## Changelog entry format

```md
## Experiment N — keep|discard
Score: X/Y (Z%)
Change: ...
Why: ...
Checks failed: [ids]
Checks fixed: [ids]
Notes: ...
```

## Commit parceling during loops (required)

Keep the loop running, but commit in logical parcels when a stable milestone is reached.

Commit parcel triggers:
- migrated microapp reaches full-pass gate status
- a tricky blocker/bug is solved and verified
- SDK extraction slice + docs sync passes gates

Rules:
- commit only verified slices (typecheck + runtime gates pass)
- one concern per commit (migration wiring, bug fix, SDK extraction, docs sync)
- after commit, continue next loop iteration from current branch state
- do not wait until the entire long loop ends to commit everything at once

---

## Default target kickoff

If user does not specify target, start with:

- slug: `demo-layout-stress-test-pi`
- source candidates:
  - `microapps/demo-layout-stress-test-pi/` (current)
  - matching historical variant under `microapps/.disabled/` if needed for parity study

Then run baseline + loop using migration eval set.
