---
status: in-progress
owner: agent
branch: spike/spk-microapp-dev-hygiene
updated: 2026-03-19
---

# spk-microapp-dev-hygiene

Agent context bootstrap file. Read first. Optimised for scan speed.

## Mission

Microapp dev hygiene uplift.
- code: improve SDK + component reliability in real microapps
- docs: DRY + progressive disclosure + low token load
- execution: skills-first + deterministic verification
- memory: convert repeated failures into gotchas/checklists/scripts
- cadence: `microloop` self-prompting drives iteration, does not replace code changes

## Focus areas → key files

### F1 — Plan / execution control
Purpose: maintain session direction, slice order, and learning capture.
- `today-plan.md`
- `devlog.md`
- `microapp-autoloop-system.md`

### F2 — Skill strategy / steering strategy / agent-native architecture
Purpose: define the operating model (skills-first + guardrails + parity).
- `agentic-dev-guide-skills-first.md`
- `/Users/james/Downloads/Lessons from Building Claude Code_ How We Use Skills.txt`
- `/Users/james/Downloads/steering-accuracy-beats-prompts-workflows.txt`
- `/Users/james/Downloads/agent-native.txt`

### F3 — Microapp docs refactor surface
Purpose: canonical doc set to dedupe, relayer, and harden for agent use.
- `docs/building-custom-microapps.md`
- `.agents/guides/microapp/quick-start.md`
- `.agents/guides/microapp/sdk-reference.md`
- `.agents/guides/microapp/pitfalls.md`
- `.agents/guides/microapp/layout.md`
- `.agents/guides/microapp/component-contract.md`
- `.agents/guides/microapp/persistence.md`
- `.agents/guides/microapp/examples-by-tier.md`

### F4 — SDK/code truth surface
Purpose: source-of-truth for behaviour, contracts, command naming, and tiering.
- `src/services/microapp-sdk.ts`
- `src/core/microapp-registry.ts`
- `src/core/command-catalog.ts`
- `.pi/extensions/microloop.ts` (iteration protocol + self-prompt loop)

### F5 — Migration queue / debt map
Purpose: prioritise cleanup work using measured violations, not guesses.
- `blessed-violations.md`

### F6 — Partner agents (execution lenses)
Purpose: split cognition by role (docs refiner vs microapp implementer).
- `.pi/agents/microapp-doc-refiner.md`
- `.pi/agents/microapp-developer.md`
- Skills these agents should load as needed:
  - `.pi/skills/simplify-docs/SKILL.md`
  - `.pi/skills/skill-creator/SKILL.md`
  - `.pi/skills/ww-ops/SKILL.md`

### F7 — Review + adjustment phase (fresh-eyes pass)
Purpose: run a deliberate second-pass critique to surface missed improvements.
- Prompt seed: `Review this with fresh eyes. Assume current output is serviceable but suboptimal. Find the top 3 clarity gaps, top 3 reliability risks, and top 3 simplifications. Then propose smallest safe edits.`
- Evidence target: update `devlog.md` with what changed after fresh-eyes review.

### F8 — Strategy ranking + scenario routing
Purpose: choose best improvement path per slice and avoid docs-only drift.
- Canon: `.planning/spikes/spk-microapp-dev-hygiene/today-plan.md` (Approach ranking + Scenarios)
- Rule: prefer paired loop (code slice + docs sync in same iteration)
- Rule: `microloop` drives cadence; gates decide keep/discard

## Work protocol (ruthless)

1. Read `today-plan.md`
2. Pick smallest slice
3. Edit
4. Verify
5. Log learning in `devlog.md`
6. Update signposts if drift

## Verification contract (must)

```bash
bun run typecheck
bun run src/cli/wibwob.ts -i main cmd microapps.reload   # microapp-only edits
# or
bash scripts/restart.sh       # host/runtime edits

bun run src/cli/wibwob.ts -i main state
bun run src/cli/wibwob.ts -i main map
./scripts/screenshot-window.sh "<window title>"
```

Pass criteria:
- command surface works
- state/capture hooks meaningful
- visual behaviour confirmed

## Scope guardrails

In:
- microapp + SDK doc architecture
- skill/agent quality for this workflow
- gotcha codification

Out (unless explicit):
- unrelated feature work
- unrelated deploy/infra rewrites

## Session closeout

- [ ] `today-plan.md` updated
- [ ] `devlog.md` updated (pain → cause → fix → canon)
- [ ] changed guidance reflected in canonical docs
- [ ] no stale links in touched docs

<for-humans>

## Meta-prompt template — rewrite for agent scannability

Use this when asking an agent to tighten docs for context bootstrap speed.

```text
Use <TARGET_FILE> as an agent bootstrap index.

Rewrite for maximum agent scannability, not human prose quality.

Constraints:
1. Minimal words, maximal semantic precision.
2. Map each focus area directly to key files/dirs.
3. Prioritise canonical truth sources (docs + code).
4. Include strict execution protocol (read → edit → verify → log).
5. Include mandatory verification contract commands.
6. Keep British English.
7. Remove fluff, narrative, and repeated explanation.
8. Treat this as infrastructure: ruthlessly engineered for context setup speed.

Output requirements:
- Overwrite file in place.
- Keep headings short and machine-scannable.
- Preserve scope guardrails and closeout checklist.
```

</for-humans>
