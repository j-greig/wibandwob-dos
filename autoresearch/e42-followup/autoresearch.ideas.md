# E042 Follow-Up — Ideas

## Blessed Elimination
- Render-engine microapps (plasma, contour, tr808, generative-art) legitimately need blessed
  for canvas-level pixel work. Exempt with `@internal` annotation, don't force Handle API.
- sdk-showcase proves the pattern — use it as the reference for migration
- runtime-inspector migration (done) is the canonical proof
- Consider a lint rule / COAT check: "microapp imports blessed → warning"

## App-Controller Decomposition
- Extract window openers first (most lines, clearest seam)
- Global keybindings are second (well-defined block)
- Menu builder third (data-driven, could become declarative)
- Workspace restore is tightly coupled — extract carefully
- Theme application could be a service method

## Type Safety
- control-api.ts has most `as any` — Hono request/response types
- chrome-browser-service.ts — puppeteer types are loose
- blessed widget casts are unavoidable in some cases — use `as blessed.Widgets.BoxElement`
  instead of `as any` where possible

## Plan 9 Plumber
- Start with file-extension routing (simplest useful case)
- Agent tool: `tui_plumb` — send content to best handler
- File-manager "open with" is the first consumer
- URL handling: click URL in chat → plumber → browser window

## Future
- Structured logging (pino-style with [tag] prefix)
- Atomic writes in safe-fs.ts (tmp + rename)
- Event bus redesign (TODO-b1ddb4ff)
