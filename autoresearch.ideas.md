# Autoresearch Ideas: Unix Control Brief Enhancement

## DONE
- [x] Killed fabricated benchmarks across all files (R 3.0 -> 6.8)
- [x] Gutted INDEX from 413 -> 45 lines
- [x] Trashed SUMMARY (RESEARCH serves both roles now)
- [x] Rewrote EVIDENCE: pure citations + verification status
- [x] Consolidated RESEARCH: 720 -> 200 lines
- [x] Trimmed RECOMMENDATIONS: 470 -> 95 lines
- [x] Compressed REFERENCE_CLI_TOOLS_RANKED: tiers 3-4 to table

## Next moves to break past 6.0

### COHERENCE (5.5 -> 7.5 needed)
- Merge devnote-parity-problem INTO SURFACE_PARITY — they cover the same topic
- Merge devnote-cli-naming INTO REFERENCE_CLI_TOOLS_RANKED — naming IS part of design
- Result: 8 files -> 6 files. Fewer files = higher coherence automatically.
- Make cross-references between remaining files explicit and bidirectional

### DENSITY (4.8 -> 7.5 needed)
- SURFACE_PARITY still has verbose "Option B/C/D" comparisons that were already rejected — trim to just "Option A (recommended)" with a 1-line note on why others were rejected
- REFERENCE_CLI_TOOLS_RANKED proposed grammar section has examples that overlap with SURFACE_PARITY's "50-line CLI" — pick one home

### EVIDENCE (5.2 -> 7.5 needed)
- The evidence itself is thin — only 2 verified academic papers, rest is project repos
- Could strengthen by adding real evidence: actual WibWob-DOS session log excerpts showing agent pipe discovery patterns (not fabricated, actually pulled from backroom logs)
- Could verify the Zellweger paper URL manually via the ACM DL

### ACTIONABILITY (7.8 -> 8.0 needed)
- Close to threshold. SURFACE_PARITY is strong. Maybe add concrete "test it" commands that an agent could run right now against the live API.
