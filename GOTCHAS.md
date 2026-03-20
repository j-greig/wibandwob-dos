# GOTCHAS.md — Non-Obvious Failure Modes

> Things LLMs get wrong here that they wouldn't get wrong in a standard repo.
> Don't include things that an LLM would alreay know from its training data,
  eg common coding/dev knowledge.
> Intake buffer — add when something burns you, not preemptively.
> Review periodically: promote stable entries to their parent CAPS file, delete what's absorbed.

---

## Documentation

**Never edit generated files directly.** They carry `<!-- AUTO-GENERATED -->` headers.
Fix via the generator script, then regenerate. Direct edits are silently overwritten.

**Never list watched file mappings outside gen scripts.** The `@watches` header in each
`scripts/gen-*` file is the single source of truth. A duplicate list anywhere else will drift.

**Never restate standard patterns.** Delta principle: if a competent LLM already knows it,
cut it. The test: "would this sentence appear in any TypeScript project's docs?" If yes — cut.

**Never make two doc changes in one autoresearch run.** Score delta must be attributable
to a single change or the loop can't learn.

---

## Microapps

**Never import from `src/core/` or `src/services/` directly.** Only
`src/services/microapp-sdk.js` is the stable import surface. Everything else is a COAT violation.

**Never change a microapp's `id` field carelessly.** It's the key into the command registry.
Changing it silently breaks all commands, workspace saves, and API paths for that microapp.

---

## Ops

**Never `kill -9` the wibwob process as first resort.** blessed needs clean shutdown to
release mouse tracking escape codes. Use `SIGTERM` (`kill $PID`). If terminal mangles: `reset`.

---

## CAPS files

**If a CAPS file needs >3 `<progressive-disclosure>` tags, split it.** More than 3 means
the file covers multiple concerns — create a new CAPS file at root for the second concern.

---

## Agent behaviour

**Never expand a terse-but-correct description for "readability."** Terse is correct here.
Expansion adds tokens, dilutes signal, fails the delta test.

**Never trust API responses alone as proof.** Visual verification is mandatory —
open the thing, screenshot it, read its state.
