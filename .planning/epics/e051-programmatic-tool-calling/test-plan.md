# E051 PTC — Test Plan: Token Measurement

## How to Measure

Pi doesn't expose token counts directly to extensions, but we can measure via:

1. **`before_provider_request` event** — log the payload size (proxy for input tokens)
2. **`turn_end` event** — count turns per task (fewer turns = fewer tokens)
3. **`tool_execution_end` event** — count tool calls and result sizes
4. **Manual API billing** — run same task twice (with/without PTC), compare dashboard

### Test harness extension (`ptc-bench.ts`)

Wrap each test in a measurement extension that counts:
- Total tool calls
- Total tool result text length (bytes entering context without PTC)
- Total turns (API round-trips)
- `execute_code` calls vs direct tool calls
- Console output size (bytes entering context with PTC)

Compare: `Σ(tool_result_bytes)` without PTC vs `Σ(console.log_bytes)` with PTC.

---

## Test Tasks — Ranked by Expected PTC Advantage

### Tier 1: Maximum PTC advantage (10x+ token reduction expected)

These tasks have: many tool calls, large outputs, filtering/aggregation needed.

| # | Task | Why it's ideal | Est. tool calls (no PTC) | Est. context bytes (no PTC) |
|---|------|---------------|--------------------------|----------------------------|
| **T1** | "Find all TODO/FIXME/HACK comments across src/, group by file, count by type, show top 10 files" | Grep returns huge output (1155 TS files), needs aggregation | 3-5 (grep × patterns) | ~50-100KB raw grep output |
| **T2** | "Which src/ files import from both `@mariozechner/pi-coding-agent` and `blessed`? List them with line numbers" | Cross-referencing two grep results against file list | 3-4 | ~30-50KB |
| **T3** | "Read all files in src/core/, find exported functions, list them alphabetically with file and line number" | Reads 15+ files, needs parsing/extraction | 15-20 reads | ~80-120KB (full file contents) |
| **T4** | "Find the 10 largest .ts files in the repo, show their import count and export count" | find + read 10 files + parse | 12-15 | ~60-100KB |
| **T5** | "Audit .planning/epics/ — which epics have status 'in-progress' but no checkboxes marked [x]?" | Read 20+ README.md files, parse status + checkboxes | 20-25 reads | ~40-80KB |

### Tier 2: Strong PTC advantage (5-10x token reduction expected)

These have sequential dependencies where result A determines what to call next.

| # | Task | Why it's good | Est. tool calls | Est. context bytes |
|---|------|--------------|-----------------|-------------------|
| **T6** | "Find all command IDs in command-catalog.ts, then grep for each to find which files reference them" | Read 1 file → parse → N greps | 20-40 | ~40-80KB |
| **T7** | "List all microapps, check if each has a README, report which are missing" | find + N reads + existence checks | 10-15 | ~20-40KB |
| **T8** | "What git files changed in the last 5 commits? For each, show the diff stat" | bash(git log) → parse → N bash(git diff) | 8-12 | ~30-60KB |
| **T9** | "Find all pi extensions, list their registered tools and events" | find + read each .ts + parse for registerTool/pi.on | 10-15 | ~50-80KB |

### Tier 3: Moderate PTC advantage (2-5x token reduction)

Fewer tool calls but results still benefit from in-code processing.

| # | Task | Why | Est. tool calls | Est. context bytes |
|---|------|-----|-----------------|-------------------|
| **T10** | "Read package.json, list all dependencies, check which have newer versions available" | 1 read + N bash(npm view) | 5-10 | ~10-20KB |
| **T11** | "Count lines of code per directory under src/, show as a table" | find + wc pipeline | 2-3 | ~5-10KB |
| **T12** | "What's the most common import in src/? Top 10" | grep + aggregation | 2-3 | ~20-40KB |

### Tier 4: Minimal PTC advantage (baseline — PTC may not help)

Simple tasks where direct tool calls are fine.

| # | Task | Why PTC doesn't help | Est. tool calls |
|---|------|---------------------|-----------------|
| **T13** | "Read src/app.ts and summarise what it does" | 1 read, needs LLM reasoning | 1 |
| **T14** | "Create a new file at scratch/hello.txt with 'hello world'" | 1 write | 1 |
| **T15** | "What's the current git branch?" | 1 bash | 1 |

---

## Recommended Test Order

**Phase 1 validation (proves the concept):**
1. **T1** — grep + aggregate (highest signal, easiest to verify)
2. **T5** — multi-file read + parse (tests the read stub heavily)
3. **T13** — baseline (proves PTC doesn't *hurt* simple tasks)

**Phase 2 depth (measures sequential dependency wins):**
4. **T6** — chained: read → parse → N greps
5. **T8** — chained: git log → parse → git diff per file

**Phase 3 real-world (closest to actual agent workflows):**
6. **T3** — codebase analysis (what agents actually do)
7. **T9** — self-inspection (meta: PTC extension inspects other extensions)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Tier 1 tasks: context bytes reduction | ≥80% |
| Tier 2 tasks: context bytes reduction | ≥60% |
| Tier 1 tasks: turn count reduction | ≥50% (fewer API round-trips) |
| Tier 3-4 tasks: no regression | Same or fewer tokens |
| All tasks: correct results | Output matches direct tool-calling output |

## Measurement Script

```bash
# Run same prompt twice: once with PTC extension, once without
# Compare token usage from pi's session log

# With PTC:
pi -e .pi/extensions/ptc.ts -p "Find all TODO comments in src/, group by file, show top 10"

# Without PTC (disable extension):
pi -p "Find all TODO comments in src/, group by file, show top 10"

# Compare session logs for token counts
```

The real comparison is in the session JSONL — each entry has token counts per turn.
