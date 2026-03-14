---
title: Agent Notes Protocol
scope: all agents working in this codebase
---

# Agent Notes Protocol

Specs in `.agents/shell-dev/specs/` are living documents. Agents may edit them.

## What to do when you find something new

If you hit a failure mode, spot a wrong invariant, or discover a pattern
the spec is missing — just fix it. Edit the spec body if you are confident.
Use the `## Agent Notes` table if you want to flag it for human review first.

## Agent Notes table format

Each spec has an append-only notes table at the bottom. One row per finding.

| Date | Type | Subsystem | Finding | Triggered by |
|------|------|-----------|---------|--------------|

Types: `failure-mode` · `invariant` · `correction` · `gotcha` · `do-dont`

Finding format: `symptom: cause → fix` in one line.

Example:
| 2026-03-10 | gotcha | state-and-api | GET /state stale after module reload: sync() not called → wait 500ms or call sync() manually | microapps.reload returned ok but /state showed old commands |

## Consolidation

When Agent Notes has 8+ rows: promote valid findings into the spec body,
clear the promoted rows, commit: `docs(e001): consolidate agent notes into <subsystem> spec`.
