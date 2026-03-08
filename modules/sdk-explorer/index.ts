/**
 * SDK Explorer — interactive documentation surface.
 *
 * Tabs: Quick Start / Components / Examples / Architecture.
 * Examples tab renders live components.
 * Code snippets panel. Links to README sections.
 */

import type { MicroappHost } from "#sdk";

const TAB_IDS = ["Quick Start", "Components", "Examples", "Architecture"] as const;
type TabId = typeof TAB_IDS[number];

const QUICK_START = `
╔══ Quick Start ══╗

  1. Create module directory:
     mkdir modules/my-app

  2. Add module.json:
     { "name": "my-app", "type": "microapp",
       "microapp": { "id": "my-app", "title": "My App" } }

  3. Write index.ts:
     import type { MicroappHost } from "#sdk";

     export default function setup(host: MicroappHost) {
       host.registerCommand({
         id: "open",
         label: "My App",
         action: () => {
           const win = host.createWindow({
             title: "My App",
             width: 40, height: 12
           });
           win.body.setContent("Hello from My App!");
           host.screen.render();
         }
       });
     }

  4. Restart WibWob-DOS. Your app appears in menus.
`;

const COMPONENTS = `
╔══ SDK Components ══╗

  Interactive Primitives:
    createButton     — clickable action trigger
    createToggle     — boolean switch
    createTextInput  — single-line text entry
    createProgressBar — horizontal fill indicator
    createSpinner    — animated loading indicator
    createBadge      — small label tag

  Data Display:
    createList       — scrollable item list
    createTable      — columnar data display
    createTree       — hierarchical node display
    createSparkline  — inline data visualization
    createGauge      — value display with bar

  Layout + Overlay:
    createTabs       — tabbed content container
    createAccordion  — expandable sections
    createSplitPane  — side-by-side layout
    createModal      — centered overlay dialog
    createNotification — ephemeral message toast

  Core Primitives:
    createStack      — vertical layout
    createColumns    — horizontal layout
    createHeaderBar  — top status bar
    createStatusBar  — bottom status bar
    createTextBlock  — text content area
`;

const EXAMPLES = `
╔══ Live Examples ══╗

  ▸ ProgressBar:  [████████░░░░░░░░░░░░] 42%

  ▸ Sparkline:    ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▅▇

  ▸ Gauge:        ▕▓▓▓▓▓▓▓▓░░░░░░░░░░▏ 45

  ▸ Tree:
    └── ▾ modules/
        ├── ▸ hello-world/
        ├── ▸ poetry-clock/
        └── ▸ module-observatory/

  ▸ Table:
    Name          │Status │Commands
    ──────────────┼───────┼────────
    hello-world   │loaded │1
    poetry-clock  │loaded │2

  ▸ Badge:  [ info ]  [ success ]  [ warning ]
`;

const ARCHITECTURE = `
╔══ Architecture ══╗

  ┌─────────────┐     ┌──────────────┐
  │ module.json  │────▶│ module-loader │
  │ (manifest)   │     │ (discovery)   │
  └─────────────┘     └──────┬───────┘
                             │
                    ┌────────▼────────┐
                    │  MicroappHost   │
                    │  (SDK surface)  │
                    └────────┬────────┘
                             │
         ┌───────────┬───────┴───────┬──────────┐
         │           │               │          │
    ┌────▼────┐ ┌────▼────┐ ┌───────▼──┐ ┌─────▼────┐
    │ Window  │ │ Command │ │ Snapshot │ │  Theme   │
    │ Manager │ │ Registry│ │ Registry │ │ Resolver │
    └─────────┘ └─────────┘ └──────────┘ └──────────┘

  Module Lifecycle:
    discover → load → setup(host) → register commands → create windows
    reload: unload → re-import → setup(host)
    unload: close windows → remove commands → cleanup hooks
`;

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "SDK Explorer",
    menu: [{ category: "applications", order: 63, label: "SDK Explorer" }],
    palette: { order: 174 },
    action: () => {
      const win = host.createWindow({
        title: "SDK Explorer",
        width: 72,
        height: 28,
      });

      let activeTab: TabId = "Quick Start";

      const TAB_CONTENT: Record<TabId, string> = {
        "Quick Start": QUICK_START,
        "Components": COMPONENTS,
        "Examples": EXAMPLES,
        "Architecture": ARCHITECTURE,
      };

      function render() {
        const tabs = TAB_IDS.map(t =>
          t === activeTab ? `[${t}]` : ` ${t} `
        ).join(" ");

        const content = TAB_CONTENT[activeTab] ?? "";
        win.body.setContent(`${tabs}\n${"─".repeat(68)}\n${content}`);
        host.screen.render();
      }

      win.body.key(["tab"], () => {
        const idx = TAB_IDS.indexOf(activeTab);
        activeTab = TAB_IDS[(idx + 1) % TAB_IDS.length];
        render();
      });
      win.body.key(["1"], () => { activeTab = "Quick Start"; render(); });
      win.body.key(["2"], () => { activeTab = "Components"; render(); });
      win.body.key(["3"], () => { activeTab = "Examples"; render(); });
      win.body.key(["4"], () => { activeTab = "Architecture"; render(); });
      win.body.key(["q", "escape"], () => win.close());

      win.onResize(render);
      render();

      win.describeState(() => ({
        summary: `SDK Explorer — ${activeTab}`,
        activeTab,
      }));
    },
  });
}
