---
title: "SPK — Direction Reset: WibWobDOS vs Symbient Computer"
status: not-started
github_issue: "—"
pr: "—"
date: 2026-02-20
authors: [james, 0xG]
---

## TL;DR

> We built a rich TUI (WibWobDOS) on top of the original vision of a shared unix computer for multiple LLMs to inhabit. After discussing with 0xG (collaborator, AI/inference research), we think the TUI layer is now *in the way* rather than enabling the core goal. This spike documents the options for resetting direction — preserving WibWobDOS as an artefact without abandoning what was learned — and poses the question cleanly for a Codex analysis pass.

---

## 1. The Original Vision (Symbient Computer Spec)

The founding concept — loosely documented before WibWobDOS was built — was:

> **A shared unix computer that multiple LLMs ("symbiants") inhabit simultaneously.** Each LLM gets a shell. They can read/write files, leave messages, observe each other's traces, and develop emergent behaviour through cohabitation. The interface is a raw unix terminal. No special UI layer. Agents interact by *typing into a shell*, the same way a human would.

Key properties of that vision:
- **Unix-native** — agents use standard shell tooling (bash, files, pipes, cron)
- **Observable** — humans can `tail -f` any agent's activity log
- **Multi-tenant** — multiple LLMs active concurrently, aware of each other via shared filesystem state
- **Research-grade** — designed to study emergent LLM behaviour in a shared environment, not to build a product feature
- **Minimal interface contract** — no API, no IPC, no MCP required for agents to participate; stdin/stdout is enough

The commit hash `76785b0dc66ba4d9ca374cc6fe07117c18637ffb` that originally referenced this spec **no longer exists** anywhere (not locally, not on GitHub remote — confirmed via `git cat-file` and `gh api`). The content is reconstructed above from memory and adjacent docs.

---

## 2. What Was Built Instead (mvp/mvp001-wibwobcity branch)

The `mvp/mvp001-wibwobcity` branch adds substantially to the existing WibWobDOS C++ tvision TUI codebase:

| Commit range | What landed |
|---|---|
| `38f2eb3` | Native Micropolis (SimCity) engine bridge — stage-0 smoke tests |
| `dcc79e2` | ASCII Micropolis window rendered inside tvision TUI |
| `9700384` | Cursor, tools, apply_tool bridge, HUD, zone tiers, wide-tile glyphs |
| `5c97df8` | Coal + nuclear power plant keybindings |
| `75727a1` | SimCity-style right-hand tool palette (TMicropolisToolPalette) |
| `ddb3810` | Sim speed controls (pause, 5-speed cycle) |

On top of the existing WibWobDOS foundation (tvision C++ TUI, FastAPI Python sidecar, Docker build, MCP tools, pattern/scramble system, browser renderer, command registry refactor).

**What this means in practice:** agents wanting to interact with WibWobDOS must go through the REST API or MCP tools. They cannot simply type into a shell. The TUI is a forced intermediary.

---

## 3. The Problem (as stated by James + 0xG)

> "WibWobDOS is an extra level of complexity on top of the original goal. Agents have to use the API to interact with WibWobDOS vs simply typing into a unix shell. The forced interface is a barrier, not an enabler."

The AI/LLM research goal (monitoring multiple LLMs living in a shared computer) is **better served by**:

- A shared filesystem + shell environment
- Each LLM gets a home dir, a log, a shell session
- Communication via files (shared inbox, world state YAML, etc.)
- Human monitoring via standard unix tools
- No tvision, no Docker C++ build, no FastAPI sidecar required

WibWobDOS becomes interesting again *later* — as a visualisation layer or control panel *on top of* the shared computer, not as the computer itself.

---

## 4. Options (not yet decided)

### Option A — Freeze WibWobDOS, new repo for Symbient Computer
- Create a new repo (e.g. `wibandwob-computer` or `symbient-computer`) for the unix-shell-native multi-LLM environment
- Leave `mvp/mvp001-wibwobcity` as a preserved branch in `wibandwob-dos`
- Merge WibWobDOS back to `main` cleanly (or leave as branch)
- **Pro:** Clean separation. WibWobDOS stays as a creative/visual artefact. New work starts fresh.
- **Con:** Another repo; scatter risk.

### Option B — Clone mvp branch as archive, strip WibWobDOS from a new branch
- Branch `archive/mvp001-wibwobcity-snapshot` from current MVP
- Create a new branch (e.g. `mvp/mvp002-symbient-computer`) that removes or comment-gates the tvision/Docker/FastAPI layer
- Build the unix shell substrate in the same repo
- **Pro:** Keeps git history, one repo, easy to revive WibWobDOS later
- **Con:** Messy if the tvision/API surface is deeply intertwined

### Option C — Merge WibWobDOS to main, start symbient-computer as a subdirectory
- Merge `mvp/mvp001-wibwobcity` → `main` (it's a meaningful artefact)
- Add a `computer/` subdirectory to this or a sibling repo for the new direction
- WibWobDOS remains runnable; computer lives alongside it
- **Pro:** Nothing is lost; both exist; WibWobDOS could later render the computer's state
- **Con:** Repo scope creep; two very different concerns in one place

### Option D — Rollback new branch to a clean pre-WibWobDOS state
- Find the last commit on `main` before the WibWobCity MVP diverged
- Cut a new branch from that point, implement symbient computer there
- **Pro:** Cleanest slate
- **Con:** Discards all Micropolis work; may be premature

### Option E — Hybrid: WibWobDOS as optional visualiser, shared computer as core
- Symbient computer (unix shell substrate) is the primary artefact
- WibWobDOS becomes an optional TUI that can *observe* the shared computer's state (read-only or via controlled writes)
- **Pro:** Both visions are honoured; WibWobDOS has a real role
- **Con:** Requires defining the interface between the two

---

## 5. Open Questions for Codex Analysis Pass

> **Prompt for Codex:** Read this file and the following context, then answer the questions below without implementing anything. Output a structured analysis as a markdown document.

**Context to load:**
- `.planning/spikes/spk-direction-reset/spk01-direction-reset-brief.md` (this file)
- `.planning/README.md`
- `README.md`
- `docs/master-philosophy.md` (if present)
- `git log --oneline main..mvp/mvp001-wibwobcity` (branch delta)

**Questions:**

1. **Blast radius** — if we want to strip or comment-gate the tvision TUI and FastAPI sidecar from the current codebase, what are the minimal touch points? Is the C++/Python split clean enough that the Python side could become a standalone daemon without the tvision binary?

2. **Symbient computer MVP** — given the original spec (multiple LLMs, shared unix filesystem, shell-native interaction), what is the smallest possible MVP that proves the concept? What does a single LLM "living" on this computer look like concretely (home dir structure, how it reads/writes, how it signals activity)?

3. **Option ranking** — evaluate Options A–E from the brief against: (a) research value, (b) implementation cost, (c) reversibility, (d) git hygiene. Which option or hybrid do you recommend and why?

4. **WibWobDOS role** — is there a natural future role for the tvision TUI as a *viewer* of the shared computer's state (e.g. rendering agent activity logs, world state, inter-agent messages)? If so, what would the clean interface be?

5. **Merge safety** — what would a clean merge of `mvp/mvp001-wibwobcity` to `main` require? Are there any conflicts, incomplete arcs, or un-closed planning briefs that should be resolved first?

6. **Commit hash note** — the original symbient computer spec was referenced as commit `76785b0dc66ba4d9ca374cc6fe07117c18637ffb`. This SHA does not exist locally or on GitHub remote (confirmed). Note this in your analysis and treat the reconstructed spec in §1 of this document as canonical for this spike.

---

## 6. Next Steps (blocked on Codex analysis)

- [ ] Offload §5 questions to Codex (use `codex-runner` skill)
- [ ] Review Codex output with James + 0xG
- [ ] Decide on option (A/B/C/D/E or hybrid)
- [ ] If merge-to-main chosen: open PR, follow standard merge checklist
- [ ] If new branch/repo chosen: create it, add skeleton, link from this spike
- [ ] Update this file with `status: done` once direction is locked

---

## 7. What We Are NOT Deciding Here

- The full architecture of the symbient computer (that's a separate spike/epic)
- Whether WibWobDOS development continues long-term
- The exact format of agent home dirs / memory files (that's `wibandwob-brain` scope)
- Whether this repo gets renamed
