---
name: pi-usage-audit
description: Audit local Pi skill, extension, and agent usage from session logs for the current repo. Flags stale items not used in N days and outputs an agent-friendly Markdown/JSON report. Use when asked what is stale, unused for 2 weeks, or to rank under-used skills/extensions/agents.
---

# Pi Usage Audit

Audit usage signals from Pi session logs for this repo bucket.

## TL;DR

- Reads: `~/.pi/agent/sessions/--<cwd>--/*.jsonl`
- Detects usage for:
  - skills (`read` of `.pi/skills/*/SKILL.md`)
  - extensions (slash commands + extension tool results)
  - agents (`read` of `.pi/agents/*.md` + `@agent` mentions)
- Writes stale report with configurable threshold.

## Quick run

```bash
bash .pi/skills/pi-usage-audit/scripts/export.sh \
  --days 14 \
  --out scratch/reports/pi-usage-audit.md \
  --json-out scratch/reports/pi-usage-audit.json
```

## Weekly hygiene wrapper

```bash
bash .pi/skills/pi-usage-audit/scripts/weekly-hygiene.sh 14
```

This will:
- run the audit,
- print the Top stale 10 block to terminal,
- and open the Markdown report on macOS.

## Output

- Markdown report includes:
  - TL;DR
  - Top stale 10 (cross-surface)
  - full tables for Skills / Extensions / Agents
- JSON report includes machine-readable rows + top_stale_10.

## Options

- `--days <n>` stale threshold (default `14`)
- `--out <path>` markdown output path
- `--json-out <path>` optional JSON output path
- `--cwd <path>` target repo root (default current dir)
- `--sessions-dir <path>` override sessions root

## Notes

- This is read-only against session logs (no runtime instrumentation required).
- “never” means no usage signal found in scanned logs, not guaranteed true non-usage.
