# WibWob-DOS Prompt Library

Prompts for working effectively with this codebase. Each is a precision tool, not a checklist — use the right one at the right moment.

---

## Prompt index

| File | Type | When |
|------|------|------|
| `post-session-review.md` | Reflective / Quality Gate | End of session, before closing branch |
| `simplicity-review.md` | Verbosity Reduction | After implementation, before post-session review |

---

## How to use these prompts

### Sequencing

```
implement a slice
  → simplicity-review    (cut everything safe to cut)
  → post-session-review  (verify invariants and evidence)
  → commit + push
```

Never run post-session-review before simplicity-review. The former checks correctness; the latter changes the code. Doing them in the wrong order means reviewing code you're about to change.

### Adapting prompts to the task

Each prompt has fixed passes (always run) and adaptive heuristics (fire on trigger). Read the trigger conditions before skipping anything — a heuristic that looks irrelevant sometimes catches the highest-leverage problem.

Replace `<N>` in `git diff HEAD~<N>..HEAD` with the number of commits in your session. If unsure: `git log --oneline origin/main..HEAD | wc -l`.

---

## Why these prompts are built the way they are

### 5-Whys: why does the post-session-review exist as a structured prompt rather than a mental checklist?

**Why 1: agents and humans forget different things.**
A mental checklist assumes the reviewer knows what to look for. In this codebase, the COAT invariants (auto-generated API surface), describeState() contracts, and doc-sync requirements are non-obvious. They get skipped under time pressure.

**Why 2: the cost of skipping them is invisible until it isn't.**
A stale COAT.md causes no immediate error. It causes an agent three sessions later to call an endpoint that no longer exists. The failure is temporally distant from the cause — a structured prompt closes that gap.

**Why 3: the review must be machine-runnable, not just human-readable.**
WibWob-DOS is an equal human/agent control system. Any process that only works when a human is paying attention is a liability. A prompt with a defined output format (PASS/FAIL/SKIP + artefact path) can be run by an agent and its output parsed.

**Why 4: the output format enforces a decision, not a description.**
"I reviewed the COAT" is not useful. "COAT: PASS — no new endpoints" is. Forcing PASS/FAIL/SKIP means the reviewer must actually form a judgment, not just acknowledge they looked.

**Why 5: the parking lot instruction exists because discovered-but-unacted-on work disappears.**
Every session produces observations that don't fit the current slice. Without a structural place to put them (parking lot entry or GitHub issue), they vanish. The review prompt makes this the last mandatory step, not an afterthought.

---

### 5-Whys: why does the simplicity-review use lenses + adaptive heuristics rather than a flat checklist?

**Why 1: verbosity has different root causes in different code.**
A flat checklist treats all verbosity the same. A 60-line function is verbose for a different reason than a type with 12 fields. Lenses let the reviewer apply the right frame — structural, semantic, topological — rather than running every question on every file.

**Why 2: heuristics need triggers because unconditional rules produce false positives.**
"Every function over 40 lines should be split" is wrong — some 40-line functions are exactly right. The trigger condition (`IF any function exceeds 40 lines`) gates the heuristic on the case where it's worth asking the question, not asserting an answer.

**Why 3: Chesterton's Fence prevents destructive simplification.**
This codebase has patterns that look redundant but exist for reasons not visible at the call site (e.g. the agent-sufficiency requirement on describeState(), the COAT surface constraints). The Fence heuristic requires the reviewer to articulate why an abstraction exists before removing it — if they can't, removal is safe; if they can, they've confirmed it should stay.

**Why 4: the compression test has a failure condition.**
Most simplicity guides say "if you see duplication, extract it." This prompt adds: "if the parameterisation is more complex than the duplication, leave it." Three similar lines of code are readable. A two-parameter higher-order function to eliminate those three lines is a net complexity increase. The failure condition prevents over-abstraction.

**Why 5: the DISCOVERY field exists because prompts have blind spots.**
Every structured prompt encodes the reviewer's prior beliefs about where complexity hides. The DISCOVERY field is a forcing function to look for what the prompt didn't ask about — the highest-leverage simplification that no lens covers. Over time, recurring DISCOVERYs become new lenses.

---

### 5-Whys: why does the simplicity-review include semantic and gravitational lenses, which are not standard code review categories?

**Why 1: names are the most-read code in any codebase.**
A developer reads a function name dozens of times for every one time they read its body. A name that encodes redundant information (e.g. `userIdString` when the type is `string` and the scope is a user handler) imposes a reading tax on every future reader. The semantic lens targets this specifically.

**Why 2: gravitational attractors are the primary cause of scope creep.**
An abstraction that is "almost right" for multiple purposes attracts additions. Each addition makes it more general and harder to reason about. The gravitational lens asks not "is this correct?" but "will this stay small?" — a different and equally important question.

**Why 3: standard code review focuses on correctness, not on trajectory.**
A correct abstraction can still be heading toward unmaintainability. Gravitational analysis catches this before it manifests as a bug. It's a prospective lens, not a retrospective one — which is why it doesn't appear in standard review guides.

**Why 4: this codebase has explicit non-standard requirements (agent-readability).**
Semantic clarity matters more here than in a purely human-operated codebase because agents parse code and state outputs, not just humans. A name that's ambiguous to a human is often invisible to an agent. The semantic lens enforces clarity at the level that agent tooling actually consumes.

**Why 5: the lenses are skippable — "no purchase" is a valid result.**
A lens that fires on every file becomes background noise. Making each lens explicitly skippable (with "skip lenses with no purchase") preserves the signal. A reviewer who marks 4 lenses as SKIP and 2 as active has done something useful; a reviewer who runs all 7 uniformly on every file has generated a report, not a judgment.

---

## Adding a new prompt

1. Name it `<concern>-<type>.md` in kebab-case (e.g. `api-surface-audit.md`).
2. Add it to the index table above.
3. If it replaces part of an existing prompt, edit that prompt to remove the overlap.
4. Run the 5-Whys for at least one structural decision in the new prompt. If you can't answer Why 3, the prompt is probably not necessary yet.
