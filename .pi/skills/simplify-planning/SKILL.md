---
name: simplify-planning
description: >-
  Three-pass review of planning epics, features, stories, spikes, and refactor
  trackers. Checks execution coherence (status fields vs reality, AC-to-test
  traceability, lifecycle sync), scope hygiene (stories that are actually three
  stories, ACs that are untestable, scope creep), and canon compliance (naming
  rules, checkbox format, commit conventions, closeout pass rules from
  AGENTS.md and .planning/README.md). Fixes issues directly. Use when the user
  says "simplify planning", "tidy the epics", "audit the briefs", or before
  closing out a feature or epic.
---
# Simplify Planning: Epic & Story Review

Review planning documents for execution coherence, scope hygiene, and canon
compliance. Fix issues directly.

The canon rules live in two places. Read both before starting:

- `.planning/README.md` — status vocabulary, checkbox format, AC rules,
  file naming, work-item hierarchy, PR checklist
- `AGENTS.md` — commit message format, naming rules, planning brief
  requirements, stop checklist, closeout pass rules, GitHub formatting
  guardrails

## Scope

The user may point at a specific epic, feature, story, or spike. If no
target is specified, scan `.planning/epics/` for any brief with status
`in-progress` or `blocked` and review those.

Read each target brief fully. Also read its parent epic brief and any
sibling stories to check cross-references and consistency.

## Phase 1: Execution Coherence

Check whether planning docs reflect the actual state of work.

1. **Status vs reality.** If a brief says `in-progress`, is there evidence
   of actual work (commits on a branch, a PR, changed source files)? If it
   says `not-started`, has work actually begun? Flag mismatches.

2. **GitHub issue lifecycle.** If the brief references a GitHub issue number,
   check: is the issue state consistent with the brief status? Canon rule:
   set issue to `in-progress` when implementation starts, comment with
   commit SHAs as slices land, update planning `PR:` field when a PR opens,
   close issue when acceptance checks pass. Flag any drift.

3. **AC-to-test traceability.** Every `AC-*` bullet must have a concrete
   `Test:` line. No placeholders (`TBD`, `TODO`, `later`). This is a canon
   rule from AGENTS.md. Flag violations.

4. **Checkbox accuracy.** Walk the feature checklist in each epic brief and
   the story/task checklists in feature/story briefs. Are completed items
   marked `[x]`? Are in-progress items marked `[~]`? Are dropped items
   marked `[-]` with a reason? Flag stale checkboxes.

5. **Cross-reference integrity.** If a story brief references a file path,
   a module name, or another planning doc, does that target still exist?
   Flag broken references.

## Phase 2: Scope Hygiene

Check whether each work item is properly scoped.

1. **Story sizing.** Canon rule: a story should land in one review session
   and one PR. If a story brief has more than 5-6 task checkboxes, or its
   ACs span unrelated concerns, it is probably multiple stories. Flag it.

2. **AC quality.** Each AC must be observable, binary, and scoped (canon
   rules from .planning/README.md). Flag ACs that are vague ("improve X"),
   bundled ("X and Y and Z work correctly"), or unverifiable without
   reading the implementation.

3. **Scope creep.** Compare the story brief's stated scope against its task
   list and ACs. Are there tasks or ACs that do not serve the story's
   stated objective? Flag items that should be parking-lot entries or
   separate stories.

4. **Dependency clarity.** If a story depends on another story or feature
   being done first, is that stated explicitly? Flag implicit dependencies.

5. **Spike vs story confusion.** A spike produces findings and reduces
   uncertainty. A story produces mergeable code. Flag any spike that has
   implementation ACs, or any story whose primary output is "investigate"
   or "evaluate".

## Phase 3: Canon Compliance

Check mechanical conformance with the repo's planning conventions.

1. **Status header.** Every brief must have: `Status:` (valid value),
   `GitHub issue:` (real number if not `not-started`), `PR:` field.
   Epic briefs should use YAML frontmatter with `id`, `title`, `status`,
   `issue`, `pr` fields.

2. **File naming.** Files under `.planning/epics/` must match the prefix
   conventions: `eNNN-*` for epics, `fNN-*` for features, `sNN-*` for
   stories. Spikes must live under `.planning/spikes/` with `spk-*`
   prefix. Flag violations.

3. **Checkbox format.** Only `[ ]`, `[~]`, `[x]`, `[-]` are valid. Flag
   any other checkbox states or freeform progress markers.

4. **Parking lot discipline.** Side-work items discovered during a story
   should be in a parking lot, not silently added to the story's task
   list. Flag task items that look like follow-ons rather than core
   deliverables.

5. **Commit message alignment.** If the brief references specific commits
   or PRs, spot-check that commit messages follow the canon format:
   `type(scope): imperative summary`. Flag violations.

## Phase 3: Fix Issues

Aggregate findings from all three passes. Fix each issue directly in the
planning files. Specific fix patterns:

- **Status mismatches:** Update the status field to match reality. Add a
  note if the mismatch was significant.
- **Missing test lines:** Add a `Test:` line to each AC that lacks one.
  If the test is genuinely unknown, write `Test: DECISION NEEDED —
  no clear test strategy yet` rather than leaving it blank.
- **Oversized stories:** Do not split them yourself. Flag with a comment
  block: `<!-- SCOPE: This story may be 2-3 stories. Consider splitting
  before implementation. -->` and list the natural split points.
- **Stale checkboxes:** Update to match actual state.
- **Broken cross-references:** Fix the path or note the deletion.
- **Canon violations:** Fix naming, headers, and checkbox format directly.

When done, briefly summarise what was fixed per file, or confirm the
planning docs were already clean.
