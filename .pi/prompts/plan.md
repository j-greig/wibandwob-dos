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

---

## Phase 2 · Draft

For each file you'd touch, state:
- **File** — path
- **Change** — what, concretely
- **Why** — one line

Then: **Blast radius** — number of files, new vs modified, estimated lines changed.
Flag any pre-existing bugs found along the way.

---

## Phase 3 · Review

Pretend you're encountering this plan cold. Read it again with fresh eyes.

Apply each lens. Skip any with no purchase — but name it so the skip is visible.

| Lens | Question |
|------|----------|
| **SCOPE** | What's in here that isn't strictly needed? Cut it. |
| **REUSE** | Does something like this already exist in the codebase? |
| **DELTA** | Can the blast radius shrink? Fewer files, fewer new abstractions? |
| **NAMES** | Could another developer understand every new name in under 30 seconds? |
| **GRAVITY** | Will any of these additions attract future growth? Flag attractors. |
| **SEQUENCE** | Is there a safe order of changes? Any circular dependency risk? |

Adaptive — fire only when triggered:

- **New UI** → How does the user discover this? Is it findable without docs?
- **New abstraction** → Justify in one sentence or inline it.
- **3+ files touched** → Name the coupling. Is it essential or accidental?
- **Refactor** → How do you prove old and new behave identically?

Then ask yourself:
- *What assumption is this plan making that might be wrong?*
- *What does this plan not say?*
- *What's the hidden cost?*

If blast radius exceeds 3 files or the plan introduces new abstractions, read `/simplicity-review` and apply its lenses to the plan before finalizing.

---

## Phase 4 · One level up

Set aside the plan. What's the single addition — not asked for, maybe not obvious — that would genuinely elevate this? Draw on your feel for the codebase, the user's momentum, the patterns you've seen, where things tend to break or shine.

One thing only. If nothing comes, say so — that's fine.

---

## Output

Adjusted plan incorporating review findings. Same format as Phase 2 — files, changes, why — but now final. If nothing changed, say "Plan unchanged" and move on.

Then: **Evidence** — how do you prove it works? Name the specific command, test, or observation that confirms the change landed correctly.

Write the final plan (Phase 2 output through Evidence) to `scratch/plans/<YYYY-MM-DD>-<slug>.md` where `<slug>` is a short kebab-case summary of the task. Create the directory if needed.
