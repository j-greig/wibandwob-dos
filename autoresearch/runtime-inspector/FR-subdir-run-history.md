# Idea: run management commands on top of workingDir

Dave already shipped `workingDir` in `autoresearch.config.json` (5f154eb) which
redirects all file I/O, command execution and git to a subdirectory. That's the
hard part done. What's missing is the UX layer on top — commands to switch
between runs without hand-editing the config file.

## What workingDir gives you today

```json
// autoresearch.config.json (manual edit)
{ "workingDir": "autoresearch/shader-music" }
```

```
project/
  autoresearch.config.json
  autoresearch/
  ├── shader-music/       ◄ workingDir points here
  │   ├── autoresearch.jsonl
  │   ├── autoresearch.md
  │   └── autoresearch.sh
  └── typecheck-v2/       exists but you have to edit json to switch
```

Works great. But switching means opening the config, changing the path,
and hoping you spelled it right.

## What I hacked in on top

```
/autoresearch use shader-music    rewrites workingDir, reconstructs state
/autoresearch use typecheck-v2    switch again, one command
/autoresearch list                scan autoresearch/ for runs:

    shader-music
  ▸ typecheck-v2 (active)
    runtime-inspector

/autoresearch archive old-stuff   move root-level files → subdir
/autoresearch clear               remove workingDir, disconnect, widget hides
```

```
  ┌─────────────────────────────────────────────┐
  │  /autoresearch use <name>                   │
  │                                             │
  │  1. writes workingDir to config.json        │
  │  2. mkdir -p autoresearch/<name>/           │
  │  3. reconstructState() from .jsonl          │
  │  4. widget shows correct scores             │
  │                                             │
  │  /autoresearch list                         │
  │                                             │
  │  scans autoresearch/ for dirs with .jsonl   │
  │  marks active run with ▸                    │
  │                                             │
  │  /autoresearch archive <name>               │
  │                                             │
  │  mv autoresearch.* → autoresearch/<name>/   │
  │  updates workingDir to match                │
  │                                             │
  │  /autoresearch clear                        │
  │                                             │
  │  deletes workingDir from config             │
  │  hides widget, resets state                 │
  └─────────────────────────────────────────────┘
```

## Why bother

When you're running autoresearch across multiple targets you end up with
a lot of runs. I've got 40+ in one project:

```
  autoresearch/
  ├── shader-music/          29 experiments, score 90.2
  ├── typecheck-v2/          14 experiments
  ├── plumb/                  8 experiments
  ├── wibmux/                12 experiments
  ├── runtime-inspector/     22 experiments, score 10.0
  └── ...
```

Being able to `list` them, `use` to jump between them, and `archive` old
root-level files into the tree makes the whole thing feel like a proper
experiment manager rather than "edit a json file and hope".

## Implementation

~60 lines on top of the existing workingDir infra:

```
  listRuns(cwd)     scan autoresearch/ for dirs containing .jsonl
  + 4 handlers in the /autoresearch command:
    list             listRuns() + mark active
    use <name>       writeConfig({ workingDir: "autoresearch/<name>" })
    archive <name>   mv files, writeConfig()  
    clear            delete workingDir from config, reset state
```

All use the existing `readConfig`/`writeConfig`/`reconstructState` that
workingDir already introduced. No new infrastructure.

## Bug fix also bundled

```
  /autoresearch off → widget stayed visible
  fix: call updateWidget() which now checks autoresearchMode flag
```

Happy to PR this if useful. The local mod is battle-tested across 40+ runs.
