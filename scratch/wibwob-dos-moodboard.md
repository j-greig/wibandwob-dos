# WibWob-DOS Architecture Moodboard

> Generated 2026-03-16. View in a terminal at 255x71 or wider for best results.

```
                                                       ┌─ PHILOSOPHY ─────────────────────────────────────┐   ┌──────────────────────────────────────────┐ ┌─ PRINCIPLES ───────────────────────────────────┐
  __      ___ _  __      __   _        ___   ___  ___  │                                                   │  │  ╭─┐     ╭─┐  ╭─┐     ╭─┐       |WWW     │ │                                                 │
  \ \    / (_) |_\ \    / /__| |__ ___|   \ / _ \/ __| │  Symbient = machines augmented with humanness      │ │  │◕│     │◕│  │◕│     │◕│       |        │ │  Radical simplicity                             │
   \ \/\/ /| | '_ \ \/\/ / _ \ '_ \___| |) | (_) \__ \ │  Cyborg   = human augmented by machines            │ │  │ │     │ │  │ │     │ │   _  _|_  __   │ │  Constrained expressiveness                     │               /\_/\
    \_/\_/ |_|_.__/\_/\_/\___/_.__/   |___/ \___/|___/ │                                                   │  │  │ └─────┘ │  │ └─────┘ │  |;|_|;|_|;||  │ │  Legibility over cleverness                     │              ( o.o )
                                                       │  Wib: chaos, art, lateral thinking, disruption     │ │  │    ◡    │  │    ◡    │   \ .    .//   │ │  Host owns complexity                           │               > ^ <
      /\_____/\           /\_____/\                    │  Wob: order, science, rigour, systems thinking     │ │  └─────────┘  └─────────┘    \ .  ://    │ │  Unix influence: small tools, explicit contracts │            /|     |\
     /  o   o  \         /  o   o  \                   │                                                   │  │       │            │          |  :||     │ │  Small + opinionated > infinite + flexible      │            / |     | \
    ( ==  ^  == )       ( ==  ^  == )                  │  The runtime exists in the LIMINAL SPACE           │ │       │         +  │          |. :||     │ │  Constraints create clarity                     │           ~  |     |  ~
     )         (         )         (                   │  between biological + machine intelligence.        │ │       │       .    │          |: :||     │ │                                                 │              |     |
    (           )       (           )                  │                                                   │  │      ╱│╲          ╱│╲         |, :||     │ │  "Every interface is just another               │              |     |
   ( (  ) (  )  )       ( (  ) (  )  )                 │  Legible to humans. Predictable for agents.        │ │     ╱ │ ╲        ╱ │ ╲        |   ||     │ │   client of the runtime."                       │              |     |
  (__(__)_(__)__)       (__(__)_(__)__)                │  Expressive for creators.                          │ │    ╱  │  ╲      ╱  │  ╲       |. :||     │ │                                                 │
     WIB                    WOB                        │                                                   │  └──────────────────────────────────────────┘ └─────────────────────────────────────────────────┘
   chaos                  order                        └───────────────────────────────────────────────────┘
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                                                    ── EQUAL PEER INTERFACES ──
    ___ ___   _ _____                                               ┌─────────┐     ┌─────┐     ┌─────┐     ┌───────┐                       ┌─ MICROAPP LIFECYCLE ──────────────┐        ┌─ SDK ──────────────────────────────────────┐
   / __/ _ \ /_\_   _|                                              │         │     │     │     │     │     │       │                       │                                    │       │                                             │
  | (_| (_) / _ \| |                                                │   TUI   │     │ CLI │     │ API │     │ Agent │                       │  microapp.json  id, menu, tier     │       │  Stable surface, mutable implementation     │
   \___\___/_/ \_\_|                                                │         │     │     │     │     │     │       │                       │       │                            │       │                                             │
                                                                    └────┬────┘     └──┬──┘     └──┬──┘     └───┬───┘                       │       ▼                            │       │  Handle API:                                │
  ┌─────────┐                                                            │             │           │            │                           │  setup(host)                       │       │    create<Component>(parent, opts?)          │
  │         │                                                            │             │           │            │                           │       │                            │       │    { element, update(partial), destroy() }   │
  │   COAT  │                                                            ├─────────────┴───────────┴────────────┘                           │       ▼                            │       │                                             │
  │         │                                                            │                                                                  │  host.createWindow()               │       │  11 components:                             │
  └─────────┘                                                            ▼                                                                  │       │                            │       │    StatusBar  TextViewer  ListPanel          │
       │                                                            ┌─────────┐                                                             │       ├── describeState()  agents   │      │    SplitView  ButtonBar  HeaderBar           │
       │                                                            │         │                                                             │       ├── captureText()    snapshot  │     │    ScrollView Tabs       Rule                │
       ├───────────────┬───────────────┬───────────────┐            │ Runtime │                                                             │       ├── onRestyle()      themes   │      │    InputLine  Canvas                         │
       │               │               │               │            │         │                                                             │       └── onCleanup()      teardown │      │                                             │
       ▼               ▼               ▼               ▼            └─────────┘                                                             │                                    │       │  No blessed. Microapps never touch           │
  ┌─────────┐     ┌─────────┐     ┌────────┐     ┌───────────┐                                                                              └────────────────────────────────────┘       │  the rendering engine directly.              │
  │         │     │         │     │        │     │           │                                                                                                                           │                                             │
  │ Command │     │ Inspect │     │ Window │     │ Workspace │                                                                                                                           └─────────────────────────────────────────────┘
  │         │     │         │     │        │     │           │
  └─────────┘     └─────────┘     └────────┘     └───────────┘

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  ┌─ ARCHITECTURE ─────────────────────────────────────────────────────────────────────────────────────────────────────────┐      ┌─ TIERS ──────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                                                        │      │                                                                                                  │
  │  src/core/           src/ui/            src/sdk/             src/services/         src/windows/         src/cli/        │     │  core     ██████████  menu + palette + API + agent     figlet, journal, terminal, file-mgr, chat  │
  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────────┐   ┌───────────────┐   ┌──────────┐    │       │  beta     ▓▓▓▓▓▓▓▓▓▓  palette + API + agent           plasma, generative, tr808, zine, glitchbox │
  │  │ AppController │   │ layout.ts    │   │ composition    │   │ state-service   │   │ agent-window  │   │ wibwob   │    │      │  internal ░░░░░░░░░░  API only (explicit filter)       layout-probe, heartbeat, hello-world       │
  │  │ CmdCatalog    │   │ chrome.ts    │   │ helpers.ts     │   │ control-api     │   │ file-manager  │   │ open     │    │      │  disabled             not loaded                        (workspace-level override)                 │
  │  │ CmdRegistry   │   │ containers   │   │ microapp-host  │   │ microapp-loader │   │ text-viewer   │   │ help     │    │      │                                                                                                  │
  │  │ WindowFacade  │   │ forms.ts     │   │ runtime-help   │   │ agent-session   │   │ primer-browse │   └──────────┘    │      │  Host decides visibility. Microapp declares capability. Registry assigns tier.                     │
  │  │ WindowManager │   │ feedback.ts  │   │ runtime-client │   │ content-svc     │   │ backrooms     │                   │      └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
  │  │ Themes        │   │ data.ts      │   └────────────────┘   │ figlet-svc      │   │ music-player  │   microapps/      │
  │  │ SafeFs        │   │ patterns.ts  │                        │ workspace-svc   │   │ chrome-browse │   40+ apps        │          /\_____/\           /\_____/\
  │  │ Overlays      │   └──────────────┘                        └─────────────────┘   └───────────────┘                   │         /  o   o  \         /  o   o  \
  │  └──────────────┘                                                                                                      │        ( ==  ^  == )       ( ==  ^  == )
  │                                                                                                                        │         )         (         )         (
  └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘    (           )       (           )
                                                                                                                                   ( (  ) (  )  )       ( (  ) (  )  )
                                                                                                                                  (__(__)_(__)__)       (__(__)_(__)__)
                                                                                                                                     WIB                    WOB
                                                                                                                                   chaos                  order
                                                                                                                                    folk                   punk

  ╔═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
  ║                                                                                                                                                                                                                                               ║
  ║   NORTH STAR:  Create a small, stable host for composable terminal microapps. The runtime remains small; complexity emerges from composition, not API growth.                                                                                  ║
  ║                                                                                                                                                                                                                                               ║
  ╚═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```
