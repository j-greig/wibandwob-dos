# Still Missing
## Things not yet in the plan — for human review + augmentation

_Seeded from fresh-eyes-review.md. Add your own thoughts below each item._

---

## 1. `wibwob-session-briefing.sh` — faster than health-full, do it first

One script that answers "what state are we in?" at session open:
- `wibwob status` → instance alive + identity + screen size
- open/assigned todos count
- active spike name + status from `.planning/spikes/`
- usage-pulse maturity signal ("too young — check again YYYY-MM-DD")
- latest reflection filename + open fix item count

Simpler than `health-full.sh`. No knip/madge deps. 30-second win.

> 💭 _your thoughts:_

---

## 2. `app-controller.ts` decomposition — the named rough edge nobody's planning

Architecture doc says explicitly: "continue decomposing into focused window families."
Invariant doc names "giant controller growth" as an anti-pattern.
It's 2313 lines. Nobody has a sprint for it.

Needs its own spike: `spk-app-controller-decomposition`.
The health gate should track its line count as a secondary metric so we notice
whether it's growing or shrinking.

> 💭 _your thoughts:_

---

## 3. Runtime behaviour bugs from W11/W12 — not in any plan

Named in reflections but not in pitfalls.md or any spike:

- **SDK focus theft** — microapps steal keyboard focus and don't return it cleanly on close
- **`element.key()` double-fire** — registers globally on `program`, not per-element;
  2-3× keystroke fire in any microapp with nested key handlers (W11 + W12)
- **Silent resize `false`** — `POST /windows/batch` can return `false` with no explanation;
  window then closes itself (W12: contour)
- **`desktop.clear-all` race** — opening windows immediately after clear-all loses IDs for a beat; need `sleep 0.5`

At minimum: pitfalls.md entries.
Better: composition-helpers mitigation for key-handler pattern, typed error on silent resize.

> 💭 _your thoughts:_

---

## 4. `describeState()` compliance gap — COAT parity across the fleet

44 microapps. Compliance is inconsistent. Invariants 5 and 12 require:
- `summary` (non-empty)
- `appType` (present, matching microapp id)
- at least one semantic field beyond summary

The hero 7 smoke script (Session 2) should enforce this. The broader fleet
should at least be audited and a compliance count surfaced in `health-full.sh`.

> 💭 _your thoughts:_

---

## 5. `gen-integration-surface.ts` should be in `health-full.sh`

`integration-surface.md` is already auto-generated from code. If it drifts from
the live API, that's a doc-drift failure. Wire the freshness check into the gate.

Also: Session 3's `sdk-export-index.sh` should mirror `gen-integration-surface.ts`
— read that script first before writing anything new.

> 💭 _your thoughts:_

---

## 6. Reflections → pitfalls feedback loop

W11 and W12 are the most honest signal in the codebase. But nothing promotes
friction from `reflections/` to `pitfalls.md` automatically.

Minimum viable: in `wibwob-session-briefing.sh`, grep the latest reflection for
open fix items and surface the count. Human/agent decides whether to promote.

Ideal: a `scripts/reflection-to-pitfalls.sh` that extracts unresolved `**Fix`
entries and appends them as candidates to `pitfalls.md` for review.

> 💭 _your thoughts:_

---

## 7. COAT-complete crash recovery — the loop isn't closed

We have: control manifest + reload invalidator + crash-bundle command.
We don't have: anything that auto-detects instance death and acts on it.

Sketch:
```bash
if ! bun run wibwob health > /dev/null 2>&1; then
  bun run wibwob crash-bundle --out scratch/reports/crash-$(date +%Y%m%d-%H%M)
  echo "Restart: tmux send-keys -t wibwob 'bun run dev:world' Enter"
  exit 1
fi
```

Lives in `health-full.sh` as the first check. Closes the loop from
"instance dead" → "evidence collected + restart instruction" in one command.

> 💭 _your thoughts:_

---

## 8. Agent fleet consolidation — waiting on usage-pulse data

Skills to merge (from post-spike-masterplan.md):
- `autoresearch` + `autoresearch-create` → one skill
- `chiptune` + `chiptune-cover` + `chiptune-studio` → one skill with modes
- `session-archaeology` + `pi-session-log-explorer` → one skill

**Do not act on this until usage-pulse has ~1 week of data (target: 2026-03-27).**
The current stats (4 skills, 4 extensions, 2 agents from 1 sprint) are not
representative. Come back to this item with real signal.

> 💭 _your thoughts:_

---

## 9. file-manager-window.ts — the other god window

1859 lines in `src/windows/`. Bigger than music-player. Needs its own spike.
Session 5 does music-player (1227 lines). file-manager is the follow-on.

> 💭 _your thoughts:_

---

## 10. PreToolUse safety hooks — structural, not advisory

gstack's `careful`/`freeze`/`guard` intercept tool calls at execution time.
"Please be careful" in a prompt is ignored under pressure. A hook that exits 1
is not.

Candidates for WibWob-DOS:
- Bash: warn on `kill -9 <wibwob pid>`, `bun run dev` when instance running
- Edit: warn on `app-controller.ts`, `command-catalog.ts` (high blast radius)
- Write: warn on `microapp.json` id field changes (breaks command surface)

Not urgent. High leverage when working near production.

> 💭 _your thoughts:_

---

## 11. Your additions

> 💭

