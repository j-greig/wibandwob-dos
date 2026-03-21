import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTabs,
  createListPanel,
  createSplitView,
  createStatusBar,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Color Palette";

// ANSI 256-color palette organized into named groups
const PALETTES: Record<string, { name: string; colors: number[] }[]> = {
  "Standard": [
    { name: "Primary", colors: [0, 1, 2, 3, 4, 5, 6, 7] },
    { name: "Bright", colors: [8, 9, 10, 11, 12, 13, 14, 15] },
  ],
  "Greyscale": [
    { name: "Dark→Light", colors: Array.from({ length: 24 }, (_, i) => 232 + i) },
  ],
  "Rainbow": [
    { name: "Reds", colors: [196, 202, 208, 214, 220, 226] },
    { name: "Greens", colors: [46, 47, 48, 49, 50, 51] },
    { name: "Blues", colors: [21, 27, 33, 39, 45, 51] },
    { name: "Purples", colors: [129, 135, 141, 147, 153, 159] },
  ],
  "Warm": [
    { name: "Warm Tones", colors: [52, 88, 124, 160, 196, 202, 208, 214, 220, 226, 228, 230] },
  ],
};

function renderSwatch(colors: number[]): string {
  const lines: string[] = [];
  for (let i = 0; i < colors.length; i += 8) {
    const row = colors.slice(i, i + 8);
    const swatchLine = row.map(c => `\x1b[48;5;${c}m  \x1b[0m`).join("");
    const labelLine = row.map(c => c.toString().padStart(3)).join(" ");
    lines.push(`  ${swatchLine}`);
    lines.push(`  ${labelLine}`);
  }
  return lines.join("\n");
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Explore ANSI 256-color palettes. Arrow keys: navigate, Tab: switch pane.",
    menu: [{ category: "demos", order: 205, label: APP_TITLE }],
    palette: { order: 205, label: `Open ${APP_TITLE}` },
    action: () => {
      const paletteNames = Object.keys(PALETTES);
      let activePalette = 0;
      let selectedGroup = 0;

      const win = host.createWindow({ title: APP_TITLE, width: 65, height: 22 });

      const split = createSplitView(win.body, {
        direction: "horizontal",
        ratio: 0.35,
        bottomOffset: 1,
      });

      const groups = PALETTES[paletteNames[activePalette]]!;
      const list = createListPanel(split.first, {
        items: groups.map(g => g.name),
      });

      // Build tab content for each palette category
      const tabDefs = paletteNames.map(name => {
        const cats = PALETTES[name]!;
        const content = cats.map(g =>
          `\n  ${g.name}\n${renderSwatch(g.colors)}`
        ).join("\n");
        return { label: name, content };
      });

      const tabs = createTabs(split.second, { tabs: tabDefs, active: 0 });

      const status = createStatusBar(win.body, {
        left: "←→: palette  ↑↓: group  Tab: switch pane",
        right: `${paletteNames[activePalette]}`,
      });

      const refreshList = () => {
        const groups = PALETTES[paletteNames[activePalette]]!;
        list.update({ items: groups.map(g => g.name), selected: 0 });
        selectedGroup = 0;
        status.update({ right: paletteNames[activePalette] });
        host.screen.render();
      };

      list.onSelect((idx) => {
        selectedGroup = idx;
        const groups = PALETTES[paletteNames[activePalette]]!;
        const group = groups[idx];
        if (group) {
          status.update({ right: `${paletteNames[activePalette]} > ${group.name}` });
          host.screen.render();
        }
      });

      tabs.onSwitch((idx) => {
        activePalette = idx;
        refreshList();
      });

      // Tab key to switch between list and tabs
      list.element.key(["tab"], () => {
        tabs.element.focus();
      });
      tabs.element.key(["tab"], () => {
        list.element.focus();
      });

      win.describeState(() => ({
        summary: `Color Palette — ${paletteNames[activePalette]}, group: ${selectedGroup}`,
        palette: paletteNames[activePalette],
        selectedGroup,
        totalPalettes: paletteNames.length,
      }));

      win.captureText(() => {
        const cats = PALETTES[paletteNames[activePalette]]!;
        return cats.map(g => `${g.name}: [${g.colors.join(", ")}]`).join("\n");
      });

      win.onRestyle(() => {
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        list.destroy();
        tabs.destroy();
        split.destroy();
        status.destroy();
      });

      win.setFocusTarget(list.element);
      win.focus();

      return { ok: true, windowId: win.id };
    },
  });
}
