# Autoresearch for Brief Enhancement: Design Notes

## The Idea
Use the autoresearch loop — LLM scorer + iterative edit + keep/discard —
to improve documentation briefs themselves. The unix-control document suite
(5 files, ~2200 lines, ~75KB) is the test case.

## Why This Works
Autoresearch needs three things:
1. A measurable output (the brief text)
2. A scorer that can evaluate quality on defined axes
3. An editor that can make targeted improvements per iteration

Documentation has all three. An LLM can score a brief on well-defined axes,
identify the weakest section, rewrite it, re-score, and keep or discard.
The loop converges on briefs that are maximally useful to their audience.

## Proposed Quality Axes (5 axes, 1-10 each)

### EVIDENCE (weight: high)
Are claims backed by specific, verifiable references?
- 1-3: Vague assertions, no URLs, "studies show" without citation
- 4-6: Some references but mixed quality, broken links, unchecked quotes
- 7-8: Most claims cite specific projects/papers with URLs and dates
- 9-10: Every claim has a primary source, quotes are verified, dates checked

Checklist (score 1 point per item present, scale to 10):
- [ ] Every performance claim cites a specific benchmark or paper
- [ ] URLs resolve to real pages (not hallucinated)
- [ ] Quoted passages match their source
- [ ] Academic citations include author, year, venue
- [ ] Production project claims cite specific repos with commit evidence
- [ ] Statistics include sample sizes or confidence indicators
- [ ] Counter-evidence is acknowledged, not hidden
- [ ] Date of last verification noted per reference
- [ ] Primary vs secondary sources distinguished
- [ ] No "weasel phrases" (some studies, it is known, experts agree)

### ACTIONABILITY (weight: high)
Can a reader take concrete action from this document?
- 1-3: Pure theory, no implementation guidance
- 4-6: General recommendations without specifics
- 7-8: Clear steps with code examples and cost estimates
- 9-10: Copy-paste-ready implementation plan with success metrics

Checklist:
- [ ] Each recommendation has a concrete first step
- [ ] Code examples are runnable, not pseudocode
- [ ] Time/effort estimates included per recommendation
- [ ] Success metrics defined (how do you know it worked?)
- [ ] Dependencies between steps are explicit
- [ ] Risk/rollback plan for each change
- [ ] Priority ordering is justified, not arbitrary
- [ ] Target audience stated per section
- [ ] "Do this Monday" clarity — no ambiguity about what to do first
- [ ] Anti-patterns shown alongside patterns (what NOT to do)

### COHERENCE (weight: medium)
Does the document suite work as a unified whole?
- 1-3: Files contradict each other, redundant sections, no navigation
- 4-6: Mostly consistent but some drift between files
- 7-8: Clear document roles, cross-references work, no contradictions
- 9-10: Each file has a distinct purpose, zero redundancy, perfect nav

Checklist:
- [ ] No claim appears in more than one file (DRY)
- [ ] Cross-references use correct filenames and section headers
- [ ] Index accurately describes what each file contains
- [ ] Reading order is clear for each audience type
- [ ] Terminology is consistent across all files
- [ ] If a fact changes, it only needs updating in one place
- [ ] Summary file is a true subset of the research file (no unique claims)
- [ ] Recommendations trace back to specific evidence entries
- [ ] No orphan sections (content that belongs in a different file)
- [ ] File lengths match their stated purpose (summary is short, research is long)

### RIGOUR (weight: medium)
How honest is the document about what it knows and doesn't know?
- 1-3: Overclaims, presents anecdotal data as proof, no caveats
- 4-6: Some caveats but buried, confidence levels unclear
- 7-8: Clear separation of proven vs hypothesised, open questions listed
- 9-10: Bayesian honesty — every claim has explicit confidence level

Checklist:
- [ ] Proven claims separated from hypotheses
- [ ] "We don't know" stated explicitly where appropriate
- [ ] Anecdotal evidence labelled as such
- [ ] Benchmark methodology described (not just results)
- [ ] Selection bias acknowledged (are we only citing favourable evidence?)
- [ ] Alternative explanations considered for key findings
- [ ] Limitations of the Unix approach honestly discussed
- [ ] Confidence levels (high/medium/low) on performance claims
- [ ] Distinction between "this worked for us" vs "this generalises"
- [ ] Date-sensitivity noted (will this evidence age?)

### DENSITY (weight: low)
Information per byte — is there filler?
- 1-3: Walls of boilerplate, repetitive framing, verbose examples
- 4-6: Some fluff but core content is solid
- 7-8: Tight writing, every paragraph earns its space
- 9-10: Could not remove a sentence without losing information

Checklist:
- [ ] No throat-clearing paragraphs (remove "In this section we will...")
- [ ] No repeated introductions across files
- [ ] Tables used instead of prose for structured data
- [ ] Code examples are minimal (show the point, nothing extra)
- [ ] No emoji-heavy formatting that adds visual noise without meaning
- [ ] Section headers are descriptive (not generic "Overview", "Details")
- [ ] Footnotes or appendices for tangential detail
- [ ] Word count proportional to importance (key findings get most space)
- [ ] No restating the question before answering it
- [ ] Could pass a "so what?" test on every paragraph

## How the Loop Would Work

### Input
The 5 markdown files in `autoresearch/unix-control/`.

### Per Iteration
1. Scorer reads all 5 files
2. Scores each axis (EVIDENCE, ACTIONABILITY, COHERENCE, RIGOUR, DENSITY)
3. Identifies the SINGLE weakest axis
4. Identifies the specific section dragging that axis down
5. Editor rewrites ONLY that section
6. Re-score
7. Keep if average improved, discard if not

### Constraints
- Edit only ONE section per iteration (surgical, not wholesale rewrite)
- Never invent evidence — can only restructure, clarify, or flag gaps
- If EVIDENCE score is low because claims are unverified, the fix is to
  ADD a caveat or REMOVE the claim, not to fabricate a citation
- Cross-file edits allowed (e.g. move a section from SUMMARY to RESEARCH)
- Maximum 30 iterations before human review

### Stop Conditions
- All axes >= 8.5
- Three consecutive discards (local maximum reached)
- Human interrupt

### autoresearch.sh Shape
```bash
#!/usr/bin/env bash
# Concatenate all docs, send to scorer with the axis checklists above,
# parse per-axis scores, compute average.
DOCS=$(cat autoresearch/unix-control/*.md)
SCORE_PROMPT="Score this document suite on 5 axes..."
# ... LLM call, parse EVIDENCE: N.N, ACTIONABILITY: N.N, etc ...
echo "FINAL_SCORE: $AVERAGE"
```

### What the Scorer Prompt Looks Like
```
You are scoring a research document suite on Unix philosophy for AI agent
control. The suite has 5 files totalling ~2200 lines.

Score each axis 1-10 using the checklist. For each axis, state which
checklist items are met and which are not. Then give the score.

EVIDENCE: [checklist evaluation] → N.N
ACTIONABILITY: [checklist evaluation] → N.N
COHERENCE: [checklist evaluation] → N.N
RIGOUR: [checklist evaluation] → N.N
DENSITY: [checklist evaluation] → N.N

AVERAGE: N.N
WEAKEST_AXIS: [name]
WEAKEST_SECTION: [file:section that most drags down the weakest axis]
```

## First-Pass Observations on the Current Docs

Having read the suite, here's my unscored intuition on where things stand:

**EVIDENCE: ~6.5.** Good project references (llm, MCP, yabai, i3) but
some claims feel unverified. The +23.6% success rate stat is attributed
to "Anthropic's o1/o3 evals + internal testing" — is that a real citation
or an LLM confabulation? The Zellweger & Gigerenzer 2020 CHI paper needs
verification. Some URLs may be hallucinated (the MCP SDK GitHub path
looks wrong). Strong on breadth, weak on verification.

**ACTIONABILITY: ~7.0.** The RECOMMENDATIONS file has a phased plan with
code examples. Good. But time estimates and success metrics are vague.
"Run benchmark suite" — what suite? How long? What's the pass threshold?

**COHERENCE: ~5.5.** Significant redundancy across files. The performance
delta table appears in SUMMARY, EVIDENCE, and RESEARCH. The project list
is repeated in multiple places. INDEX helps but the files themselves have
fuzzy boundaries. SUMMARY contains unique claims not in RESEARCH (bad —
summary should be strict subset).

**RIGOUR: ~5.0.** This is the weakest axis. Performance claims are stated
with false precision (+23.6%, -26%, -31%) but the methodology is murky.
"From Anthropic's o1/o3 evals + internal testing" — is this published
data? Anecdotal? Hypothetical? The document doesn't distinguish. The
Expected Wins table gives "High confidence" without justification.

**DENSITY: ~6.0.** Heavy emoji use. Repeated introductions. The same
core argument (CLI > REST for agents) is restated many times with
slightly different framing. Could be 40% shorter without losing content.

**Estimated starting average: ~6.0**

## Meta-Note: The Recursion

Yes, this document is itself a brief about how to improve briefs. If you
pointed autoresearch at THIS file, it would try to improve the improvement
plan. At some point you'd need a human to say "good enough, go build."

The recursion bottoms out at: does the autoresearch loop actually produce
better documents? That's an empirical question. Run it, diff the before
and after, have a human judge. If the human says "yes, this is better,"
the loop works. If not, the axes are wrong.

## Files in This Directory

| File | Role | Source |
|------|------|--------|
| RESEARCH_UNIX_AGENT_CONTROL.md | Full research brief (720 lines) | Cloned from repo root |
| UNIX_AGENT_CONTROL_SUMMARY.md | Executive summary (190 lines) | Cloned from repo root |
| UNIX_AGENT_CONTROL_EVIDENCE.md | Citations and evidence (424 lines) | Cloned from repo root |
| UNIX_AGENT_CONTROL_INDEX.md | Navigation index (385 lines) | Cloned from repo root |
| UNIX_AGENT_CONTROL_RECOMMENDATIONS.md | Implementation plan (470 lines) | Cloned from repo root |
| REFERENCE_CLI_TOOLS_RANKED.md | 12 CLI tools ranked as design refs (130 lines) | Cloned from concurrent agent |
| autoresearch-brief-enhancement.md | This file — meta design notes | New |

Note: the root-level originals are being enhanced by another agent session
concurrently. These clones are a snapshot for autoresearch experimentation.
Sync back to root when the loop produces improvements worth keeping.
