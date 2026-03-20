import blessed from "blessed";
import fs from "node:fs";
import { EMPTY_PRIMER_SELECTED } from "../../src/services/microapp-sdk.js";

import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
} from "../../src/services/contour-engine.js";
import {
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  renderTerrainMap,
  type TerrainMap,
} from "../../src/services/terrain-model.js";
import type { BrowserEntry, GalleryTab } from "../../src/core/types.js";
import {
  clamp,
  ContentService,
  createLazyMountedPlayer,
  resolveSidebarWidth,
  type AnimatedPanelPlayer,
  type MicroappHost,
  type MicroappSnapshotWindow,
  type Rect,
  type LayoutPart,
} from "../../src/services/microapp-sdk.js";

type ViewMode = "overview" | "terrain" | "chat";
type HelperKind = "signal-monitor" | "note-cloud";
type PrimerPaneFocus = "list" | "preview";

const VIEW_BUTTONS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "terrain", label: "TERRAIN" },
  { id: "chat", label: "CHAT" },
] as const;

const HELPER_TITLES: Record<HelperKind, string> = {
  "signal-monitor": "Patchbay: Signal Monitor",
  "note-cloud": "Patchbay: Note Cloud",
};

const primerContent = new ContentService();


function clipText(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  return value.length > width
    ? `${value.slice(0, Math.max(0, width - 1))}…`
    : value;
}

function firstChannelId(host: MicroappHost): string | undefined {
  return host.worldChat.listChannels()[0]?.id;
}

function summarizeChannel(
  host: MicroappHost,
  channelId: string | undefined,
): string {
  if (!channelId) {
    return "no channel";
  }
  const channel = host.worldChat.readChannel(channelId);
  if (!channel) {
    return `${channelId} unavailable`;
  }
  return `${channel.label} · ${channel.participants.length} online · ${channel.messages.length} msgs`;
}

function buildOverviewText(args: {
  seed: number;
  terrain: TerrainMap;
  helperKinds: HelperKind[];
  eventLines: string[];
  channelSummary: string;
}): string {
  return [
    "Patchbay Lab",
    "",
    "Coverage harness for the current microapp SDK.",
    "",
    "Current benches:",
    "  - terrain",
    "  - animation",
    "  - world chat",
    "  - primer gallery subview",
    "  - helper windows",
    "  - semantic state + snapshot",
    "",
    `Seed: ${args.seed}`,
    `Terrain: ${args.terrain.terrainName}`,
    `Water: ${Math.round(args.terrain.waterCoverage * 100)}%`,
    `Chat: ${args.channelSummary}`,
    `Helpers: ${args.helperKinds.join(", ") || "(none)"}`,
    "",
    "Latest activity:",
    ...(args.eventLines.slice(-8).length > 0
      ? args.eventLines.slice(-8)
      : ["(no events yet)"]),
  ].join("\n");
}

function createPatchAnimationPlayer(host: MicroappHost): AnimatedPanelPlayer & {
  setRunning(running: boolean): void;
  shuffle(): void;
} {
  let config = {
    mode: "hybrid" as const,
    seed: Math.floor(Math.random() * 100000),
    terrainIdx: Math.floor(Math.random() * terrainNames.length),
    nLevels: 6,
    fps: 8,
  };

  const bridge = createLazyMountedPlayer({
    create(target) {
      return createContourPlayer({
        ...config,
        getViewport: () =>
          readNodeViewport(target, {
            minWidth: 12,
            minHeight: 6,
            fallbackWidth: 20,
            fallbackHeight: 8,
          }),
        onFrame: (content) => {
          target.setContent(content);
          host.screen.render();
        },
      });
    },
    render: () => host.screen.render(),
    clearOnStop: true,
  });

  return {
    ...bridge,
    shuffle() {
      config = {
        mode:
          Math.random() > 0.5
            ? "hybrid"
            : Math.random() > 0.5
              ? "chaos"
              : "order",
        seed: Math.floor(Math.random() * 100000),
        terrainIdx: Math.floor(Math.random() * terrainNames.length),
        nLevels: 3 + Math.floor(Math.random() * 6),
        fps: 8,
      };
      bridge.setRunning(false);
      bridge.setRunning(true);
    },
  };
}

function readPrimerPreview(entry: BrowserEntry | undefined): string {
  if (!entry) {
    return EMPTY_PRIMER_SELECTED;
  }
  try {
    const raw = fs.readFileSync(entry.filePath, "utf8");
    return `${entry.label}\n${entry.filePath}\n\n${raw}`;
  } catch (error) {
    return `Cannot preview primer.\n\n${error instanceof Error ? error.message : String(error)}`;
  }
}

export default function setup(host: MicroappHost) {
  let control:
    | {
        setView: (view: ViewMode) => void;
        reseed: () => void;
        cycleChannel: () => void;
        sendPing: () => void;
        spawnHelper: (kind: HelperKind) => void;
        closeHelpers: () => void;
      }
    | undefined;

  function openPatchbay(args?: Record<string, unknown>) {
    let view: ViewMode =
      typeof args?.view === "string" &&
      VIEW_BUTTONS.some((button) => button.id === args.view)
        ? (args.view as ViewMode)
        : "overview";
    let seed =
      typeof args?.seed === "number"
        ? Math.floor(args.seed)
        : Math.floor(Math.random() * 100000);
    let terrainIdx =
      typeof args?.terrainIdx === "number"
        ? clamp(
            Math.floor(args.terrainIdx),
            0,
            Math.max(0, terrainNames.length - 1),
          )
        : Math.max(0, terrainNames.indexOf("archipelago"));
    let channelId =
      typeof args?.channelId === "string"
        ? args.channelId
        : firstChannelId(host);
    const sender =
      typeof args?.sender === "string" ? args.sender : "patchbay-lab";
    const restoredHelpers = Array.isArray(args?.helperKinds)
      ? args.helperKinds.filter(
          (kind): kind is HelperKind =>
            kind === "signal-monitor" || kind === "note-cloud",
        )
      : [];
    const eventLines: string[] = [];
    let previewText = "";
    let inspectorText = "";
    let deckText = "";
    let statePreview = "";
    let lastSummary = "";
    let lastStatusLeft = "";
    let lastStatusRight = "";
    let unsubscribe: (() => void) | undefined;
    let closing = false;
    let terrain = createTerrainMap({
      width: 56,
      height: 22,
      seed,
      terrainIdx,
      seaLevel: 0.34,
      vegetationEnabled: true,
    });
    let focus = getTerrainFocusPoint(terrain);
    const primerEntries = primerContent.collectGalleryEntries();
    const primerTabs = primerContent.buildGalleryTabs(primerEntries);
    const primerTabButtons = (
      primerTabs.length > 0 ? primerTabs : [{ label: "Empty", entries: [] }]
    ).map((tab, index) => ({
      id: `tab-${index}`,
      label: tab.label,
    }));
    let activePrimerTabIndex =
      typeof args?.primerTabIndex === "number"
        ? clamp(
            Math.floor(args.primerTabIndex),
            0,
            Math.max(0, primerTabButtons.length - 1),
          )
        : 0;
    let activePrimerIndex =
      typeof args?.primerIndex === "number"
        ? Math.max(0, Math.floor(args.primerIndex))
        : 0;
    let primerPaneFocus: PrimerPaneFocus =
      args?.primerPaneFocus === "preview" ? "preview" : "list";

    const helperWindows = new Map<
      HelperKind,
      { id: number; render: () => void; close: () => void }
    >();
    const desktopWidth = Math.max(48, Math.floor(host.geometry.width));
    const desktopHeight = Math.max(18, Math.floor(host.geometry.height));
    const initialWidth = clamp(Math.floor(desktopWidth * 0.78), 88, 140);
    const initialHeight = clamp(Math.floor(desktopHeight * 0.74) + 15, 39, 57);

    const win = host.createWindow({
      title: "Patchbay Lab",
      width: initialWidth,
      height: initialHeight,
    });

    function pushEvent(text: string): void {
      eventLines.push(text);
      while (eventLines.length > 24) {
        eventLines.shift();
      }
    }

    function currentPrimerTab(): GalleryTab {
      return (
        primerTabs[activePrimerTabIndex] ?? { label: "Empty", entries: [] }
      );
    }

    function currentPrimerEntries(): BrowserEntry[] {
      return currentPrimerTab().entries;
    }

    function currentPrimerEntry(): BrowserEntry | undefined {
      const entries = currentPrimerEntries();
      if (entries.length === 0) {
        return undefined;
      }
      activePrimerIndex = clamp(activePrimerIndex, 0, entries.length - 1);
      return entries[activePrimerIndex];
    }

    function switchPrimerTab(nextIndex: number): void {
      activePrimerTabIndex = clamp(
        nextIndex,
        0,
        Math.max(0, primerTabButtons.length - 1),
      );
      activePrimerIndex = 0;
      pushEvent(`primer tab -> ${currentPrimerTab().label}`);
      render();
    }

    function movePrimerSelection(delta: number): void {
      const entries = currentPrimerEntries();
      if (entries.length === 0) {
        return;
      }
      activePrimerIndex = clamp(
        activePrimerIndex + delta,
        0,
        entries.length - 1,
      );
      const selected = entries[activePrimerIndex];
      if (selected) {
        pushEvent(`primer -> ${selected.label}`);
      }
      render();
    }

    function ensureWorld(): void {
      host.worldChat.ensureWorld(
        `patchbay:${terrain.terrainName}:${seed}`,
        terrain.width,
        terrain.height,
      );
      if (!channelId) {
        channelId = firstChannelId(host);
      }
    }

    function rebuildTerrain(nextSeed?: number): void {
      seed =
        typeof nextSeed === "number"
          ? Math.floor(nextSeed)
          : Math.floor(Math.random() * 100000);
      terrain = createTerrainMap({
        width: 56,
        height: 22,
        seed,
        terrainIdx,
        seaLevel: 0.34,
        vegetationEnabled: true,
      });
      focus = getTerrainFocusPoint(terrain);
      ensureWorld();
      animationPlayer.shuffle();
      pushEvent(`terrain reseeded -> ${terrain.terrainName} ${seed}`);
    }

    function cycleChannel(): void {
      const channels = host.worldChat.listChannels();
      if (channels.length === 0) {
        pushEvent("no channels available");
        return;
      }
      const currentIndex = channels.findIndex(
        (channel) => channel.id === channelId,
      );
      const nextIndex =
        currentIndex >= 0 ? (currentIndex + 1) % channels.length : 0;
      channelId = channels[nextIndex]?.id;
      if (channelId) {
        host.worldChat.joinChannel(sender, channelId);
        pushEvent(`joined ${channelId}`);
      }
    }

    function sendPing(): void {
      if (!channelId) {
        pushEvent("cannot send ping: no channel");
        return;
      }
      host.worldChat.joinChannel(sender, channelId);
      host.worldChat.sendMessage(
        sender,
        channelId,
        `patchbay ping ${new Date().toISOString().slice(11, 19)}`,
      );
      pushEvent(`sent ping -> ${channelId}`);
    }

    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const modeBar = host.ui.createButtonBar(
      win.body,
      VIEW_BUTTONS,
      (nextView) => {
        view = nextView;
        pushEvent(`view -> ${nextView}`);
        render();
      },
    );
    const commandDeck = host.ui.createTextBlock(win.body, {
      paddingLeft: 1,
      paddingTop: 0,
    });
    const galleryTabBar = host.ui.createButtonBar(
      win.body,
      primerTabButtons,
      (tabId) => {
        const nextIndex = Number(tabId.replace("tab-", ""));
        if (Number.isFinite(nextIndex)) {
          switchPrimerTab(nextIndex);
        }
      },
    );
    const viewSurfaceNode = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      style: host.theme().body,
    });
    const primerFrameBox = blessed.box({
      parent: viewSurfaceNode,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      tags: true,
      border: "line",
      style: host.theme().body,
    });
    const primerFrameTitle = blessed.box({
      parent: primerFrameBox,
      top: 0,
      left: 1,
      right: 1,
      height: 1,
      tags: true,
      style: host.theme().header,
    });
    const primerFrameStatus = blessed.box({
      parent: primerFrameBox,
      left: 1,
      right: 1,
      height: 1,
      bottom: 0,
      tags: true,
      style: host.theme().footer ?? host.theme().body,
    });
    const simplePreviewBox = blessed.box({
      parent: viewSurfaceNode,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      tags: true,
      mouse: true,
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      style: host.theme().body,
    });
    const primerSidebarBox = blessed.box({
      parent: primerFrameBox,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      tags: true,
      mouse: true,
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      style: host.theme().body,
    });
    const primerDividerBox = blessed.box({
      parent: primerFrameBox,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      tags: true,
      style: host.theme().muted ?? host.theme().body,
    });
    const primerContentBox = blessed.box({
      parent: primerFrameBox,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      tags: false,
      mouse: true,
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      style: host.theme().body,
    });
    const viewSurface: LayoutPart<void> = {
      node: viewSurfaceNode,
      layout(rect: Rect) {
        host.ui.applyRect(viewSurfaceNode, rect);
        if (view === "overview") {
          const frameInset = 1;
          const titleHeight = 1;
          const statusHeight = 1;
          const innerWidth = Math.max(0, rect.width - frameInset * 2);
          const sidebarWidth = resolveSidebarWidth(
            innerWidth,
            { percent: 0.32, min: 24, max: 36 },
            true,  // has divider
            8,     // minimum content width
          );
          const dividerWidth = 1;
          simplePreviewBox.hide();
          primerFrameBox.show();
          primerFrameTitle.show();
          primerFrameStatus.show();
          primerSidebarBox.show();
          primerDividerBox.show();
          primerContentBox.show();
          host.ui.applyRect(primerFrameBox, rect);
          host.ui.applyRect(primerFrameTitle, {
            top: 0,
            left: 1,
            width: Math.max(0, rect.width - 2),
            height: titleHeight,
          });
          host.ui.applyRect(primerFrameStatus, {
            top: Math.max(0, rect.height - 1),
            left: 1,
            width: Math.max(0, rect.width - 2),
            height: statusHeight,
          });
          const innerTop = frameInset + titleHeight;
          const innerHeight = Math.max(
            0,
            rect.height - frameInset - titleHeight - statusHeight - frameInset,
          );
          host.ui.applyRect(primerSidebarBox, {
            top: innerTop,
            left: frameInset,
            width: sidebarWidth,
            height: innerHeight,
          });
          host.ui.applyRect(primerDividerBox, {
            top: innerTop,
            left: frameInset + sidebarWidth,
            width: dividerWidth,
            height: innerHeight,
          });
          host.ui.applyRect(primerContentBox, {
            top: innerTop,
            left: frameInset + sidebarWidth + dividerWidth,
            width: Math.max(
              0,
              innerWidth - sidebarWidth - dividerWidth,
            ),
            height: innerHeight,
          });
        } else {
          primerFrameBox.hide();
          primerFrameTitle.hide();
          primerFrameStatus.hide();
          primerSidebarBox.hide();
          primerDividerBox.hide();
          primerContentBox.hide();
          simplePreviewBox.show();
          host.ui.applyRect(simplePreviewBox, rect);
        }
      },
      update() {},
      restyle() {
        const activeFrame =
          primerPaneFocus === "list"
            ? host.theme().selected
            : (host.theme().input ?? host.theme().selected);
        const inactiveFrame = host.theme().bodyAlt ?? host.theme().body;
        viewSurfaceNode.style = host.theme().body;
        primerFrameBox.style = {
          ...(inactiveFrame ?? {}),
          border: {
            fg: activeFrame.fg,
          },
        } as blessed.Widgets.BoxOptions["style"];
        primerFrameTitle.style = activeFrame;
        primerFrameStatus.style = activeFrame;
        simplePreviewBox.style = host.theme().body;
        primerSidebarBox.style =
          primerPaneFocus === "list" ? activeFrame : host.theme().body;
        primerDividerBox.style =
          primerPaneFocus === "list"
            ? activeFrame
            : (host.theme().muted ?? host.theme().body);
        primerContentBox.style =
          primerPaneFocus === "preview" ? activeFrame : host.theme().body;
      },
      destroy() {
        viewSurfaceNode.destroy();
      },
    };
    const previewDivider = host.ui.createRule(win.body, {
      axis: "horizontal",
      inset: 1,
    });
    const animationPlayer = createPatchAnimationPlayer(host);
    const animationPanel = host.ui.createAnimatedPanel(win.body, {
      player: animationPlayer,
    });
    const previewStack = host.ui.createStack(win.body, [
      {
        key: "primer-tabs",
        basis: 1,
        part: galleryTabBar,
        visible: () => view === "overview",
      },
      { key: "preview", basis: "1fr", part: viewSurface },
      { key: "divider", basis: 1, part: previewDivider },
      { key: "animation", basis: 8, part: animationPanel },
    ]);
    const inspector = host.ui.createTextBlock(win.body, {
      paddingLeft: 1,
      paddingTop: 0,
    });
    const body = host.ui.createRow(win.body, [
      { key: "deck", basis: 29, part: commandDeck },
      { key: "preview", basis: "1fr", part: previewStack },
      { key: "inspector", basis: 34, part: inspector },
    ]);
    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });
    const root = host.ui.createStack(win.body, [
      { key: "header", basis: 1, part: headerBar },
      { key: "modebar", basis: 1, part: modeBar },
      { key: "body", basis: "1fr", part: body },
      { key: "status", basis: 1, part: statusBar },
    ]);

    function spawnHelper(kind: HelperKind): void {
      if (helperWindows.has(kind)) {
        pushEvent(`helper already open -> ${kind}`);
        render();
        return;
      }

      const helper = host.createWindow({
        title: HELPER_TITLES[kind],
        width: kind === "signal-monitor" ? 44 : 40,
        height: kind === "signal-monitor" ? 14 : 12,
        left: kind === "signal-monitor" ? 6 : 16,
        top: kind === "signal-monitor" ? 3 : 7,
      });

      const content = blessed.box({
        parent: helper.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        style: host.theme().body,
      });

      const helperRender = () => {
        const lines =
          kind === "signal-monitor"
            ? [
                "{bold}Signal Monitor{/bold}",
                "",
                `view: ${view}`,
                `channel: ${summarizeChannel(host, channelId)}`,
                "",
                ...eventLines.slice(-10),
              ]
            : [
                "{bold}Note Cloud{/bold}",
                "",
                "Patch ideas:",
                "- use this window for notes/memory later",
                "- make links explicit once ports exist",
                "- title metadata can carry lightweight ownership",
                "",
                `current terrain: ${terrain.terrainName}`,
                `primer tab: ${currentPrimerTab().label}`,
                `helpers: ${[...helperWindows.keys()].join(", ") || "(none)"}`,
              ];
        content.setContent(lines.join("\n"));
      };

      helper.describeState(() => ({
        appRole: "helper",
        helperKind: kind,
        summary: `${HELPER_TITLES[kind]} helper`,
        contentPreview: content
          .getContent()
          .split("\n")
          .slice(0, 10)
          .join("\n"),
      }));
      helper.captureText(() => content.getContent());
      helper.onResize(() => {
        helperRender();
        host.screen.render();
      });
      helper.onRestyle(() => {
        content.style = host.theme().body;
        helperRender();
      });
      helper.onCleanup(() => {
        helperWindows.delete(kind);
        pushEvent(`helper closed -> ${kind}`);
        if (!closing) {
          render();
        }
      });
      helperWindows.set(kind, {
        id: helper.id,
        render: helperRender,
        close: () => helper.close(),
      });
      helperRender();
      helper.focus();
      pushEvent(`helper opened -> ${kind}`);
      render();
    }

    function closeHelpers(): void {
      for (const helper of helperWindows.values()) {
        helper.close();
      }
      helperWindows.clear();
      pushEvent("helpers closed");
      render();
    }

    function renderSimplePreview(): string {
      if (view === "chat") {
        const channel = channelId
          ? host.worldChat.readChannel(channelId)
          : undefined;
        if (!channel) {
          return [
            "{bold}Chat Bench{/bold}",
            "",
            "No active world-chat channel.",
            "",
            "Use [c] to cycle channels or send a ping after a world exists.",
          ].join("\n");
        }
        return [
          `{bold}Chat Bench{/bold}  ${channel.label}`,
          "",
          ...channel.messages.slice(-18).map((message) => {
            const time = message.at.slice(11, 16);
            return message.kind === "chat"
              ? `[${time}] <${message.sender}> ${message.text}`
              : `[${time}] ${message.text}`;
          }),
        ].join("\n");
      }

      const viewport = readNodeViewport(simplePreviewBox, {
        minWidth: 24,
        minHeight: 8,
        fallbackWidth: 36,
        fallbackHeight: 12,
      });
      const lines = renderTerrainMap(terrain, {
        mode: "hybrid",
        levels: 6,
        tags: true,
        camera: {
          centerX: focus.x,
          centerY: focus.y,
          width: Math.max(24, viewport.width),
          height: Math.max(8, viewport.height),
        },
        player: {
          x: focus.x,
          y: focus.y,
          glyph: "@",
          color: "magenta",
        },
      });
      return lines.join("\n");
    }

    function renderPrimerGallery(): { sidebar: string; content: string } {
      const entries = currentPrimerEntries();
      const selected = currentPrimerEntry();
      const sidebarWidth = Math.max(
        12,
        (Number(primerSidebarBox.width) || 26) - 2,
      );
      const sidebarLines = [
        `Primer tab: ${currentPrimerTab().label}`,
        "",
        ...(entries.length > 0
          ? entries.slice(0, 24).map((entry, index) => {
              const marker = index === activePrimerIndex ? ">" : " ";
              return `${marker} ${clipText(entry.label, sidebarWidth - 2)}`;
            })
          : ["(no primers in this tab)"]),
      ];
      const meta = selected ? primerContent.measureEntry(selected) : undefined;
      const contentLines = [
        selected ? selected.label : "No primer selected",
        selected ? selected.filePath : "",
        meta
          ? `measured ${meta.lineCount} lines · ${meta.columnWidth} cols · rec ${meta.recommendedWidth}x${meta.recommendedHeight}`
          : entries.length > 0
            ? "measurement unavailable"
            : "switch tab or add primers",
        "",
        readPrimerPreview(selected),
      ];
      return {
        sidebar: sidebarLines.join("\n"),
        content: contentLines.join("\n"),
      };
    }

    function togglePrimerPaneFocus(): void {
      primerPaneFocus = primerPaneFocus === "list" ? "preview" : "list";
      pushEvent(`primer focus -> ${primerPaneFocus}`);
      render();
    }

    function setPrimerPaneFocus(nextFocus: PrimerPaneFocus): void {
      if (primerPaneFocus === nextFocus) {
        return;
      }
      primerPaneFocus = nextFocus;
      pushEvent(`primer focus -> ${primerPaneFocus}`);
      render();
    }

    function renderInspector(): string {
      const channel = channelId
        ? host.worldChat.readChannel(channelId)
        : undefined;
      const transport = host.worldChat.getTransportStatus();
      const artifact = createSavedTerrainArtifact({
        map: terrain,
        focus,
        renderMode: "hybrid",
        levels: 6,
        playerLabel: "Patchbay",
        playerGlyph: "@",
        playerSprite: [" @ "],
      });
      const selectedPrimer = currentPrimerEntry();

      return [
        "Inspector",
        "",
        `view: ${view}`,
        `seed: ${seed}`,
        `terrain: ${terrain.terrainName} (#${terrainIdx})`,
        `focus: ${focus.x},${focus.y}`,
        `artifact mode: ${artifact.renderMode}`,
        `channel: ${channel?.id ?? "(none)"}`,
        `transport: ${transport.kind}${transport.kind === "irc" ? (transport.connected ? " connected" : " offline") : ""}`,
        `primer tab: ${currentPrimerTab().label}`,
        `primer count: ${currentPrimerEntries().length}`,
        `primer selected: ${selectedPrimer?.label ?? "(none)"}`,
        `helpers: ${[...helperWindows.keys()].join(", ") || "(none)"}`,
        "",
        "Helper window ids:",
        ...([...helperWindows.entries()].length > 0
          ? [...helperWindows.entries()].map(
              ([kind, helper]) => `- ${kind}: #${helper.id}`,
            )
          : ["- none"]),
        "",
        "Latest events:",
        ...(eventLines.slice(-8).length > 0
          ? eventLines.slice(-8)
          : ["(no events yet)"]),
      ].join("\n");
    }

    function renderDeck(): string {
      return [
        "Command Deck",
        "",
        "[1] overview",
        "[2] terrain",
        "[3] chat",
        "[r] reseed terrain",
        "[c] cycle chat channel",
        "[p] send patchbay ping",
        "[m] open signal monitor",
        "[n] open note cloud",
        "[x] close helpers",
        "",
        "Primer bench:",
        "[click/f] focus list/preview",
        "[j/k/↑↓] primer up/down",
        "[[] prev tab",
        "[]] next tab",
        "",
        "Current benches:",
        "- commands",
        "- layout",
        "- terrain",
        "- animation",
        "- world chat",
        "- primer gallery subview",
        "- helper windows",
        "- snapshot/state",
      ].join("\n");
    }

    function render(): void {
      const innerW = Math.max(0, Number(win.body.width) || 0);
      const innerH = Math.max(0, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      deckText = renderDeck();
      inspectorText = renderInspector();
      lastSummary = `Patchbay ${view} · ${terrain.terrainName} · ${helperWindows.size} helpers`;
      statePreview =
        view === "terrain"
          ? `terrain ${terrain.terrainName} seed ${seed} focus ${focus.x},${focus.y}`
          : view === "chat"
            ? summarizeChannel(host, channelId)
            : `overview ${currentPrimerTab().label} selected ${currentPrimerEntry()?.label ?? "(none)"}`;
      lastStatusLeft =
        view === "overview"
          ? `${currentPrimerTab().label} · ${activePrimerIndex + 1}/${Math.max(1, currentPrimerEntries().length)} primers`
          : `${summarizeChannel(host, channelId)} · seed ${seed}`;
      lastStatusRight =
        view === "overview"
          ? `[click/f] ${primerPaneFocus} · list:j/k/↑↓,[ ] · preview:j/k/↑↓ scroll · [q] close`
          : "[1-3] views [r] reseed [m/n] helpers [p] ping [q] close";

      headerBar.update({
        left: "Patchbay Lab",
        right: `${terrain.terrainName} ${seed}`,
      });
      modeBar.update({
        leftText: `mode=${view}  helpers=${helperWindows.size}`,
        activeId: view,
      });
      galleryTabBar.update({
        leftText: "Primer bench",
        activeId:
          primerTabButtons[
            Math.min(activePrimerTabIndex, primerTabButtons.length - 1)
          ]?.id ?? "tab-0",
      });
      commandDeck.update({ text: deckText });

      if (view === "overview") {
        const gallery = renderPrimerGallery();
        previewText = `${gallery.sidebar}\n\n${gallery.content}`;
        simplePreviewBox.setContent("");
        primerFrameTitle.setContent(
          // don't use arrow prefix in PREVIEW mode as u can't use keyboard to navigate primers.
          `${primerPaneFocus === "list" ? "{black-fg}{red-bg} ▶ LIST {/red-bg}{/black-fg}" : "{black-fg}{cyan-bg} PREVIEW {/cyan-bg}{/black-fg}"}  Primer Bench  ${currentPrimerTab().label}`,
        );
        primerFrameStatus.setContent(
          primerPaneFocus === "list"
            ? " ▶ LIST ACTIVE  Click preview or press f  j/k/↑↓ select  [ ] tab "
            : " ▶ PREVIEW ACTIVE  Click list or press f  j/k/↑↓ scroll ",
        );
        primerSidebarBox.setContent(gallery.sidebar);
        primerDividerBox.setContent(
          Array.from(
            { length: Math.max(1, Number(primerDividerBox.height) || 1) },
            () => "│",
          ).join("\n"),
        );
        primerContentBox.setContent(gallery.content);
      } else {
        previewText = renderSimplePreview();
        simplePreviewBox.setContent(previewText);
        primerSidebarBox.setContent("");
        primerDividerBox.setContent("");
        primerContentBox.setContent("");
      }

      inspector.update({ text: inspectorText });
      statusBar.update({
        left: lastStatusLeft,
        right: lastStatusRight,
      });

      for (const helper of helperWindows.values()) {
        helper.render();
      }
      host.screen.render();
    }

    control = {
      setView(nextView) {
        view = nextView;
        pushEvent(`view -> ${nextView}`);
        render();
      },
      reseed() {
        rebuildTerrain();
        render();
      },
      cycleChannel() {
        cycleChannel();
        render();
      },
      sendPing() {
        sendPing();
        render();
      },
      spawnHelper(kind) {
        spawnHelper(kind);
      },
      closeHelpers() {
        closeHelpers();
      },
    };

    ensureWorld();
    if (channelId) {
      host.worldChat.joinChannel(sender, channelId);
    }
    pushEvent("patchbay booted");
    animationPlayer.setRunning(true);

    win.body.key(["1"], () => control?.setView("overview"));
    win.body.key(["2"], () => control?.setView("terrain"));
    win.body.key(["3"], () => control?.setView("chat"));
    win.body.key(["r"], () => control?.reseed());
    win.body.key(["c"], () => control?.cycleChannel());
    win.body.key(["p"], () => control?.sendPing());
    win.body.key(["m"], () => control?.spawnHelper("signal-monitor"));
    win.body.key(["n"], () => control?.spawnHelper("note-cloud"));
    win.body.key(["x"], () => control?.closeHelpers());
    win.body.key(["f"], () => {
      if (view === "overview") togglePrimerPaneFocus();
    });
    win.body.key(["j"], () => {
      if (view !== "overview") return;
      if (primerPaneFocus === "list") {
        movePrimerSelection(1);
      } else {
        primerContentBox.scroll(1);
        host.screen.render();
      }
    });
    win.body.key(["k"], () => {
      if (view !== "overview") return;
      if (primerPaneFocus === "list") {
        movePrimerSelection(-1);
      } else {
        primerContentBox.scroll(-1);
        host.screen.render();
      }
    });
    win.body.key(["down"], () => {
      if (view !== "overview") return;
      if (primerPaneFocus === "list") {
        movePrimerSelection(1);
      } else {
        primerContentBox.scroll(1);
        host.screen.render();
      }
    });
    win.body.key(["up"], () => {
      if (view !== "overview") return;
      if (primerPaneFocus === "list") {
        movePrimerSelection(-1);
      } else {
        primerContentBox.scroll(-1);
        host.screen.render();
      }
    });
    win.body.key(["["], () => {
      if (view === "overview" && primerPaneFocus === "list")
        switchPrimerTab(activePrimerTabIndex - 1);
    });
    win.body.key(["]"], () => {
      if (view === "overview" && primerPaneFocus === "list")
        switchPrimerTab(activePrimerTabIndex + 1);
    });
    win.body.key(["q", "escape"], () => win.close());

    primerSidebarBox.on("click", () => {
      if (view === "overview") {
        setPrimerPaneFocus("list");
      }
    });
    primerContentBox.on("click", () => {
      if (view === "overview") {
        setPrimerPaneFocus("preview");
      }
    });

    win.onResize(render);
    win.onRestyle(() => {
      root.restyle();
      viewSurface.restyle();
      render();
    });
    win.onCleanup(() => {
      closing = true;
      unsubscribe?.();
      animationPlayer.destroy();
      for (const helper of helperWindows.values()) {
        helper.close();
      }
      helperWindows.clear();
      root.destroy();
      control = undefined;
    });
    win.describeState(() => ({
      appRole: "main",
      summary: lastSummary,
      contentPreview: statePreview,
      view,
      seed,
      terrainName: terrain.terrainName,
      terrainIdx,
      channelId,
      primerTabIndex: activePrimerTabIndex,
      primerTabLabel: currentPrimerTab().label,
      primerIndex: activePrimerIndex,
      primerLabel: currentPrimerEntry()?.label,
      primerPaneFocus,
      helperKinds: [...helperWindows.keys()],
      helperWindowIds: [...helperWindows.values()].map((helper) => helper.id),
      eventCount: eventLines.length,
      latestEvent: eventLines[eventLines.length - 1],
    }));
    win.captureText(() =>
      [deckText, "", previewText, "", inspectorText].join("\n"),
    );

    unsubscribe = host.worldChat.subscribe((event) => {
      if (event.type === "world-reset") {
        pushEvent(`world reset -> ${event.worldKey}`);
      } else if (event.type === "channel") {
        pushEvent(`channel updated -> ${event.channelId}`);
      } else {
        pushEvent(
          `transport -> ${event.status.kind}${event.status.kind === "irc" ? (event.status.connected ? " connected" : " offline") : ""}`,
        );
      }
      render();
    });

    for (const kind of restoredHelpers) {
      spawnHelper(kind);
    }

    render();
    win.focus();
  }

  host.registerCommand({
    id: "open",
    label: "Open Patchbay Lab",
    description: "Open the Patchbay Lab SDK coverage harness.",
    action: openPatchbay,
    menu: [{ category: "demos", order: 125, label: "Patchbay Lab" }],
    palette: { order: 125, label: "Open Patchbay Lab" },
  });

  host.registerCommand({
    id: "set-view",
    label: "Set Patchbay View",
    description:
      'Set the active Patchbay Lab view. args: { view: "overview"|"terrain"|"chat" }',
    direct: true,
    action: (args) => {
      const nextView =
        typeof args?.view === "string" &&
        VIEW_BUTTONS.some((button) => button.id === args.view)
          ? (args.view as ViewMode)
          : "overview";
      if (control) {
        control.setView(nextView);
      } else {
        openPatchbay({ view: nextView });
      }
    },
  });

  host.registerCommand({
    id: "reseed",
    label: "Reseed Patchbay Terrain",
    description: "Regenerate the terrain bench inside Patchbay Lab.",
    direct: true,
    action: () => {
      if (control) {
        control.reseed();
      } else {
        openPatchbay();
      }
    },
  });

  host.registerCommand({
    id: "spawn-helper",
    label: "Spawn Patchbay Helper",
    description:
      'Spawn a Patchbay helper window. args: { kind: "signal-monitor"|"note-cloud" }',
    direct: true,
    action: (args) => {
      const kind =
        args?.kind === "note-cloud" ? "note-cloud" : "signal-monitor";
      if (control) {
        control.spawnHelper(kind);
      } else {
        openPatchbay({ helperKinds: [kind] });
      }
    },
  });

  host.registerCommand({
    id: "send-ping",
    label: "Send Patchbay Ping",
    description: "Send a test message into the active world-chat channel.",
    direct: true,
    action: () => {
      if (control) {
        control.sendPing();
      } else {
        openPatchbay({ view: "chat" });
      }
    },
  });

  host.registerSnapshot({
    serialize: (window: MicroappSnapshotWindow) => {
      const state = window.describeState?.() ?? {};
      if (state.appRole !== "main") {
        return undefined;
      }
      return {
        view: state.view ?? "overview",
        seed: state.seed,
        terrainIdx: state.terrainIdx,
        channelId: state.channelId,
        primerTabIndex: state.primerTabIndex,
        primerIndex: state.primerIndex,
        helperKinds: state.helperKinds,
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", {
        view: payload.view,
        seed: payload.seed,
        terrainIdx: payload.terrainIdx,
        channelId: payload.channelId,
        primerTabIndex: payload.primerTabIndex,
        primerIndex: payload.primerIndex,
        primerPaneFocus: payload.primerPaneFocus,
        helperKinds: payload.helperKinds,
      });
    },
  });
}
