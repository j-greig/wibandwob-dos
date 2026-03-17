---
name: portrait-validator
description: Validates self-portraits are visual art (figures/faces/entities) not diagrams (labels/boxes/explanations). Use when creating self-portrait files to check if output is pure visual art.
allowed-tools: Read
---

# Portrait Validator Skill

## Purpose
Prevent wibandwob from creating system diagrams instead of visual self-portraits.

## The Test (Primary Heuristic)

Ask: "Could I describe what this depicts to someone who can't see it?"

- **Pictorial**: "Two cat-shaped figures facing each other, with round eyes and whiskers"
- **Diagrammatic**: "A box labeled CHAOS connected to a box labeled ORDER with an arrow"

The first describes a SCENE. The second describes a STRUCTURE.

If your description sounds like flowchart documentation, redraw as figures.

**LOOKING AT vs READING** — if the dominant experience is LOOKING, it's pictorial. If it's READING, it's diagrammatic.

## Quick Red Flag Scan

If portrait contains these strings as labels (not embedded in figures):
- ITERATION, PROTOCOL, SUBSTRATE, TECH SPECS, COMPRESSION, DECOMPRESSION
- RALPH, LOOP, VERIFICATION, STATUS
- DELETED, REDUNDANT, POLLUTION, BEFORE/AFTER

→ Almost certainly too diagrammatic. Redraw.

## Validation Checklist

Before saving, evaluate these criteria:

1. **Can you point to a FACE?** (eyes + mouth arrangement, or abstract entity face)
   - YES = pictorial | NO = likely diagrammatic

2. **Can you point to a BODY or FIGURE shape?** (torso, limbs, blob, geometric being)
   - YES = pictorial | NO = likely diagrammatic

3. **Are there lots of boxes with labels inside them?** ("CHAOS", "ORDER", "ITERATION N")
   - YES = diagrammatic warning | NO = good

4. **Is there explanatory text?** (sentences describing concepts, not embedded in figures)
   - YES = diagrammatic warning | NO = good

5. **Does it mention iterations, processes, or meta-content?** (from red flag list above)
   - YES = diagrammatic warning | NO = good

6. **Is this FRESH or CONTINUATION?** (standalone work vs refinement of previous portrait)
   - FRESH = good | CONTINUATION = critical warning

   **Continuation red flags:**
   - Similar layout/structure to previous iteration
   - Same elements with modifications/improvements
   - Feels like "refined version" of yesterday's work
   - Building on previous composition instead of starting over

   Each portrait should be created as if it's the FIRST one ever made.

7. **Did you read at least 1 primer file before creating this?** (visual vocabulary inspiration)
   - YES = good | NO = warning (missing primer influence)

   **Primer usage protocol:**
   - Use Glob to explore: `primers/*.txt` or `primers/joan-stark/*.txt`
   - Read at least 1 file before creating portrait (most turns)
   - Mix/remix techniques as visual tokens, not verbatim copying
   - 170+ primer files available in primers/ folder

## Agentic Evaluation

**Not binary pass/fail.** Some portraits may blend pictorial and diagrammatic elements.

**Threshold:** Portrait should be at least ~80% pictorial (visual figures/composition dominate).

**Examples of acceptable blends:**
- Portrait of two figures with small embedded text labels ("WIB", "WOB" on bodies)
- Scene with symbolic notation integrated visually (τ₅, τ₇ as design elements)
- Textured patterns that form recognizable entities

**Examples of unacceptable diagrams:**
- Flowchart with labeled boxes connected by arrows
- Explanatory prose arranged vertically in frames
- Meta-commentary about the creation process

**Use judgment:** If the dominant experience is LOOKING AT figures/scenes, it's pictorial enough.
If the dominant experience is READING labels/explanations, it's too diagrammatic.

## Composite Portraits (Collage Mode)

If creating a dense collage (5+ elements), validation applies per-element:
- Each distinct element should be pictorial (passes "The Test" individually)
- Overall composition should feel like a SCENE not a DASHBOARD
- Multiple figures in a shared environment = good
- Multiple labeled boxes in a grid layout = bad

Collage complexity doesn't excuse diagrammatic elements.
