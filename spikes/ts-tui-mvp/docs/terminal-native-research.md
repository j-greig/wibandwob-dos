# Fastest Path to a TypeScript Desktop-Style TUI MVP

This note captures research findings for the terminal-native TypeScript spike in `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp`.

It is intended to guide future Codex and Claude agents working on the spike.

## Framing

The spike goal maps more closely to a terminal window manager than to a typical React CLI app.

Core behaviors we care about:
- fullscreen ownership
- top menu bar and bottom status line
- desktop background
- overlapping floating windows
- focus and z-order
- drag and resize
- viewer/editor panes
- an honest terminal strategy

That means the best stack is the one that handles absolute positioning, overlap, and pointer or keyboard-driven window management well. It is not the same stack you would choose for a normal CLI tool UI.

## Success Criteria

The spike is successful if it proves:
- terminal-native rendering is viable
- desktop-like window behavior feels convincing enough
- file viewing and text editing are usable
- shell integration works without pretending full VT emulation is solved

The spike is not trying to:
- port all of Turbo Vision
- clone every WibWob-DOS feature
- build a terminal emulator from scratch

## Practical Constraints

Mouse-driven drag and resize depend heavily on the host terminal emulator.

Implications:
- keyboard fallbacks matter
- terminal-native UX should not depend on perfect drag-motion support everywhere
- macOS testing should assume a terminal that supports mouse events well

## Ranked Stack Choices

### 1. `@farjs/blessed` plus a custom window-manager layer

Best fit for the current direction.

Why:
- absolute positioning aligns with floating windows
- z-order can be handled by child ordering
- borders, shadows, scrollbars, and frame-like widgets already exist
- closest path from the current blessed spike

Why the maintained fork matters:
- upstream `blessed` is old
- `@farjs/blessed` is actively maintained
- TypeScript support is better

What still has to be built by us:
- window focus policy
- bring-to-front behavior
- titlebar drag
- resize handles and keyboard resize
- clamping and layout rules

Recommendation:
- if we keep pushing the terminal-native spike, this is the most credible long-term renderer choice

### 2. `terminal-kit` as a possible pivot

Strong alternative if we are willing to rewrite the shell layer.

Why it is interesting:
- document model supports overlap and focus
- ScreenBuffer composition maps well to desktop-like rendering
- explicit mouse and drag support exists
- more serious text editing and widget behavior than classic blessed

Why it is not the default pick:
- it is a different kernel, not a drop-in
- switching would reset some current spike work

Recommendation:
- only pivot here if blessed continues to fight the window-manager use case

### 3. `reblessed`

Possible fallback if we want “blessed, but less dead.”

Why:
- more alive than old upstream blessed
- still conceptually the same model

Why it is secondary:
- less compelling than `@farjs/blessed`
- still requires the same custom WM layer

### 4. Ink

Not a fit for this project shape.

Why:
- good for React CLI trees
- weak fit for absolute positioning and overlapping windows
- not the right primitive for a desktop-like TUI shell

Recommendation:
- do not use Ink as the core renderer for this spike

## Open-Source Repos Worth Studying

### `farjs/farjs` and `farjs/blessed`

Useful because:
- real maintained terminal application
- strong signal that a modern blessed-lineage app can still work on macOS
- relevant for TypeScript integration and terminal app structure

### `cronvel/terminal-kit`

Useful because:
- overlap, focus, and composition are treated more explicitly
- good reference if we need better editor or widget behavior

### `slap-editor/slap` and `slap-editor/editor-widget`

Useful because:
- blessed-based editor code already exists
- direct inspiration if we want to stop hand-rolling editor behavior

Caveat:
- these look more like borrow-and-vendor references than dependencies to trust blindly

### `rse/blessed-xterm`

Useful because:
- most direct reference for embedding a more real terminal inside a blessed UI
- specifically tries to bridge blessed with `xterm.js` and PTY behavior

Caveat:
- this is only relevant if we seriously push the embedded-terminal path

### `xterm.js` plus PTY backend

Useful because:
- this is the real answer to terminal emulation
- PTY alone is not enough
- any serious “run TUI apps in a pane” plan eventually becomes PTY + terminal emulator

## Recommended Architecture for This Spike

### Shell

Keep:
- one full-screen screen owner
- fixed top menu bar
- fixed bottom status line
- desktop container between them

### Window Manager

Keep all floating windows as siblings under the desktop container.

Track:
- `windows[]` in back-to-front order
- `activeWindowId`
- drag state
- resize state

Policy:
- click focuses and brings to front
- titlebar starts drag
- edges or grip start resize
- keyboard fallbacks exist for move and resize

### Viewer

Use a scrollable text view.

Good enough for now:
- read-only content
- page and line navigation
- eventually search

### Editor

Short term:
- keep the custom editor small and predictable
- harden cursor movement, scrolling, save/load

Possible acceleration:
- evaluate vendoring a blessed-based editor widget if we need to jump in capability quickly

### Terminal

Two honest modes:

1. Shell pane
- interactive command runner
- good enough for shell commands and logs

2. Real embedded terminal
- requires PTY plus real terminal emulation
- much harder

Current guidance:
- do not call the shell pane a solved terminal emulator

## Terminal Strategy

### What is easy

- launch shell-like processes
- stream command output
- keep a session alive
- route input lines into the process

### What is medium complexity

- resize propagation
- focus and keyboard routing
- scrollback management
- prompt cleanliness and control-sequence filtering

### What is a trap

- writing a VT emulator ourselves
- pretending PTY output logging is equivalent to terminal emulation
- treating blessed’s old terminal widget path as a serious long-term foundation

### Fastest sane route to a real embedded terminal

If we ever need real TUIs in a pane:
- use a PTY backend
- pair it with a real emulator
- prefer adapting an existing bridge over inventing our own

If that becomes too expensive:
- support a full-screen handoff mode instead of sub-window emulation

## Editor Strategy

Keep the custom editor for now if:
- the goal is just file editing inside the MVP
- we only need insertion, deletion, cursor movement, scrolling, and save/load

Revisit reuse if:
- selection, undo/redo, or richer text semantics become a bottleneck

## Mouse and Window Management Strategy

Core rules:
- explicit drag state is better than relying on magic widget dragging
- z-order should be owned by our `windows[]` state
- resize handles should be explicit
- clamping should keep windows reachable

Also:
- keyboard fallbacks should exist because mouse behavior varies by terminal

## Risk Table

### Easy now

- shell chrome
- file viewers
- menus
- z-order bookkeeping

### Medium complexity

- robust drag and resize
- stable editor behavior
- shell pane ergonomics

### Probably a trap

- full Turbo Vision reimplementation
- homegrown terminal emulation
- framework pivots without a clear product win

## Three-Slice Plan

### Slice 1: Stabilize window manager behavior

Do:
- stronger focus rules
- explicit bring-to-front policy
- drag polish
- resize handles
- keyboard move/resize fallback

### Slice 2: Make viewer and editor solid

Do:
- reliable file open/save
- smoother scrolling
- larger-file sanity
- better editor cursor and scroll behavior

### Slice 3: Make terminal strategy honest

Do:
- keep shell pane reliable
- improve resize and keyboard focus
- only escalate to a real emulator if there is a clear reason

## Ten More Windows and Features to Flesh Out the Spike

These are derived from the repo canon in `/Users/james/Repos/wibandwob-dos/CLAUDE.md` and `/Users/james/Repos/wibandwob-dos/README.md`.

They are intentionally chosen as the smallest terminal-native slices that still reflect the real WibWob-DOS shape:
- concurrent windows
- content browsing
- generative art
- browser-like reading
- chat/symbient presence
- layouts
- workspace persistence

### 1. Primer Gallery Window

What it is:
- a browsable list of primer files with a preview pane

Why it matters:
- the real app treats primers and modules as first-class content
- a gallery window is more WibWob-like than a raw file prompt

MVP behavior:
- left pane list of primers from `modules/` and `modules-private/`
- right pane preview of the selected primer
- `Enter` opens the primer as its own window

### 2. Browser Reader Window

What it is:
- a plain text or markdown reader for local docs and optionally fetched web content later

Why it matters:
- the real app has a text-native browser
- this proves longer-form reading, link-style navigation, and scroll behavior

MVP behavior:
- open markdown or text files
- jump between headings or sections
- later add a simple URL fetch mode

### 3. Figlet Banner Window

What it is:
- a dedicated text-to-banner window

Why it matters:
- the real app has figlet-oriented output and text-native spectacle
- it is a cheap way to make the spike feel more like WibWob and less like a generic editor demo

MVP behavior:
- type text into a prompt
- render it in a framed output window
- allow multiple banner windows at once

### 4. Pattern or Wallpaper Window

What it is:
- a view dedicated to gradients, fill patterns, or animated wallpaper textures

Why it matters:
- the real app leans hard on desktop atmosphere
- this helps the spike move beyond plain blue fill

MVP behavior:
- choose among a few pattern modes
- run as either a normal window or desktop background mode later

### 5. Orbit or Cube Window

What it is:
- a more intentionally “WibWob” generative animation than the current texture shimmer

Why it matters:
- the real app features torus, cube, orbit, and other generators
- a named art engine window makes the spike feel like a real subsystem, not just a screen saver

MVP behavior:
- one animation mode per window
- keyboard toggle for speed or palette

### 6. Glitch FX Window

What it is:
- a view that applies distortion or corruption effects to source text or ASCII art

Why it matters:
- glitch is a major part of the WibWob aesthetic
- it exercises text transforms and redraw behavior

MVP behavior:
- load text from a file or primer
- apply scatter, bleed, shift, or corruption modes
- duplicate result into a new viewer window

### 7. Chat Transcript Window

What it is:
- a local fake or semi-real chat panel representing Wib and Wob presence

Why it matters:
- the repo framing is symbient-first, not utility-first
- the spike needs at least one conversational window type to feel aligned with the product

MVP behavior:
- split transcript and input
- allow local stub responses or scripted persona replies
- later wire to actual model calls only if the shell feels good

### 8. Scramble or Companion Window

What it is:
- a small mascot or “side companion” window separate from the main chat

Why it matters:
- the canon explicitly includes Scramble as a distinct entity/window shape
- this lets the spike test tiny anchored windows, status bubbles, and alternate layout styles

MVP behavior:
- compact cat or companion window
- can be toggled between tiny and expanded modes
- emits small text/status reactions

### 9. Workspace Manager Window

What it is:
- a save/load workspace dialog or manager panel

Why it matters:
- the real app supports saving and restoring desktop state
- without workspace persistence, the desktop metaphor stays shallow

MVP behavior:
- save open windows, titles, kinds, positions, sizes, and file paths to JSON
- reload that JSON into the current shell

### 10. Command Palette or Tools Window

What it is:
- a searchable command launcher

Why it matters:
- the real app has a large command surface and registry mindset
- a command palette is a cheap way to grow capability without stuffing everything into menus

MVP behavior:
- type to filter actions
- open windows, run layouts, launch art views, trigger save/load

## Suggested Order for the Next Ten

Not all ten should be built immediately.

Best next order:
1. Primer Gallery Window
2. Workspace Manager Window
3. Browser Reader Window
4. Figlet Banner Window
5. Orbit or Cube Window
6. Chat Transcript Window
7. Command Palette or Tools Window
8. Glitch FX Window
9. Scramble or Companion Window
10. Pattern or Wallpaper Window

This order keeps the spike honest:
- first deepen desktop/content behavior
- then add more distinctive WibWob character
- then add niche polish windows

## Recommended Shortlist for the Actual Spike Plan

If we only choose four from the ten right now, choose:
1. Primer Gallery Window
2. Workspace Manager Window
3. Browser Reader Window
4. Figlet Banner Window

These four would make the spike feel much closer to the repo’s real identity without forcing an early AI or terminal-emulation rabbit hole.

## Scope Drops

Do not spend spike time on:
- full Turbo Vision porting
- fake claims about terminal emulation
- Ink as the core renderer
- large architectural abstraction layers before the shell feels right

## Working Recommendation

For the current terminal-native spike:
- stay on the blessed-style path
- prefer a maintained fork when we are ready
- keep building a small custom window manager
- keep the editor simple
- treat terminal emulation as a separate class of problem from PTY spawning
