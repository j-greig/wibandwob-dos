# Runtime Inspector Microapp — Spec v0.1

## Purpose

A built-in microapp for inspecting and operating the host runtime from inside the runtime itself.

It acts as:
- architecture probe
- debugging console
- operator cockpit
- agent support tool
- proof that the runtime model is coherent

It should validate that the platform has a real shared semantic runtime rather than only UI-specific flows.

## Strategic Role

This should be the first serious proof microapp after the initial refactor pass.

Why:
- it forces the command layer to become explicit
- it forces runtime state to become inspectable
- it forces window and microapp concepts to become real domain objects
- it tests parity across TUI, CLI, and API
- it creates a debugging surface for humans and agents

## Core Idea

The microapp exposes the runtime to itself through simple, canonical surfaces.

The microapp does not reach into arbitrary internals.
It uses stable runtime inspection APIs and shared semantic commands.

This makes it both:
- a useful tool
- a test of platform quality

## Primary Views

### 1. Commands

Shows all registered commands.

Per command:
- id
- title
- source microapp or system area
- arguments schema summary
- availability / enabled state
- last run timestamp

Actions:
- search commands
- inspect command
- execute command
- view recent command history

### 2. Windows

Shows the current window tree / panel structure.

Per window:
- id
- title
- owning microapp
- focus state
- visibility
- bounds / layout metadata
- parent / child relationship

Actions:
- focus window
- close window
- inspect window
- jump to owning microapp

### 3. Microapps

Shows loaded microapps.

Per microapp:
- id
- name
- version
- status
- capabilities
- open windows count
- commands contributed

Actions:
- inspect manifest
- activate
- deactivate
- restart
- open primary window

### 4. Events

Shows recent runtime events.

Per event:
- timestamp
- type
- source
- target
- payload summary

Actions:
- filter by source
- filter by type
- pause stream
- inspect event payload

### 5. State

Shows inspectable runtime state.

Examples:
- focused window id
- active microapp ids
- current layout mode
- command queue stats
- event bus stats
- render tick info

Actions:
- inspect domain object
- expand structured state view
- copy state snapshot

### 6. Logs

Shows runtime logs and diagnostics.

Per item:
- level
- timestamp
- source
- message

Actions:
- filter
- search
- tail / pause
- export current view

## Layout Proposal

Default layout:
- left column: section list
- main pane: table / list for selected section
- right pane or lower pane: detail inspector
- footer: actions / key hints / command entry

Alternative layout:
- top tabs
- middle content area
- bottom detail / log strip

The initial version should prefer clarity over density.

## Command Surface

The Runtime Inspector should itself register commands.

Examples:
- inspector.open
- inspector.focusSection
- inspector.runCommand
- inspector.inspectWindow
- inspector.inspectMicroapp
- inspector.toggleEventStream
- inspector.exportSnapshot

This makes the microapp operable from:
- TUI
- CLI
- API
- other microapps

## Required Runtime APIs

The microapp needs a stable read-oriented inspection surface.

Suggested APIs:
- listCommands()
- getCommand(id)
- runCommand(id, args)
- listWindows()
- getWindow(id)
- focusWindow(id)
- listMicroapps()
- getMicroapp(id)
- restartMicroapp(id)
- listRecentEvents(filter)
- getRuntimeSnapshot()
- listLogs(filter)

These should be explicitly designed as public or beta runtime-inspection APIs.

## SDK Needs

Minimum SDK support needed:
- table/list primitive
- text/detail view primitive
- command registration
- event subscription
- simple filter input
- scrollable log view
- optional split-pane layout primitive

## MVP Scope

Version 0.1 should include only:
- Commands view
- Windows view
- Microapps view
- simple State summary
- execute command action
- focus window action

Do not include:
- arbitrary mutation of runtime internals
- scripting engine
- deep config editing
- unsafe raw object access

## Design Constraints

The microapp must model the platform's philosophy.

It should be:
- minimal
- inspectable
- composable
- low ceremony
- declarative where possible

Avoid:
- giant bespoke widget logic
- hidden state
- special-case privileged access without clear API

## Why This Microapp Matters

This microapp is a forcing function.

If it is hard to build, that is a signal that:
- the command layer is unclear
- runtime state is not coherent
- window objects are not real enough
- microapp lifecycle is not explicit enough
- inspection APIs are missing

That feedback is valuable.

## Success Criteria

The Runtime Inspector is successful when:
- a human can understand the runtime from inside the host
- an agent can use it to navigate and debug the system
- commands, windows, and microapps are first-class objects
- the microapp uses stable platform APIs rather than private hacks
- it becomes a practical daily tool for development

## Long-Term Extensions

Possible later additions:
- event graph view
- command provenance view
- capability inspector
- runtime diff snapshots
- interface parity dashboard
- diagnostics timeline
- safe REPL / query console

## North Star

A self-describing microapp that allows the host runtime to become visible, inspectable, and operable from within itself using the same stable semantic surfaces available to other peer interfaces.

