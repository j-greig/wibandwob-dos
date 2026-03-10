import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";

import { theme } from "../core/theme/resolver.js";
import {
  createColumns,
  createHeaderBar,
  createNodePart,
  createRestyleBundle,
  createRule,
  createStack,
  createStatusBar,
  type UiPart,
} from "../core/ui-parts.js";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
  type ContourMode,
  type ContourPlayer,
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./generative-windows.js";

const MODE_ORDER: readonly ContourMode[] = ["chaos", "order", "hybrid"];
const PANEL_COUNT = 3;
const HEADER_TITLE = "TRIPTYCH";

type ViewMode = "solo" | "triptych";

type TriptychState = {
  panelBoxes: blessed.Widgets.BoxElement[];
  header: UiPart<{ left: string; right?: string }>;
  statusBar: UiPart<{ left?: string; right?: string }>;
  root: UiPart<void>;
  players: ContourPlayer[];
  panelStates: Array<{ mode: ContourMode; terrain: string; seed: number; levels: number }>;
};

function centeredLabel(width: number, label: string): string {
  const padding = Math.max(0, Math.floor((width - label.length) / 2));
  return `${" ".repeat(padding)}${label}`;
}

function randomTerrainOrder(count: number): number[] {
  const all = terrainNames.map((_, idx) => idx);
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, Math.min(count, all.length));
}

export function openContourWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Contour Studio", "contour");
  let viewMode: ViewMode = "solo";

  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    style: theme().body,
  });
  const status = blessed.box({
    parent: frame.body,
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    tags: false,
    style: theme().header,
  });

  let triptych: TriptychState | null = null;

  const updateSoloStatus = () => {
    status.setContent(
      ` mode:${viewMode}  terrain:${terrainNames[player.terrainIdx]}  seed:${player.seed}  levels:${player.levels}  keys:m t r +/- s 3:triptych `
    );
  };

  const updateTriptychBars = () => {
    if (!triptych) return;
    const width = Math.max(1, Number(frame.body.width) || 0);
    triptych.header.update({ left: centeredLabel(width, HEADER_TITLE) });
    triptych.statusBar.update({ left: " mode:triptych  r:reseed  m:mode  t:terrain  s:save  3:solo " });
  };

  const captureTriptychRows = (): string[] => {
    if (!triptych) return [];
    return triptych.panelBoxes
      .map((panelBox) => panelBox.getContent().split("\n"))
      .reduce<string[]>((rows, panelRows, panelIdx) => {
        const baseRows = rows.length > 0 ? rows : panelRows.map(() => "");
        return baseRows.map((row, rowIdx) => {
          const divider = panelIdx === 0 ? "" : " | ";
          return `${row}${divider}${panelRows[rowIdx] ?? ""}`;
        });
      }, []);
  };

  const destroyTriptych = () => {
    if (!triptych) return;
    for (const playerInstance of triptych.players) {
      playerInstance.destroy();
    }
    triptych.root.destroy();
    triptych = null;
  };

  const mountTriptych = () => {
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

    triptych = { panelBoxes, header, statusBar, root, players, panelStates };

    for (const el of panelBoxes) {
      bindSharedKeys(el);
    }
  };

  const doLayout = () => {
    const width = Math.max(1, Number(frame.body.width) || 0);
    const height = Math.max(1, Number(frame.body.height) || 0);
    if (viewMode === "solo") {
      canvas.top = 0;
      canvas.left = 0;
      canvas.width = width;
      canvas.height = Math.max(1, height - 1);
      status.bottom = 0;
      status.height = 1;
      updateSoloStatus();
      return;
    }
    triptych?.root.layout({ top: 0, left: 0, width, height });
    updateTriptychBars();
  };

  const player = createContourPlayer({
    mode: "chaos",
    terrainIdx: Math.max(0, terrainNames.indexOf("meadow")),
    fps: 12,
    getViewport: () => readNodeViewport(canvas, { minWidth: 12, minHeight: 6 }),
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
    onStatus: () => {
      if (viewMode === "solo") {
        updateSoloStatus();
      }
    },
  });

  const cycleMode = () => {
    if (viewMode === "solo") {
      const next = MODE_ORDER[(MODE_ORDER.indexOf(player.mode) + 1) % MODE_ORDER.length] ?? "chaos";
      player.setMode(next);
      return;
    }
    for (const playerInstance of triptych?.players ?? []) {
      const next = MODE_ORDER[(MODE_ORDER.indexOf(playerInstance.mode) + 1) % MODE_ORDER.length] ?? "chaos";
      playerInstance.setMode(next);
    }
  };

  const cycleTerrain = () => {
    if (viewMode === "solo") {
      player.setTerrain(player.terrainIdx + 1);
      return;
    }
    for (const playerInstance of triptych?.players ?? []) {
      playerInstance.setTerrain(playerInstance.terrainIdx + 1);
    }
  };

  const reseed = () => {
    if (viewMode === "solo") {
      player.reroll();
      return;
    }
    for (const playerInstance of triptych?.players ?? []) {
      playerInstance.reroll();
    }
  };

  const saveFrame = () => {
    const dir = path.join(process.cwd(), "scratch", "captures");
    fs.mkdirSync(dir, { recursive: true });

    if (viewMode === "solo") {
      const text = canvas.getContent();
      if (!text) return;
      const name = `contour_${player.mode}_${terrainNames[player.terrainIdx]}_${player.seed}_${Date.now()}.txt`;
      fs.writeFileSync(path.join(dir, name), text, "utf8");
      status.setContent(` saved: ${name}`);
      deps.screen.render();
      return;
    }

    const text = captureTriptychRows().join("\n");
    if (!text.trim()) return;
    const name = `contour_triptych_${(triptych?.panelStates ?? []).map((state) => state.seed).join("-")}_${Date.now()}.txt`;
    fs.writeFileSync(path.join(dir, name), text, "utf8");
    triptych?.statusBar.update({
      left: " mode:triptych  r:reseed  m:mode  t:terrain  s:save  3:solo ",
      right: `saved: ${name}`,
    });
    deps.screen.render();
  };

  const switchToSolo = () => {
    if (viewMode === "solo") return;
    destroyTriptych();
    canvas.show();
    status.show();
    viewMode = "solo";
    player.play();
    doLayout();
    deps.onStateChanged?.();
    deps.screen.render();
  };

  const switchToTriptych = () => {
    if (viewMode === "triptych") return;
    player.pause();
    canvas.hide();
    status.hide();
    mountTriptych();
    viewMode = "triptych";
    doLayout();
    for (const playerInstance of triptych?.players ?? []) {
      playerInstance.play();
    }
    triptych?.panelBoxes[0]?.focus();
    deps.onStateChanged?.();
    deps.screen.render();
  };

  const toggleViewMode = () => {
    if (viewMode === "solo") {
      switchToTriptych();
    } else {
      switchToSolo();
    }
  };

  const adjustLevels = (delta: number) => {
    if (viewMode !== "solo") return;
    player.setLevels(player.levels + delta);
  };

  const bindSharedKeys = (el: blessed.Widgets.BoxElement) => {
    el.key(["m"], cycleMode);
    el.key(["t", "tab"], cycleTerrain);
    el.key(["r"], reseed);
    el.key(["s"], saveFrame);
    el.key(["3"], toggleViewMode);
  };

  for (const el of [frame.frame, frame.body, canvas]) {
    bindSharedKeys(el);
    el.key(["+", "="], () => adjustLevels(1));
    el.key(["-"], () => adjustLevels(-1));
  }

  frame.frame.on("resize", () => {
    doLayout();
    if (viewMode === "solo") {
      player.reroll();
      return;
    }
    for (const playerInstance of triptych?.players ?? []) {
      playerInstance.reroll();
    }
  });

  frame.describeState = () => {
    if (viewMode === "triptych") {
      return {
        appType: "contour-studio" as const,
        summary: "Contour Studio triptych view with three synchronized contour players.",
        viewMode,
        panels: (triptych?.panelStates ?? []).map((state, idx) => ({
          panel: idx + 1,
          mode: state.mode,
          terrain: state.terrain,
          seed: state.seed,
          levels: state.levels,
        })),
      };
    }

    return {
      appType: "contour-studio" as const,
      summary: "Animated contour map studio with chaos, order, and hybrid terrain rendering.",
      contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
      viewMode,
      mode: player.mode,
      terrain: terrainNames[player.terrainIdx],
      seed: player.seed,
      levels: player.levels,
    };
  };

  frame.captureText = () =>
    viewMode === "triptych"
      ? `${captureTriptychRows().join("\n")}\n${triptych?.statusBar.node.getContent() ?? ""}`
      : `${canvas.getContent()}\n${status.getContent()}`;
  frame.cleanup = () => {
    player.destroy();
    destroyTriptych();
  };
  frame.focus = () => {
    if (viewMode === "triptych") {
      triptych?.panelBoxes[0]?.focus();
      return;
    }
    canvas.focus();
  };
  const restyleBundle = createRestyleBundle([
    [canvas, () => theme().body],
    [status, () => theme().header],
  ]);
  frame.onRestyle = () => {
    restyleBundle.restyle();
    triptych?.root.restyle();
  };
  frame.refresh = doLayout;

  deps.windowManager.registerWindow(frame);
  frame.focus();
  doLayout();
  player.play();
}
