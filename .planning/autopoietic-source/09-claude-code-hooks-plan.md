# Claude Code Hooks — Enforcing the 30 Principles

> Planning document for hooks that keep the post-refactor codebase aligned with CODE-STYLE.md.

---

## The right question to ask first

The 30 principles describe how code SHOULD be written. But when does a principle get violated? There are exactly 3 moments:

1. **When code is being written** (the Edit/Write happens)
2. **When code is about to be committed** (the git commit happens)
3. **When a task is "done"** (Claude stops responding)

Each moment has a different hook event, different available information, and different ability to fix the problem. The hook that fires at moment 1 can prevent the violation. The hook at moment 2 can catch it. The hook at moment 3 can only report it.

**Prevention > Detection > Reporting.** So we want to invest most heavily at moment 1.

---

## Candidate approaches

### A. PostToolUse on Write|Edit — "Principle mirror"

**What:** After Claude writes or edits a `.ts` file, run a lightweight scan of the changed file. Report violations back to Claude as feedback so it can self-correct in the same turn.

**What it checks (fast, regex-based):**
- File over 400 LOC (P1, P5)
- Any function over 80 LOC (P1, P15)
- Nesting depth > 3 (P9 Guard Clauses)
- Magic numbers outside of obvious cases (P19)
- `as` type assertions (P29 — every `as` is where the compiler stopped helping)
- Duplicated patterns in the same file (P6 — crude but catches copy-paste)

**Mechanism:** `PostToolUse` with matcher `Write|Edit`. Script reads the file path from `tool_input`, runs quick regex checks, outputs feedback as a system message. Exit 0 with `systemMessage` — doesn't block, just informs Claude.

**Latency:** ~50-100ms (regex on a single file). Negligible.

**Adversarial critique:**
- (+) Fires at moment 1 — Claude can fix violations immediately
- (+) Zero friction for the user — silent unless there's a problem
- (+) Works for agents writing code unsupervised
- (-) Regex can't catch semantic violations (P10 Query/Command separation, P13 discriminated unions)
- (-) Magic number detection has high false positive rate (coordinates, array indices)
- (-) Doesn't know if the file was ALREADY over 400 LOC before Claude touched it
- **Mitigation:** Check delta, not absolute. Only flag if Claude's edit made it worse.

---

### B. PreToolUse on Bash (git commit) — "Pre-commit quality gate"

**What:** Before `git commit` executes, scan all staged `.ts` files for principle violations. Warn (not block) by injecting feedback.

**What it checks:**
- Same regex checks as A, but across all staged files
- Boundary violations against MODULE_MANIFEST (if it exists)
- File count — if committing >10 files, warn about blast radius

**Mechanism:** `PreToolUse` with matcher `Bash`. Script parses `tool_input.command` for `git commit`. Runs checks on `git diff --cached --name-only`. Exit 0 with warnings as `additionalContext`, or exit 2 to block egregious violations.

**Latency:** ~200-500ms (scan staged files). Acceptable for a commit.

**Adversarial critique:**
- (+) Last chance before code is permanent
- (+) Already a familiar pattern (commit-lint.sh exists)
- (+) Can check cross-file concerns (boundary violations, duplication across files)
- (-) Fires at moment 2 — the code is already written, Claude has to go back and fix
- (-) Warns but doesn't block = might be ignored
- (-) The existing `.githooks/pre-commit` already runs typecheck + eslint — overlap risk
- **Mitigation:** Make it complementary — git pre-commit checks compilation, Claude pre-commit checks principles.

---

### C. Stop hook — "Quality gate before done"

**What:** When Claude finishes a response, check if any `.ts` files were modified in this turn and whether they pass quality checks. If violations exist, block the stop and tell Claude to fix them.

**Mechanism:** `Stop` hook. Script reads the transcript or git diff to find modified files, scans them, exits 2 if violations found (blocking Claude from finishing).

**Adversarial critique:**
- (+) Ensures Claude never delivers code with obvious violations
- (+) The existing `stop-ac-check.sh` already does this pattern for acceptance criteria
- (-) Can't distinguish "Claude is done with the whole task" from "Claude is done with one message"
- (-) If Claude is in a conversation, blocking Stop is annoying — it fires every turn
- (-) High false positive risk = user frustration
- **Verdict:** Too aggressive. The Stop event fires too often. Better to catch at write-time (A) or commit-time (B).

---

### D. PostToolUse "prompt" type — "LLM-as-judge"

**What:** After Claude writes code, a lightweight single-turn LLM call evaluates whether the code follows the principles. The prompt includes the written code and the 30 principles. The LLM returns a structured verdict.

**Mechanism:** `PostToolUse` with matcher `Write|Edit`, hook type `"prompt"`. The prompt template includes the file content and asks: "Does this code follow these principles? List violations."

**Adversarial critique:**
- (+) Can catch semantic violations that regex can't (P10 Query/Command, P13 discriminated unions, P22 collaboration interfaces)
- (+) Claude Code supports `"type": "prompt"` natively — single-turn, fast
- (-) Latency: 2-5 seconds per file write. That's a lot of friction.
- (-) Cost: every file edit triggers an API call. Expensive over a session.
- (-) The judge LLM might disagree with the writing LLM — confusing feedback loops
- (-) 30 principles in the prompt = long context = expensive
- **Verdict:** Too slow and expensive for every edit. But could work as an optional "deep review" triggered manually.

---

### E. UserPromptSubmit — "Inject relevant principles"

**What:** When the user submits a prompt that mentions code changes, inject the 2-3 most relevant principles as context. Claude sees the principles before writing code.

**Mechanism:** `UserPromptSubmit` hook. Script reads the prompt, matches keywords to principles (e.g., "refactor" → P1, P5, P15; "type" → P27, P28, P29; "error handling" → P30). Outputs matched principles as `additionalContext`.

**Adversarial critique:**
- (+) Prevention, not detection — Claude sees the rules before writing
- (+) Lightweight — keyword matching is instant
- (+) Targeted — only injects relevant principles, not all 30
- (-) Keyword matching is crude — might inject wrong principles
- (-) Claude already has CLAUDE.md context — adding more context bloats the window
- (-) Doesn't help when agents write code without user prompts (subagents)
- **Verdict:** Nice-to-have but low impact. Claude can already read CODE-STYLE.md if needed.

---

### F. SessionStart — "Code health baseline"

**What:** At session start, inject a snapshot of current code health: largest files, most-violated principles, boundary status. Claude starts with awareness of the codebase's weak points.

**Mechanism:** `SessionStart` hook. Script runs the code-health snapshot (if it exists) or a lightweight scan, outputs a summary.

**Adversarial critique:**
- (+) Sets the tone for the session — Claude knows what to watch for
- (+) Only fires once — no ongoing friction
- (+) Already follows the pattern of `session-context.sh`
- (-) Static snapshot — doesn't reflect changes made during the session
- (-) Adds to context window consumption
- **Mitigation:** Keep it to 5-10 lines. Just the worst offenders, not a full report.

---

### G. PostToolUse "agent" type — "Deep review agent"

**What:** After significant code changes (>100 LOC written in a single edit), spawn a subagent that reads the changed file, reads CODE-STYLE.md, and produces a structured review.

**Mechanism:** `PostToolUse` with matcher `Write|Edit`, hook type `"agent"`. The agent has Read access to review the code against the principles.

**Adversarial critique:**
- (+) Most thorough — can reason about architecture, naming, composition
- (+) Catches things regex and single-turn prompts can't
- (-) Extremely slow (30-60 seconds per review)
- (-) Extremely expensive (full agent context)
- (-) Fires on EVERY edit — even 1-line changes
- (-) Agent feedback might conflict with the main Claude's intent
- **Verdict:** Way too heavy for a hook. This is what code review and `/simplify` are for.

---

## Adversarial ranking

| Rank | Approach | Prevention or Detection? | Latency | False Positives | Unsupervised Agent Safety | Friction |
|------|----------|--------------------------|---------|-----------------|---------------------------|----------|
| **1** | **A — PostToolUse principle mirror** | Detection → immediate fix | ~100ms | Medium | HIGH — catches violations as they happen | LOW |
| **2** | **B — Pre-commit quality gate** | Detection → requires go-back | ~300ms | Low | HIGH — last gate before permanence | LOW |
| **3** | **F — SessionStart baseline** | Prevention (awareness) | Once | None | MEDIUM — sets context | NONE |
| 4 | E — UserPromptSubmit principles | Prevention (context) | ~10ms | Medium | LOW — only on user prompts | LOW |
| 5 | C — Stop quality gate | Detection → blocks finish | ~200ms | HIGH | HIGH but annoying | HIGH |
| 6 | D — LLM-as-judge | Detection → semantic | ~3s | Low | HIGH | HIGH (cost+latency) |
| 7 | G — Deep review agent | Detection → thorough | ~30s | Very low | HIGH | VERY HIGH |

---

## The recommended stack

**Three hooks, layered:**

### Hook 1: PostToolUse "Principle mirror" (the workhorse)

Fires after every `.ts` Write/Edit. Regex-based, ~100ms. Reports violations as a system message so Claude self-corrects in the same turn. This is the highest-leverage hook because it catches violations at the moment of creation.

Checks:
- File LOC > 400 → warn
- Function LOC > 80 → warn (regex: count lines between `function`/`=>` and closing brace)
- Nesting depth > 3 → warn (count leading whitespace)
- `as` cast count > 3 in the edited region → warn (P29)
- Bare `any` type → warn (P29, strict mode)

Does NOT check: naming quality, architectural composition, query/command separation. Those are judgment calls, not regex targets.

### Hook 2: PreToolUse on `git commit` — "Commit health check"

Fires before commit. Scans staged `.ts` files. Warns about:
- New or worsened size violations across all staged files
- Boundary violations against MODULE_MANIFEST (if it exists)
- `as any` additions (zero tolerance — each one needs justification)

Blocks (exit 2) only for: MODULE_MANIFEST boundary violations. Everything else warns.

### Hook 3: SessionStart — "Health baseline"

Fires once at session start. Outputs the 3-5 worst code health issues. ~5 lines of context. Sets Claude's awareness without bloating the window.

```
Code health: app-controller.ts 2525 LOC (target: <400),
control-api.ts:handleRequest 680 LOC (target: <80),
file-manager-window.ts 1859 LOC (single function).
See CODE-STYLE.md for the 30 principles.
```

### What we DON'T build

- No LLM-as-judge hook (too slow, too expensive)
- No Stop hook (fires too often, too aggressive)
- No deep review agent (that's what code review and `/simplify` are for)
- No UserPromptSubmit principle injection (CLAUDE.md already handles this)

---

## Why this stack and not something else

The adversarial challenge to this stack:

**"Aren't you just building the thermometer again? Didn't the devil's advocate say monitoring is a confession?"**

Yes — but these hooks are different from the code-health infrastructure we debated. That infrastructure was about *reporting metrics to humans*. These hooks are about *giving Claude real-time feedback so it writes better code in the first place*. The distinction:

- code-health CLI: tells a human "this file is 2500 LOC" → human decides what to do
- PostToolUse hook: tells Claude "you just made this file 410 LOC" → Claude fixes it now

One is a dashboard. The other is a feedback loop that closes in the same turn. The hook makes the agent better at following the principles, which is the primary strategy.

**"What about the 14 principles the regex can't check?"**

True — P10 (Query/Command), P13 (Discriminated Unions), P14 (Compose Don't Inherit), P22 (Collaboration Interfaces), etc. are judgment calls. No hook can check them. But that's what CODE-STYLE.md is for — Claude reads it, internalizes it, applies it. The hook catches the *mechanical* violations (size, nesting, casts) so Claude can focus its judgment on the *semantic* ones.

**"Three hooks? The project already has 10. Isn't this bloat?"**

The existing 10 hooks cover planning, commit format, file naming, desktop state, context management. None of them check code quality. These 3 fill a real gap. And the total hook count (13) is reasonable for a project of this size.

---

## Prior art: pi-system-reminders

> Prompted by: https://github.com/Michaelliv/pi-system-reminders

This open-source repo provides 13 example reminders that monitor Claude Code agent behavior and inject steering guidance at critical moments. Here's how they map to our planned hooks:

| pi-system-reminder | Our planned hook | Match? |
|---|---|---|
| **file-churn** (same file edited 5+ times) | **Hook 1: PostToolUse principle mirror** | Directly relevant — file churn is a symptom of P1/P5 violations. If Claude keeps editing the same file, the file is probably too big or doing too much. |
| **bash-spiral** (3 consecutive bash failures) | — | Not code-quality related, but good general hygiene. Already useful as-is. |
| **prefer-edit** (3+ writes to same file → suggest Edit) | **Hook 1: PostToolUse principle mirror** | Adjacent — our hook catches the *quality* of what's written, prefer-edit catches the *method* of writing. Complementary. |
| **read-before-edit** (edit with stale content) | — | Not principle-related, but prevents bugs. Good general practice. |
| **context-large** / **token-usage** | — | Not principle-related, but the project already has a context window warning hook. |
| **post-compaction** (file contents lost after compaction) | — | Not principle-related but operationally important. |
| **task-tools-reminder** (20 tool calls without task update) | — | Not directly related, but interesting for discipline. |

### The strongest overlap is `file-churn`

It's a proxy for exactly what we care about — if Claude is churning on a file, that file likely violates P1 (Composed Method) or P5 (Single Responsibility). Our principle mirror hook would catch the *cause* (file too big, function too long), while file-churn catches the *symptom* (repeated edits).

### What we should steal

- **file-churn** — adopt it, and enhance the message to reference the specific principle being violated ("This file has been edited 5 times. Consider P1: Composed Method — is this file doing too much?")
- **prefer-edit** — adopt as-is, it's good hygiene
- **bash-spiral** — adopt as-is, prevents agent frustration loops

### What we don't need from pi-system-reminders

- context-large / token-usage — already have a context window hook
- session-resumed — already have session-context.sh
- malware-awareness — not relevant to this codebase
- file-empty / file-truncated — nice-to-have but low priority

### Two complementary layers

The pi-system-reminders are *behavioral guardrails* (stop the agent doing dumb things). Our planned hooks are *quality guardrails* (stop the agent writing bad code). They're complementary layers — pi catches process problems, ours catch product problems.
