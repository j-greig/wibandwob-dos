#!/usr/bin/env node
/**
 * Generate WibWob-DOS architecture moodboard as ASCII art.
 * Target: 249w x 65h (255x71 minus 3-char chrome on each side)
 */

import { renderMermaidAscii } from "../.pi/extensions/mermaid-renderer/node_modules/beautiful-mermaid/dist/index.js";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const W = 249;
const H = 65;
const canvas = Array.from({ length: H }, () => Array(W).fill(" "));

function stamp(text, startX, startY) {
  const lines = text.split("\n");
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < [...lines[y]].length; x++) {
      const ch = [...lines[y]][x];
      const cx = startX + x;
      const cy = startY + y;
      if (cx >= 0 && cx < W && cy >= 0 && cy < H && ch !== " ") {
        canvas[cy][cx] = ch;
      }
    }
  }
}

function hline(ch, x, y, len) {
  for (let i = 0; i < len; i++) {
    if (x + i < W && y >= 0 && y < H) canvas[y][x + i] = ch;
  }
}

function figlet(text, font = "small") {
  try {
    return execSync(`figlet -f ${font} "${text}"`, { encoding: "utf8" }).trimEnd();
  } catch { return text; }
}

function primer(name) {
  const p = `/Users/james/Repos/wibandwob-dos/modules-private/wibwob-primers/primers/${name}`;
  try { return readFileSync(p, "utf8").trimEnd(); } catch { return ""; }
}

// ── Mermaid diagrams ────────────────────────────────────────

const coatDiagram = renderMermaidAscii(`graph TD
    COAT["COAT"] --> CMD["Command"]
    COAT --> INS["Inspect"]
    COAT --> WIN["Window"]
    COAT --> WKS["Workspace"]
`);

const adapterDiagram = renderMermaidAscii(`graph TD
    TUI["TUI"] --> RT["Runtime"]
    CLI["CLI"] --> RT
    API["API"] --> RT
    AGT["Agent"] --> RT
`);

// ── Figlet ──────────────────────────────────────────────────

const title = figlet("WibWob-DOS");
const coatFig = figlet("COAT");

// ── Primers ─────────────────────────────────────────────────

const folkCats = primer("folk-chaos-order-punk.txt");
const postcard = primer("www-postcard-castle.txt");
const catSimple = primer("cat-cat-simple.txt");

// ── Hand-drawn blocks ───────────────────────────────────────

const philoBlock = [
  "┌─ PHILOSOPHY ─────────────────────────────────────┐",
  "│                                                   │",
  "│  Symbient = machines augmented with humanness      │",
  "│  Cyborg   = human augmented by machines            │",
  "│                                                   │",
  "│  Wib: chaos, art, lateral thinking, disruption     │",
  "│  Wob: order, science, rigour, systems thinking     │",
  "│                                                   │",
  "│  The runtime exists in the LIMINAL SPACE           │",
  "│  between biological + machine intelligence.        │",
  "│                                                   │",
  "│  Legible to humans. Predictable for agents.        │",
  "│  Expressive for creators.                          │",
  "│                                                   │",
  "└───────────────────────────────────────────────────┘",
].join("\n");

const principlesBlock = [
  "┌─ PRINCIPLES ───────────────────────────────────┐",
  "│                                                 │",
  "│  Radical simplicity                             │",
  "│  Constrained expressiveness                     │",
  "│  Legibility over cleverness                     │",
  "│  Host owns complexity                           │",
  "│  Unix influence: small tools, explicit contracts │",
  "│  Small + opinionated > infinite + flexible      │",
  "│  Constraints create clarity                     │",
  "│                                                 │",
  "│  \"Every interface is just another               │",
  "│   client of the runtime.\"                       │",
  "│                                                 │",
  "└─────────────────────────────────────────────────┘",
].join("\n");

const archBlock = [
  "┌─ ARCHITECTURE ─────────────────────────────────────────────────────────────────────────────────────────────────────────┐",
  "│                                                                                                                        │",
  "│  src/core/           src/ui/            src/sdk/             src/services/         src/windows/         src/cli/        │",
  "│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────────┐   ┌───────────────┐   ┌──────────┐    │",
  "│  │ AppController │   │ layout.ts    │   │ composition    │   │ state-service   │   │ agent-window  │   │ wibwob   │    │",
  "│  │ CmdCatalog    │   │ chrome.ts    │   │ helpers.ts     │   │ control-api     │   │ file-manager  │   │ open     │    │",
  "│  │ CmdRegistry   │   │ containers   │   │ microapp-host  │   │ microapp-loader │   │ text-viewer   │   │ help     │    │",
  "│  │ WindowFacade  │   │ forms.ts     │   │ runtime-help   │   │ agent-session   │   │ primer-browse │   └──────────┘    │",
  "│  │ WindowManager │   │ feedback.ts  │   │ runtime-client │   │ content-svc     │   │ backrooms     │                   │",
  "│  │ Themes        │   │ data.ts      │   └────────────────┘   │ figlet-svc      │   │ music-player  │   microapps/      │",
  "│  │ SafeFs        │   │ patterns.ts  │                        │ workspace-svc   │   │ chrome-browse │   40+ apps        │",
  "│  │ Overlays      │   └──────────────┘                        └─────────────────┘   └───────────────┘                   │",
  "│  └──────────────┘                                                                                                      │",
  "│                                                                                                                        │",
  "└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘",
].join("\n");

const tierBlock = [
  "┌─ TIERS ──────────────────────────────────────────────────────────────────────────────────────────┐",
  "│                                                                                                  │",
  "│  core     ██████████  menu + palette + API + agent     figlet, journal, terminal, file-mgr, chat  │",
  "│  beta     ▓▓▓▓▓▓▓▓▓▓  palette + API + agent           plasma, generative, tr808, zine, glitchbox │",
  "│  internal ░░░░░░░░░░  API only (explicit filter)       layout-probe, heartbeat, hello-world       │",
  "│  disabled             not loaded                        (workspace-level override)                 │",
  "│                                                                                                  │",
  "│  Host decides visibility. Microapp declares capability. Registry assigns tier.                     │",
  "└──────────────────────────────────────────────────────────────────────────────────────────────────────┘",
].join("\n");

const sdkBlock = [
  "┌─ SDK ──────────────────────────────────────┐",
  "│                                             │",
  "│  Stable surface, mutable implementation     │",
  "│                                             │",
  "│  Handle API:                                │",
  "│    create<Component>(parent, opts?)          │",
  "│    { element, update(partial), destroy() }   │",
  "│                                             │",
  "│  11 components:                             │",
  "│    StatusBar  TextViewer  ListPanel          │",
  "│    SplitView  ButtonBar  HeaderBar           │",
  "│    ScrollView Tabs       Rule                │",
  "│    InputLine  Canvas                         │",
  "│                                             │",
  "│  No blessed. Microapps never touch           │",
  "│  the rendering engine directly.              │",
  "│                                             │",
  "└─────────────────────────────────────────────┘",
].join("\n");

const lifecycleBlock = [
  "┌─ MICROAPP LIFECYCLE ──────────────┐",
  "│                                    │",
  "│  microapp.json  id, menu, tier     │",
  "│       │                            │",
  "│       ▼                            │",
  "│  setup(host)                       │",
  "│       │                            │",
  "│       ▼                            │",
  "│  host.createWindow()               │",
  "│       │                            │",
  "│       ├── describeState()  agents   │",
  "│       ├── captureText()    snapshot  │",
  "│       ├── onRestyle()      themes   │",
  "│       └── onCleanup()      teardown │",
  "│                                    │",
  "└────────────────────────────────────┘",
].join("\n");

const northStar = [
  "╔═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗",
  "║                                                                                                                                                                                                                                               ║",
  "║   NORTH STAR:  Create a small, stable host for composable terminal microapps. The runtime remains small; complexity emerges from composition, not API growth.                                                                                  ║",
  "║                                                                                                                                                                                                                                               ║",
  "╚═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝",
].join("\n");

// ══════════════════════════════════════════════════════════════
//  COMPOSE
// ══════════════════════════════════════════════════════════════

// ── ROW 1 (y=0-14): Title + Philosophy + Folk cats + Principles ──

stamp(title, 2, 1);
stamp(folkCats, 2, 6);        // Wib & Wob cats under title
stamp(philoBlock, 55, 0);
stamp(postcard, 110, 0);      // Castle postcard
stamp(principlesBlock, 155, 0);
stamp(catSimple, 215, 3);     // Smol cat in corner

// Horizontal divider
hline("═", 0, 15, W);

// ── ROW 2 (y=16-37): COAT + diagrams + SDK + Lifecycle ──

stamp(coatFig, 2, 17);
stamp(coatDiagram, 2, 22);
stamp(adapterDiagram, 68, 17);
stamp(lifecycleBlock, 140, 17);
stamp(sdkBlock, 185, 17);

// Label the adapter diagram
stamp("── EQUAL PEER INTERFACES ──", 68, 16);

// Horizontal divider
hline("═", 0, 38, W);

// ── ROW 3 (y=39-64): Architecture + Tiers + North Star ──

stamp(archBlock, 2, 39);
stamp(tierBlock, 130, 39);
stamp(northStar, 2, 60);

// Accent: repeat folk cats bottom-right
stamp(folkCats, 130, 49);

// ── OUTPUT ──────────────────────────────────────────────────
const output = canvas.map((row) => row.join("").trimEnd()).join("\n");

const lines = output.split("\n");
const maxW = Math.max(...lines.map(l => l.length));
console.error(`Canvas: ${maxW}w x ${lines.length}h (target: ${W}w x ${H}h)`);
if (maxW > W) {
  let overflows = 0;
  lines.forEach((l, i) => { if (l.length > W) { overflows++; if (overflows <= 5) console.error(`  line ${i+1}: ${l.length} chars`); }});
  if (overflows > 5) console.error(`  ...and ${overflows - 5} more`);
}

console.log(output);
