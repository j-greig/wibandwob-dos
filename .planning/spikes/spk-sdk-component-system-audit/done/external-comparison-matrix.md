# External Comparison Matrix (v0)

Scope: pragmatic baselines for a terminal-native SDK that still borrows product-system discipline.

Parity tags:
- ✅ have
- 🟡 partial
- ❌ missing
- 🚫 intentionally out-of-scope

## Baselines used

### Terminal-native
- Textual (Python)
- Rich (Python, render toolkit)
- Bubble Tea + Bubbles (Go)

### Product/UI-system
- Radix UI (headless React primitives)
- shadcn/ui (Radix + Tailwind composition patterns)
- Headless UI (headless React/Vue primitives)

---

## Category parity table

| Category | WibWob SDK | Textual | Rich | Bubbles | Radix/shadcn/Headless baseline | Notes |
|---|---:|---:|---:|---:|---:|---|
| Layout primitives (stack/row/grid) | ✅ | ✅ | 🟡 | 🟡 | ✅ | We are strong here for terminal-native needs. |
| Responsive breakpoints | ✅ | 🟡 | ❌ | ❌ | ✅ | Better than most terminal libs; keep as core differentiator. |
| Chrome (header/status/sidebar/panel/rule) | ✅ | ✅ | 🟡 | 🟡 | ✅ | Good surface, but naming layers need crisping. |
| Tabs/navigation list/search | ✅ | ✅ | 🟡 | ✅ | ✅ | Core parity present; interaction polish pass still needed. |
| Forms basics (button/input/check/radio/select) | ✅ | ✅ | 🟡 | ✅ | ✅ | Good baseline now that toggle+segmented landed. |
| Form state patterns (validation, async submit states) | 🟡 | ✅ | ❌ | 🟡 | ✅ | Need canonical patterns/examples, not necessarily new primitives. |
| Data display (KV/log/table) | ✅ | ✅ | 🟡 | 🟡 | ✅ | Table ergonomics trail web ecosystems; acceptable if documented. |
| Feedback (progress/spinner/toast) | ✅ | ✅ | ✅ | ✅ | ✅ | Missing explicit alert/banner primitive guidance. |
| Modal/dialog/confirm overlays | 🟡 | ✅ | ❌ | ✅ | ✅ | Overlay manager exists host-side; SDK-level modal contract should be clearer. |
| Theming/restyle model | ✅ | ✅ | ✅ | 🟡 | ✅ | Strong invariant model in WibWob; docs can be cleaner. |
| Animation/motion helpers | ✅ | 🟡 | ❌ | 🟡 | ✅ | High-priority area for this sprint: stronger reusable motion patterns. |
| Lifecycle safety helpers (timers/teardown) | ✅ | 🟡 | ❌ | 🟡 | 🟡 | `safeDestroy*` is a good differentiator for agent workflows. |
| Keyboard/focus semantics | 🟡 | ✅ | 🟡 | ✅ | ✅ | Keep this practical; no ARIA parity target for terminal UI. |
| Complex web patterns (popover/menu primitives, portals) | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | Not worth full parity; selective equivalents only where terminal UX benefits. |

---

## Product-owner readout by category

## 1) Keep as strategic strengths

- Layout + responsive primitives
- Lifecycle-safe helpers (`createTimer`, `clearTimers`, `safeDestroy*`)
- Theme/restyle invariants
- Agent/API-visible command/state model (COAT alignment)

## 2) Crisp-up priorities (high leverage)

1. **Naming coherence across two strata**
   - `createLayout*` family vs composition-helper family (`createHeaderBar`, `createStatusBar`, etc.)
   - Decide canonical naming policy and reduce duplicate mental models.

2. **Modal/overlay SDK contract clarity**
   - Host has overlay capability, but module-author path is less explicit.
   - Add clear docs/patterns before adding new primitives.

3. **Form workflow guidance**
   - Validation states, async submit, disable/loading patterns should be canonical examples.

4. **Data table guidance**
   - Clarify intended scope (read-only/simple interactive) vs out-of-scope advanced table features.

## 3) Intentional non-goals (to stop scope creep)

- Full web-style component parity (popover trees, portal stacks, ARIA semantics layer)
- Marketing/product-site design-system ambitions
- Heavy abstraction for UI states without terminal-native payoff

---

## Suggested decisions entering Phase 3

- Provisional keep: current core layout/chrome/form/feedback/data set.
- Provisional merge target: overlapping `createLayout*` and composition-helper naming surfaces.
- Provisional deprecate candidates: exports in SDK “advanced internals” zone that are not core for third-party microapp authoring.
- Provisional delete candidates: demo-only patterns that duplicate showcase coverage without distinct value.
