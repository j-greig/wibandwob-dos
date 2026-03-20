# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Changelog (this file) — human-readable, curated, not a git log dump
- `status` as a CLI alias for `health`
- Pi usage audit skill — surfaces stale skills, extensions, and agents ranked by last-seen date

## [0.2.0] - 2026-03-20

Eight new microapps, self-hosting, and a cleaner SDK contract.

### Added

- **Tidepool** — ambient generative display; auto-pauses when idle so it doesn't hog the runtime
- **Poetry Clock** — tells the time as a poem
- **Patchbay** — visual signal routing between windows
- **ANSI Lab** — a scratch space for building and editing ANSI art
- **Terrarium Life** — Conway's Game of Life in a window
- **Forms Playground** — interactive form component explorer
- **Glitchbox** — controlled glitch effects applied to window content
- **E026 Demo** — the canonical microapp development reference, now live and browsable

All eight are accessible from the new **Demos** top-level menu item.

- Figlet microapp: favourite fonts can now be saved and recalled from a dedicated favs view
- `scripts/fx/flamingo-trail-v2.py` — bouncing ASCII art with per-character colour
  gradients, dark-pastel theme support, and configurable canvas/window sizing.
  Controllable via flags; designed to run inside any open notepad window.

**Self-hosting**
- Fly.io: disposable deploy profile and host-aware API bind — `fly deploy` and go
- Render.com: web service scaffold for one-click deploys
- Hosting smoke skill — adapter-agnostic gate tests (CLI, API, screenshot, persistence)
  with an agent runbook; works across Docker, VPS, Fly, and Render

**Agent infrastructure**
- Runtime data root and two-level instance identity — multiple instances can now
  coexist on the same host without fighting over state files
- Hot-reload invalidator and crash recovery bundle for development workflows

### Changed
- SDK method naming and owner boundaries codified — microapp authors have one clear import surface with no ambiguity about what belongs to the host vs the microapp
- Motion callbacks (`tween`, `pingPong`, `sequence`) now isolated with try/catch — a crashing animation can no longer take down its window
- CLI health scan de-duplicates instances by live-probed PID rather than stale discovery cache
- npm package name is now `wibwob-dos`

### Fixed
- Dashboard canvas widths clamped to even cell boundaries — fixes rendering artefacts in drawille/contrib widgets
- Glitchbox controls and button bars fully repaired after SDK handle API migration
- `.npmignore` tightened — local env files and agent project metadata no longer included in published packages

### Removed
- `espennilsen/pi-subagent` extension — pi's built-in subagent tool covers the same ground

[Unreleased]: https://github.com/j-greig/wibandwob-dos/compare/v0.2.0...HEAD
