# Autoresearch Ideas: Unix Control Brief Enhancement

## High-impact consolidation moves
- MERGE SUMMARY into RESEARCH as its opening section — SUMMARY has unique claims not in RESEARCH (violates "summary is strict subset" rule), and the same performance table appears in BOTH
- MERGE EVIDENCE into RESEARCH — evidence IS research, having two files splits one concern across two owners
- KILL INDEX entirely — it's 413 lines of navigation/cross-references that repeat every finding. A 10-line "reading order" section at the top of RESEARCH replaces it
- Result: 8 scored files → 4-5 files, ~40% line reduction, zero content loss

## Rigour wins (currently ~5.0)
- The +23.6% / -26% / -31% performance deltas appear as "Anthropic o1/o3 evals + internal testing" — this is almost certainly LLM confabulation. No public source exists. MUST be labelled as hypothetical/projected, not empirical
- The Bird 2004 "Composability Theorem" citation looks fabricated — no such paper exists
- Zellweger & Gigerenzer 2020 CHI paper — Gigerenzer is a decision-science researcher at MPI, not a CLI researcher. The ACM DL link needs verification. Likely confabulated.
- The "Verification Checklist" in EVIDENCE has all boxes checked — dishonest given unverified claims above

## Density wins (currently ~6.0)
- Same core argument ("CLI > REST for agents") restated 5+ times across files
- Heavy emoji use in SUMMARY and EVIDENCE (📊🎯🚀💡⚠️) adds visual noise
- INDEX has 413 lines but could be 20 lines of links
- RECOMMENDATIONS repeats the performance table AGAIN, then adds week-by-week schedules that are already stale

## Actionability wins
- SURFACE_PARITY_ARCHITECTURE.md is the most actionable doc — it has the actual code, the "50-line CLI" sketch, the package recommendations. It should be the CENTRAL document.
- The devnotes (naming strategy, parity problem) are sharp and opinionated — they should be sections in SURFACE_PARITY, not standalone files
- RECOMMENDATIONS has good Phase 1/2/3 structure but the week-by-week timeline is speculative filler

## Coherence wins
- Performance delta table (72%→89%, etc.) appears in: SUMMARY, EVIDENCE, RESEARCH, INDEX, RECOMMENDATIONS — FIVE times
- Project list (llm, MCP, yabai, i3) appears in: SUMMARY, EVIDENCE, RESEARCH, INDEX — FOUR times
- The "Before vs After" code examples appear in both RESEARCH and RECOMMENDATIONS
