# Doc Health — Ideas Backlog

## Active ideas
- Pre-commit hook doesn't catch content drift in generated files (only source staleness). Would need --dry-run per gen script to compare output — expensive but correct.
- Agent task success test: give fresh context only CAPS files + "build a microapp" task, measure pass/fail
- Subagent GOTCHAS promotion review: periodically spawn doc-agent to suggest promotions

## Plateau reached
- 14/14 all green, delta judge scores 8-9/10 across all CAPS files
- Missing-output-skip bug fixed — suite now has real sensitivity
- Stress tests pass: 4 sabotage scenarios all caught correctly
- Adding more structural axes is diminishing returns unless source code changes introduce drift

## Deferred (later sessions)
- MicroappHost gen: repurpose gen-sdk-surface.ts for real JSDoc + type signatures
- Analytics JSONL: upgrade usage-pulse.ts
- Pre-commit hook auto-install
- doc-health --dry-run mode: run all gen scripts, compare output to committed files (expensive but catches content drift)
