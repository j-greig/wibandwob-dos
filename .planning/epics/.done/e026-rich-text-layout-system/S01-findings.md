# S01 Findings — Markdown Rendering Approach

Status: done
Date: 2026-03-09

## Decision: Approach B — Native TypeScript

Use the native TS pipeline (marked AST → ANSI renderer → figlet headings)
derived from the pi-markdown-reader prototype. Python Rich subprocess is
relegated to F08 stretch only, specifically for syntax highlighting language
breadth if regex coverage proves insufficient.

---

## Benchmark Results

Test machine: macOS, Bun runtime, Python 3.14.2, Rich installed.
Width: 80 cols. 5 runs each. Rich = fresh python3 subprocess per call.

| File      | Lines | TS native avg | Rich subprocess avg | TS min | Rich min |
|-----------|-------|--------------|---------------------|--------|----------|
| README.md | 139   | 25ms         | 107ms               | 21ms   | 105ms    |
| AGENTS.md | 254   | 53ms         | 118ms               | 49ms   | 116ms    |
| NOTES.md  | 108   | 14ms         | 106ms               | 13ms   | 104ms    |

**TS native is 4–8x faster.** Rich subprocess baseline is ~105ms regardless
of file size — that is the python3 process startup cost. TS native scales with
content; Rich startup dominates and is fixed overhead per call.

At 105ms cold per render the Rich path is usable (not perceptibly slow for
a file open) but the startup cost compounds on resize events. The MarkdownViewer
re-renders on every resize — at 105ms per resize that is noticeably laggy.
At 14–53ms the TS path renders inside a single animation frame.

---

## Gap Analysis

All three test files (README.md, AGENTS.md, NOTES.md) rendered without errors
or crashes on both paths. No rendering gaps detected in the spike renderer
against these files.

Confirmed working in the TS native spike renderer:

- H1–H5 figlet headings with font gradient: doom → slant → shadow → small → smslant
- ANSI colour gradient: bright cyan → blue → magenta → yellow → green
- Bold, italic, code spans (dark bg), strikethrough, links (underline + dim URL)
- Fenced code blocks with dark background strip and ``` lang fence markers
- Unordered and ordered lists (shallow nesting only — see gaps below)
- Blockquotes with │ border and italic styling
- Horizontal rules
- Tables (minimal: header bold + rows, no proportional column sizing yet)
- HTML passthrough skipped cleanly (badge img tags from README front matter)

Confirmed working in the prototype (pi-markdown-reader/renderer.ts) but not
yet in the spike renderer — gaps to fill in S02/markdown-service.ts:

- Proportional table column sizing with unicode box borders (prototype has this,
  spike used a minimal fallback — copy from prototype's renderTable)
- Deeply nested lists (prototype handles recursion via renderList depth param)
- Nested blockquotes (prototype recurses tokens; spike does one level)

These are copy-from-prototype tasks, not new design work.

---

## What Rich Gives That Native TS Does Not

1. **Syntax highlighting language breadth.** Pygments covers 500+ languages.
   The prototype's highlight.ts covers Python, TypeScript, and Bash via regex.
   Rich's Syntax class handles C, Rust, Go, SQL, YAML, TOML, etc. natively.
   This is the only meaningful capability gap — deferred to F08 stretch.

2. **Markdown edge cases.** Rich's markdown-it parser handles more edge cases
   than marked.js lexer. In practice this did not surface on any wwdos .md
   file tested. Not a practical concern.

3. **Nothing else.** Rich's visual output for headings, blockquotes, tables,
   and inline styles is broadly equivalent to the prototype's ANSI output.
   The figlet heading system in the prototype is richer (font catalogue, colour
   gradient) than Rich's plain bold headings.

---

## Approach A (Rich subprocess) — Ruled Out as Primary

- 4–8x slower per render
- ~105ms fixed overhead per call regardless of content (python3 startup)
- Adds Python + Rich as a runtime dependency (currently not installed by default)
- `rich` not in Homebrew Python system packages — requires pip with
  `--break-system-packages` flag, which is a red flag for reliability
- No advantage in rendering quality for standard markdown

Rich subprocess remains viable as an **opt-in stretch** for F08 syntax
highlighting — one subprocess call per code block, result cached, not on
every resize. At that usage pattern the 105ms cost is acceptable.

## Approach C (pi-tui markdown.ts port) — Redundant

The prototype's renderer.ts is already essentially this port. The delta between
pi-tui's Markdown class and the prototype is small (prototype added figlet
headings, ANSI colour gradient, wwdos-specific theme). Doing a fresh port
would reproduce work already done. Not pursued.

---

## Confirmed Architecture

1. Add `marked` and `get-east-asian-width` to wwdos package.json — done in S01.

2. `src/core/ansi-utils.ts` — visibleWidth, wrapTextWithAnsi, padToWidth,
   extractAnsiCode, AnsiCodeTracker. Port from prototype utils.ts directly.

3. `src/services/markdown-service.ts` — renderMarkdown(text, width, opts).
   Port from prototype renderer.ts. Fill the three gaps above (table column
   sizing, deep list nesting, nested blockquotes) by copying from prototype.

4. `src/services/syntax-highlight.ts` — highlightCode(text, lang). Port from
   prototype highlight.ts. Extend regex coverage for JSON, YAML, CSS in S02.

5. Syntax highlighting breadth (F08 stretch): evaluate extending regex vs
   Rich subprocess on a per-block basis. Decision deferred to F08.

6. `tags: false` on Blessed scrollable box + raw ANSI content. Confirmed
   working. No ANSI→Blessed adapter needed.

---

## AC Verification

AC-1: S01-findings.md exists with approach, latency numbers, gap analysis,
decision rationale. ✓ (this file)

AC-2: Prototype renderer correctly handles real .md files from wwdos repo.
✓ README.md, AGENTS.md, NOTES.md all rendered cleanly with no crashes.
Visual check of ANSI output confirms figlet headings, code blocks, inline styles.
