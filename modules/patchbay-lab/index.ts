import blessed from "blessed";

import {
  createContourPlayer,
  createLazyMountedPlayer,
  createNodePart,
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  readNodeViewport,
  renderTerrainMap,
  terrainNames,
  type AnimatedPanelPlayer,
  type MicroappHost,
  type MicroappSnapshotWindow,
  type TerrainMap,
} from "../../src/services/microapp-sdk.js";

type ViewMode = "overview" | "terrain" | "chat";
type HelperKind = "signal-monitor" | "note-cloud";

const VIEW_BUTTONS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "terrain", label: "TERRAIN" },
  { id: "chat", label: "CHAT" },
] as const;

const HELPER_TITLES: Record<HelperKind, string> = {
  "signal-monitor": "Patchbay: Signal Monitor",
  "note-cloud": "Patchbay: Note Cloud",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function firstChannelId(host: MicroappHost): string | undefined {
  return host.worldChat.listChannels()[0]?.id;
}

function summarizeChannel(host: MicroappHost, channelId: string | undefined): string {
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
    ...(args.eventLines.slice(-8).length > 0 ? args.eventLines.slice(-8) : ["(no events yet)"]),
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
        mode: Math.random() > 0.5 ? "hybrid" : Math.random() > 0.5 ? "chaos" : "order",
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
      typeof args?.view === "string" && VIEW_BUTTONS.some((button) => button.id === args.view)
        ? (args.view as ViewMode)
        : "overview";
    let seed = typeof args?.seed === "number" ? Math.floor(args.seed) : Math.floor(Math.random() * 100000);
    let terrainIdx = typeof args?.terrainIdx === "number"
      ? clamp(Math.floor(args.terrainIdx), 0, Math.max(0, terrainNames.length - 1))
      : Math.max(0, terrainNames.indexOf("archipelago"));
    let channelId = typeof args?.channelId === "string" ? args.channelId : firstChannelId(host);
    const sender = typeof args?.sender === "string" ? args.sender : "patchbay-lab";
    const restoredHelpers = Array.isArray(args?.helperKinds)
      ? args.helperKinds.filter((kind): kind is HelperKind => kind === "signal-monitor" || kind === "note-cloud")
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

    const helperWindows = new Map<HelperKind, { id: number; render: () => void; close: () => void }>();
    const desktopWidth = Math.max(48, Math.floor(host.geometry.width));
    const desktopHeight = Math.max(18, Math.floor(host.geometry.height));
    const initialWidth = clamp(Math.floor(desktopWidth * 0.78), 88, 140);
    const initialHeight = clamp(Math.floor(desktopHeight * 0.74), 24, 42);

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

    function ensureWorld(): void {
      host.worldChat.ensureWorld(`patchbay:${terrain.terrainName}:${seed}`, terrain.width, terrain.height);
      if (!channelId) {
        channelId = firstChannelId(host);
      }
    }

    function rebuildTerrain(nextSeed?: number): void {
      seed = typeof nextSeed === "number" ? Math.floor(nextSeed) : Math.floor(Math.random() * 100000);
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
      const currentIndex = channels.findIndex((channel) => channel.id === channelId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % channels.length : 0;
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
      host.worldChat.sendMessage(sender, channelId, `patchbay ping ${new Date().toISOString().slice(11, 19)}`);
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
    const commandDeck = host.ui.createTextBlock(win.body, { paddingLeft: 1, paddingTop: 0 });
    const previewBox = blessed.box({
      parent: win.body,
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
    const previewPart = createNodePart(previewBox, {
      restyle: () => {
        previewBox.style = host.theme().body;
      },
    });
    const previewDivider = host.ui.createRule(win.body, { axis: "horizontal", inset: 1 });
    const animationPlayer = createPatchAnimationPlayer(host);
    const animationPanel = host.ui.createAnimatedPanel(win.body, { player: animationPlayer });
    const previewStack = host.ui.createStack(win.body, [
      { key: "preview", basis: "1fr", part: previewPart },
      { key: "divider", basis: 1, part: previewDivider },
      { key: "animation", basis: 8, part: animationPanel },
    ]);
    const inspector = host.ui.createTextBlock(win.body, { paddingLeft: 1, paddingTop: 0 });
    const body = host.ui.createColumns(win.body, [
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
                `helpers: ${[...helperWindows.keys()].join(", ") || "(none)"}`,
              ];
        content.setContent(lines.join("\n"));
      };

      helper.describeState(() => ({
        appRole: "helper",
        helperKind: kind,
        summary: `${HELPER_TITLES[kind]} helper`,
        contentPreview: content.getContent().split("\n").slice(0, 10).join("\n"),
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

    function renderPreview(): string {
      if (view === "overview") {
        return buildOverviewText({
          seed,
          terrain,
          helperKinds: [...helperWindows.keys()],
          eventLines,
          channelSummary: summarizeChannel(host, channelId),
        });
      }

      if (view === "chat") {
        const channel = channelId ? host.worldChat.readChannel(channelId) : undefined;
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

      const viewport = readNodeViewport(previewBox, {
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

    function renderInspector(): string {
      const channel = channelId ? host.worldChat.readChannel(channelId) : undefined;
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

      return [
        "Inspector",
        "",
        `view: ${view}`,
        `seed: ${seed}`,
        `terrain: ${terrain.terrainName} (#${terrainIdx})`,
        `focus: ${focus.x},${focus.y}`,
        `artifact mode: ${artifact.renderMode}`,
        `channel: ${channel?.id ?? "(none)"}`,
        `transport: ${transport.kind}${transport.kind === "irc" ? transport.connected ? " connected" : " offline" : ""}`,
        `helpers: ${[...helperWindows.keys()].join(", ") || "(none)"}`,
        "",
        "Helper window ids:",
        ...([...helperWindows.entries()].length > 0
          ? [...helperWindows.entries()].map(([kind, helper]) => `- ${kind}: #${helper.id}`)
          : ["- none"]),
        "",
        "Latest events:",
        ...(eventLines.slice(-8).length > 0 ? eventLines.slice(-8) : ["(no events yet)"]),
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
        "[q] close patchbay",
        "",
        "Current benches:",
        "- commands",
        "- layout",
        "- terrain",
        "- animation",
        "- world chat",
        "- helper windows",
        "- snapshot/state",
      ].join("\n");
    }

    function render(): void {
      const innerW = Math.max(0, Number(win.body.width) || 0);
      const innerH = Math.max(0, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      previewText = renderPreview();
      inspectorText = renderInspector();
      deckText = renderDeck();
      lastSummary = `Patchbay ${view} · ${terrain.terrainName} · ${helperWindows.size} helpers`;
      statePreview =
        view === "terrain"
          ? `terrain ${terrain.terrainName} seed ${seed} focus ${focus.x},${focus.y}`
          : view === "chat"
            ? summarizeChannel(host, channelId)
            : `overview ${terrain.terrainName} helpers ${helperWindows.size}`;
      lastStatusLeft = `${summarizeChannel(host, channelId)} · seed ${seed}`;
      lastStatusRight = "[1-3] views [r] reseed [m/n] helpers [p] ping [q] close";

      headerBar.update({
        left: "Patchbay Lab",
        right: `${terrain.terrainName} ${seed}`,
      });
      modeBar.update({
        leftText: `mode=${view}  helpers=${helperWindows.size}`,
        activeId: view,
      });
      commandDeck.update({ text: deckText });
      previewBox.setContent(previewText);
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
    win.body.key(["q", "escape"], () => win.close());

    win.onResize(render);
    win.onRestyle(() => {
      previewBox.style = host.theme().body;
      root.restyle();
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
      helperKinds: [...helperWindows.keys()],
      helperWindowIds: [...helperWindows.values()].map((helper) => helper.id),
      eventCount: eventLines.length,
      latestEvent: eventLines[eventLines.length - 1],
    }));
    win.captureText(() => [deckText, "", previewText, "", inspectorText].join("\n"));

    unsubscribe = host.worldChat.subscribe((event) => {
      if (event.type === "world-reset") {
        pushEvent(`world reset -> ${event.worldKey}`);
      } else if (event.type === "channel") {
        pushEvent(`channel updated -> ${event.channelId}`);
      } else {
        pushEvent(`transport -> ${event.status.kind}${event.status.kind === "irc" ? event.status.connected ? " connected" : " offline" : ""}`);
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
    menu: [{ category: "applications", order: 125, label: "Patchbay Lab" }],
    palette: { order: 125, label: "Open Patchbay Lab" },
  });

  host.registerCommand({
    id: "set-view",
    label: "Set Patchbay View",
    description: 'Set the active Patchbay Lab view. args: { view: "overview"|"terrain"|"chat" }',
    direct: true,
    action: (args) => {
      const nextView =
        typeof args?.view === "string" && VIEW_BUTTONS.some((button) => button.id === args.view)
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
    description: 'Spawn a Patchbay helper window. args: { kind: "signal-monitor"|"note-cloud" }',
    direct: true,
    action: (args) => {
      const kind = args?.kind === "note-cloud" ? "note-cloud" : "signal-monitor";
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
        helperKinds: state.helperKinds,
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", {
        view: payload.view,
        seed: payload.seed,
        terrainIdx: payload.terrainIdx,
        channelId: payload.channelId,
        helperKinds: payload.helperKinds,
      });
    },
  });
}
