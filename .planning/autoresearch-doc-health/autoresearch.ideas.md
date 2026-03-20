# Doc Health — Ideas Backlog

## Done (prune)
- ~~Add @parent header to gen script comment metadata~~ — done, axis 4+9
- ~~Count-based functional checks~~ — done, axis 8
- ~~Bidirectional cross-reference check~~ — done, axis 6+7
- ~~CAPS file word-count regression~~ — done, axis 11
- ~~Pre-commit hook~~ — done, scripts/hooks/pre-commit

## Active ideas
- Add @parent to gen script comment headers (not just output headers) — consistency
- Wire pre-commit hook into actual git workflow (install-hooks.sh already exists but not auto-run)
- Agent task success test: give fresh context only CAPS files + task, measure pass/fail — the real delta test
- doc-health --verbose mode: print which axis failed for debugging
- Detect CAPS files that reference each other circularly without adding info (pure indirection)
- Ensure every CAPS file has at least one `<progressive-disclosure>` tag (except GOTCHAS/LEXICON)

## Deferred (later sessions)
- MicroappHost gen: repurpose gen-sdk-surface.ts for real JSDoc + type signatures
- Analytics JSONL: upgrade usage-pulse.ts to append to ~/.pi/analytics/skill-usage.jsonl
- Delta judge (LLM scorer) as periodic audit
