---
title: WibWobCity Phase 2 — Events, Observability, Workspace
status: not-started
github_issue: TBD
pr: —
depends_on: spk04 (merged via PR #TBD)
---

# TL;DR

SPK04 shipped a playable WibWobCity. Phase 2 makes it *readable* — you can see what the
sim is doing, the window survives workspace reload, and the budget model is surfaced.

---

## Stages

### E — Workspace Round-Trip *(carry-over from SPK04)*
**Files:** `window_type_registry.cpp`, `micropolis_ascii_view.cpp`

Register `"micropolis_ascii"` in `window_type_registry`. Persist:
```json
{ "type": "micropolis_ascii", "x": N, "y": N, "w": N, "h": N, "seed": N, "speed": N }
```
On load: spawn via registry lookup, `initialize_new_city(seed, speed)`, restore
camera + cursor position. Does NOT restore city state (use F3/save slots for that).

AC: workspace save → app restart → reload → Micropolis window present and ticking at
correct speed.

---

### F — Game Events Panel
**Problem:** engine fires `sendMessage` callbacks for power shortage, zone needs, fire,
traffic, disasters — all silently swallowed by `ConsoleCallback` no-ops right now.

**Plan:**
- Add a `std::deque<std::string> eventLog_` ring buffer (max 50) to `MicropolisBridge`
- Override `ConsoleCallback::sendMessage` (or subclass it) to push human-readable
  strings: `"Power shortage at (42,17)"`, `"Residential needs more"`, etc.
- Message ID → human label table from
  `vendor/MicropolisCore/MicropolisEngine/src/message.h`
- New `TMicropolisEventLog : TView` — scrollable panel, ~8 rows tall, docked below map
  or as a toggleable overlay (`e` key)
- `bridge_.get_events()` returns the ring buffer; view renders newest-first

AC: place a powered zone, wait, see a message. Lose power, see "Power shortage".

---

### G — Observability / Debug Overlay *(toggle with `d`)*
**Problem:** hard to debug placement issues — is power reaching? Is the tile what I
think it is?

**Plan:**
- `d` toggles a debug row inserted into the map cursor position showing:
  `tile=0x04A2 pwr=1 pop=3 landVal=42 crime=0`
- Pull from `sim_->getPowerMap()`, `sim_->populationDensityMap`,
  `sim_->landValueMap`, `sim_->crimeRateMap` (all public arrays on Micropolis)
- Render as an extra bottom-bar line when cursor is stationary, or always if in
  debug mode

AC: cursor over a zone tile → debug row shows correct tile ID and power status.

---

### H — Budget Panel *(F4)*
**Problem:** city runs out of money with no explanation.

**Plan:**
- `F4` opens a modal `TMicropolisBudgetView` showing:
  taxes collected, road/fire/police maintenance, net balance
- Engine has `sim_->taxRate`, `sim_->roadPercent`, `sim_->firePercent`,
  `sim_->policePercent`, `sim_->cityTax`, `sim_->roadFund`, etc.
- Read-only for now (no budget editing)
- Close with `Esc` / `F4`

AC: `F4` shows a panel. Panel numbers match `totalFunds` trajectory.

---

## Guardrails (inherited from SPK04)
- No raw ANSI bytes in any `TDrawBuffer` write
- `micropolis_determinism` and `micropolis_no_ansi` tests stay green after every stage
- Feature stays behind `open_micropolis_ascii` command

## Suggested order
E → F → G → H. E is a quick Codex job. F has the most gameplay impact.

## Open questions
- Should the event log be a separate window or docked to the city window?
- Budget editing (tax rate slider) in phase 3 or here?
- Should save slots persist between app restarts (they do — .city files on disk)?
