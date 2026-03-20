# Doc Health — Ideas Backlog

## Next: implement doc-review.sh (tier 2+3)
- Spec written: `.planning/autoresearch-doc-health/doc-review-spec.md`
- Tier 2 (semantic): subagent delta judge per CAPS file, haiku model, ~30s
- Tier 3 (functional): subagent builds microapp from CAPS only, sonnet model, ~60s
- Wire tier 2 as secondary metric in autoresearch loop

## Plateau — tier 1 is done
- 15/15 structural, stress tested, content drift detection added
- Delta judge scored all CAPS files 8-9/10
- Pre-commit hook works, content freshness axis validates regen output
- No more structural axes worth adding without real source code changes

## Deferred
- MicroappHost gen: repurpose gen-sdk-surface.ts for real JSDoc + type signatures
- Analytics JSONL: upgrade usage-pulse.ts
- Pre-commit hook auto-install (postinstall script)
- Headless pi agent running doc-review on schedule (cron/launchd)
