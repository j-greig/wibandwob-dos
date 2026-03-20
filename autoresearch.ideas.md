# Doc Health — Ideas Backlog

## Active ideas
- Subagent delta judge as periodic review (tested: scored AGENTS.md 8/10, found 6 redundancies)
- Subagent GOTCHAS promotion review: read GOTCHAS, suggest entries to promote to parent CAPS
- Test that doc-agent skill actually works end-to-end when subagent infra is available
- Add axis: every gen script @output path also appears in its @parent CAPS file's <output> tag (tighter circularity)
- Agent task success test: give fresh context only CAPS files + "build a microapp" task, measure pass/fail

## Diminishing returns zone
- More structural axes that all pass — 14/14 is regression-catching territory now
- Python Path() parsing for @watches derivation — too complex for grep, low ROI
- doc-health --json mode — useful for tooling but not for the autoresearch loop itself

## Deferred (later sessions)
- MicroappHost gen: repurpose gen-sdk-surface.ts for real JSDoc + type signatures
- Analytics JSONL: upgrade usage-pulse.ts
- Pre-commit hook auto-install (package.json postinstall or similar)
