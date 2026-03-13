# Unix Control Brief Enhancement — Kickoff Prompt

Copy everything below the line into a fresh pi session.

---

Read `autoresearch/unix-control/autoresearch-brief-enhancement.md` first. That is your mission brief.

You are running an autoresearch loop to improve a suite of 5 research documents about Unix philosophy for AI agent control interfaces. The documents live in `autoresearch/unix-control/`. The meta-doc you just read defines 5 scoring axes (EVIDENCE, ACTIONABILITY, COHERENCE, RIGOUR, DENSITY), each with a 10-item checklist, plus a first-pass estimate of where the docs currently stand (~6.0 average).

Your job:

1. Read all 6 source documents in `autoresearch/unix-control/` (skip this file and the meta-doc)
2. Set up autoresearch for this task:
   - Create `autoresearch/unix-control/autoresearch.sh` that concatenates the 5 docs, sends them to the LLM scorer with the axis checklists from the meta-doc, and parses EVIDENCE/ACTIONABILITY/COHERENCE/RIGOUR/DENSITY scores plus FINAL_SCORE average
   - Create `autoresearch/unix-control/autoresearch.checks.sh` that validates the docs (no broken internal cross-references, no duplicate sections across files, word counts reasonable)
   - Symlink the root `autoresearch.*` files to point at `autoresearch/unix-control/` (replacing any existing symlinks)
   - Call `init_experiment` with name "Unix Control Brief Enhancement", metric "quality_score", direction "higher"
3. Run the first baseline score without making any edits — just score the docs as they are
4. Log it as your baseline with `log_experiment`
5. Start iterating: identify weakest axis, find the specific section dragging it down, make ONE surgical edit, re-score, keep or discard

Rules:
- Edit only the 5 source docs, never the meta-doc or this file
- One section edit per iteration (not wholesale rewrites)
- NEVER invent evidence. If a claim is unverified, add a caveat or remove it. Do not fabricate citations.
- Cross-file moves are fine (e.g. dedup by moving content from SUMMARY into RESEARCH and replacing with a cross-ref)
- Stop when all axes >= 8.5, or after 3 consecutive discards, or 30 iterations
- The root-level copies of these docs are being edited by another agent — do NOT touch files outside `autoresearch/unix-control/`

Context you need:
- Repo: `/Users/james/Repos/wibandwob-dos`
- The docs are about designing CLI-first control interfaces for LLM agents (vs REST APIs)
- They reference real projects (llm, MCP, yabai, i3) and make performance claims
- Some of those claims may be LLM confabulations from a previous generation session — treat with suspicion
- The RIGOUR axis (~5.0) and COHERENCE axis (~5.5) are likely your biggest wins early on
