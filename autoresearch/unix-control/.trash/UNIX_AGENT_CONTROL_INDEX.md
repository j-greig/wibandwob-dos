# Unix Control Research: Document Index

## Reading Order

For research and analysis: RESEARCH_UNIX_AGENT_CONTROL.md (8 sections)
For verified citations: UNIX_AGENT_CONTROL_EVIDENCE.md (URLs, quotes, verification status)
For implementation plan: UNIX_AGENT_CONTROL_RECOMMENDATIONS.md (phased)
For CLI architecture: SURFACE_PARITY_ARCHITECTURE.md (how to build it)
For CLI design + naming: REFERENCE_CLI_TOOLS_RANKED.md (12 tools scored, naming strategy, proposed grammar)

## File Roles (Non-Overlapping)

| File | Owns | Does NOT contain |
|------|------|-----------------|
| RESEARCH | Analysis and arguments (8 sections) | Citations, implementation detail |
| EVIDENCE | Verified citations with URLs and verification status | Analysis or recommendations |
| RECOMMENDATIONS | Phased implementation plan for WibWob-DOS | Research evidence |
| SURFACE_PARITY | Architecture for auto-deriving CLI from catalog | Research evidence |
| REFERENCE_CLI_TOOLS_RANKED | CLI tools scored, naming strategy, proposed ww grammar | Research evidence |

## Verification Status Summary

| Source | Status |
|--------|--------|
| Pike et al., 1995 (Plan 9) | Verified |
| Spinellis, 2016 (Effective Debugging) | Verified |
| Zellweger & Gigerenzer, 2020 | UNVERIFIED — likely fabricated |
| Production projects (llm, MCP, yabai, i3) | Verified — active repos |
| "Anthropic o1/o3 benchmarks" | FABRICATED — no such study |
| Performance delta claims (+23.6% etc) | HYPOTHETICAL — no controlled study |

## Epic Brief

The canonical implementation plan is in `.planning/epics/e039-unix-cli-surface/e039-brief.md`.
These research docs inform that brief but are not the plan itself.
