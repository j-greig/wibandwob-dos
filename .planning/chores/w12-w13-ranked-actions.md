# W12/W13 Ranked Action Items

Extracted from W12 + W13 devlog triage. Ranked by agent-friction impact.
Branch: `chore/w13-reflections`
Date: 2026-03-23

---

## Tier 1 — High leverage, unblocks agents daily

### 1. SDK reference doc
**What:** Document LayoutPart vs composition helpers, 3 timer mechanisms (`setInterval` / `createTimer+Set` / `createAnimationClock`), `createCanvas` timing gotcha, `applyContribRect` pattern, ANSI-in-grid performance cliff.
**Why:** W12 MAPP 1-10 audit found 8 undiscovered patterns. Every new microapp developer hits these. One doc prevents dozens of burned sessions.
**Source:** W12-176..184
**Blast radius:** New `SDK-MICROAPP-DEV.md` section or `.agents/guides/microapp/sdk-patterns.md`

### 2. `wibwob commands` shows arg schemas
**What:** Machine-readable arg schemas in `wibwob commands` output — not just description strings.
**Why:** `window.close --windowId` returned `ok:true` and did nothing — agent burned 6 attempts on wrong param name. Machine-readable args = agents never guess.
**Source:** W12-112..115
**Blast radius:** `command-catalog.ts` already has Zod schemas — expose them in `list()` output.

### 3. CLI health gate — refuse/warn on 1×1 screen instance
**What:** Before dispatching any command, check `screen.width > 1`. Warn or refuse if targeting a headless zombie.
**Why:** Ghost zombie instances silently eat commands, return `ok:true`, nothing happens. Worst failure mode in the system.
**Source:** W12-119..122
**Blast radius:** `wibwob` CLI socket discovery + `control-api.ts` or CLI dispatch layer.

### 4. Command fuzzy matching
**What:** Normalise `_` → `-` before 404 on command lookup. Optionally Levenshtein for close misses.
**Why:** `terrain_lab.open` vs `terrain-lab.open` — hit this repeatedly. One replace pass costs nothing.
**Source:** W12-004, W12-008
**Blast radius:** `command-registry.ts` `run()` method — one normalisation line before lookup.

---

## Tier 2 — Significant, medium effort

### 5. `microapps.reload` warns when host files changed
**What:** Flag `reload invalidated by host changes` when `src/**` files have changed since boot.
**Why:** Half-state trap: windows render but commands vanish after touching `src/`. Agents restart manually and wonder why for 20 minutes.
**Source:** W12-169
**Blast radius:** `microapp-loader.ts` + reload API response shape.

### 6. Journal as memory surface
**What:** Inject 3 most recent journal entries into agent context on startup.
**Why:** The plumbing and data exist. Continuity between sessions would be genuinely different. Highest "symbient" value of anything on this list.
**Source:** W12-109
**Blast radius:** Agent session bootstrap + `journal-service.ts` read path.

### 7. Batch op failure reasons
**What:** `/windows/batch` returns `{ ok: false, reason: "min-size", windowId: 3 }` not just `false`.
**Why:** Silent failures waste debugging cycles every time.
**Source:** W12-009
**Blast radius:** `control-api.ts` batch handler — structured error per op.

### 8. `perform action "reload_config"` for shader hot-swap
**What:** Replace `osascript` Cmd+Shift+, keystroke simulation with proper Ghostty 1.3 AppleScript action.
**Why:** Keystroke simulation is fragile (wrong window, focus issues). Native action exists.
**Source:** W12 Ghostty AppleScript discovery / W13
**Blast radius:** `.pi/skills/wibwobdos/scripts/ghostty-shader.sh` `reload()` function — 3 line change.

---

## Tier 3 — Good, lower urgency

### 9. `desktop.compose` — declarative multi-window layout
**What:** One command, declarative layout spec, multi-window workspace in one shot.
**Why:** Currently 10-line bash loops. Would make agent desktop choreography trivial.
**Source:** W12-005
**Blast radius:** New command + layout resolver. Significant.

### 10. `scripts/devlog-split.sh WXX N`
**What:** Auto-split a reflection file into N blobs by `## ` headers, write to `scratch/`.
**Why:** Done manually this session. ~20 lines of bash. Enables automated W-tagging without human splitting.
**Source:** W13-007
**Blast radius:** New script only.

### 11. GitHub Actions → Fly.io deploy
**What:** `fly deploy` on push to main. One workflow file + `FLY_API_TOKEN` secret.
**Why:** Already authorized. True disposable testbed that stays current automatically.
**Source:** W12-125
**Blast radius:** `.github/workflows/deploy-fly.yml` — new file only.

### 12. `wibwob commands --writable`
**What:** List which appTypes support `.write` / `.send`.
**Why:** Saves 404s when trying to write to windows that don't support it.
**Source:** W12-010
**Blast radius:** `command-registry.ts` list output + CLI flag.

---

## Tier 4 — Kill or park

| Idea | Decision | Reason |
|------|----------|--------|
| Cinema single-timeline fix (W12-051..059) | Park | Niche, spec exists in `RECORDING.md`, low daily impact |
| Fly.io config tweaks (W12-126..131) | Park | Nice-to-have, not urgent |
| Rename `.agents/` (W12-116) | Kill | Cosmetic disruption, unclear value vs cost |
| `wibwob cleanup-sockets` (W12-064) | Done | `wibwob clean` already ships this |

---

## Recommended next 3

1. **#4 Command fuzzy matching** — smallest blast radius, immediate daily value, one line
2. **#3 CLI health gate** — prevents the most silent/confusing failure mode
3. **#1 SDK docs** — highest total session-hours saved across all future microapp work
