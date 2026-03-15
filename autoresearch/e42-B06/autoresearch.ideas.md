# E042-B06 Next Frontier — Ideas

_Seed ideas for the agent to evaluate after auditing B01–B05. Add more during the loop._

## Architecture
- God file decomposition that B01 didn't cover (app-controller, ui-parts, browser-windows)
- Lazy loading / dynamic import() for window factories and engines
- Discriminated unions for WindowRecord by kind
- Branded types for WindowId, CommandId, ModuleId

## DRY
- Duplicate patterns across microapps (common setup boilerplate)
- Config/constants scattered vs centralised
- Theme token usage consistency

## SDK
- Missing SDK exports that microapps still bypass for
- Blessed edge-case helpers not yet in SDK (tag-aware wrap, focus trap, resize)
- TypeScript type precision — eliminate remaining `as any` in src/core/

## Documentation
- Stale references in .agents/ specs
- .planning/ status fields vs reality
- AGENTS.md accuracy audit (scripts, commands, file paths)
- docs/ completeness — are SDK docs matching actual exports?
- Orphaned docs that reference deleted code

## Developer Experience
- Onboarding friction for new microapp authors
- Error messages that don't help diagnose problems
- Script discoverability and documentation
- Keyboard shortcut conflicts across windows

## Hygiene
- Dead TODOs in source code
- Orphaned config files
- .gitignore completeness
- Logging signal vs noise ratio
