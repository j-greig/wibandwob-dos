# Agentic Development Guide (Skills-First)

## TL;DR

If you want better agent outcomes, stop overloading one giant prompt.
Build **skills as modular capability packages** (instructions + scripts + references + data), then add **just-in-time steering/guardrails** where failure is costly.

This guide synthesises:
- `Lessons from Building Claude Code_ How We Use Skills` (**primary weighting, ~70%**)
- `steering-accuracy-beats-prompts-workflows`
- `agent-native`

---

## 1) Core stance: skills are your product surface, not just docs

A recurring mistake is treating skills as markdown snippets. The strongest pattern is:

- Skill = **foldered execution unit**
  - `SKILL.md` (activation + orchestration guidance)
  - `scripts/` (deterministic helpers)
  - `references/` (deep docs)
  - `assets/` (templates/examples)
  - optional persisted data in stable plugin data dir

Why this matters:
- model spends tokens on judgment, not reconstructing boilerplate
- behaviour becomes reusable across repos/sessions
- you can continuously patch gotchas without rewriting core prompts

---

## 2) Skill portfolio design (what to build first)

From the Claude Code lessons, high-value skills tend to cluster into 9 categories. Prioritise these in order:

1. **Product verification** (highest leverage)
2. **Library/API reference**
3. **Code quality/review**
4. **Runbooks**
5. **Scaffolding/templates**
6. Data analysis
7. Team workflow automation
8. CI/CD + deployment
9. Infra ops

### Why verification first
Verification skills are force multipliers because they close the loop from “changed code” to “proved behaviour”.
If you can invest one week anywhere, invest in high-quality verification scripts + assertions.

---

## 3) Skill writing rules that actually improve performance

## 3.1 Don’t state the obvious
Only include information that changes model behaviour away from generic defaults.

Bad:
- “Write clear code.”

Good:
- “Our shell-level command IDs are kebab-case; underscore variants are invalid and silently fail in some flows.”

## 3.2 Maintain a living **Gotchas** section
The highest-signal section in a skill.
Append every repeated failure pattern as:
- symptom
- root cause
- detection command
- canonical fix

## 3.3 Progressive disclosure by file layout
Keep SKILL.md short and operational.
Move depth to `references/*.md` and instruct when to read each file.

Pattern:
- SKILL.md: “If command registration fails, read references/command-surface.md.”

## 3.4 Avoid railroading
Give constraints + priorities, not brittle scripts of thought.
Let the model adapt.

## 3.5 Treat description as trigger logic
The description field is not marketing copy; it is activation routing.
Include intent phrases users actually say.

## 3.6 Store reusable code, not only prose
Prefer small scripts for repetitive transforms/checks. This reduces hallucinated glue code.

## 3.7 Design setup paths explicitly
If setup is required (tokens, channels, env), support first-run onboarding and persist config.

---

## 4) Add steering where prompts/skills still fail

From the steering evals:
- simple prompt instructions: good but leaky
- rigid workflows: predictable but brittle off-happy-path
- SOPs: highly reliable, high token cost
- **steering hooks**: best reliability/cost balance for critical rules

Use deterministic steering/hooks for:
- tool order constraints
- parameter validation
- input-source integrity checks
- post-response format/tone gates

Practical rule:
- Put **general behaviour** in skill/SOP
- Put **non-negotiable correctness** in deterministic checks/hooks

---

## 5) Agent-native architecture constraints for better skills

Borrowing from `agent-native`:

1. **Parity**: anything user can do, agent can do via tools
2. **Granularity**: tools are atomic primitives
3. **Composability**: new features should often be prompt/skill additions
4. **Emergence**: observe requests, then codify repeated patterns into skills
5. **Improvement over time**: update prompts/skills with real failure logs

For skill design this implies:
- keep primitives available (domain tools are shortcuts, not hard gates)
- make CRUD complete for each entity
- provide explicit completion signalling
- favour files for transparent agent context and inspectable memory

---

## 6) Skill quality rubric (use before publishing)

Score each 1–5:

1. **Trigger precision**
   - Does the description activate on real user phrasing?
2. **Operational clarity**
   - Are exact commands, paths, and done criteria present?
3. **Gotcha coverage**
   - Are known failures encoded with detection + fix?
4. **Determinism support**
   - Are critical checks handled by scripts/hooks, not prose alone?
5. **Progressive disclosure hygiene**
   - Is SKILL.md concise, with deep material linked out?
6. **Token efficiency**
   - Is repeated/reference material deduplicated?
7. **Verification strength**
   - Does the skill prove success (not just execute steps)?

Interpretation:
- 30+ publish
- 24–29 pilot only
- <24 redesign

---

## 7) Suggested implementation template

```text
skill-name/
├── SKILL.md
├── references/
│   ├── gotchas.md
│   ├── verification.md
│   └── api-reference.md
├── scripts/
│   ├── preflight.sh
│   ├── verify.sh
│   └── collect-evidence.sh
└── assets/
    └── report-template.md
```

### SKILL.md minimum structure
1. Purpose + trigger intents
2. Quick run
3. Decision table (when to use which path)
4. Verification contract
5. Escalation/fallbacks
6. Links to references

---

## 8) Operating loop for continuous skill improvement

1. Run skill in real tasks
2. Log misses/failures
3. Classify failure type:
   - trigger miss
   - instruction ambiguity
   - missing script
   - non-deterministic critical rule
4. Patch smallest layer first:
   - description → SKILL.md wording → script/check → steering hook
5. Re-evaluate with repeat scenarios
6. Curate/merge redundant skills

This avoids the “prompting treadmill” by moving repeated fixes into modular, testable artefacts.

---

## 9) What to do next in this repo

1. Create/upgrade skills in this order:
   - verification-centric microapp testing skill
   - microapp command-surface/runbook skill
   - docs-refinement skill for SDK/microapp guides
2. Add a shared `references/gotchas.md` pattern to each high-use skill
3. Add deterministic preflight scripts for critical command/arg/path checks
4. Track usage and under-triggering (simple hook/logging)
5. Quarterly prune redundant skills and merge overlaps

---

## 10) Devlog pattern for this session (from the agent-native lens)

The `agent-native` doc strongly implies that improvement comes from **accumulated context + refinement loops**. For this session, the devlog should not be a changelog; it should be a compact learning loop artefact.

Use this structure per entry:

1. **Intent** — what outcome we were trying to achieve
2. **Observed behaviour** — what the agent actually did
3. **Gap type** — parity / granularity / composability / verification / UX
4. **Root cause** — missing tool, weak trigger, stale docs, no guardrail, etc.
5. **Patch layer** — prompt, skill description, SKILL.md, script, hook
6. **Evidence** — command output, screenshot path, failing/passing check
7. **Next codification** — what becomes canon (gotcha, checklist item, script)

### Suggested entry format (copy/paste)

```markdown
### HH:MM — <short title>
- Intent:
- Observed behaviour:
- Gap type: [parity|granularity|composability|verification|ux]
- Root cause:
- Patch layer: [description|skill|script|hook|docs]
- Evidence:
- Canon update:
```

### Session-specific focus for today

Track these three counters in the devlog:
- **Trigger misses** (skill should have activated but didn’t)
- **Silent success failures** (`ok:true` but wrong outcome)
- **Verification escapes** (change made without strong proof)

At end-of-session, add a 6-line rollup:
- Top 3 repeated failure patterns
- Which skill updates landed
- Which deterministic checks/hooks were added
- What remains prompt-only (risk)
- Token-heavy docs to split for progressive disclosure
- First task for next session

## One-line doctrine

**Use skills for reusable cognition, scripts for deterministic execution, and steering/hooks for non-negotiable correctness.**
