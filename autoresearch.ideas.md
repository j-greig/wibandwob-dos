# Doc Health — Ideas Backlog

- Add @parent header to gen script comment metadata (not just in generated output)
- Pre-commit hook that blocks if doc-health < 8
- @watches derivation checker (scripts/check-watches.sh) — verify declared watches match actual readFileSync calls
- Count-based functional checks: endpoints in COAT.md vs source, skills in skills.md vs source
- Delta judge (LLM scorer) for CAPS file compression quality — run as periodic audit not every commit
- Bidirectional cross-reference check: every CAPS file section referenced by a Parent header should actually contain the output reference
- Add a 9th axis: CAPS file word-count regression — flag if any CAPS file grows >20% between runs (potential delta principle violation)
- Wire doc-health.sh --json into the autoresearch loop for richer metric extraction
- MicroappHost gen: repurpose gen-sdk-surface.ts to extract real JSDoc + type signatures from microapp-host.ts
- Analytics JSONL: upgrade usage-pulse.ts to append to ~/.pi/analytics/skill-usage.jsonl
