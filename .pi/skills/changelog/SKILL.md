---
name: changelog
description: >
  Maintain a CHANGELOG.md that follows the Keep a Changelog 1.1.0 convention.
  Use when: adding a changelog entry, releasing a version, creating a CHANGELOG.md
  from scratch, updating the changelog after a commit, bumping a version, writing
  release notes, or when the user says "update the changelog", "add to changelog",
  "what changed", "log this release", "keep a changelog", or "write release notes".
---

# Changelog Skill

Maintain `CHANGELOG.md` following [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

Read [README.md](README.md) for the full rationale and FAQ.

## Golden Rules

1. **For humans, not machines.** No git log dumps. Curate.
2. **One entry per version.** No missing releases.
3. **Latest version first.**
4. **Date format: `YYYY-MM-DD`** (ISO 8601, unambiguous).
5. **Keep an `[Unreleased]` section** at the top for changes not yet in a release.
6. **Group by type** within each version (see below).

## Change Types (in this order)

```
### Added      — new features
### Changed    — changes in existing functionality
### Deprecated — soon-to-be removed features
### Removed    — now removed features
### Fixed      — bug fixes
### Security   — vulnerability patches
```

Omit sections with no entries. Only include what's notable to users/contributors.

## File Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ...

## [1.2.0] - 2025-06-01

### Added
- Short human-readable description of the feature

### Fixed
- Description of the fix

## [1.1.0] - 2025-03-15

...

[Unreleased]: https://github.com/org/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/org/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/org/repo/releases/tag/v1.1.0
```

## How [Unreleased] works

`[Unreleased]` is a **temporary holding pen** at the top of the file.
Every notable change lands here first. On release day, the whole section
gets stamped with a version and date — and a fresh empty `[Unreleased]`
opens above it, ready for the next batch.

```
ship a feature → add one line to [Unreleased]
                         ↓  (repeat until release)
release day → rename [Unreleased] to [X.Y.Z] - YYYY-MM-DD
                         ↓
             add fresh empty [Unreleased] above it
                         ↓
    those lines are now permanently in the versioned changelog
```

The payoff: release day is thirty seconds (rename, version, date) instead of
reconstructing everything from git log. Nothing in `[Unreleased]` is ever
thrown away — it all folds into the next versioned entry.

## Workflow

### Adding unreleased changes
1. Open `CHANGELOG.md`
2. Add a line under `## [Unreleased]` in the correct type section
3. Do this **at commit time**, not on release day — that's what keeps it easy
4. Create `## [Unreleased]` at top if it doesn't exist yet

### Cutting a release
1. Rename `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`
2. Add a fresh empty `## [Unreleased]` above it
3. Add the compare link at the bottom: `[X.Y.Z]: https://...`
4. Update the `[Unreleased]` link to compare from the new tag

### Creating from scratch
1. Write the header block (title + two-line preamble)
2. Add `## [Unreleased]` section
3. Work backwards through git history — one entry per release, curated not dumped
4. Add comparison links footer

## Yanked Releases

```markdown
## [0.3.2] - 2024-11-01 [YANKED]
```

Use `[YANKED]` for versions pulled due to serious bugs or security issues.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Dates look ambiguous | Regional format (01/02/03) | Always use `YYYY-MM-DD` |
| Changelog drifts from reality | Only updating at release | Update `[Unreleased]` at commit time |
| Missing versions | Skipped patch releases | Add them retroactively — rewriting is fine |
| Entry reads like a commit message | Copied from `git log` | Rewrite for users: *what changed for them*, not *what you did* |
| No `[Unreleased]` section | Started without one | Add it — it reduces friction at release time |
