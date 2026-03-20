# .agents/ — Reference Documentation

> Start at `AGENTS.md` (root) — ops, instance targeting, agents, conventions.
> Then `PHILOSOPHY.md` (why) → `ARCHITECTURE.md` (how).
> Only come here for specific work.

---

## 3-tier orientation model

**Tier 1 — Read at session start (~450 lines total)**

| File | Covers |
|------|--------|
| `AGENTS.md` | Instance targeting, lifecycle ops, agents, PTC, devlog, planning |
| `PHILOSOPHY.md` | Why this exists, 5 design filters, north star |
| `ARCHITECTURE.md` | COAT, state flow, 4 subsystems, key files, SDK stability tiers |

After these three files an agent is oriented. `.agents/` is Tier 2 and 3 — only read for specific work.

---

**Tier 2 — Read when starting that type of work**

| File | Read when… |
|------|-----------|
| `guides/microapp.md` | Building or modifying a microapp — scaffold, SDK, layout, pitfalls |
| `guides/shell.md` | Shell / host work — invariants, control API, World Chat, dual-instance |

---

**Tier 3 — Read before touching specific subsystem files**

| File | Subsystem | Key files covered |
|------|-----------|------------------|
| `specs/window-system.md` | WindowManager, WindowFacade, microapp window registration | `src/core/window-manager.ts`, `window-facade.ts` |
| `specs/workspace.md` | WorkspaceService, save/restore flow, WindowSnapshot schema | `src/services/workspace-service.ts` |

---

**Auto-generated reference**

| File | Source | Regenerate |
|------|--------|-----------|
| `integration-surface.md` | `control-api.ts` + `command-catalog.ts` | `bun run .pi/skills/ww-primitives/scripts/gen-integration-surface.ts` |

Current: 23 endpoints · 85 commands · generated 2026-03-17.

---

**Reflections** — `reflections/` — weekly agent devlogs. Pain → why → fix. Not orientation docs.

**Archive** — `.archive/` — superseded docs. Safe to read for historical context; do not update.
