# 014 — Gaps Found: SKILL.md Cross-Check

Cross-checked all 12 handover docs (001-013 + overview) against
`.pi/skills/wibwobdos/SKILL.md`. These items are documented in the
operational skill but missing from or underserved in the TS handover docs.

## Gap 1: Double-Parse API Envelope (CRITICAL for agents)

`POST /menu/command` returns a double-wrapped response:

```json
{"ok": true, "result": "{\"messages\":[...]}"}
```

`outer["result"]` is a JSON STRING, not an object. Must parse twice:

```python
outer = json.loads(raw)
inner = json.loads(outer["result"])
```

Applies to: `get_chat_history`, `frame_capture`, `paint_export`, any
command returning structured JSON. Plain string responses ("ok") don't
need the inner parse.

**Impact on TS rebuild**: If the TS app keeps a REST API layer, this
envelope pattern must either be preserved (backward compat) or eliminated
(breaking change). 006 documents the IPC protocol but doesn't call out
the double-parse gotcha at the HTTP layer.

**Recommendation**: Eliminate in TS rebuild. Commands should return typed
objects directly. If backward compat is needed, add a `?raw=1` query
param that returns unwrapped JSON.

## Gap 2: C++ Edit Rules & Uses_* Macros

The SKILL.md documents critical C++ gotchas:

- `Uses_TWindow`, `Uses_TRect`, etc. MUST be defined before
  `#include <tvision/tv.h>` or types are invisible
- `Uses_TWindowInit` is NOT a valid macro (comes free with Uses_TWindow)
- `TGroup::current` is a member, not a method
- Never forward-declare tvision types in your own namespace
- Frame z-order: `insertBefore(frame, nullptr)` = top, `insert(frame)` = wrong
- Frameless windows: child views must include parent chrome commands in
  right-click menus or they become unreachable

**Impact on TS rebuild**: Not directly relevant since TS won't use
tvision. But any C++ maintenance during the transition needs these rules.
004 (window factories) should reference this for anyone still editing C++.

## Gap 3: Turbo Vision Responsive Layout (growMode)

The SKILL.md has a complete growMode flag table:

| Flag | Meaning |
|------|---------|
| gfGrowLoX | left edge tracks owner's right |
| gfGrowHiX | right edge tracks owner's right |
| gfGrowLoY | top edge tracks owner's bottom |
| gfGrowHiY | bottom edge tracks owner's bottom |
| gfGrowAll | all four |
| gfGrowRel | proportional |

Plus the 3-col + status bar layout recipe and the `changeBounds()`
override pattern for complex layouts.

**Impact on TS rebuild**: The TS equivalent needs a layout constraint
system. blessed has `top`, `left`, `width`, `height` with percentage
and calc expressions. The growMode mental model (which edges track which
parent edges) maps to CSS-like anchoring. 004 mentions growMode but
doesn't provide the translation table.

**Recommendation**: Add a "Layout Constraint Translation" section to 004
mapping growMode flags to blessed/CSS equivalents.

## Gap 4: Extracted Module Paths

The SKILL.md documents the progressive extraction from wwdos_app.cpp:

| Path | Contents |
|------|----------|
| `app/core/json_utils.h` | `json_escape(s)` — canonical JSON string escaper |
| `app/ui/ui_helpers.h` | `makeStringCollection(vector<string>)` |
| `app/windows/frame_animation_window.h/.cpp` | Extracted window class |
| `app/paint/paint_wwp_codec.h/.cpp` | .wwp JSON codec |
| `app/paint/` | Full paint subsystem |

**Impact on TS rebuild**: These extractions show the direction of
modularization. The TS rebuild should mirror this structure but go
further — every window type in its own module, every codec isolated.
009 covers paint_wwp but the others aren't mentioned.

## Gap 5: Docker Build & Deploy

The SKILL.md covers:
- `make up-real` — real C++ backend in Docker
- `make up` — mock mode
- Full gate: `make up-real && make provision && make deploy && make test`
- Container health: `docker compose exec substrate bash -c 'curl -sf $WIBWOBDOS_URL/health'`

**Impact on TS rebuild**: The TS spike will need its own Docker story.
None of the handover docs cover containerization. This is a CI/deploy
concern, not an architecture concern, but the TS agent needs it
eventually.

## Gap 6: Agent Skills Inventory

The SKILL.md lists 5 operational skills:
- ww-launch (tmux monitor layout)
- ww-api-smoke (endpoint sweep)
- ww-build-test (compile + test)
- screenshot (screen capture)
- ww-audit (parity gap matrix)

**Impact on TS rebuild**: These skills need TS equivalents. The TS agent
should have: a launch skill, a smoke test skill, a build skill, and a
screenshot/state capture skill. Not blocking for architecture docs but
needed for operational parity.

## Summary

| Gap | Severity | Action |
|-----|----------|--------|
| Double-parse envelope | High | Add to 006, decide keep/kill for TS |
| Uses_* macros | Low (C++ only) | Reference in 004 for transition period |
| growMode translation | Medium | Add constraint mapping to 004 |
| Extracted modules | Low | Already implicit in per-doc coverage |
| Docker | Medium | Defer to TS CI setup phase |
| Agent skills | Low | Create TS equivalents when operational |
