import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { theme } from "../core/theme/resolver.js";
import {
  createStack,
  createColumns,
  createNodePart,
  createHeaderBar,
  createStatusBar,
  createRule,
} from "../core/ui-parts.js";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
  type ContourMode,
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

const MODE_ORDER: readonly ContourMode[] = ["chaos", "order", "hybrid"];
const PANEL_COUNT = 3;
const HEADER_TITLE = "TRIPTYCH";

function randomTerrainOrder(count: number): number[] {
  const all = terrainNames.map((_, idx) => idx);
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, Math.min(count, all.length));
}

function centeredLabel(width: number, label: string): string {
  const padding = Math.max(0, Math.floor((width - label.length) / 2));
  return `${" ".repeat(padding)}${label}`;
}

export function openContourTriptychWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Contour Triptych", "contour");

  const panelBoxes = Array.from({ length: PANEL_COUNT }, () =>
    blessed.box({
      parent: frame.body,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      style: theme().body,
    })
  );

  const header = createHeaderBar(frame.body);
  const dividerA = createRule(frame.body, { axis: "vertical" });
  const dividerB = createRule(frame.body, { axis: "vertical" });
  const statusBar = createStatusBar(frame.body);

  const terrainOrder = randomTerrainOrder(PANEL_COUNT);
  const panelStates = Array.from({ length: PANEL_COUNT }, (_, idx) => ({
    mode: MODE_ORDER[idx] ?? "chaos",
    terrain: terrainNames[terrainOrder[idx] ?? 0] ?? terrainNames[0] ?? "unknown",
    seed: 0,
    levels: 5,
  }));

  const panelParts = panelBoxes.map((panelBox) =>
    createNodePart(panelBox, {
      restyle: () => {
        panelBox.style = theme().body;
      },
    })
  );

  const players = panelBoxes.map((panelBox, idx) =>
    createContourPlayer({
      mode: MODE_ORDER[idx] ?? "chaos",
      terrainIdx: terrainOrder[idx] ?? 0,
      fps: 12,
      getViewport: () => readNodeViewport(panelBox, { minWidth: 8, minHeight: 4 }),
      onFrame: (content) => {
        panelBox.setContent(content);
        deps.screen.render();
      },
      onStatus: (state) => {
        panelStates[idx] = state;
        deps.onStateChanged?.();
      },
    })
  );

  const columns = createColumns(frame.body, [
    { key: "panel-1", basis: "1fr", part: panelParts[0]! },
    { key: "divider-1", basis: 1, part: dividerA },
    { key: "panel-2", basis: "1fr", part: panelParts[1]! },
    { key: "divider-2", basis: 1, part: dividerB },
    { key: "panel-3", basis: "1fr", part: panelParts[2]! },
  ]);

  const root = createStack(frame.body, [
    { key: "header", basis: 1, part: header },
    { key: "body", basis: "1fr", part: columns },
    { key: "status", basis: 1, part: statusBar },
  ]);

  const updateBars = () => {
    const width = Math.max(1, Number(frame.body.width) || 0);
    header.update({ left: centeredLabel(width, HEADER_TITLE) });
    statusBar.update({ left: "r:reseed m:mode t:terrain s:save" });
  };

  const doLayout = () => {
    const width = Math.max(1, Number(frame.body.width) || 0);
    const height = Math.max(1, Number(frame.body.height) || 0);
    root.layout({ top: 0, left: 0, width, height });
    updateBars();
  };

  const cycleModes = () => {
    for (const player of players) {
      const next = MODE_ORDER[(MODE_ORDER.indexOf(player.mode) + 1) % MODE_ORDER.length] ?? "chaos";
      player.setMode(next);
    }
  };

  const cycleTerrains = () => {
    for (const player of players) {
      player.setTerrain(player.terrainIdx + 1);
    }
  };

  const reseedAll = () => {
    for (const player of players) {
      player.reroll();
    }
  };

  const captureTriptychRows = () =>
    panelBoxes
      .map((panelBox) => panelBox.getContent().split("\n"))
      .reduce<string[]>((rows, panelRows, panelIdx) => {
        const baseRows = rows.length > 0 ? rows : panelRows.map(() => "");
        return baseRows.map((row, rowIdx) => {
          const divider = panelIdx === 0 ? "" : " | ";
          return `${row}${divider}${panelRows[rowIdx] ?? ""}`;
        });
      }, []);

  const saveFrame = () => {
    const text = captureTriptychRows().join("\n");
    if (!text.trim()) return;
    const dir = path.join(process.cwd(), "scratch", "captures");
    fs.mkdirSync(dir, { recursive: true });
    const name = `contour_triptych_${panelStates.map((state) => state.seed).join("-")}_${Date.now()}.txt`;
    fs.writeFileSync(path.join(dir, name), text, "utf8");
    statusBar.update({ left: "r:reseed m:mode t:terrain s:save", right: `saved: ${name}` });
    deps.screen.render();
  };

  for (const el of [frame.frame, frame.body, ...panelBoxes]) {
    el.key(["r"], reseedAll);
    el.key(["m"], cycleModes);
    el.key(["t"], cycleTerrains);
    el.key(["s"], saveFrame);
  }

  frame.frame.on("resize", doLayout);

  frame.describeState = () => ({
    appType: "contour-triptych" as const,
    summary: "Contour Triptych — three contour players side by side.",
    panels: panelStates.map((state, idx) => ({
      panel: idx + 1,
      mode: state.mode,
      terrain: state.terrain,
      seed: state.seed,
      levels: state.levels,
    })),
  });
  frame.captureText = () => captureTriptychRows().join("\n");
  frame.cleanup = () => {
    for (const player of players) {
      player.destroy();
    }
    root.destroy();
  };
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    panelBoxes[0]?.focus();
  };
  frame.onRestyle = () => {
    root.restyle();
  };

  frame.refresh = doLayout;
  deps.windowManager.registerWindow(frame);
  frame.focus();

  doLayout();
  for (const player of players) {
    player.play();
  }
}
