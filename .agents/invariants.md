# Invariants, Anti-Patterns & Integration Rules

> Deeper failure-mode coverage per subsystem in `.agents/specs/` —
> window-system.md · state-and-api.md · workspace.md · agent-session.md


WibWob-DOS is designed for equal human/agent control. The invariants below exist to enforce that — if an agent cannot reach a surface, discover a command, or read meaningful state, that is a bug not a limitation.

## Architecture Invariants

These rules are strict. Treat violations as bugs, not style nits.

1. **Single source of truth per concern.**
   If a concept already has a home, extend that home. Do not create a second helper/service/path for the same concern because it is locally convenient.

2. **Measurement is content-only.**
   Content measurement returns content dimensions and content semantics. Border, titlebar, padding, toolbar, and shadow are chrome, not content.

3. **Chrome is declarative.**
   Window size math belongs in `window-chrome.ts`. No inline `+2`, `+3`, `+6`, or copied size formulas in window code.

4. **Desktop geometry is canonical.**
   Screen width/height/cellAspect come from `DesktopGeometryService`. Do not invent local geometry math unless the result is immediately derived from canonical geometry.

5. **Window state is self-describing.**
   Every window type must expose semantic metadata through `describeState()`. If an agent needs a property, add it to the window metadata contract rather than teaching the agent to scrape UI text.

6. **One reusable interaction component before many prompts.**
   Repeated picker/open/select flows belong in `OverlayManager` or a dedicated shared component. Do not add one-off textbox prompts for file/font/workspace/content selection when a shared browser can do it.

7. **Layout is an engine, not scattered commands.**
   New placement logic should move toward shared layout primitives, not bespoke coordinate code per feature.

8. **User-visible commands should be defined once.**
   Menu and palette entries should derive from `command-catalog.ts`. Use explicit `order` values with gaps (`0, 10, 20...`) so commands can be inserted later without renumbering. `category` decides the menu bucket.

9. **Services own logic, windows own wiring.**
   Services discover, measure, persist, resolve, and transform data. Window factories render widgets, bind keys/mouse, manage focus/cleanup, and expose state.

9a. **Blessed composition should stay modular.**
   Reuse established window interaction patterns when they fit, instead of inventing a second chat/input model.

10. **No duplicate fallbacks unless centrally owned.**
    If a fallback mode exists, it must be declared in the owning service. Do not embed secondary fallback logic inside window code and service code at the same time.

11. **Experimental integrations must stay behind one seam.**
    If we try a foreign runtime or agent stack, wrap it in a single service boundary first. Do not leak vendor-specific assumptions across the app.

12. **User-visible surfaces must be API-visible.**
    If a window, app, button, command, mode, or state matters to a user, it must have a typed representation in desktop state and a control path in `control-api.ts`. Window-local actions count too — if a window has a primary action (send, restart, run, save, open), expose a control path rather than requiring UI scraping. `describeState()` and the control API should evolve together.

13. **Every themed widget must be restyleable.**
    Any blessed node created with a theme colour must be reachable from `restyleAll()` or `onRestyle()` — either stored on `WindowRecord` (chrome) or captured in the restyle closure (microapp). Unregistered nodes keep the colour of whatever theme was active on open and bleed into every subsequent theme. Verify by switching theme with the window open.

14. **Reorg passes do not add product surface area.**
    When the active goal is architecture cleanup, do not add new window types or scattered UI entry points unless the user explicitly asks. Prefer extracting, consolidating, and normalizing existing behaviour first.

## Anti-Patterns

Do not introduce these:

- parallel measurement functions for different callers
- per-window copies of generic sizing logic
- state fields that duplicate the same fact under different names
- direct widget scraping when semantic state can be exposed
- vendor code referenced directly from many app files
- giant controller growth when a window family or service can be extracted cleanly
- "just this once" prompt flows that should be shared components
- hardcoded geometry magic numbers without named ownership

## Pi Session Bridge

The in-app Wib&Wob Agent can communicate with external pi sessions (`wibwob1`, `wibwob2`) running on the same machine.

Three agent tools:
- `list_sessions` — discover all live sessions by name and socket id
- `send_to_session` — deliver a message to a named session
- `get_session_message` — read the last response from a session

Routing: `sessionName` (e.g. `wibwob1`) is sufficient. `--session-control` is only required on the sending side. The receiver needs no extra flag.

Current topology: external pi sessions create Unix sockets at `~/.pi/session-control/<id>.sock` and speak JSON-RPC. The in-app agent bridge (`pi-session-bridge.ts`) is currently a CLIENT only — it can send to pi sessions but does not appear in `list_sessions` itself.

To make wibwob-dos a first-class peer:
- spin up a socket SERVER in `pi-session-bridge.ts`
- register the socket under `~/.pi/session-control/<id>.sock`
- implement four RPC methods: `send`, `get_message`, `get_summary`, `clear`

## Pi Integration Rule

`pi-coding-agent` is used as an engine inside the app (native Wib&Wob Agent).

Safe rule:
- if we embed pi, wrap it behind one service — `wibwob-agent-session.ts`
- our app still owns window chrome, workspace restore, desktop state, z-order/resize/drag, and typed metadata for agent-visible state
- if terminal-hosted pi work ever returns, treat it as an experiment, not the architectural foundation
