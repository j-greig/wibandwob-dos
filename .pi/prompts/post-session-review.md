# Post-Session Review Prompt

**Type:** Reflective / Quality Gate
**When to use:** At the end of any dev session before closing a branch or marking a slice done.

---

Read before anything else:
  PHILOSOPHY.md · ARCHITECTURE.md · GOTCHAS.md
  git diff HEAD~<N>..HEAD   (replace N with commit count for this session)

---

## Review passes

### 1. Invariant compliance
Check each ARCHITECTURE.md invariant against changed files.
Flag any violation. Do not fix yet — list first.

### 2. COAT surface
Did any public API endpoint, command, or skill change?
If yes: run `bun scripts/gen-integration-surface.ts` and commit the updated COAT.md.
If no: confirm by grepping for new `router.` or `registerCommand` calls.

### 3. describeState() contract
Every microapp must return:
  - what it is doing right now
  - what operations are available
  - whether it is in an error state

For each microapp touched: does its describeState() satisfy all three? If not, list the gap.

### 4. Agent-sufficiency test
Give only the describeState() output to a hypothetical agent.
Can it operate the window without reading source? Yes/No.
If no: state exactly what is missing.

### 5. Evidence gate
Every slice must have binary evidence (pass/fail + artefact path).
Did this session produce it? List the artefact path or flag missing.

### 6. Doc honesty
Did any CAPS doc become stale as a result of this session?
Run `bash scripts/doc-sync.sh` to check. If stale: fix in this commit.

### 7. Parking lot
Anything discovered but not acted on → one line in AGENTS.md parking lot or a GitHub issue. Never leave it in your head.

---

## Output format

For each pass: PASS / FAIL / SKIP (with reason for skip)
For each FAIL: one-line description + file:line reference
At the end: DONE or BLOCKED (with blocker stated plainly)

Nothing else.
