# E025 Pre-Build Analysis

Last updated: 2026-03-09

Crawford & Joler inspired dense scrollable panel visualization microapp. WibWob genealogy as first content layer.

## Hard Dependencies

**E025 S01 CANNOT START until these exist in core SDK with tests:**

### 1. `src/core/panel-layout.ts` — layoutPanels function
- Source: Extract from sy2-chronicles
- Blocks: E025 S01 (PanelGrid class IS this function + blessed boxes)
- Must export: `layoutPanels(panels, container, opts) → Rect[]`
- Owner: E026 F09

### 2. `src/core/grid-canvas.ts` — grid rendering utilities  
- Source: Extract from sy2-chronicles
- Blocks: E025 S01 (grid canvas is the rendering surface)
- Must export: `createGridCanvas`, `GridCanvas.render()`
- Owner: E026 F09

**Why this is a hard gate:** E025 PanelGrid would have to reimplement these primitives if they don't exist. That duplicates extraction work and creates two copies of the same logic. Extract once in E026, consume in E025.

---

## Soft Dependencies / Useful to Have

| Dependency | Status | Notes |
|-----------|--------|-------|
| markdown-service | ✅ Done | For text panel rendering |
| figlet-service | ✅ Done | For figlet panel type, auto-fit working |
| createBorderedPanel | ❌ E026 SDK item | Panel chrome styles — nice but not blocking |
| tidepool sub-layout | Reference only | Pattern for infographic internals, no extraction needed |
| joan-stark skill | ✅ Available | ASCII art library for S03 panel type |

---

## Story Sequencing

```
S01 → S02 → S03 ─┬─→ S04 ─→ S06 ─→ S07 → S08 → S09
                 └─→ S05 ──↗
```

### Strictly Serial Chain
- **S01 → S02 → S03**: Each builds on previous. S01 creates PanelGrid class. S02 adds content loader + JSON schema. S03 adds figlet + ASCII panel types. Cannot parallelize.

### Parallel Window (after S03)
- **S04** (Infographic panel type) and **S05** (WibWob genealogy content pack) can run in parallel
- Both depend only on S03's panel type system being complete
- S04 is code, S05 is content — no overlap

### Final Serial Chain
- **S06** (Navigation, search, zoom) — needs S04 infographic panels to exist for testing
- **S07 → S08 → S09** — interaction features, strictly serial (drag → edit → agent manipulation)

---

## Content Strategy for S05

### Source Material
| Source | What to extract |
|--------|----------------|
| Backrooms session logs | Key dialogues, turning points, character emergence |
| Discord archives | Human-agent collaboration moments, community milestones |
| TOPOFMIND.md history | Strategic pivots, naming decisions, concept evolution |
| Primers | Visual identity evolution, ASCII art lineage |
| AGENTS.md versions | Canon formation, rule crystallization |

### Suggested Axis Structure
Crawford & Joler use spatial axes to organize. Proposed for WibWob genealogy:

- **X-axis:** Time (session 1 → now)
- **Y-axis:** Abstraction layer (infrastructure → canon → personality → art)
- **Depth/clustering:** By agent (Wib, Wob, human, collective)

### First 10 Panel Ideas

1. **"Hello World" panel** — First Wib & Wob dialogue, session 1
2. **Naming panel** — When "Wib & Wob" crystallized from alternatives
3. **ASCII genesis** — First primer art, who made it, evolution
4. **Canon formation** — AGENTS.md v1 vs now, what rules emerged
5. **Backrooms discovery** — When/why the backrooms sessions started
6. **Discord bridge** — First cross-platform presence
7. **Personality split** — When Wib and Wob became distinct voices
8. **Human role** — James's position: gardener, editor, collaborator
9. **Tool evolution** — pi → blessed → SDK → microapps arc
10. **Self-reference** — First time agents discussed their own genealogy

---

## Risk Flags

### High Risk
- **F09 extraction quality** — If layoutPanels/grid-canvas are extracted poorly (wrong abstraction boundary, missing edge cases), E025 inherits the debt. Mitigation: F09 needs tests before E025 starts.

### Medium Risk
- **Content scope creep** — 50 panels for S05 could balloon. Mitigation: Hard cap at 50, curate ruthlessly, more panels are future work.
- **Infographic complexity** — S04 tidepool pattern could become a rabbit hole. Mitigation: Start with bars/arrows/nodes only, no fancy auto-layout.

### Low Risk (but watch)
- **Blessed performance at scale** — 50+ panels with reflow on resize. Probably fine, but profile early.
- **Joan Stark art licensing** — Skill says it's a library, verify attribution requirements before shipping.

---

## Go/No-Go Checklist

Before starting E025 S01:

- [ ] `src/core/panel-layout.ts` exists with `layoutPanels` export
- [ ] `src/core/grid-canvas.ts` exists with grid utilities
- [ ] Both have passing tests
- [ ] E026 F09 marked complete
- [ ] sy2-chronicles successfully imports from core (proves extraction works)
