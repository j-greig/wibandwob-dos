import blessed from "blessed";
import {
  blankGrid,
  clamp,
  createAnimationClock,
  createBorderedPanel,
  createSelectableList,
  gridToText,
  paintCentered,
  paintText,
  type MicroappHost,
  type MicroappSnapshotWindow,
} from "../../src/services/microapp-sdk.js";

type SkyMode = "mist" | "static" | "aurora" | "eclipse";
type OverlayMode = "pressure" | "omens" | "wind";

type RegionDef = {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
  basePressure: number;
  baseWind: number;
  tempBias: number;
  spiritBias: number;
};

type ForecastSnapshot = {
  regionId?: string;
  skyMode?: SkyMode;
  overlay?: OverlayMode;
  tempo?: number;
  paused?: boolean;
};

type RegionReading = {
  pressure: number;
  wind: number;
  temperature: number;
  visibility: number;
  spiritIndex: number;
  alert: string;
  severity: number;
  summary: string;
};

const SKY_MODE_CYCLE: SkyMode[] = ["mist", "static", "aurora", "eclipse"];
const OVERLAY_CYCLE: OverlayMode[] = ["pressure", "omens", "wind"];
const TEMPO_CYCLE = [1, 2, 3] as const;

const SKY_LABELS: Record<SkyMode, string> = {
  mist: "MIST",
  static: "STATIC",
  aurora: "AURORA",
  eclipse: "ECLIPSE",
};

const OVERLAY_LABELS: Record<OverlayMode, string> = {
  pressure: "PRESSURE",
  omens: "OMENS",
  wind: "WIND",
};

const REGIONS: RegionDef[] = [
  { id: "north-sea-of-lamps", label: "North Sea of Lamps", short: "LAMPS", x: 12, y: 5, basePressure: 1009, baseWind: 18, tempBias: 3, spiritBias: 5 },
  { id: "velvet-escarpment", label: "Velvet Escarpment", short: "VELVT", x: 35, y: 4, basePressure: 997, baseWind: 27, tempBias: 7, spiritBias: 14 },
  { id: "cathedral-of-static", label: "Cathedral of Static", short: "STATIC", x: 55, y: 8, basePressure: 991, baseWind: 34, tempBias: 1, spiritBias: 19 },
  { id: "murmur-basin", label: "Murmur Basin", short: "MURMR", x: 20, y: 15, basePressure: 1016, baseWind: 12, tempBias: 9, spiritBias: 6 },
  { id: "opal-frontier", label: "Opal Frontier", short: "OPAL", x: 44, y: 16, basePressure: 1003, baseWind: 22, tempBias: 12, spiritBias: 10 },
  { id: "sleeping-wire", label: "Sleeping Wire", short: "WIRE", x: 63, y: 14, basePressure: 988, baseWind: 31, tempBias: 5, spiritBias: 16 },
];

const SKY_GLYPHS: Record<SkyMode, string[]> = {
  mist: ["·", " ", "~", " ", "·", " "],
  static: [".", ":", "*", "+", ".", ":"],
  aurora: ["~", "≈", "·", "~", "*", "·"],
  eclipse: [" ", "◌", " ", "·", " ", "◌"],
};

const OMINOUS_WORDS = [
  "low whisper shelf",
  "moon pressure inversion",
  "cat-sense updraft",
  "corridor lightning",
  "velvet hail",
  "portable dusk cell",
  "silence bloom",
  "red sleep front",
];

function cycleValue<T>(values: readonly T[], current: T, step = 1): T {
  const index = values.indexOf(current);
  if (index < 0) return values[0]!;
  return values[(index + step + values.length) % values.length]!;
}

function safeRegion(regionId: string | undefined): RegionDef {
  return REGIONS.find((region) => region.id === regionId) ?? REGIONS[0]!;
}

function computeReading(region: RegionDef, tick: number, skyMode: SkyMode): RegionReading {
  const slow = Math.sin((tick + region.x) / 8);
  const fast = Math.cos((tick * 1.7 + region.y) / 5);
  const drift = Math.sin((tick + region.spiritBias * 3) / 13);
  const skyPressure = skyMode === "eclipse" ? -9 : skyMode === "aurora" ? 4 : skyMode === "static" ? -3 : 2;
  const skySpirit = skyMode === "static" ? 8 : skyMode === "aurora" ? 5 : skyMode === "eclipse" ? 11 : 2;
  const pressure = Math.round(region.basePressure + slow * 7 + fast * 3 + skyPressure);
  const wind = Math.max(0, Math.round(region.baseWind + Math.abs(fast) * 9 + (skyMode === "static" ? 7 : 0) + (skyMode === "eclipse" ? 4 : 0)));
  const temperature = Math.round(11 + region.tempBias + drift * 5 + (skyMode === "mist" ? -2 : skyMode === "aurora" ? 1 : 0));
  const visibility = clamp(Math.round(78 - Math.abs(slow) * 24 - (skyMode === "mist" ? 18 : 0) - (skyMode === "eclipse" ? 12 : 0)), 12, 96);
  const spiritIndex = clamp(Math.round(40 + region.spiritBias + drift * 18 + (skySpirit * 1.2) + Math.abs(slow) * 10), 0, 99);

  let alert = "stable dream pressure";
  let severity = 0;
  if (spiritIndex >= 82) {
    alert = "red omen front";
    severity = 3;
  } else if (wind >= 38 || pressure <= 989) {
    alert = "restless corridor gusts";
    severity = 2;
  } else if (visibility <= 32) {
    alert = "veil drift advisory";
    severity = 1;
  }

  const summary = `${pressure} hPa · ${wind} kn · vis ${visibility}% · spirits ${spiritIndex}`;
  return { pressure, wind, temperature, visibility, spiritIndex, alert, severity, summary };
}

function pressureTrend(reading: RegionReading): string {
  if (reading.pressure <= 990) return "falling hard";
  if (reading.pressure <= 999) return "falling";
  if (reading.pressure >= 1015) return "high and lucid";
  return "holding";
}

function renderRadar(width: number, height: number, args: {
  tick: number;
  skyMode: SkyMode;
  overlay: OverlayMode;
  selectedRegionId: string;
}): string {
  const w = Math.max(22, width);
  const h = Math.max(10, height);
  const grid = blankGrid(w, h);
  const sky = SKY_GLYPHS[args.skyMode];

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = Math.abs((x * 5 + y * 7 + args.tick) % sky.length);
      if ((x + y + args.tick) % (args.skyMode === "mist" ? 9 : 6) === 0) {
        grid[y]![x] = sky[index] ?? " ";
      }
    }
  }

  const frontY = 2 + ((args.tick / 2) % Math.max(3, h - 5));
  for (let x = 1; x < w - 2; x += 1) {
    const y = Math.max(1, Math.min(h - 2, Math.round(frontY + Math.sin((x + args.tick) / 5) * 2)));
    grid[y]![x] = args.skyMode === "eclipse" ? "#" : args.skyMode === "aurora" ? "~" : "=";
  }

  paintCentered(grid, 0, ` DREAM RADAR · ${SKY_LABELS[args.skyMode]} · ${OVERLAY_LABELS[args.overlay]} `);

  for (const region of REGIONS) {
    const x = Math.min(w - 8, Math.max(1, region.x));
    const y = Math.min(h - 2, Math.max(2, region.y));
    const selected = region.id === args.selectedRegionId;
    grid[y]![x] = selected ? "◉" : "◌";
    const label = selected ? `[${region.short}]` : region.short;
    paintText(grid, Math.min(w - label.length - 1, x + 2), y, label);

    if (args.overlay === "pressure") {
      const reading = computeReading(region, args.tick, args.skyMode);
      const pressureMark = reading.pressure <= 992 ? "L" : reading.pressure >= 1014 ? "H" : "M";
      paintText(grid, Math.max(1, x - 1), Math.min(h - 1, y + 1), pressureMark);
    } else if (args.overlay === "omens") {
      const reading = computeReading(region, args.tick, args.skyMode);
      const omen = reading.spiritIndex >= 80 ? "!" : reading.spiritIndex >= 66 ? "+" : ".";
      paintText(grid, Math.max(1, x - 1), Math.min(h - 1, y + 1), omen);
    } else {
      const reading = computeReading(region, args.tick, args.skyMode);
      const gust = reading.wind >= 35 ? ">>>" : reading.wind >= 25 ? ">>" : ">";
      paintText(grid, Math.min(w - gust.length - 1, x + 1), Math.max(1, y - 1), gust);
    }
  }

  return gridToText(grid);
}

function renderRegionSummary(region: RegionDef, reading: RegionReading, skyMode: SkyMode): string {
  const risk = reading.severity === 3 ? "RED" : reading.severity === 2 ? "AMBER" : reading.severity === 1 ? "BLUE" : "GREEN";
  return [
    region.label,
    "",
    `sky        ${SKY_LABELS[skyMode]}`,
    `pressure   ${reading.pressure} hPa`,
    `wind       ${reading.wind} kn`,
    `temp       ${reading.temperature}°C`,
    `visibility ${reading.visibility}%`,
    `spirits    ${reading.spiritIndex}/99`,
    `trend      ${pressureTrend(reading)}`,
    `risk       ${risk}`,
    "",
    `alert      ${reading.alert}`,
  ].join("\n");
}

function renderDreamGauge(reading: RegionReading, width: number): string {
  const inner = Math.max(8, width - 16);
  const fill = Math.round((reading.spiritIndex / 99) * inner);
  return `[${"#".repeat(fill)}${"-".repeat(Math.max(0, inner - fill))}] ${String(reading.spiritIndex).padStart(2, "0")}`;
}

function renderBulletin(region: RegionDef, reading: RegionReading, tick: number, skyMode: SkyMode): string {
  const omen = OMINOUS_WORDS[(tick + region.spiritBias) % OMINOUS_WORDS.length] ?? OMINOUS_WORDS[0]!;
  return [
    `Region: ${region.label}`,
    `Condition: ${reading.alert}`,
    `Pattern: ${omen}`,
    "",
    `${SKY_LABELS[skyMode]} skies are dragging a pressure seam across ${region.short}.`,
    `Visibility holds at ${reading.visibility}% while the spirit index sits at ${reading.spiritIndex}.`,
    reading.severity >= 2
      ? "Advice: keep lamps low, note unusual echoes, and avoid corridor crossings."
      : "Advice: safe for wandering, but log any recurring symbols before dawn.",
  ].join("\n");
}

function renderAlerts(tick: number, skyMode: SkyMode): string {
  const ranked = REGIONS.map((region) => ({ region, reading: computeReading(region, tick, skyMode) }))
    .sort((a, b) => b.reading.severity - a.reading.severity || b.reading.spiritIndex - a.reading.spiritIndex)
    .slice(0, 5);

  return ranked.map(({ region, reading }, index) => {
    const level = reading.severity === 3 ? "RED" : reading.severity === 2 ? "AMBER" : reading.severity === 1 ? "BLUE" : "CLEAR";
    return `${index + 1}. ${level.padEnd(5, " ")} ${region.short.padEnd(6, " ")} ${reading.alert}`;
  }).join("\n");
}

function renderLedger(tick: number, skyMode: SkyMode, tempo: number, paused: boolean): string {
  const globalPressure = Math.round(REGIONS.reduce((sum, region) => sum + computeReading(region, tick, skyMode).pressure, 0) / REGIONS.length);
  const highSpirit = Math.max(...REGIONS.map((region) => computeReading(region, tick, skyMode).spiritIndex));
  return [
    "Station Ledger",
    "",
    `clock       ${paused ? "frozen" : "running"}`,
    `tempo       x${tempo}`,
    `mean hPa    ${globalPressure}`,
    `peak omen   ${highSpirit}`,
    `overlay     ${OVERLAY_LABELS[OVERLAY_CYCLE[(tick + tempo) % OVERLAY_CYCLE.length] ?? "pressure"]}`,
    "",
    "Controls",
    "↑/↓ region",
    "m sky mode",
    "o overlay",
    "t tempo",
    "space pause",
  ].join("\n");
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dream Forecast",
    description: "Open the psychic weather workstation.",
    menu: [{ category: "applications", order: 62, label: "Dream Forecast" }],
    palette: { order: 62, label: "Open Dream Forecast" },
    action: (args) => openDreamForecast(host, args as ForecastSnapshot | undefined),
  });

  host.registerSnapshot({
    serialize: (window: MicroappSnapshotWindow) => {
      const state = window.describeState?.() ?? {};
      if (state.appType !== "wibwob.dreamforecast") return undefined;
      return {
        regionId: state.regionId,
        skyMode: state.skyMode,
        overlay: state.overlay,
        tempo: state.tempo,
        paused: state.paused,
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", payload);
    },
  });
}

function openDreamForecast(host: MicroappHost, initial?: ForecastSnapshot) {
  const win = host.createWindow({
    title: "Dream Forecast",
    width: clamp(Math.floor(host.geometry.width * 0.78), 96, 132),
    height: clamp(Math.floor(host.geometry.height * 0.74), 28, 40),
  });

  const state = {
    regionId: safeRegion(initial?.regionId).id,
    skyMode: SKY_MODE_CYCLE.includes(initial?.skyMode as SkyMode) ? (initial?.skyMode as SkyMode) : "mist",
    overlay: OVERLAY_CYCLE.includes(initial?.overlay as OverlayMode) ? (initial?.overlay as OverlayMode) : "pressure",
    tempo: TEMPO_CYCLE.includes((initial?.tempo ?? 1) as 1 | 2 | 3) ? (initial?.tempo as 1 | 2 | 3) : 1,
    paused: initial?.paused ?? false,
    tick: 0,
  };

  const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
  const regionPanel = createBorderedPanel(win.body, { title: "Regions" }, host.theme);
  const radarPanel = createBorderedPanel(win.body, { title: "Radar" }, host.theme);
  const bulletinPanel = createBorderedPanel(win.body, { title: "Bulletin" }, host.theme);
  const stationPanel = createBorderedPanel(win.body, { title: "Station" }, host.theme);
  const alertsPanel = createBorderedPanel(win.body, { title: "Alerts" }, host.theme);

  const regionListHandle = createSelectableList({
    parent: regionPanel.content,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: {
      ...host.theme().body,
      selected: host.theme().selected,
      item: host.theme().body,
    },
  });
  const regionList = regionListHandle.node;
  regionListHandle.setItems(REGIONS.map((region) => region.label));

  const radarBox = blessed.box({
    parent: radarPanel.content,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: false,
    style: host.theme().body,
  });
  const bulletinBox = blessed.box({
    parent: bulletinPanel.content,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: false,
    style: host.theme().body,
  });
  const stationBox = blessed.box({
    parent: stationPanel.content,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: false,
    style: host.theme().body,
  });
  const alertsBox = blessed.box({
    parent: alertsPanel.content,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: false,
    style: host.theme().body,
  });

  type SkyButton = SkyMode | "pause";
  const skyBar = host.ui.createButtonBar<SkyButton>(
    win.body,
    [
      { id: "mist", label: "MIST" },
      { id: "static", label: "STATIC" },
      { id: "aurora", label: "AURORA" },
      { id: "eclipse", label: "ECLIPSE" },
      { id: "pause", label: "PAUSE" },
    ],
    (id) => {
      if (id === "pause") state.paused = !state.paused;
      else state.skyMode = id;
      syncClockState();
      render();
    },
  );

  type OverlayButton = OverlayMode | "tempo";
  const overlayBar = host.ui.createButtonBar<OverlayButton>(
    win.body,
    [
      { id: "pressure", label: "PRESSURE" },
      { id: "omens", label: "OMENS" },
      { id: "wind", label: "WIND" },
      { id: "tempo", label: "TEMPO" },
    ],
    (id) => {
      if (id === "tempo") state.tempo = cycleValue(TEMPO_CYCLE, state.tempo);
      else state.overlay = id;
      render();
    },
  );

  const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });

  const centreStack = host.ui.createStack(win.body, [
    { key: "radar", basis: "2fr", part: radarPanel },
    { key: "bulletin", basis: "1fr", part: bulletinPanel },
  ]);
  const rightStack = host.ui.createStack(win.body, [
    { key: "station", basis: "1fr", part: stationPanel },
    { key: "alerts", basis: "1fr", part: alertsPanel },
  ]);
  const bodyColumns = host.ui.createColumns(win.body, [
    { key: "regions", basis: 24, part: regionPanel },
    { key: "centre", basis: "1fr", part: centreStack },
    { key: "right", basis: 28, part: rightStack },
  ]);
  const root = host.ui.createStack(win.body, [
    { key: "header", basis: 1, part: headerBar },
    { key: "body", basis: "1fr", part: bodyColumns },
    { key: "sky", basis: 1, part: skyBar },
    { key: "overlay", basis: 1, part: overlayBar },
    { key: "status", basis: 1, part: statusBar },
  ]);

  const clock = createAnimationClock(6);
  const unsubscribe = clock.subscribe((tick) => {
    state.tick = tick * state.tempo;
    if (!state.paused) render();
  });

  function syncClockState() {
    if (state.paused) clock.pause();
    else clock.play();
  }

  function currentRegion(): RegionDef {
    return safeRegion(state.regionId);
  }

  function currentReading(): RegionReading {
    return computeReading(currentRegion(), state.tick, state.skyMode);
  }

  function selectRegionByIndex(index: number) {
    const region = REGIONS[clamp(index, 0, REGIONS.length - 1)] ?? REGIONS[0]!;
    state.regionId = region.id;
    regionList.select(clamp(index, 0, REGIONS.length - 1));
    render();
  }

  function activeAlertCount(): number {
    return REGIONS.filter((region) => computeReading(region, state.tick, state.skyMode).severity > 0).length;
  }

  function render() {
    const innerW = Math.max(96, Number(win.body.width) || 96);
    const innerH = Math.max(24, Number(win.body.height) || 24);
    root.layout({ top: 0, left: 0, width: innerW, height: innerH });

    const region = currentRegion();
    const reading = currentReading();
    const radarWidth = Math.max(20, Number(radarBox.width) || 20);
    const radarHeight = Math.max(8, Number(radarBox.height) || 8);

    headerBar.update({
      left: `Dream Forecast  ${region.label}`,
      right: `${SKY_LABELS[state.skyMode]} · ${OVERLAY_LABELS[state.overlay]} · tempo x${state.tempo}`,
    });
    radarPanel.setActive(true);
    stationPanel.setActive(reading.severity >= 2);
    alertsPanel.setActive(activeAlertCount() > 2);
    skyBar.update({ leftText: ` sky`, activeId: state.paused ? "pause" : state.skyMode });
    overlayBar.update({ leftText: ` overlay`, activeId: state.overlay });
    statusBar.update({
      left: `${reading.alert} · spirits ${reading.spiritIndex}/99 · gauge ${renderDreamGauge(reading, 18)}`,
      right: `↑/↓ region · m sky · o overlay · t tempo · space ${state.paused ? "resume" : "pause"}`,
    });

    radarBox.setContent(renderRadar(radarWidth, radarHeight, {
      tick: state.tick,
      skyMode: state.skyMode,
      overlay: state.overlay,
      selectedRegionId: state.regionId,
    }));
    bulletinBox.setContent(renderBulletin(region, reading, state.tick, state.skyMode));
    stationBox.setContent(`${renderRegionSummary(region, reading, state.skyMode)}\n\n${renderLedger(state.tick, state.skyMode, state.tempo, state.paused)}`);
    alertsBox.setContent(renderAlerts(state.tick, state.skyMode));

    host.screen.render();
  }

  win.describeState(() => {
    const region = currentRegion();
    const reading = currentReading();
    return {
      appType: "wibwob.dreamforecast",
      summary: `Dream Forecast — ${region.label} under ${SKY_LABELS[state.skyMode].toLowerCase()} skies`,
      regionId: region.id,
      regionLabel: region.label,
      skyMode: state.skyMode,
      overlay: state.overlay,
      tempo: state.tempo,
      paused: state.paused,
      pressure: reading.pressure,
      wind: reading.wind,
      visibility: reading.visibility,
      spiritIndex: reading.spiritIndex,
      alert: reading.alert,
      alertCount: activeAlertCount(),
      contentPreview: renderBulletin(region, reading, state.tick, state.skyMode),
    };
  });

  win.captureText(() => {
    const region = currentRegion();
    const reading = currentReading();
    return [
      `Dream Forecast`,
      `${region.label} · ${SKY_LABELS[state.skyMode]} · ${OVERLAY_LABELS[state.overlay]}`,
      reading.summary,
      reading.alert,
      "",
      renderBulletin(region, reading, state.tick, state.skyMode),
      "",
      renderAlerts(state.tick, state.skyMode),
    ].join("\n");
  });

  regionList.on("select", (_item, index) => {
    selectRegionByIndex(index);
    radarBox.focus();
  });

  win.onInput((ch, key) => {
    if (key?.name === "up") {
      const index = REGIONS.findIndex((region) => region.id === state.regionId);
      selectRegionByIndex(index - 1);
      return;
    }
    if (key?.name === "down") {
      const index = REGIONS.findIndex((region) => region.id === state.regionId);
      selectRegionByIndex(index + 1);
      return;
    }
    if (key?.name === "space" || ch === " ") {
      state.paused = !state.paused;
      syncClockState();
      render();
      return;
    }
    if (ch === "m" || ch === "M") {
      state.skyMode = cycleValue(SKY_MODE_CYCLE, state.skyMode);
      render();
      return;
    }
    if (ch === "o" || ch === "O") {
      state.overlay = cycleValue(OVERLAY_CYCLE, state.overlay);
      render();
      return;
    }
    if (ch === "t" || ch === "T") {
      state.tempo = cycleValue(TEMPO_CYCLE, state.tempo);
      render();
      return;
    }
  });

  win.onResize(render);
  win.onRestyle(() => {
    const body = host.theme().body;
    radarBox.style = body;
    bulletinBox.style = body;
    stationBox.style = body;
    alertsBox.style = body;
    regionList.style = {
      ...body,
      selected: host.theme().selected,
      item: body,
    };
    render();
  });
  win.onCleanup(() => {
    unsubscribe();
    clock.destroy();
  });

  syncClockState();
  selectRegionByIndex(REGIONS.findIndex((region) => region.id === state.regionId));
  radarBox.focus();
  win.focus();
}
