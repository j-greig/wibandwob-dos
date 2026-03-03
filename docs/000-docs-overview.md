# Docs Overview

Canonical inventory of documentation for WibWob-DOS. Update this file whenever a doc is added or its status materially changes.

## Status Key

| Status | Meaning |
|--------|---------|
| `active` | Current, authoritative. Prefer for all work. |
| `partial` | Partially written or missing sections. Still useful. |
| `reference` | Background context only. Not a primary planning source. |
| `retired` | Superseded or absorbed. Move to `docs/.trash/` if preserving. |

## Active Documents

| Path | Status | Description |
|------|--------|-------------|
| `AGENTS.md` | active | Agent guidance, architecture invariants, control API reference, editing rules |
| `README.md` | active | Project overview, setup, quick start |
| `docs/000-docs-overview.md` | active | This file — doc inventory |

## Planning

| Path | Status | Description |
|------|--------|-------------|
| `.planning/README.md` | active | Canon terms, naming conventions, commit format |
| `.planning/epics/EPIC_STATUS.md` | active | One-line status register for all epics |
| `.planning/BUILD.md` | partial | Build order and architectural notes |

## Architecture Reference

Architecture knowledge primarily lives in `AGENTS.md` under:
- "Architecture" section — module ownership map
- "Architecture Invariants" — strict rules
- "Code Style" — conventions
- "Anti-Patterns" — what not to do

## Retired / Legacy

Legacy docs from the C++ era or early spikes should be moved to `docs/.trash/`
when they are no longer referenced by active planning. Do not keep two overlapping
sources alive for the same concept.
