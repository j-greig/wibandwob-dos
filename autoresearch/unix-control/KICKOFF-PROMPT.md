# Unix Control Brief Enhancement — Kickoff Prompt

Copy everything below the line into a fresh pi session.

---

Read `autoresearch/unix-control/autoresearch-brief-enhancement.md` first. That is your mission brief.

You are running an autoresearch loop to improve a suite of 5 research documents about Unix philosophy for AI agent control interfaces. The documents live in `autoresearch/unix-control/`. The meta-doc you just read defines 5 scoring axes (EVIDENCE, ACTIONABILITY, COHERENCE, RIGOUR, DENSITY), each with a 10-item checklist, plus a first-pass estimate of where the docs currently stand (~6.0 average). Rough endgoal: "make the CommandRegistry the single source of truth with typed arg schemas, then project to both HTTP and CLI mechanically" brief, but with an optimal token count vs semantic-crispyness to the briefing and research docs.

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

Key packages to know about (for ACTIONABILITY scoring — recommendations should reference these):
- `@hono/zod-openapi` — Zod schemas define routes, OpenAPI spec auto-generated. Hono is already the HTTP framework in the app.
- `citty` (UnJS) — lightweight CLI framework with typed args, used by Nuxt
- `tRPC` — typed procedures but HTTP-only
- `@sinclair/typebox` — JSON schema builder, fast validation (already in repo)
- `commander.js` / `yargs` — CLI frameworks that could consume Zod schemas
- `zod` + `zod-to-json-schema` — already transitive deps via MCP SDK, Anthropic, OpenAI

There are currently too many docs saying similar things from different angles.
COHERENCE and DENSITY improvements should aggressively consolidate — merge
redundant files, kill duplicated sections, reduce the total file count.
The goal is fewer, sharper documents, not more.

## Phase Graduation

This autoresearch has TWO phases with an automatic transition:

**Phase 1: Brief Enhancement** (start here)
- Score and improve the doc suite on 5 axes
- Aggressively consolidate — fewer files, kill duplication
- Graduate to Phase 2 when: ALL axes >= 7.5 AND ACTIONABILITY >= 8.0

**Phase 2: Build the CLI** (auto-transition)
When the brief is sharp enough to build from, switch modes:
- Create `src/cli/ww.ts` and supporting files per the SURFACE_PARITY_ARCHITECTURE.md
- Add Zod params schemas to commands in `src/core/command-catalog.ts`
- The autoresearch scorer switches to testing the BUILT artefact, not the docs
- New axes: PARITY (do CLI commands match API?), COVERAGE (what % of catalog
  commands have CLI subcommands?), ERGONOMICS (can an agent pipe ww output
  through jq effectively?)

**How to test the CLI agentically (no TUI needed):**
- The WibWob app is running in tmux on port 8099. The CLI talks to it via HTTP.
- Test pattern: `ww windows list | jq '.[0].id'` — verify JSON output parses
- Test pattern: `ww window $(ww windows list | jq -r '.[0].id') move --x 10 --y 5`
  then `curl http://127.0.0.1:8099/state` to verify position changed
- Test pattern: `ww commands list | wc -l` vs `curl http://127.0.0.1:8099/commands/list | jq '.commands | length'`
  — counts must match (parity check)
- All testable via bash — no visual inspection needed for functional parity
- Visual verification (does the window ACTUALLY move on screen?) is a human
  step — flag it with "NEEDS VISUAL CHECK" in the experiment log

**Phase 2 scoring script shape:**
```bash
# Functional tests — automated
ww windows list | jq . > /dev/null        # parses as JSON?
MATCH=$(diff <(ww commands list | jq -r '.[].id' | sort) \
             <(curl -s .../commands/list | jq -r '.commands[].id' | sort))
# Coverage — what % of api:true commands work via CLI?
# Ergonomics — can common agent workflows pipe cleanly?
```

Context you need:
- Repo: `/Users/james/Repos/wibandwob-dos`
- The docs are about designing CLI-first control interfaces for LLM agents (vs REST APIs)
- They reference real projects (llm, MCP, yabai, i3) and make performance claims
- Some of those claims may be LLM confabulations from a previous generation session — treat with suspicion
- The RIGOUR axis (~5.0) and COHERENCE axis (~5.5) are likely your biggest wins early on
