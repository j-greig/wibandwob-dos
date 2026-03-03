import blessed from "blessed";

import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { createLivePlayer } from "../services/animation-service.js";
import {
  generateTerrainHills,
  renderContourFromHills,
  terrainNames,
  type ContourMode,
  type Hill
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

const MODE_ORDER: readonly ContourMode[] = ["chaos", "order", "hybrid"];
const DEFAULT_LEVELS = 5;
const MIN_LEVELS = 2;
const MAX_LEVELS = 8;
const ORDER_RATIO = 0.5;
const SWELL_TICKS = 15;
const ADD_HILL_EVERY = 1;
const COVERAGE_TARGET = 0.6;

type ActiveHill = {
  hill: Hill;
  startTick: number;
};

type GrowState = {
  key: string;
  allHills: Hill[];
  active: ActiveHill[];
  nextHillIndex: number;
  finished: boolean;
};

function randomSeed(): number {
  return Math.floor(Math.random() * 100000);
}

function scaledHill(hill: Hill, age: number): Hill {
  const swell = Math.max(0.14, Math.min(1, age / SWELL_TICKS));
  return [
    hill[0],
    hill[1],
    hill[2] * swell,
    hill[3] * (0.35 + swell * 0.65),
    hill[4],
    hill[5],
    hill[6],
    hill[7],
    hill[8]
  ] as const;
}

function estimatedCoverage(hills: readonly Hill[], width: number, height: number): number {
  const area = Math.max(1, width * height);
  const hillArea = hills.reduce((sum, hill) => sum + Math.PI * hill[2] * hill[2], 0);
  return Math.min(1, hillArea / area);
}

export function openContourWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Contour Studio", "contour");
  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    style: theme().body
  });
  const status = blessed.box({
    parent: frame.body,
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    tags: false,
    style: theme().header
  });

  let mode: ContourMode = "chaos";
  let terrainIdx = terrainNames.indexOf("meadow");
  if (terrainIdx < 0) {
    terrainIdx = 0;
  }
  let seed = randomSeed();
  let levels = DEFAULT_LEVELS;
  let growState: GrowState | null = null;

  const viewport = () => ({
    width: Math.max(12, Number(canvas.width)),
    height: Math.max(6, Number(canvas.height))
  });

  const ensureGrowState = (width: number, height: number): GrowState => {
    const key = [width, height, seed, terrainIdx].join(":");
    if (growState && growState.key === key) {
      return growState;
    }
    growState = {
      key,
      allHills: generateTerrainHills(width, height, seed, terrainIdx),
      active: [],
      nextHillIndex: 0,
      finished: false
    };
    return growState;
  };

  const syncStatus = () => {
    const terrain = terrainNames[((terrainIdx % terrainNames.length) + terrainNames.length) % terrainNames.length] ?? "unknown";
    status.setContent(` mode:${mode}  terrain:${terrain}  seed:${seed}  levels:${levels}  keys:m t/TAB r +/- `);
  };

  const buildFrame = (tick: number, width: number, height: number): string => {
    const state = ensureGrowState(width, height);

    if (!state.finished && tick % ADD_HILL_EVERY === 0 && state.nextHillIndex < state.allHills.length) {
      state.active.push({
        hill: state.allHills[state.nextHillIndex]!,
        startTick: tick
      });
      state.nextHillIndex += 1;
    }

    const activeHills = state.active.map(({ hill, startTick }) => scaledHill(hill, Math.max(1, tick - startTick + 1)));
    if (
      !state.finished &&
      (estimatedCoverage(activeHills, width, height) >= COVERAGE_TARGET || state.nextHillIndex >= state.allHills.length)
    ) {
      state.finished = true;
    }

    syncStatus();
    return renderContourFromHills(width, height, {
      mode,
      seed,
      terrainIdx,
      nLevels: levels,
      orderRatio: ORDER_RATIO,
      hills: activeHills
    }).join("\n");
  };

  const player = createLivePlayer({
    fps: 12,
    generator: (tick, width, height) => buildFrame(tick, width, height),
    getViewport: viewport,
    onFrame: (content) => {
      canvas.setContent(content);
      syncStatus();
      deps.screen.render();
    }
  });

  const rerender = () => {
    growState = null;
    const { width, height } = viewport();
    canvas.setContent(buildFrame(player.currentFrame, width, height));
    deps.screen.render();
  };

  const cycleMode = () => {
    mode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length] ?? "chaos";
    rerender();
  };

  const cycleTerrain = () => {
    terrainIdx = (terrainIdx + 1) % terrainNames.length;
    rerender();
  };

  const reroll = () => {
    seed = randomSeed();
    rerender();
  };

  const adjustLevels = (delta: number) => {
    const nextLevels = Math.max(MIN_LEVELS, Math.min(MAX_LEVELS, levels + delta));
    if (nextLevels === levels) return;
    levels = nextLevels;
    rerender();
  };

  player.play();
  frame.describeState = () => ({
    appType: "contour-studio",
    summary: "Animated contour map studio with chaos, order, and hybrid terrain rendering.",
    contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
    mode,
    terrain: terrainNames[terrainIdx],
    seed,
    levels
  });
  frame.captureText = () => `${canvas.getContent()}\n${status.getContent()}`;
  frame.cleanup = () => player.destroy();
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    canvas.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    status.style = theme().header;
  };

  for (const element of [frame.frame, frame.body, canvas]) {
    element.key(["m"], cycleMode);
    element.key(["t", "tab"], cycleTerrain);
    element.key(["r"], reroll);
    element.key(["+", "="], () => adjustLevels(1));
    element.key(["-"], () => adjustLevels(-1));
  }

  frame.frame.on("resize", rerender);
  deps.windowManager.registerWindow(frame);
  frame.focus();
}
