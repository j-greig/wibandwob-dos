# PRD: Wib&Wob Chat Theming (Light/Dark Toggle)

## Context & Problem
- Wib&Wob chat currently uses a single light theme. Users want a dark option without duplicating UI code.
- The Turbo Vision TUI must remain legible under varying terminal palettes and keep code paths DRY.

## Goals
- Provide two first-class chat themes: Light (current) and Dark (inverse-friendly).
- Allow in-app toggle (Tools menu) without restarting or losing chat state.
- Keep theming logic centralized to avoid style drift across chat subviews.
- Preserve streaming UX readability (deltas, status) in both themes.

## Non-Goals
- Global theming of all app windows (scope is Wib&Wob chat UI).
- Custom user-defined themes beyond light/dark.
- Changes to Claude/LLM behavior.

## Users
- Primary: Operators of Wib&Wob TUI who prefer light or dark presentations.
- Secondary: Demos and reviewers switching quickly during sessions.

## Requirements
1) Two presets: `Light` (existing) and `Dark` (high contrast, low glare).  
2) Live toggle: change theme while chat is open; no restart.  
3) DRY theme model: single struct for colors/attributes; avoid duplicated style code.  
4) Apply uniformly to chat components: message pane, streaming text, input, status/spinner, borders.  
5) Persistence (nice-to-have): remember last-used theme for next launch.  
6) Safe contrasts: ensure readable foreground/background and visible focus/selection.  
7) Menu access: Tools menu entries for Light/Dark (and optional Toggle).  
8) Logging: note theme changes in chat log for diagnostics.  
9) No regression: streaming, input, and window navigation remain functional in both themes.

## UX / Interaction
- Menu: Tools → “Chat: Light Theme”, “Chat: Dark Theme” (optionally “Chat: Toggle Theme”).
- Feedback: on selection, status line updates (“Chat theme: Dark”) and chat repaint.
- State: theme applies only to Wib&Wob chat window(s); other windows unchanged.

## Technical Approach
- Theme model: define `ChatTheme` struct with base colors (bg, text, accent, status ok/error, border, selection) and derived shades (dim/bright) computed via helpers.
- Presets: two constexpr/static `ChatTheme` presets (Light/Dark) defined in one header/source.
- Application: add a `WibWobThemeManager` (or static helpers) to map `ChatTheme` to Turbo Vision `TColorAttr`/palette entries and apply to chat subviews.
- State: store current theme enum in `TWibWobWindow` (or engine) with `setTheme(const ChatTheme&)` that updates subviews and triggers redraw.
- Toggle: menu commands dispatch to `setTheme(lightTheme)` / `setTheme(darkTheme)`; optional toggle flips enum.
- Persistence (optional): stash last theme in config/env; load on window init.
- Logging: on theme change, write to chat log and stderr debug.

## Data / State
- Enum: `ChatThemeId { Light, Dark }`
- Presets: `ChatTheme lightTheme`, `ChatTheme darkTheme`
- Current: stored per chat window; optional persisted default.

## Accessibility & Quality
- Contrast targets: ensure text vs bg ΔL high enough; status/error colors distinct in both themes.
- Selection/focus visible in both themes; avoid invisible cursor in dark mode.
- Streaming legibility: partial deltas remain obvious; keep spinner/status readable.

## Telemetry (minimal)
- Log theme changes (theme id + timestamp) in chat log for debugging.

## Risks & Mitigations
- Risk: Low contrast in certain terminals → choose safe RGB pairs; allow quick switch back.
- Risk: Style drift across views → centralize application in one helper.
- Risk: Palette conflicts with other windows → scope theme to chat only.

## Rollout & Testing
- Manual: switch Light↔Dark while streaming; confirm repaint and readability.
- Smoke: ensure menu commands succeed and no crash in headless runs.
- Regression: verify chat streaming, input, and window navigation unaffected.
