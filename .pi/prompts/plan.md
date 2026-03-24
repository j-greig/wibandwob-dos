---
description: Plan before you code — phased thinking with fresh-eyes review
---

Plan this before writing any code:

**$@**

---

Ensure you've read **PHILOSOPHY.md** and **ARCHITECTURE.md** this session. If not, read them now before proceeding — they ground every decision below.

Each phase gates the next. Skip a phase only if you can state in one sentence why it adds no value here — write that sentence before moving on.

---

## Phase 1 · Orient

Read the files, patterns, and constraints relevant to the task.
Then state the simplest version of this change in one sentence.

**Micro-diagram heuristic** *(use when it helps — skip when it doesn't)*: if a bug, dependency, or state change would take a human 3+ sentences to follow in prose, compress it into a small ASCII diagram instead. The format doesn't matter — pick whatever makes the structure visible. Trigger: you catch yourself wanting to write "which then causes… which means that… so when…"

A few shapes to draw from — mix freely, invent others:

```
# causal chain (who breaks whom)
onRestyle fires
  └─ el.style = newStyle          ← wipes style.track
     └─ this.track widget persists (set at construction, not in style)
        └─ render: if (this.track) → this.style.track.fg → CRASH

# state mutation (what a value looks like before vs after)
BEFORE restyle:  el.style = { fg, bg, track: { fg, bg } }   ok
AFTER  restyle:  el.style = { fg, bg }                       MISSING
                                          ^ this.track still set → crash

# flow with a break point
createScrollbar() → scrollbar.track unset → this.track never set → safe
scrollbar:{track:{}} → this.track set at init ─────────────────────┐
                                                                    ↓
                                               el.style = newStyle (no track)
                                                                    ↓
                                                          render → CRASH

# two-path divergence (why one case works and the other doesn't)
safeSetStyle(el, s)   →  injects style.track if el.scrollable  →  ok
el.style = s directly →  no injection                           →  CRASH on next render
```

One diagram per distinct structure. Don't force it onto simple one-step changes.

> ⚑ Write the closing tag before continuing to Phase 2.

Wrap this phase's output in `<phase-1-orient>` tags.

---

## Phase 2 · Draft

For each file you'd touch, state:
- **File** — path
- **Change** — what, concretely (bullets only, max 2 sentences)
- **Why** — one line

Then: **Blast radius** — number of files, new vs modified, estimated lines changed.
Flag any pre-existing bugs found along the way.

If no source files are touched (conceptual task), describe instead: the artifact produced, its format, and who consumes it.

> ⚑ Write the closing tag before continuing to Phase 3.

Wrap this phase's output in `<plan-draft>` tags.

---

## Phase 3 · Review

You are a skeptical senior engineer who has seen over-engineered plans fail in production. Your instinct is to cut, not add. Apply each lens looking for reasons to simplify.

Apply each lens. One sentence per lens. Skip any with no purchase — write "skip" so the skip is visible.

| Lens | Question |
|------|----------|
| **SCOPE** | What's in here that isn't strictly needed? Cut it. |
| **REUSE** | Does something like this already exist in the codebase? |
| **DELTA** | Can the blast radius shrink? Fewer files, fewer new abstractions? |
| **NAMES** | Could another developer understand every new name in under 30 seconds? |
| **GRAVITY** | Will any of these additions attract future growth? Flag attractors. |
| **SEQUENCE** | Is there a safe order of changes? Any circular dependency risk? |
| **COAT** | Would this work without the TUI, using only the API? If no — it isn't done. Every user-visible surface needs a typed representation in state and a path in control-api. |
| **COMPOSITION** | Does this add a new primitive, or compose from existing ones? Prefer composition. New SDK surface is a last resort. |

Adaptive — fire only when triggered:

- **New UI** → How does the user discover this? Is it findable without docs?
- **New abstraction** → Justify in one sentence or inline it.
- **3+ files touched** → Name the coupling. Is it essential or accidental?
- **Refactor** → How do you prove old and new behave identically?
- **Microapp changed** → Does `describeState()` still expose everything an agent needs?

### Adversarial self-review

Scale to the problem. Trivial changes (one-line fix, doc update) get a quick gut-check. Complex, uncertain, or multi-file changes get the full treatment — argue against your own plan as if reviewing someone else's PR.

- *What assumption is this plan making that might be wrong?*
- *What does this plan not say?*
- *What's the hidden cost?*
- *If this fails in production, what's the most likely cause?*
- *Am I solving the symptom or the root cause?* (If the same pain has appeared in multiple WXX reflections, you're probably looking at a symptom.)
- *What would a skeptic who knows this codebase say?*

End with a kill count: **Killed: N files · N abstractions · N LOC**
(If zero: say so explicitly — it means the review found nothing to cut.)

### Auto-checks — run these, don't just read them

| Trigger | Command |
|---------|---------|
| Any `.ts` file in scope | `bun run typecheck` |
| Any `src/` file in scope | `bun run check-coat` (COAT boundary violations) |
| Blast radius > 3 files | Read `/simplicity-review` and apply its lenses |
| Any CAPS doc (`AGENTS.md`, `ARCHITECTURE.md` etc.) in scope | `bash scripts/doc-review.sh` |

For adversarial self-questioning of the plan, load `/grill-me`.

> ⚑ Write the closing tag before continuing to Phase 4.

Wrap this phase's output in `<review>` tags.

---

## Phase 4 · One level up

Shift register: set aside the engineering mindset. Think as a product designer or end user encountering this for the first time.

What's the single addition — not asked for, maybe not obvious — that would genuinely elevate this? Draw on your feel for the codebase, the user's momentum, the patterns you've seen, where things tend to break or shine. If you are considering multiple options, rank them, including metrics or a table to aid your decision if it's hard to choose between them so the user can see your thinking.

One thing only. If nothing comes, say so — that's fine.

This phase is **advisory**. Do not include it in the final plan without explicitly marking it `[Phase 4 — optional]`.

---

## Output the final plan

First, output a `<review-delta>` block: bullet list of what Phase 3 cut, added, or renamed versus the `<plan-draft>`. If nothing changed, say "Plan unchanged."

Then output the adjusted final plan in `<plan-final>` tags. Same format as Phase 2 — files, changes, why — but now final.

Then: **Evidence** — how do you prove it works? Name the specific command, test, or observation that confirms the change landed correctly.

### Actionable steps *(optional — use judgment)*

If the plan has more than one concrete action, append a `## Steps` section inside `<plan-final>` with `[ ]` checkboxes for every action and every Evidence item. Pick the shape that fits:

| Shape | When to use |
|-------|-------------|
| **Flat list** — single ordered `[ ]` sequence | ≤ 3 files, obvious execution order, no blockers between steps |
| **Grouped** — `[ ]` items under per-file or per-domain headings | Multi-file change where steps cluster naturally by location |
| **Phased** — `[ ]` items under `### Phase 1 / Phase 2 …` headings | Complex change with hard sequencing dependencies or parallel tracks |

These are starting points. If none fits, invent a shape that does — the goal is a checklist someone can actually work through, not a format for its own sake. If the plan is trivial (single file, one obvious action), skip the section entirely and say so in one line.

---

Write the final plan (Phase 2 output through Steps) to `scratch/plans/<YYYY-MM-DD>-<slug>.md` where `<slug>` is a short kebab-case summary of the task. Create the directory if needed.

Begin your response with `<phase-1-orient>`.
