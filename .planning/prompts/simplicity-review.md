# Simplicity Review Prompt

**Type:** Verbosity Reduction / Code Clarity
**When to use:** After any implementation slice, before the post-session review.
**Goal:** Remove everything that does not contribute to what the system can do or what agents can observe.

---

Read before anything else:
  PHILOSOPHY.md (five filters) · ARCHITECTURE.md (fourteen invariants) · GOTCHAS.md
  git diff HEAD~<N>..HEAD

Single goal: find every place in this session's work where something can be
removed, merged, or replaced with a simpler composition — without reducing what
the system can do or what agents can observe.

---

## Simplicity lenses

Run each applicable lens against changed files. Skip lenses with no purchase.

### STRUCTURAL
- Is there an abstraction with only one caller? Inline it.
- Is there a class where a function would do?
- Is there a function where an expression would do?
- Are there two abstractions expressing the same concept at different levels?
  Collapse to the lower one.

### SEMANTIC
- Does a name encode information already present in its type or scope? Strip it.
- Does a comment restate what the code says? Delete it.
- Does a type carry fields no current caller reads? Remove them.
- Can a boolean flag be replaced by two named functions?

### TOPOLOGICAL
- How many files does this unit import from? More than 3 is a smell for a
  microapp; more than 6 for a service. Flag without mandating a fix.
- Does this change increase the number of things that must change together?
  That's hidden coupling — name it.

### INFORMATIONAL
- Is the same fact stated in: types AND comments AND variable names AND docs?
  Pick one. Delete the others.
- Does describeState() repeat information available from the command catalog?
  The host can derive it; the microapp shouldn't restate it.

### CONTRACTUAL
- Does the public interface expose more than its current callers use?
  Cut the unused surface. YAGNI is not a tradeoff here — it's a COAT invariant.
- Does a parameter exist to handle a case that never occurs in this codebase?
  Remove it.

### TEMPORAL
- Is there state that could be derived on read rather than maintained on write?
  Derived state has no sync bugs.
- Is there a flag that only exists to sequence two things that could be reordered?
  Reorder them; delete the flag.

### GRAVITATIONAL
- If another developer reads this abstraction, will they want to add to it?
  Attractors grow. A function that does one thing stays small. Flag attractors.

---

## Adaptive heuristics

These fire only when triggered. Check each trigger; apply the heuristic if it fires.

**IF any function exceeds 40 lines:**
  → Apply deletion test line by line: what breaks if this line is removed?
    Lines that break nothing are candidates for deletion.
    Lines that break something reveal the function's true contract.
    The true contract is probably 5–10 lines. Find it.

**IF a new type or interface was added:**
  → Apply the interface budget: can a caller understand it in under 30 seconds
    without reading the implementation? If not, split or rename until yes.

**IF a new abstraction was added that has a single implementation:**
  → Apply Chesterton's Fence: state in one sentence why the abstraction exists
    rather than inlining the implementation. If you cannot, the abstraction
    should not exist yet.

**IF the same pattern appears in 2+ places:**
  → Apply the compression test: can both instances be expressed as one
    parameterised call? If yes, extract. If the parameterisation is more complex
    than the duplication, leave it duplicated — three similar lines beat a
    premature abstraction.

**IF a comment explains what the code does:**
  → Apply the inversion test: can the code be rewritten so the comment is
    unnecessary? Rename the function or variable until the comment disappears.
    If the comment explains *why*, keep it. If it explains *what*, delete it.

**IF a new describeState() was added:**
  → Apply the agent-sufficiency test: give only the describeState() output to a
    hypothetical agent. Can it answer:
    - what is this window doing right now?
    - what operations are available?
    - is it in an error state?
    If no: add the missing fields. If yes and output is >200 bytes of JSON,
    look for redundancy.

**IF a CAPS doc was updated:**
  → Apply the delta principle: does every sentence state something that diverges
    from a standard pattern? Delete any sentence that restates what any competent
    Bun/TypeScript developer would assume.

---

## Output format

For each lens or heuristic that fired, one entry:
  `FILE:LINE — what to cut/merge/rename — why it's safe`

Group by:
- **CUT** — remove entirely
- **MERGE** — fold into something existing
- **RENAME** — semantic only, no behaviour change

Then: total estimated line reduction if all cuts are made.

Then, only if you found it:
  **DISCOVERY:** one pattern this prompt didn't ask about but which is the
  highest-leverage simplification available.

Nothing else.
