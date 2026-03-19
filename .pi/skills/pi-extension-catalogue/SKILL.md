---
name: pi-extension-catalogue
description: Build an agent-friendly catalogue of all local Pi extensions in `.pi/extensions` by extracting top docblocks and command/tool/shortcut surfaces into a progressive-disclosure Markdown report. Use when asked to list extensions, summarise extension capabilities, map extension command surfaces, or prepare an extension overview for handoff.
---

# Pi Extension Catalogue

Create a fast-scanning, agent-friendly map of local Pi extensions.

## What this skill produces

- A Markdown report with:
  - TL;DR
  - at-a-glance table
  - per-extension progressive-disclosure blocks
- Optional clipboard copy (macOS)

## Quick run

```bash
bash .pi/skills/pi-extension-catalogue/scripts/export.sh --out scratch/reports/pi-extension-catalogue.md --copy
```

## Options

- `--extensions-dir <dir>`: source extension directory (default: `.pi/extensions`)
- `--out <path>`: output Markdown path (default: `scratch/reports/pi-extension-catalogue.md`)
- `--copy`: copy report text to clipboard (macOS `pbcopy`)
- `--limit <n>`: scan only first N files (default: all)

## When to use

- “What extensions are installed?”
- “Summarise extension capabilities.”
- “Give me command/shortcut surfaces for extensions.”
- “Make a handoff doc for extension behaviour.”

## Notes

- Source of truth is local code in `.pi/extensions/*.ts`.
- Summaries are extracted from each file’s top `/** ... */` docblock.
- Command/shortcut surfaces are inferred from `registerCommand` / `registerShortcut` calls.
- Tool surface extraction is conservative to avoid noisy false positives.
