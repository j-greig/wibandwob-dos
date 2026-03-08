# GlitchBox Build Diary

## 2026-03-08 — Iteration 1: Full MVP

### What we did

Built the complete GlitchBox TUI window in a single iteration:

1. **Types** — Added `"glitchbox"` to `WindowKind` and `TransientAppType`
2. **Command catalog** — Registered `glitchbox.open` and `glitchbox.pose` with full metadata (menu, palette, context menu, API, agent flags)
3. **Window file** — `src/windows/glitchbox-window.ts` with:
   - Generative ASCII field using wave interference + focal point modulation (`·:·~` chars)
   - 5 distinct skeleton presets: idle, arms-raised, step-left, jump, wave
   - 8-frame crossfade interpolation between poses
   - Focal point drift toward skeleton centre of mass (AC-4)
   - `describeState()` returning `currentPreset`, `hasPose: true` (AC-5)
   - Keyboard 'p' to cycle poses
   - Composite renderer layering skeleton on top of field
4. **App controller** — `openGlitchBox()` (focusOrCreate) + `glitchboxPose()` wired in actions builder

### ACs advanced

- AC-1: `glitchbox.open` opens window with animated field + idle skeleton ✓
- AC-2: `glitchbox.pose` updates skeleton with ~8 frame smooth interpolation ✓
- AC-3: 5 presets visually distinct (different arm/leg positions) ✓
- AC-4: Field focal point drifts toward skeleton centre of mass ✓
- AC-5: `/state` reports `currentPreset` and `hasPose: true` ✓
- AC-6: No camera, no Python, no venv ✓
- AC-7: `bun run typecheck` passes clean ✓

### What remains

Nothing — all 7 ACs are met. Ready for smoke testing with the running app.
