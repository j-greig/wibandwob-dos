# WibWob-DOS Modules

Modules are content packs, prompts, views, or tools that extend WibWob-DOS.

## Directory Structure

```
modules/              # Public modules (shipped with repo or community-contributed)
modules-private/      # Private modules (gitignored, never published)
```

Both directories are scanned at startup. Private modules take priority over public ones with the same filename.

## module.json

Every module needs a `module.json` manifest:

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "description": "What this module provides",
  "type": "content",
  "provides": {
    "primers": "primers/*.txt"
  }
}
```

### Module Types

| Type | Purpose | Location |
|---|---|---|
| `content` | Primers, ASCII art packs, text assets | `primers/*.txt` |
| `prompt` | System prompts, personality files | `*.prompt.md` |
| `view` | New TView subclass (C++ source) | `*.cpp`, `*.h` |
| `tool` | MCP tool extension (Python) | `*.py` |

## Creating a Primer Module

1. Create a directory under `modules/` (public) or `modules-private/` (private):
   ```
   modules/my-art-pack/
   ├── module.json
   └── primers/
       ├── cool-thing.txt
       └── another-thing.txt
   ```

2. Write `module.json`:
   ```json
   {
     "name": "my-art-pack",
     "version": "1.0.0",
     "description": "Cool ASCII art",
     "type": "content",
     "provides": {
       "primers": "primers/*.txt"
     }
   }
   ```

3. Add `.txt` files to `primers/`. Each file becomes a loadable primer in the TUI.

### Primer Format

Plain text files. Optional animation support with frame delimiters:

```
FPS=8
----
Frame 1 content here
----
Frame 2 content here
----
```

Without `----` delimiters, the file is displayed as static text.

## Creating a Prompt Module

```
modules-private/my-prompts/
├── module.json
└── my-personality.prompt.md
```

The app searches for `wibandwob.prompt.md` in module directories. To override the default personality, place your version in a private module.

## Examples

See `modules/example-primers/` for a working primer module with 5 demo files.
