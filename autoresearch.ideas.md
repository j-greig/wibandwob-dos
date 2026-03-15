# Autoresearch Ideas — Journal v2

## Architecture
- Each entry is a JSON file in `scratch/journal-v2/entries/<id>.json`
- Index file `scratch/journal-v2/index.json` for fast list loading
- Modes: LIST, READ, EDIT, NEW — single state machine
- Two-pane at ≥120 cols, single-pane push/pop at narrow

## MVP Must-Haves
- blessed.list for entry list (selectable, scrollable)
- blessed.box for entry body (read mode)
- blessed.textarea for edit mode (multi-line)
- Mode transitions: LIST→READ→EDIT, LIST→NEW→LIST

## UX Ideas
- Vim-like: j/k nav in list, Enter to open, Esc to go back, e to edit, n for new
- Status bar shows mode + key hints (context-aware like v1)
- Preview pane shows first ~5 lines of selected entry
- Ctrl-S to save in edit mode (blessed textarea submit)

## Agent Integration Ideas  
- journal.create returns { ok, entry } with id
- journal.read returns full entry by id
- journal.update patches title/body/tags
- journal.list returns summaries with filters
- describeState shows: mode, selectedEntry, entryCount, searchQuery

## Visual Carries from v1
- Figlet JRNL header (slant/small responsive)
- Kind icons: ◊ observation, ░ note, ★ discovery, ■ decision, ? question  
- Peer glyphs: ▸ human, ▹ agent, · system
- Mood indicator in tagline
- Theme tokens only, muted timestamps

## Deferred
- Markdown-lite rendering (##, **, `, -, code blocks)
- Entry templates
- Tag autocomplete
- Entry history / undo
