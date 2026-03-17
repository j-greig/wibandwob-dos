# PTC Extension — Test Tasks

**Parent epic:** `.planning/epics/e051-programmatic-tool-calling/`  
**Extension:** `.pi/extensions/ptc.ts`

## Measurement

Compare with/without PTC: tool call count, tool result bytes in context, turn count.

```bash
# With PTC:
pi -e .pi/extensions/ptc.ts -p "<prompt>"
# Without PTC:
pi -p "<prompt>"
```

---

## Tier 1 — Maximum advantage (10x+ savings expected)

| ID | Prompt | Why | Est. calls (no PTC) | Est. context (no PTC) |
|----|--------|-----|---------------------|-----------------------|
| T1 | "Find all TODO/FIXME/HACK comments in src/, group by file, count by type, show top 10 files" | Grep returns ~100KB across 1155 files, needs aggregation | 3-5 | 50-100KB |
| T2 | "Which src/ files import from both pi-coding-agent and blessed? List with line numbers" | Cross-reference two grep results | 3-4 | 30-50KB |
| T3 | "Read all files in src/core/, find exported functions, list alphabetically with file:line" | 15+ file reads, parsing/extraction | 15-20 | 80-120KB |
| T4 | "Find the 10 largest .ts files, show import count and export count for each" | find + read 10 files + parse | 12-15 | 60-100KB |
| T5 | "Audit .planning/epics/ — which have status 'in-progress' but no [x] checkboxes?" | Read 20+ READMEs, parse status + checkboxes | 20-25 | 40-80KB |

## Tier 2 — Strong advantage (5-10x savings)

| ID | Prompt | Why | Est. calls | Est. context |
|----|--------|-----|-----------|-------------|
| T6 | "Find all command IDs in command-catalog.ts, then find which other files reference each" | Read 1 → parse → N greps (sequential chain) | 20-40 | 40-80KB |
| T7 | "List all microapps, check which have a README, report missing ones" | find + N existence checks | 10-15 | 20-40KB |
| T8 | "What files changed in the last 5 commits? Show diff stat for each" | git log → parse → N git diffs | 8-12 | 30-60KB |
| T9 | "Find all pi extensions, list their registered tools and events" | find + read each + parse for registerTool/pi.on | 10-15 | 50-80KB |

## Tier 3 — Moderate advantage (2-5x savings)

| ID | Prompt | Why | Est. calls | Est. context |
|----|--------|-----|-----------|-------------|
| T10 | "Count lines of code per directory under src/, show as table" | find + wc | 2-3 | 5-10KB |
| T11 | "What's the most common import in src/? Top 10" | grep + sort | 2-3 | 20-40KB |

## Tier 4 — Baseline (no PTC advantage expected)

| ID | Prompt | Why | Est. calls |
|----|--------|-----|-----------|
| T12 | "Read src/app.ts and summarise what it does" | 1 read, needs LLM reasoning | 1 |
| T13 | "Create scratch/hello.txt with 'hello world'" | 1 write | 1 |
| T14 | "What's the current git branch?" | 1 bash | 1 |

## Success Criteria

| Metric | Target |
|--------|--------|
| Tier 1: context bytes reduction | ≥80% |
| Tier 2: context bytes reduction | ≥60% |
| Tier 1: turn count reduction | ≥50% |
| Tier 3-4: no regression | Same or fewer tokens |
| All tasks: correctness | Output matches non-PTC results |

## Run Order

1. **T1** — money test (closest to Anthropic's demo)
2. **T5** — multi-read + parse
3. **T12** — baseline safety check
4. **T6** — sequential chain
5. **T3** — codebase analysis
