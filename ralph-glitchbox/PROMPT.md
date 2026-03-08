# Task: Build GlitchBox TUI MVP

## Context

GlitchBox TUI is a blessed window where agents control an ASCII skeleton
in a generative field. No webcam. No Python. Works on VPS. API-driven poses.

Repo root: `../` from this directory.
Spec: `../.planning/spikes/spk-glitchbox-tui/mvp-brief.md`
Epic: `../.planning/epics/e004-monster-cam/e004-brief.md` (skeleton render ref)

## Your task each iteration

1. **Read** the MVP brief at `../.planning/spikes/spk-glitchbox-tui/mvp-brief.md`

2. **Assess** current state — check what exists:
   - `../src/windows/glitchbox-window.ts` (may not exist yet)
   - `../src/core/command-catalog.ts` (look for glitchbox entries)
   - `../src/core/app-controller.ts` (look for glitchbox wiring)

3. **Pick** the lowest-numbered unmet AC from this list:
   - AC-1: `glitchbox.open` opens window with animated field + idle skeleton
   - AC-2: `glitchbox.pose` updates skeleton to preset, ~8 frame animation
   - AC-3: 5 presets visually distinct (idle, arms-raised, step-left, jump, wave)
   - AC-4: Field focal point drifts toward skeleton centre of mass
   - AC-5: `/state` reports `currentPreset` and `hasPose: true`
   - AC-6: No camera dependency, no Python venv
   - AC-7: `bun run typecheck` passes clean

4. **Implement** ONE concrete thing toward that AC:
   - New window: `../src/windows/glitchbox-window.ts`
   - New commands: register in `../src/core/command-catalog.ts`
   - Wire handler: `../src/core/app-controller.ts`
   - State: `../src/services/state-service.ts` if needed

5. **Typecheck**: `cd ../ && bun run typecheck`
   Fix ALL errors before continuing. Zero tolerance.

6. **Log** one line to `logs/glitchbox-build.log`:
   ```
   [YYYY-MM-DD HH:MM] iter N: {what was implemented, which AC advanced}
   ```

7. **Diary** entry to `diary/changelog.md`:
   - What you did and why
   - Which AC this moves forward
   - What remains

## Implementation notes

For the generative field (AC-1, AC-4):
- Look at `../src/windows/generative-art-window.ts` — plasma engine
- Extract the render loop, adapt for GlitchBox layer 1
- Field should animate continuously, ~10fps minimum

For the skeleton render (AC-1, AC-2, AC-3):
- Layer 2 on top of the field
- Use the character vocabulary from wibandwob-base.md
- 5 named presets with distinct ASCII shapes
- Interpolate between poses over ~8 render frames

For API wiring (AC-5):
- `describeState()` must return `{ currentPreset, hasPose, windowType }`
- Follow state-service.ts patterns exactly

## Completion

When ALL 7 ACs are met and typecheck is clean, output:

<promise>GLITCHBOX_MVP_DONE</promise>

Only output this when the window genuinely opens, poses actually change visually,
and typecheck exits 0. No cheating.
