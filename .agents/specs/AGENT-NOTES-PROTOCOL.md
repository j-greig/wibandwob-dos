---
title: Agent Notes Protocol
scope: all Tier 2 specialist agents
---

# Agent Notes Protocol

Every subsystem spec has an ## Agent Notes table at the bottom.
This is the mechanism by which specialists improve their own knowledge across sessions.

## When to append

Append a row when you encounter ANY of these during a session:
- A failure mode not covered in the spec's Failure Modes table
- A pattern that contradicts a Do/Don't in the spec
- A new invariant you had to discover the hard way
- A correction to something the spec says that turned out to be wrong
- A gotcha that cost you a retry (edge case, timing issue, blessed quirk)

Do NOT append:
- Things already in the spec body
- Vague observations without a concrete cause/fix
- Information that belongs in a different spec (write it there instead)

## How to append

Use your edit tool. Find the Agent Notes table in the relevant spec and add ONE row.
Never modify the spec body above the Agent Notes section.

Template row:
| YYYY-MM-DD | <type> | <subsystem> | <one-line finding — symptom: cause → fix> | <what triggered: task/command/error> |

Types: failure-mode | invariant | correction | gotcha | do-dont

Example rows:
| 2026-03-10 | failure-mode | window-system | Window not closing: close() called before cleanup() wired — wire cleanup first | Tried to close a window mid-session, blessed threw |
| 2026-03-10 | gotcha | state-and-api | GET /state stale after module reload — call sync() or wait 500ms | modules.reload returned ok but /state showed old commands |
| 2026-03-10 | correction | workspace | describeState() called before registerWindow() in some factories — appType missing from first /state sync | Workspace restore produced windows with undefined appType |

## Consolidation (human task, quarterly)

When Agent Notes reaches 8+ rows in any spec:
1. Review each row for accuracy
2. Promote valid findings into the spec body (Failure Modes table, Invariants, Do/Don't)
3. Delete promoted rows from Agent Notes
4. Commit: "docs(e001): consolidate agent notes into <subsystem> spec"

## Spec body is read-only for agents

Agents MUST NOT edit the spec body above ## Agent Notes.
The canonical spec is human-maintained. Agent Notes is agent-maintained.
This boundary prevents spec rot from incorrect self-edits propagating into
load-bearing knowledge.
