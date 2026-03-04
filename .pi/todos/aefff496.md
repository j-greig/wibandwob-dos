{
  "id": "aefff496",
  "title": "Fix figlet window sizing — width should match text not full desktop",
  "tags": [
    "vj-timeline",
    "bug"
  ],
  "status": "open",
  "created_at": "2026-03-04T13:56:28.152Z"
}

Figlet banners open at full desktop width regardless of text length.
"DROP" gets a 169-wide window. This blocks everything behind it.

The figlet.open command (or the runner) should size the window to fit
the rendered text width + chrome, not full desktop width.

Options:
- Fix in the runner: after opening a figlet, measure it and resize
- Fix in figlet.open command: accept w/h params or auto-size
- Fix in the layout system: layout tokens for figlet should respect content width

This is one of the biggest visual problems in the Berlin show.
