/**
 * Application composition root. Owns startup, menus, window openers,
 * workspace restore, theme application, global keybindings, and
 * control API wiring. Coordinates services and window factories
 * but should not accumulate utility logic.
 */

import blessed from "blessed";
import { patchBlessedUnicode } from "./unicode-patch.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { log } from "../services/app-logger.js";

import {
  CONTROL_API_PORT,
  MASTER_PHILOSOPHY_PATH,
  README_PATH,
  REPO_ROOT,
  SCRATCH_BASE,
  SPIKE_NOTES_PATH,
  SPIKE_ROOT,
  STATE_PATH,
  WORKSPACES_DIR,
} from "./config.js";
import { appFlags } from "./cli.js";
import { loadModules } from "../services/module-loader.js";
import type { MicroappHostDeps } from "../services/module-loader.js";
import type { AppMenuActions } from "./command-catalog.js";
import { CommandRegistry, type CommandSurface } from "./command-registry.js";
import {
  buildDesktopContextMenu,
  buildWindowContextMenu,
} from "./context-menu-items.js";
import { DesktopGeometryService } from "./desktop-geometry.js";
import { MenuOverlayManager } from "./menu-overlay-manager.js";
import { OverlayManager } from "./overlay-manager.js";
import {
  theme,
  themeName,
  toggleTheme as toggleThemeVariant,
  allVariants,
  setThemeVariant,
} from "./theme/resolver.js";
import { isRightClick } from "./ui-primitives.js";
import {
  restoreWindowSnapshot,
  serializeWindowSnapshot,
  type WorkspaceRestoreActions,
} from "./workspace-snapshots.js";
import { isPersistable } from "./snapshot-registry.js";
import { loadCanvasFile, restoreCanvas, exportCanvasDocument } from "../services/canvas-document.js";
import type {
  AppType,
  BackroomsChannel,
  Box,
  BrowserEntry,
  DesktopState,
  GalleryTab,
  MenuConfig,
  Textbox,
  WindowKind,
  WindowRecord,
  WindowSnapshot,
} from "./types.js";
import {
  contentToWindowSize,
  getChromeModeForWindow,
} from "./window-chrome.js";
import { WindowManager } from "./window-manager.js";
import { createRenderScheduler, type RenderScheduler } from "./render-scheduler.js";
import { ShellChromeController } from "./shell-chrome.js";
import { RuntimeStatsController } from "./runtime-stats.js";
import { BackroomsService } from "../services/backrooms-service.js";
import {
  measurePlainTextContent,
  measurePrimerContent,
  type ContentMeasurement,
} from "../services/content-measurement.js";
import { ControlApiService } from "../services/control-api.js";
import { ContentService } from "../services/content-service.js";
import {
  getDefaultFigletFont,
  getFigletCatalogue,
  getFigletFontChoices,
  measureFiglet,
  renderFiglet,
} from "../services/figlet-service.js";
import {
  openPrimerFile,
  promptForPrimerFile,
} from "../services/file-actions.js";
import { EditorCoordinator } from "./editor-coordinator.js";
import { StateService } from "../services/state-service.js";
import { capabilityService } from "../services/capability-service.js";
import {
  promptForWorkspaceLoad,
  promptForWorkspaceSave,
} from "../services/workspace-ui.js";
import { WorkspaceService } from "../services/workspace-service.js";
import {
  type BackroomsWindowContext,
  openBackroomsLogBrowserWindow as openBackroomsLogBrowserWindowFactory,
  openBackroomsPrimerPicker as openBackroomsPrimerPickerWindow,
  openBackroomsTvWindow,
  promptForBackroomsRunOptions as promptForBackroomsRunOptionsWindow,
  promptForBackroomsTv as promptForBackroomsTvWindow,
} from "../windows/backrooms-windows.js";
import {
  openFileManagerWindow as openFarjsFileManagerWindow,
  type FileManagerRestore,
  openPrimerBrowserWindow as openPrimerBrowserListWindow,
  openPrimerGalleryWindow as openPrimerGalleryListWindow,
  openTextViewerWindow as openContentViewerWindow,
} from "../windows/browser-windows.js";
import {
  openBrowserReaderWindow as openBrowserReaderContentWindow,
  openFigletFontPicker as openFigletFontPickerWindow,
  openFigletWindow as openFigletBannerWindow,
  promptForFigletText as promptForFigletBannerText,
} from "../windows/figlet-windows.js";
import {
  openCommandPaletteWindow as openPaletteWindow,
  openArtWindow as openGenerativeArtWindow,
  openPatternWindow as openPatternAnimationWindow,
  openStateInspectorWindow as openInspectorWindow,
  openWorkspaceManagerWindow as openWorkspaceCommandWindow,
} from "../windows/generative-windows.js";
import {
  openScrambleFloatingWindow,
  openScrambleSmolPopup,
} from "../windows/scramble-window.js";
import { ScrambleBrain } from "../services/scramble-brain.js";
import { openContourWindow as openContourStudioWindow } from "../windows/contour-window.js";
import { openPlasmaWindow as openPlasmaStudioWindow } from "../windows/plasma-window.js";
import {
  extractMoodFromText,
  type PlasmaModifiers,
} from "../services/plasma-engine.js";
import { openMusicPlayerWindow } from "../windows/music-player-window.js";
import { openTerrainLabWindow as openTerrainLabStudioWindow } from "../windows/terrain-lab-window.js";
// Editor window factory now used via EditorCoordinator
import { type TuiToolContext } from "../services/agent-tools.js";
import { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { ChromeBrowserService } from "../services/chrome-browser-service.js";
import { openChromeBrowserWindow } from "../windows/chrome-browser-window.js";
import { openWibWobAgentWindow as openNativeWibWobAgentWindow } from "../windows/wibwob-agent-window.js";
import { CustomCursor } from "./custom-cursor.js";
import { openMonsterCamWindow } from "../windows/monster-cam-window.js";
import { worldChatService } from "../services/world-chat-service.js";
import {
  createRuntimeCommandService,
  type RuntimeCommandService,
} from "../application/runtime-command-service.js";
import {
  createRuntimeInspectionService,
  type RuntimeInspectionService,
} from "../application/runtime-inspection-service.js";
import {
  createRuntimeWindowService,
  type RuntimeWindowService,
} from "../application/runtime-window-service.js";
import type {
  RuntimeInspectionSnapshot,
  RuntimeOverlayInspection,
} from "../domain/runtime-inspection.js";

/** Exit code used by dev-mode reload. The launcher script watches for this. */
export const DEV_RELOAD_EXIT_CODE = 75;

/** Recursively collect .md file paths under root, skipping node_modules/.git/vendor. */
function collectMarkdownFiles(root: string): string[] {
  const SKIP = new Set(["node_modules", ".git", "vendor", ".pnpm"]);
  const results: string[] = [];
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".planning" && e.name !== ".agents") continue;
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (e.isFile() && e.name.endsWith(".md")) { results.push(full); }
    }
  }
  walk(root);
  return results.sort();
}

/** Top-level application coordinator. Builds the screen, service graph, menus, and window manager. */
export class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private readonly shellChrome: ShellChromeController;
  private readonly runtimeStats: RuntimeStatsController;
  private readonly menus: MenuConfig[];
  private readonly commands: CommandRegistry;
  private readonly menuUi: MenuOverlayManager;
  private readonly windowManager: WindowManager;
  private readonly overlays: OverlayManager;
  private readonly backrooms = new BackroomsService();
  private readonly content = new ContentService();
  private readonly workspace = new WorkspaceService(WORKSPACES_DIR);
  private readonly geometry: DesktopGeometryService;
  private readonly customCursor: CustomCursor | null;
  private readonly state: StateService;
  private readonly controlApi: ControlApiService;
  private readonly runtimeCommands: RuntimeCommandService;
  private readonly runtimeInspection: RuntimeInspectionService;
  private readonly runtimeWindows: RuntimeWindowService;
  private readonly invalidation: RenderScheduler;
  private readonly editor: EditorCoordinator;
  private activeAgentSession?: WibWobAgentSession;
  private readonly scrambleBrain: ScrambleBrain = new ScrambleBrain();
  private scramblePopupWindowId?: string;
  private readonly instanceLabel?: string;
  private readonly instanceId: string;

  constructor(opts?: { instanceLabel?: string; instanceId?: string }) {
    this.instanceLabel = opts?.instanceLabel?.trim() || undefined;
    this.instanceId = opts?.instanceId?.trim() || "???";
    log.setIdentity(this.getInstanceDisplayLabel());
    patchBlessedUnicode();
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      title: "WibWob-DOS TS MVP",
      mouse: true,
      autoPadding: false,
    });

    this.menuBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      height: 1,
      width: "100%",
      tags: true,
      style: theme().menuBar,
    });
    this.desktop = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      bottom: 1,
      width: "100%",
      style: theme().desktop,
    });
    this.statusLine = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      height: 1,
      width: "100%",
      tags: true,
      mouse: true,
      clickable: true,
      style: theme().statusLine,
    });

    // Click the Scramble indicator (=^=) in the bottom-right to toggle smol popup
    this.statusLine.on("click", (mouse) => {
      const clickX = (mouse as unknown as { x: number }).x;
      const w = Math.max(1, Number(this.screen.width) || 80);
      // Indicator is last 7 chars: " (=^=)"
      if (clickX >= w - 8) {
        this.openScrambleSmol();
      }
    });

    this.shellChrome = new ShellChromeController({
      screen: this.screen,
      menuBar: this.menuBar,
      desktop: this.desktop,
      statusLine: this.statusLine,
      getInstanceDisplayLabel: () => this.getInstanceDisplayLabel(),
      getDesktopState: () => this.state.sync(),
      getScrambleFace: () =>
        this.scrambleBrain.sleeping ? "(-.-)"
        : this.scrambleBrain.status === "thinking" ? "(o.O)"
        : this.scrambleBrain.status === "error" ? "(x.x)"
        : this.scrambleBrain.status === "offline" ? "(-.-)"
        : "(=^=)",
      onResize: () => this.syncLiveState(),
      onRestart: () => this.devRestart(),
    });
    this.runtimeStats = new RuntimeStatsController({
      screen: this.screen,
      menuBar: this.menuBar,
      enabled: appFlags().stats,
      getAgentSnapshot: () => this.activeAgentSession?.getSnapshot(),
    });

    // App-level render policy lives here.
    // Converted core owners request sync/persist/render intent through the scheduler.
    // Direct screen.render() still exists in unconverted windows and a few shell-only
    // chrome updates where the app is mutating widgets directly in-place.
    this.invalidation = createRenderScheduler({
      sync: () => this.syncLiveState(),
      persist: () => this.persistState(),
      render: () => this.screen.render(),
    });
    this.windowManager = new WindowManager(
      this.screen,
      this.desktop,
      this.invalidation,
      () => {
        this.shellChrome.repaintDesktop();
        this.invalidation.requestSync();
      },
      (window, x, y) => this.openWindowContextMenu(window, x, y),
    );
    this.windowManager.setEditorWriteHook((id, text) =>
      this.editor.writeTextById(id, text),
    );
    this.geometry = new DesktopGeometryService(this.screen);
    this.customCursor = appFlags().customCursor
      ? new CustomCursor(this.screen)
      : null;
    this.overlays = new OverlayManager(this.screen, () =>
      this.windowManager.restoreWindowFocus(),
    );
    capabilityService.probe();
    this.commands = new CommandRegistry(this.getAppMenuActions());
    this.menus = this.commands.buildMenus();
    this.menuUi = new MenuOverlayManager(
      this.screen,
      this.menuBar,
      this.menus,
      () => this.windowManager.restoreWindowFocus(),
      () => this.syncLiveState(),
      () => this.windowManager.getFocusedWindow()?.describeState?.()?.appType as string | undefined,
    );
    this.editor = new EditorCoordinator({
      windowManager: this.windowManager,
      overlays: this.overlays,
      content: this.content,
      screen: this.screen,
      isMenuOpen: () => this.menuUi.isAnyMenuOpen(),
      invalidation: this.invalidation,
      defaultDir: SPIKE_ROOT,
      editorStartDir: path.dirname(SPIKE_NOTES_PATH),
    });
    this.runtimeCommands = createRuntimeCommandService({
      listCommands: (
        surface?: CommandSurface,
        opts?: { includeUnavailable?: boolean },
      ) => this.commands.list(surface, opts),
      runCommand: (id: string, args?: Record<string, unknown>) =>
        this.commands.run(id, args),
    });
    this.runtimeInspection = createRuntimeInspectionService({
      getState: () => this.getDesktopState(),
      syncState: () => this.state.sync(),
      getPrimerInfo: (pathOrName: string) => this.getPrimerInfo(pathOrName),
      screenshotText: () => (this.screen as any).screenshot() as string,
      getSnapshot: (): RuntimeInspectionSnapshot => ({
        state: this.getDesktopState(),
        stats: this.runtimeStats.snapshot(),
        ui: {
          menu: {
            open: this.menuUi.isAnyMenuOpen(),
            label: this.menuUi.getOpenMenuLabel(),
          },
          overlay: this.getRuntimeOverlayInspection(),
        },
        scramble: {
          status: this.scrambleBrain.status,
          sleeping: this.scrambleBrain.sleeping,
          model: this.scrambleBrain.modelName,
          sessionId: this.scrambleBrain.sessionId,
          messageCount: this.scrambleBrain.history.length,
          lastMessage: this.scrambleBrain.history.at(-1)?.content ?? null,
          logPath: this.scrambleBrain.logPath ?? null,
        },
        history: this.scrambleBrain.history.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      }),
    });
    this.runtimeWindows = createRuntimeWindowService({
      commands: this.runtimeCommands,
      windows: this.windowManager,
    });
    this.controlApi = new ControlApiService(
      CONTROL_API_PORT,
      {
        commands: this.runtimeCommands,
        inspection: this.runtimeInspection,
        windows: this.runtimeWindows,
      },
      {
        instanceLabel: this.instanceLabel,
        instanceId: this.instanceId,
      },
    );
    this.state = new StateService(
      {
        appName: "WibWob-DOS TS MVP",
        appMode: "terminal-native",
        cwd: REPO_ROOT,
        statePath: STATE_PATH,
        instanceLabel: this.instanceLabel,
        instanceId: this.instanceId,
        getControlApiStatus: () => this.controlApi.getStatus(),
      },
      {
        getScreenSize: () => this.geometry.getGeometry(),
        getWindows: () => this.windowManager.getWindows(),
        getFocusedWindow: () => this.windowManager.getFocusedWindow(),
        getOpenMenuLabel: () => this.menuUi.getOpenMenuLabel(),
      },
    );

    // Set scramble session log path
    const scrambleLogDir = path.join(SCRATCH_BASE, "scramble-sessions");
    fs.mkdirSync(scrambleLogDir, { recursive: true });
    this.scrambleBrain.setLogPath(path.join(scrambleLogDir, `${this.scrambleBrain.sessionId}.jsonl`));
    this.scrambleBrain.startSessionSocket();
    // Re-render whichever Scramble window is open when brain state changes externally
    this.scrambleBrain.onChange = () => {
      const win = this.findWindowByAppType("companion-widget");
      win?.refresh?.();
    };
  }

  /** Boot the app: load modules, rebuild menus, render chrome, bind global keys, restore workspace, start control API. */
  async run(): Promise<void> {
    // Load external modules (themes + microapps) before workspace restore
    // so that external themes and commands are available for restoration.
    const microappDeps: MicroappHostDeps = {
      screen: this.screen,
      windowManager: this.windowManager,
      commands: this.commands,
      geometry: this.geometry.getGeometry(),
      focusOrCreate: (appType, createFn, multiInstance) => {
        this.focusOrCreate(appType, createFn, multiInstance);
      },
      worldChat: worldChatService,
      overlays: this.overlays,
      repoRoot: REPO_ROOT,
    };
    await loadModules(microappDeps);

    // Rebuild menus after microapps may have registered dynamic commands
    this.menus.length = 0;
    this.menus.push(...this.commands.buildMenus());

    this.renderChrome();
    this.runtimeStats.init();
    this.bindGlobalKeys();
    this.menuUi.bindMenuClicks((label) => this.openMenu(label));
    this.restoreDefaultWorkspace();
    this.controlApi.start();
    this.persistState();
    this.screen.render();
    log.app(
      `started ${this.screen.width}x${this.screen.height} theme:${themeName()} instance:${this.getInstanceDisplayLabel()}`,
    );
  }

  /** Restore default workspace on boot. Empty desktop if none exists. */
  private restoreDefaultWorkspace(): void {
    if (!this.workspace.exists()) return;
    try {
      const { windows: snapshots, theme: savedTheme } = this.workspace.load();
      if (savedTheme) {
        const variant = allVariants().find((v) => v.name === savedTheme);
        if (variant) {
          setThemeVariant(variant);
          this.applyTheme();
        }
      }
      if (snapshots.length === 0) return;
      let focusedWindow: WindowRecord | undefined;
      for (const snapshot of snapshots) {
        const restored = restoreWindowSnapshot(
          snapshot,
          this.getRestoreActions(),
        );
        if (snapshot.focused) focusedWindow = restored;
      }
      focusedWindow?.focus();
    } catch {
      // Corrupt workspace — start with empty desktop
    }
  }

  private renderChrome(): void {
    this.shellChrome.init();
  }

  /** Save workspace, quit, then send Up arrow to terminal so last command is ready to re-run. */
  private devRestart(): void {
    try {
      this.workspace.save(this.snapshotWindows(), themeName());
    } catch {
      /* best effort */
    }
    this.runtimeStats.destroy();
    this.shellChrome.destroy();
    this.screen.destroy();
    // After blessed releases the terminal, send Up arrow keystroke
    // so the shell shows the last command (e.g. bun run dev) ready to press Enter
    setTimeout(() => {
      process.stdout.write("\x1b[A"); // Up arrow escape sequence
      process.exit(0);
    }, 300);
  }

  private getInstanceDisplayLabel(): string {
    return this.instanceLabel
      ? `${this.instanceLabel} · ${this.instanceId}`
      : this.instanceId;
  }

  private toggleTheme(): void {
    toggleThemeVariant();
    this.applyTheme();
  }

  private setThemeByName(args?: Record<string, unknown>): void {
    const name = String(args?.name ?? "");
    const variant = allVariants().find((v) => v.name === name);
    if (!variant) {
      this.overlays.flash(
        `Unknown theme: ${name}. Available: ${allVariants()
          .map((v) => v.name)
          .join(", ")}`,
      );
      return;
    }
    setThemeVariant(variant);
    this.applyTheme();
  }

  private chooseTheme(): void {
    const variants = allVariants();
    const current = themeName();
    this.overlays.openCenteredListPrompt(
      "Choose Theme",
      variants.map((variant) => ({
        label:
          variant.name === current ? `● ${variant.name}` : `  ${variant.name}`,
        variant,
      })),
      variants.findIndex((variant) => variant.name === current),
      (item) => {
        setThemeVariant(item.variant);
        this.applyTheme();
      },
    );
  }

  /** Apply current theme tokens to all shell chrome and open windows. */
  private applyTheme(): void {
    log.app(`theme → ${themeName()}`);
    this.menuUi.restyle();
    this.customCursor?.restyle();
    this.windowManager.restyleAll();
    this.shellChrome.applyTheme();
    this.runtimeStats.applyTheme();
    this.persistState();
    this.screen.render();
  }

  /** Global input contract: menu triggers, window cycling/resizing, editor save, mouse delegation. */
  private bindGlobalKeys(): void {
    this.screen.key(["C-q"], () => this.destroy());
    this.screen.key(["M-f"], () => this.toggleMenu("File"));
    this.screen.key(["M-e"], () => this.toggleMenu("Edit"));
    this.screen.key(["M-v"], () => this.toggleMenu("View"));
    this.screen.key(["M-w"], () => this.toggleMenu("Window"));
    this.screen.key(["M-t"], () => this.toggleTheme());
    this.screen.key(["M-S-left"], () =>
      this.windowManager.resizeFocusedWindow(-2, 0),
    );
    this.screen.key(["M-S-right"], () =>
      this.windowManager.resizeFocusedWindow(2, 0),
    );
    this.screen.key(["M-S-up"], () =>
      this.windowManager.resizeFocusedWindow(0, -1),
    );
    this.screen.key(["M-S-down"], () =>
      this.windowManager.resizeFocusedWindow(0, 1),
    );
    this.screen.key(["escape"], () => this.closeMenu());
    this.screen.key(["tab"], () => {
      const focused = this.windowManager.getFocusedWindow();
      if (focused?.kind === "editor") {
        this.editor.insertText(focused, "  ");
        return;
      }
      this.windowManager.focusNextWindow(1);
    });
    this.screen.key(["S-tab"], () => this.windowManager.focusNextWindow(-1));
    this.screen.key(["C-s"], () => this.editor.saveFocused());
    this.screen.on("keypress", (ch, key) => {
      this.editor.handleFocusedKeypress(ch, key);
    });
    this.screen.on("mouse", (data) => this.windowManager.handleMouse(data));
    this.desktop.on("mousedown", (data) => {
      if (
        isRightClick(data) &&
        !this.windowManager.getWindowAtPosition(data.x, data.y)
      ) {
        this.openSystemContextMenu(data.x, data.y);
      }
    });
  }

  private openMenu(label: string): void {
    this.menuUi.openMenu(label);
  }

  private toggleMenu(label: string): void {
    this.menuUi.toggleMenu(label);
  }

  private closeMenu(): void {
    this.menuUi.closeMenu();
  }

  private closePopupMenu(): void {
    this.menuUi.closePopupMenu();
  }

  private closeMenus(): void {
    this.menuUi.closeMenus();
  }

  private openPopupMenu(
    items: Array<{ label: string; action: () => void }>,
    x?: number,
    y?: number,
  ): void {
    this.menuUi.openPopupMenu(items, x, y);
  }

  private openWindowContextMenu(
    window: WindowRecord,
    x?: number,
    y?: number,
  ): void {
    this.openPopupMenu(buildWindowContextMenu(window, this.commands), x, y);
  }

  private openSystemContextMenu(x?: number, y?: number): void {
    this.openPopupMenu(buildDesktopContextMenu(this.commands), x, y);
  }

  private toggleDesktopChrome(): void {
    this.shellChrome.toggleDesktopChrome();
  }

  private findWindowByAppType(appType: AppType): WindowRecord | undefined {
    return [...this.windowManager.getWindows()]
      .reverse()
      .find((window) => window.describeState?.().appType === appType);
  }

  /** Focus an existing window of appType, or create one. Single-instance by default.
   *  Returns undefined if the create function did not actually produce a new window. */
  private focusOrCreate(
    appType: AppType,
    createFn: () => void,
    multiInstance = false,
  ): WindowRecord | undefined {
    if (!multiInstance) {
      const existing = this.findWindowByAppType(appType);
      if (existing) {
        existing.focus();
        return existing;
      }
    }

    const countBefore = this.windowManager.getWindows().length;
    createFn();
    const windows = this.windowManager.getWindows();
    // Only return the new window if one was actually created
    if (windows.length > countBefore) {
      return windows[windows.length - 1];
    }
    return undefined;
  }

  private isNonInteractiveCommand(args?: Record<string, unknown>): boolean {
    return args?._interactive === false;
  }

  private getRuntimeOverlayInspection(): RuntimeOverlayInspection | null {
    const info = this.overlays.getActiveOverlayInfo();
    if (!info || typeof info.type !== "string") {
      return null;
    }
    return {
      type: info.type,
      selectedIndex:
        typeof info.selectedIndex === "number" ? info.selectedIndex : undefined,
      count: typeof info.count === "number" ? info.count : undefined,
      currentDirectory:
        typeof info.currentDirectory === "string"
          ? info.currentDirectory
          : undefined,
    };
  }

  /** Build TuiToolContext, create the agent session, and open/focus the native agent window. */
  private openWibWobAgentWindow(): WindowRecord | undefined {
    const tuiContext: TuiToolContext = {
      getState: () => this.runtimeInspection.syncState(),
      listCommands: () => this.runtimeCommands.list("agent"),
      runCommand: (id, args) =>
        this.runtimeCommands.run(id, args, {
          source: "agent",
          interactive: false,
        }),
      browserSearch: async (query, numResults) => {
        const svc = new ChromeBrowserService();
        try {
          const results = await svc.search(query, numResults);
          return results;
        } finally {
          svc.disconnect();
        }
      },
      windows: this.runtimeWindows,
    };

    const existing = this.findWindowByAppType("wibwob-agent");
    if (existing) {
      existing.focus();
      return existing;
    }

    const session = new WibWobAgentSession(tuiContext, REPO_ROOT);
    this.activeAgentSession = session;
    openNativeWibWobAgentWindow({
      screen: this.screen,
      windowManager: this.windowManager,
      agent: session,
      onStateChanged: () => this.syncLiveState(),
    });

    // Set the window id on the session so outbound messages route correctly
    const agentWin = this.windowManager.getLastWindow();
    if (agentWin) {
      session.setWindowId(agentWin.id);
    }
    return agentWin;
  }

  private getBackroomsWindowContext(): BackroomsWindowContext {
    return {
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      backrooms: this.backrooms,
      syncState: () => this.syncLiveState(),
      openEditorWindow: (filePath?: string, title?: string, initial?: string) =>
        this.editor.openWindow(filePath, title, initial),
      openBackroomsTv: (channel: BackroomsChannel) =>
        this.openBackroomsTv(channel),
    };
  }

  private openBackroomsLogBrowserWindow(): WindowRecord | undefined {
    return this.focusOrCreate("backrooms-log-browser", () => {
      openBackroomsLogBrowserWindowFactory(this.getBackroomsWindowContext());
    });
  }

  private promptForBackroomsTv(): WindowRecord | undefined {
    return this.focusOrCreate("backrooms-primer-picker", () => {
      promptForBackroomsTvWindow(this.getBackroomsWindowContext());
    });
  }

  private openBackroomsPrimerPicker(
    theme: string,
    defaults: BackroomsChannel,
  ): WindowRecord | undefined {
    return this.focusOrCreate("backrooms-primer-picker", () => {
      openBackroomsPrimerPickerWindow(
        this.getBackroomsWindowContext(),
        theme,
        defaults,
      );
    });
  }

  private promptForBackroomsRunOptions(
    theme: string,
    primers: string,
    defaults: BackroomsChannel,
  ): void {
    promptForBackroomsRunOptionsWindow(
      this.getBackroomsWindowContext(),
      theme,
      primers,
      defaults,
    );
  }

  openBackroomsTv(channel: BackroomsChannel): WindowRecord | undefined {
    return this.focusOrCreate(
      "backrooms-tv",
      () => {
        openBackroomsTvWindow(this.getBackroomsWindowContext(), channel);
      },
      true,
    );
  }

  private openPrimerBrowserWindow(restore?: {
    selectedIndex?: number;
  }): WindowRecord | undefined {
    return this.focusOrCreate("primer-browser", () => {
      openPrimerBrowserListWindow({
        windowManager: this.windowManager,
        overlays: this.overlays,
        entries: this.content.collectPrimerEntries(),
        onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
        restore,
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private getFocusedFinder() {
    const win = this.windowManager.getFocusedWindow();
    return win?.finder ?? null;
  }

  private getBackroomsPickerApi(): {
    info?: () => unknown;
    select?: (index: number) => unknown;
    confirm?: () => unknown;
    cancel?: () => unknown;
  } | null {
    const win = this.findWindowByAppType("backrooms-primer-picker");
    if (!win) return null;
    const dyn = win as unknown as Record<string, unknown>;
    return {
      info: typeof dyn._backroomsPickerInfo === "function" ? (dyn._backroomsPickerInfo as () => unknown) : undefined,
      select: typeof dyn._backroomsPickerSelect === "function" ? (dyn._backroomsPickerSelect as (index: number) => unknown) : undefined,
      confirm: typeof dyn._backroomsPickerConfirm === "function" ? (dyn._backroomsPickerConfirm as () => unknown) : undefined,
      cancel: typeof dyn._backroomsPickerCancel === "function" ? (dyn._backroomsPickerCancel as () => unknown) : undefined,
    };
  }

  private openFileManagerWindow(
    restore?: FileManagerRestore,
  ): WindowRecord | undefined {
    return this.focusOrCreate("file-manager", () => {
      openFarjsFileManagerWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        overlays: this.overlays,
        startPath: restore?.currentPath ?? REPO_ROOT,
        restore,
        onOpenFile: (filePath) => {
          this.editor.openFile(filePath);
        },
        onViewFile: (filePath) => {
          const content = fs.readFileSync(filePath, "utf8");
          this.openTextViewerWindow(
            path.basename(filePath),
            content,
            "reader",
            filePath,
          );
        },
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private openPrimerGalleryWindow(restore?: {
    activeTabIndex?: number;
    searchValue?: string;
    selectedIndex?: number;
  }): WindowRecord | undefined {
    const allEntries = this.content.collectGalleryEntries();
    return this.focusOrCreate("primer-gallery", () => {
      openPrimerGalleryListWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        overlays: this.overlays,
        allEntries,
        tabs: this.content.buildGalleryTabs(allEntries),
        onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
        restore,
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private openChromeBrowserWindow(
    initialUrl?: string,
  ): WindowRecord | undefined {
    return this.focusOrCreate(
      "web-reader",
      () => {
        openChromeBrowserWindow({
          screen: this.screen,
          windowManager: this.windowManager,
          overlays: this.overlays,
          initialUrl,
          onStateChanged: () => this.syncLiveState(),
        });
      },
      true,
    );
  }

  private openBrowserReaderWindow(
    filePath = MASTER_PHILOSOPHY_PATH,
  ): WindowRecord | undefined {
    return this.focusOrCreate(
      "reader-viewer",
      () => {
        openBrowserReaderContentWindow({
          filePath,
          onOpenTextViewer: (title, content, kind, nextFilePath) =>
            this.openTextViewerWindow(title, content, kind, nextFilePath),
          onError: (message) => this.overlays.flash(message),
        });
      },
      true,
    );
  }

  private promptForFigletText(): void {
    promptForFigletBannerText(this.overlays, (text, font) =>
      this.openFigletFontPicker(text, font),
    );
  }

  private openFigletFontPicker(
    text: string,
    currentFont: string,
    onSelect?: (font: string) => void,
  ): void {
    openFigletFontPickerWindow({
      overlays: this.overlays,
      text,
      currentFont,
      onSelect,
      onOpenWindow: (nextText, font) => this.openFigletWindow(nextText, font),
    });
  }

  private openFigletWindow(
    text: string,
    initialFont = getDefaultFigletFont(),
  ): WindowRecord | undefined {
    return this.focusOrCreate(
      "figlet-banner",
      () => {
        openFigletBannerWindow({
          screen: this.screen,
          windowManager: this.windowManager,
          overlays: this.overlays,
          applyMeasuredWindowSize: (frame, kind, content) =>
            this.applyMeasuredWindowSize(frame, kind, content),
          text,
          initialFont,
          onOpenFontPicker: (nextText, currentFont, onSelect) =>
            this.openFigletFontPicker(nextText, currentFont, onSelect),
          onSyncState: () => this.syncLiveState(),
        });
      },
      true,
    );
  }

  private openPatternWindow(): WindowRecord | undefined {
    return this.focusOrCreate("pattern-animation", () => {
      openPatternAnimationWindow({
        screen: this.screen,
        windowManager: this.windowManager,
      });
    });
  }

  private openContourWindow(): WindowRecord | undefined {
    return this.focusOrCreate("contour-studio", () => {
      openContourStudioWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private openTerrainLabWindow(): WindowRecord | undefined {
    return this.focusOrCreate("terrain-lab", () => {
      openTerrainLabStudioWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private openPlasmaWindow(
    mood?: string,
    renderMode?: string,
    options?: {
      primerName?: string;
      primerText?: string;
      reason?: string;
      modifiers?: PlasmaModifiers;
    },
  ): void {
    openPlasmaStudioWindow(
      {
        screen: this.screen,
        windowManager: this.windowManager,
        onStateChanged: () => this.syncLiveState(),
      },
      {
        mood,
        renderMode: renderMode as any,
        primerName: options?.primerName,
        primerText: options?.primerText,
        reason: options?.reason,
        modifiers: options?.modifiers,
      },
    );
  }

  private openMarkdownViewerWindow(filePath?: string, restore?: { scrollOffset?: number; figlet?: boolean; viewMode?: "edit" | "view" }): WindowRecord | undefined {
    if (filePath) {
      return this.editor.openWindow(filePath, undefined, undefined, restore);
    }
    // No path — pick from repo .md files via recursive fs walk
    const mdList = collectMarkdownFiles(REPO_ROOT);
    if (mdList.length === 0) {
      this.overlays.flash("No .md files found in repo");
      return undefined;
    }
    this.overlays.openCenteredListPrompt(
      "Open Markdown",
      mdList.map(fp => ({ label: fp.replace(REPO_ROOT + "/", ""), filePath: fp })),
      0,
      (item) => {
        this.editor.openWindow(item.filePath);
      }
    );
    return undefined;
  }

  private openPlasmaFromPrimer(filePath?: string): void {
    if (filePath) {
      this.spawnPlasmaForFile(filePath);
      return;
    }
    // No path — open a file picker so the menu item actually works
    promptForPrimerFile({
      overlays: this.overlays,
      content: this.content,
      repoRoot: REPO_ROOT,
      onOpenPrimer: (picked) => this.spawnPlasmaForFile(picked),
    });
  }

  private spawnPlasmaForFile(filePath: string): void {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const analysis = extractMoodFromText(text);
      this.openPlasmaWindow(analysis.mood.name, undefined, {
        primerName: path.basename(filePath),
        primerText: text,
        reason: analysis.reason,
        modifiers: {
          density: analysis.density,
          entropy: analysis.entropy,
          dominantRatio: analysis.dominantRatio,
        },
      });
      this.overlays.flash(`Plasma: ${analysis.mood.name} — ${analysis.reason}`);
    } catch {
      this.openPlasmaWindow();
    }
  }

  private openMusicPlayerWindow(restore?: {
    filePath?: string;
    volume?: number;
  }): WindowRecord | undefined {
    return this.focusOrCreate("music-player", () => {
      openMusicPlayerWindow(
        {
          screen: this.screen,
          windowManager: this.windowManager,
          overlays: this.overlays,
          onStateChanged: () => this.syncLiveState(),
        },
        restore,
      );
    });
  }

  private openCompanionWindow(restore?: {
    tick?: number;
    displayMode?: string;
  }): WindowRecord | undefined {
    const mode = restore?.displayMode;
    if (mode === "smol" || mode === "tall") {
      return this.openScrambleSmol(mode);
    }
    return this.openScrambleFloating();
  }

  private openScrambleFloating(initialPos?: { top: number; left: number; width: number; height: number }): WindowRecord | undefined {
    return this.focusOrCreate("companion-widget", () => {
      openScrambleFloatingWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        brain: this.scrambleBrain,
        initialPos,
        onStateChanged: () => this.shellChrome.updateStatusLine(),
        onOpenLog: () => {
          const lp = this.scrambleBrain.logPath;
          if (!lp) return;
          this.editor.openFile(lp);
        },
      });
    });
  }

  private openScrambleSmol(initialMode?: "smol" | "tall"): WindowRecord | undefined {
    // Close any existing popup first
    const existing = this.findWindowByAppType("companion-widget");
    if (existing) {
      existing.focus();
      return existing;
    }
    openScrambleSmolPopup({
      screen: this.screen,
      windowManager: this.windowManager,
      brain: this.scrambleBrain,
      initialMode,
      onStateChanged: () => this.shellChrome.updateStatusLine(),
      onPopOut: () => {
        // Abort any in-flight send, then close popup and open floating
        this.scrambleBrain.abort();
        const popup = this.findWindowByAppType("companion-widget");
        if (popup) this.windowManager.closeWindow(popup.id);
        this.openScrambleFloating();
      },
    });
    return this.findWindowByAppType("companion-widget");
  }

  private openWorkspaceManagerWindow(): WindowRecord | undefined {
    return this.focusOrCreate("workspace-manager", () => {
      openWorkspaceCommandWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        workspace: this.workspace,
        saveWorkspace: () => this.saveWorkspace(),
        promptForWorkspaceSave: () => this.promptForWorkspaceSave(),
        promptForWorkspaceLoad: () => this.promptForWorkspaceLoad(),
        openCommandPaletteWindow: () => this.openCommandPaletteWindow(),
      });
    });
  }

  private openCommandPaletteWindow(): WindowRecord | undefined {
    return this.focusOrCreate("command-palette", () => {
      openPaletteWindow({
        windowManager: this.windowManager,
        commands: this.commands.buildPalette(),
      });
    });
  }

  private promptForPrimer(): void {
    promptForPrimerFile({
      overlays: this.overlays,
      content: this.content,
      repoRoot: REPO_ROOT,
      onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
    });
  }

  // Editor open/save/keypress behavior delegated to EditorCoordinator

  private openPrimerWindow(filePath: string): WindowRecord | undefined {
    return this.focusOrCreate(
      "primer-viewer",
      () => {
        openPrimerFile({
          overlays: this.overlays,
          filePath,
          onOpenTextViewer: (title, content, kind, nextFilePath, options) =>
            this.openTextViewerWindow(
              title,
              content,
              kind,
              nextFilePath,
              options,
            ),
        });
      },
      true,
    );
  }

  private openArtWindow(): WindowRecord | undefined {
    return this.focusOrCreate("generative-art", () => {
      openGenerativeArtWindow({
        screen: this.screen,
        windowManager: this.windowManager,
      });
    });
  }

  private openMonsterCam(): WindowRecord | undefined {
    return this.focusOrCreate("monster-cam", () => {
      openMonsterCamWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        onStateChanged: () => this.syncLiveState(),
      });
    });
  }

  private copyFocusedWindowText(): void {
    const focused = this.windowManager.getFocusedWindow();
    if (!focused) {
      this.overlays.flash("No focused window.");
      return;
    }
    const text = this.windowManager.captureText(focused.id);
    if (!text) {
      this.overlays.flash("No text to copy from this window.");
      return;
    }
    try {
      const { execSync } = require("node:child_process");
      if (process.platform === "darwin") {
        execSync("pbcopy", { input: text });
      } else {
        execSync("xclip -selection clipboard", { input: text });
      }
      this.overlays.flash(
        `Copied ${text.split("\n").length} lines to clipboard.`,
      );
    } catch {
      this.overlays.flash("Clipboard not available.");
    }
  }

  private exportFocusedWindowText(targetId?: number, label?: string): void {
    let windowId: number;
    let windowTitle: string;
    if (targetId !== undefined) {
      const win = this.windowManager.getWindowById(targetId);
      if (!win) {
        this.overlays.flash(`Window ${targetId} not found.`);
        return;
      }
      windowId = targetId;
      windowTitle = win.title;
    } else {
      const focused = this.windowManager.getFocusedWindow();
      if (!focused) {
        this.overlays.flash("No focused window.");
        return;
      }
      windowId = focused.id;
      windowTitle = focused.title;
    }
    const text = this.windowManager.captureText(windowId);
    if (!text) {
      this.overlays.flash("No text to export from this window.");
      return;
    }
    const capturesDir = path.join(SPIKE_ROOT, "scratch", "captures");
    fs.mkdirSync(capturesDir, { recursive: true });
    const slug = (label ?? windowTitle)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const fileName = `${slug}_${Date.now()}.txt`;
    const filePath = path.join(capturesDir, fileName);
    fs.writeFileSync(filePath, text, "utf8");
    this.overlays.flash(`Exported to ${fileName}`);
  }

  private applyMeasuredWindowSize(
    frame: WindowRecord,
    kind: WindowKind,
    content: { width: number; height: number },
  ): void {
    const target = contentToWindowSize(content, getChromeModeForWindow(kind));
    const geometry = this.geometry.getGeometry();
    this.windowManager.resizeWindow(
      frame.id,
      Math.min(
        Math.max(target.width, 24),
        Math.max(24, geometry.width - Number(frame.frame.left)),
      ),
      Math.min(
        Math.max(target.height, 8),
        Math.max(8, geometry.height - 1 - Number(frame.frame.top)),
      ),
    );
  }

  private openTextViewerWindow(
    title: string,
    content: string,
    kind: "primer" | "reader",
    filePath?: string,
    options?: {
      contentMeasurement?: ContentMeasurement;
      frames?: string[][];
    },
  ): WindowRecord | undefined {
    const measurement =
      options?.contentMeasurement ??
      measurePlainTextContent(content).measurement;
    return this.focusOrCreate(
      kind === "primer" ? "primer-viewer" : "reader-viewer",
      () => {
        openContentViewerWindow({
          windowManager: this.windowManager,
          applyMeasuredWindowSize: (frame, nextKind, measured) =>
            this.applyMeasuredWindowSize(frame, nextKind, measured),
          title,
          content,
          kind,
          filePath,
          measurement,
          frames: options?.frames,
        });
      },
      true,
    );
  }

  private openStateInspectorWindow(): WindowRecord | undefined {
    return this.focusOrCreate("state-inspector", () => {
      openInspectorWindow({
        screen: this.screen,
        windowManager: this.windowManager,
        state: this.state,
        statePath: STATE_PATH,
      });
    });
  }

  private snapshotWindows(): WindowSnapshot[] {
    const focusedId = this.windowManager.getFocusedWindow()?.id;
    return this.windowManager
      .getWindows()
      .filter(isPersistable)
      .map((window) => serializeWindowSnapshot(window, focusedId));
  }

  private saveWorkspace(): void {
    this.workspace.save(this.snapshotWindows(), themeName());
    this.persistState();
    this.overlays.flash(`Saved workspace to ${this.workspace.path}`);
  }

  /** Auto-save current layout to the active workspace (silent, no flash). */
  private autoSaveWorkspace(): void {
    try {
      this.workspace.save(this.snapshotWindows(), themeName());
    } catch {
      /* best-effort — don't block quit */
    }
  }

  private getRestoreActions(): WorkspaceRestoreActions {
    return {
      openPrimerWindow: (filePath) => this.openPrimerWindow(filePath),
      openEditorWindow: (filePath, title, initial, restore) =>
        this.editor.openWindow(filePath, title, initial, restore),
      openBrowserReaderWindow: (filePath) =>
        this.openBrowserReaderWindow(filePath),
      openFigletWindow: (text, font) => this.openFigletWindow(text, font),
      openPatternWindow: () => this.openPatternWindow(),
      openPrimerGalleryWindow: (restore) =>
        this.openPrimerGalleryWindow(restore),
      openPrimerBrowserWindow: (restore) =>
        this.openPrimerBrowserWindow(restore),
      openFileManagerWindow: (restore) => this.openFileManagerWindow(restore),
      openBackroomsTv: (channel) => this.openBackroomsTv(channel),
      openBackroomsLogBrowserWindow: () => this.openBackroomsLogBrowserWindow(),
      openBackroomsPrimerPickerWindow: () =>
        this.openBackroomsPrimerPicker("liminal fluorescent maze", {
          theme: "liminal fluorescent maze",
          primers: "",
          turns: 3,
          model: "sonnet",
        }),
      openChromeBrowserWindow: (restore) =>
        this.openChromeBrowserWindow(restore?.url),
      openCompanionWindow: (restore) => this.openCompanionWindow(restore),
      openArtWindow: () => this.openArtWindow(),
      openMonsterCamWindow: () => this.openMonsterCam(),
      openWibWobAgentWindow: () => this.openWibWobAgentWindow(),
      windows: this.windowManager,
    };
  }

  saveWorkspaceNamed(name: string): void {
    this.workspace.setCurrentWorkspaceName(name);
    this.saveWorkspace();
  }

  private promptForWorkspaceSave(): void {
    promptForWorkspaceSave({
      overlays: this.overlays,
      workspace: this.workspace,
      onSave: () => this.saveWorkspace(),
      onAfterChange: () => this.syncLiveState(),
    });
  }

  private promptForWorkspaceLoad(): void {
    promptForWorkspaceLoad({
      overlays: this.overlays,
      workspace: this.workspace,
      workspaceDir: WORKSPACES_DIR,
      onLoad: () => this.loadWorkspace(),
    });
  }

  loadWorkspaceNamed(name: string): void {
    this.workspace.setCurrentWorkspaceName(name);
    this.loadWorkspace();
  }

  private resolveSmearSource(args?: Record<string, unknown>): {
    sourcePath: string;
    outputKind: "primer" | "reader";
    sourceKind: WindowKind;
  } | { error: string } {
    const explicitFilePath =
      typeof args?.filePath === "string" && args.filePath.trim()
        ? args.filePath.trim()
        : undefined;
    const openAs =
      args?.openAs === "primer" || args?.openAs === "reader"
        ? args.openAs
        : undefined;

    if (explicitFilePath) {
      return {
        sourcePath: explicitFilePath,
        outputKind: openAs ?? "reader",
        sourceKind: openAs ?? "reader",
      };
    }

    const focused = this.windowManager.getFocusedWindow();
    if (!focused) {
      return { error: "No focused window and no filePath provided." };
    }
    if (!focused.filePath) {
      return { error: "Focused window is not file-backed. Pass filePath explicitly." };
    }
    if (focused.kind !== "primer" && focused.kind !== "reader" && focused.kind !== "editor") {
      return { error: `Focused window kind "${focused.kind}" is not smearable.` };
    }
    return {
      sourcePath: focused.filePath,
      outputKind: openAs ?? (focused.kind === "primer" ? "primer" : "reader"),
      sourceKind: focused.kind,
    };
  }

  private runFxScript(
    fx: "glitch" | "shear" | "breed" | "flip",
    args?: Record<string, unknown>,
  ): { ok: true; filePath: string; windowId?: number } | { ok: false; error: string } {
    const { execSync } = require("node:child_process");
    const outDir = path.join(REPO_ROOT, "scratch", "generated", "fx");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = Date.now();
    const outPath = path.join(outDir, `${fx}-${stamp}.txt`);

    try {
      let cmd: string;
      const fxDir = path.join(REPO_ROOT, "scripts", "fx");

      switch (fx) {
        case "glitch": {
          const filePath = String(args?.filePath ?? "");
          if (!filePath) return { ok: false, error: "fx.glitch requires filePath" };
          const intensity = Number(args?.intensity ?? 0.5);
          const seed = args?.seed != null ? Number(args.seed) : Math.floor(Math.random() * 10000);
          cmd = `cat "${filePath}" | "${fxDir}/glitch" ${intensity} ${seed} > "${outPath}"`;
          break;
        }
        case "shear": {
          const filePath = String(args?.filePath ?? "");
          if (!filePath) return { ok: false, error: "fx.shear requires filePath" };
          const skew = Number(args?.skew ?? 2);
          cmd = `cat "${filePath}" | "${fxDir}/shear" ${skew} > "${outPath}"`;
          break;
        }
        case "breed": {
          const file1 = String(args?.file1 ?? "");
          const file2 = String(args?.file2 ?? "");
          if (!file1 || !file2) return { ok: false, error: "fx.breed requires file1 and file2" };
          const mode = String(args?.mode ?? "xor");
          const bias = Number(args?.bias ?? 0.5);
          const seed = args?.seed != null ? Number(args.seed) : 42;
          cmd = `python3 "${fxDir}/breed" "${file1}" "${file2}" --mode ${mode} --bias ${bias} --seed ${seed} --out "${outPath}"`;
          break;
        }
        case "flip": {
          const filePath = String(args?.filePath ?? "");
          if (!filePath) return { ok: false, error: "fx.flip requires filePath" };
          const direction = String(args?.direction ?? "v");
          cmd = `cat "${filePath}" | "${fxDir}/flip" ${direction} > "${outPath}"`;
          break;
        }
      }

      execSync(cmd, { timeout: 10000 });

      if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        return { ok: false, error: `FX ${fx} produced no output` };
      }

      // Open result as primer
      const win = this.openPrimerWindow(outPath);
      return { ok: true, filePath: outPath, windowId: win?.id };
    } catch (err: any) {
      return { ok: false, error: `FX ${fx} failed: ${err?.message ?? String(err)}` };
    }
  }

  private smearTextSurface(args?: Record<string, unknown>): {
    ok: true;
    filePath: string;
    windowId?: number;
    sourcePath: string;
    kind: "primer" | "reader";
    mode: string;
  } | {
    ok: false;
    error: string;
  } {
    const resolved = this.resolveSmearSource(args);
    if ("error" in resolved) {
      this.overlays.flash(resolved.error);
      return { ok: false, error: resolved.error };
    }

    const { sourcePath, outputKind } = resolved;
    if (!fs.existsSync(sourcePath)) {
      const error = `File not found: ${sourcePath}`;
      this.overlays.flash(error);
      return { ok: false, error };
    }

    const scriptPath = path.join(REPO_ROOT, "scripts", "smear.py");
    if (!fs.existsSync(scriptPath)) {
      const error = `Smear script not found: ${scriptPath}`;
      this.overlays.flash(error);
      return { ok: false, error };
    }

    const allowedModes = new Set(["wipe", "shear", "glitch", "stretch", "frames"]);
    const mode =
      typeof args?.mode === "string" && allowedModes.has(args.mode)
        ? args.mode
        : "wipe";

    const generatedDir = path.join(REPO_ROOT, "scratch", "generated", "smear");
    fs.mkdirSync(generatedDir, { recursive: true });
    const slug = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-zA-Z0-9_-]/g, "_");
    const outputPath =
      typeof args?.outPath === "string" && args.outPath.trim()
        ? args.outPath.trim()
        : path.join(generatedDir, `${slug}-${mode}-${Date.now()}.txt`);

    const cmdArgs = [scriptPath, sourcePath, "--mode", mode, "--out", outputPath];
    const numericArg = (name: string) =>
      typeof args?.[name] === "number" && Number.isFinite(args[name] as number)
        ? String(args[name])
        : undefined;

    const maybeWidth = numericArg("width");
    const maybeAt = numericArg("at");
    const maybeTile = numericArg("tile");
    const maybeSkew = numericArg("skew");
    const maybeSeed = numericArg("seed");
    const maybeIntensity = numericArg("intensity");
    const maybeFrom = numericArg("from");
    const maybeTo = numericArg("to");
    const maybeSteps = numericArg("steps");
    const maybeOutdir =
      typeof args?.outdir === "string" && args.outdir.trim()
        ? args.outdir.trim()
        : undefined;

    if (maybeWidth) cmdArgs.push("--width", maybeWidth);
    if (maybeAt) cmdArgs.push("--at", maybeAt);
    if (maybeTile) cmdArgs.push("--tile", maybeTile);
    if (maybeSkew) cmdArgs.push("--skew", maybeSkew);
    if (maybeSeed) cmdArgs.push("--seed", maybeSeed);
    if (maybeIntensity) cmdArgs.push("--intensity", maybeIntensity);
    if (maybeFrom) cmdArgs.push("--from", maybeFrom);
    if (maybeTo) cmdArgs.push("--to", maybeTo);
    if (maybeSteps) cmdArgs.push("--steps", maybeSteps);
    if (maybeOutdir) cmdArgs.push("--outdir", maybeOutdir);

    try {
      execFileSync("python3", cmdArgs, {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch (error) {
      const stderr =
        error instanceof Error && "stderr" in error && typeof error.stderr === "string"
          ? error.stderr.trim()
          : error instanceof Error
            ? error.message
            : String(error);
      const message = `Smear failed: ${stderr || "unknown error"}`;
      this.overlays.flash(message);
      return { ok: false, error: message };
    }

    if (!fs.existsSync(outputPath)) {
      const error = `Smear output missing: ${outputPath}`;
      this.overlays.flash(error);
      return { ok: false, error };
    }

    const title = path.basename(outputPath);
    const rawContent = fs.readFileSync(outputPath, "utf8");
    const opened = outputKind === "primer"
      ? this.openTextViewerWindow(
          title,
          rawContent,
          "primer",
          outputPath,
          { contentMeasurement: measurePrimerContent(rawContent).measurement },
        )
      : this.openTextViewerWindow(
          title,
          rawContent,
          "reader",
          outputPath,
          { contentMeasurement: measurePlainTextContent(rawContent).measurement },
        );

    this.overlays.flash(`Smeared ${path.basename(sourcePath)} → ${path.basename(outputPath)}`);
    return {
      ok: true,
      filePath: outputPath,
      windowId: opened?.id,
      sourcePath,
      kind: outputKind,
      mode,
    };
  }

  /** Restore a workspace: apply theme, tear down existing windows, replay snapshots, restore focus. */
  private loadWorkspace(): void {
    if (!this.workspace.exists()) {
      this.overlays.flash(`Workspace file not found: ${this.workspace.path}`);
      return;
    }
    let snapshots: WindowSnapshot[] = [];
    let savedTheme: string | undefined;
    try {
      const loaded = this.workspace.load();
      snapshots = loaded.windows;
      savedTheme = loaded.theme;
    } catch (error) {
      this.overlays.flash(
        `Cannot parse workspace: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    if (savedTheme) {
      const variant = allVariants().find((v) => v.name === savedTheme);
      if (variant) {
        setThemeVariant(variant);
        this.applyTheme();
      }
    }
    for (const window of this.windowManager.getWindows()) {
      if (window.kind !== "workspace") {
        window.close();
      }
    }
    let focusedWindow: WindowRecord | undefined;
    for (const snapshot of snapshots) {
      const restored = restoreWindowSnapshot(
        snapshot,
        this.getRestoreActions(),
      );
      if (snapshot.focused) {
        focusedWindow = restored;
      }
    }
    focusedWindow?.focus();
    this.persistState();
    this.overlays.flash(`Loaded workspace from ${this.workspace.path}`);
  }

  /** Action bridge between the command catalog/registry and concrete controller behaviour. */
  private getAppMenuActions(): AppMenuActions {
    return {
      browsePrimers: () => this.openPrimerBrowserWindow(),
      openFileManager: () => this.openFileManagerWindow(),
      openPrimerPrompt: (args) => {
        const filePath =
          typeof args?.filePath === "string" ? args.filePath : undefined;
        if (!filePath) {
          if (this.isNonInteractiveCommand(args)) {
            return {
              ok: false,
              error:
                "primer.open requires filePath when called through a non-interactive control surface",
            };
          }
          this.promptForPrimer();
          return;
        }
        const window = this.openPrimerWindow(filePath);
        if (!window) {
          return;
        }
        const x =
          typeof args?.x === "number" ? args.x : Number(window.frame.left);
        const y =
          typeof args?.y === "number" ? args.y : Number(window.frame.top);
        const w =
          typeof args?.w === "number" ? args.w : Number(window.frame.width);
        const h =
          typeof args?.h === "number" ? args.h : Number(window.frame.height);
        if (typeof args?.x === "number" || typeof args?.y === "number") {
          this.windowManager.moveWindow(window.id, x, y);
        }
        if (typeof args?.w === "number" || typeof args?.h === "number") {
          this.windowManager.resizeWindow(window.id, w, h);
        }
      },
      listPrimers: () =>
        this.content.collectPrimerEntries().map((entry) => {
          const measurement = this.content.measureEntry(entry);
          return {
            name: entry.label,
            path: entry.filePath,
            lines: measurement?.lineCount ?? 0,
            width: measurement?.columnWidth ?? 0,
            recommended_w: measurement?.recommendedWidth ?? 0,
            recommended_h: measurement?.recommendedHeight ?? 0,
            animated: measurement?.animated ?? false,
          };
        }),
      smearTextSurface: (args) => this.smearTextSurface(args),
      fxGlitch: (args) => this.runFxScript("glitch", args),
      fxShear: (args) => this.runFxScript("shear", args),
      fxBreed: (args) => this.runFxScript("breed", args),
      fxFlip: (args) => this.runFxScript("flip", args),
      openTextFile: (args) => {
        const filePath =
          typeof args?.filePath === "string" && args.filePath.trim()
            ? args.filePath.trim()
            : undefined;
        if (filePath) {
          // Path A: open a specific file
          this.editor.openFile(filePath, args);
        } else if (
          typeof args?.title === "string" ||
          typeof args?.initial === "string"
        ) {
          // Path B: open an unsaved buffer with title/initial content
          const title =
            typeof args?.title === "string" ? args.title : undefined;
          // (fall through to existing logic)
          const initial =
            typeof args?.initial === "string" ? args.initial : undefined;
          const onSave = typeof args?.onSave === "function" ? args.onSave as (content: string) => void : undefined;
          const win = this.editor.openWindow(undefined, title, initial);
          if (win && onSave) win.onSave = onSave;
        } else {
          // Path C: interactive file picker for keyboard/menu callers only
          if (this.isNonInteractiveCommand(args)) {
            return {
              ok: false,
              error:
                "editor.open requires filePath, title, or initial when called through a non-interactive control surface",
            };
          }
          this.editor.openPicker();
        }
      },
      openEditor: () => this.editor.openWindow(),
      saveFocusedEditor: () => this.editor.saveFocused(),
      saveAsFocusedEditor: () => this.editor.saveAsFocused(),
      saveWorkspaceAs: () => this.promptForWorkspaceSave(),
      loadWorkspacePrompt: () => this.promptForWorkspaceLoad(),
      copyFocusedWindowText: () => this.copyFocusedWindowText(),
      exportFocusedWindowText: (args) => {
        const id = typeof args?.id === "number" ? args.id : undefined;
        const name =
          typeof args?.name === "string" && args.name.trim()
            ? args.name.trim()
            : undefined;
        this.exportFocusedWindowText(id, name);
      },
      openArtWindow: () => this.openArtWindow(),
      openContourWindow: () => this.openContourWindow(),
      openTerrainLab: () => this.openTerrainLabWindow(),
      openPlasmaWindow: (args) => {
        const mood = typeof args?.mood === "string" ? args.mood : undefined;
        const renderMode =
          typeof args?.renderMode === "string" ? args.renderMode : undefined;
        this.openPlasmaWindow(mood, renderMode);
      },
      openPlasmaFromPrimer: (args) => {
        const filePath =
          typeof args?.filePath === "string" ? args.filePath : undefined;
        this.openPlasmaFromPrimer(filePath);
      },
      openMarkdownViewer: (args) => {
        const filePath =
          typeof args?.filePath === "string" && args.filePath.trim()
            ? args.filePath.trim()
            : undefined;
        if (!filePath && this.isNonInteractiveCommand(args)) {
          return {
            ok: false,
            error:
              "markdown.open requires filePath when called through a non-interactive control surface",
          };
        }
        this.openMarkdownViewerWindow(filePath, undefined);
      },
      toggleMarkdownFiglet: () => {
        const focused = this.windowManager.getFocusedWindow();
        if (focused?.kind === "editor" && focused.filePath) {
          focused.writeInput?.("h");
        } else {
          this.overlays.flash("No markdown file focused");
        }
      },
      openWibWobAgent: () => this.openWibWobAgentWindow(),
      reloadAgentPrompt: () => {
        if (!this.activeAgentSession) {
          this.overlays.flash("No active agent session to reload");
          return;
        }
        void this.activeAgentSession.reload()
          .then((reloaded) => {
            this.overlays.flash(
              reloaded ? "Agent prompt/runtime reloaded" : "No active agent session to reload"
            );
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            this.overlays.flash(`Agent reload failed: ${message}`);
          });
      },
      quit: () => this.destroy(),
      focusNextWindow: () => this.windowManager.focusNextWindow(1),
      focusPreviousWindow: () => this.windowManager.focusNextWindow(-1),
      closeFocusedWindow: () => this.windowManager.closeFocusedWindow(),
      closeWindowById: (args) => { this.windowManager.closeWindow(Number(args?.id)); },
      setWindowChrome: (args) => {
        const id = Number(args?.id);
        const mode = String(args?.mode ?? "standard") as "standard" | "none";
        if (!this.windowManager.setWindowChrome(id, mode)) {
          return { ok: false, error: `Window ${id} not found` };
        }
      },
      focusWindowById: (args) => { this.windowManager.focusWindowById(Number(args?.id)); },
      moveWindowById: (args) => {
        const x = args?.x ?? args?.left;
        const y = args?.y ?? args?.top;
        this.windowManager.moveWindow(Number(args?.id), Number(x), Number(y));
      },
      resizeWindowById: (args) => {
        const w = args?.w ?? args?.width;
        const h = args?.h ?? args?.height;
        this.windowManager.resizeWindow(Number(args?.id), Number(w), Number(h));
      },
      clearDesktop: (args) => {
        const closeAll = args?.all === true;
        const overlayCancelled = this.overlays.cancelActiveOverlay();
        this.closeMenus();
        const windows = this.windowManager.getWindows();
        let closed = 0;
        let kept = 0;
        for (const w of windows) {
          if (closeAll || w.kind !== "chat") {
            this.windowManager.closeWindow(w.id);
            closed++;
          } else {
            kept++;
          }
        }
        return {
          closed,
          kept,
          overlayCancelled,
          closeAll,
        };
      },
      toggleDesktopChrome: () => this.toggleDesktopChrome(),
      closeMenus: () => this.closeMenus(),
      overlayConfirm: () => {
        const confirmed = this.overlays.confirmActiveOverlay();
        return confirmed ? { confirmed: true } : { confirmed: false, error: "No active overlay" };
      },
      overlayCancel: () => {
        const cancelled = this.overlays.cancelActiveOverlay();
        return cancelled ? { cancelled: true } : { cancelled: false, error: "No active overlay" };
      },
      overlaySelect: (args) => {
        const index = Number(args?.index);
        if (!Number.isFinite(index)) {
          return { selected: false, error: "index must be a number" };
        }
        const result = this.overlays.selectActiveOverlayIndex(index);
        return result.ok
          ? { selected: true, index: result.index, count: result.count }
          : { selected: false, error: result.error ?? "Selection failed", count: result.count };
      },
      overlayInfo: () => {
        const info = this.overlays.getActiveOverlayInfo();
        return info ? { active: true, ...info } : { active: false };
      },
      openBackroomsPrompt: () => this.promptForBackroomsTv(),
      openBackroomsTv: (args?: Record<string, unknown>) => {
        const theme =
          typeof args?.theme === "string" && args.theme.trim()
            ? args.theme.trim()
            : "liminal fluorescent maze";
        const model =
          typeof args?.model === "string" &&
          ["haiku", "sonnet", "opus"].includes(args.model)
            ? (args.model as "haiku" | "sonnet" | "opus")
            : "sonnet";
        const turns =
          typeof args?.turns === "number"
            ? Math.max(1, Math.min(20, args.turns))
            : 6;
        const mode =
          typeof args?.mode === "string" &&
          ["auto", "live", "fake-live"].includes(args.mode)
            ? (args.mode as "auto" | "live" | "fake-live")
            : "auto";
        this.openBackroomsTv({ theme, model, turns, mode, primers: "" });
      },
      openBackroomsLogBrowser: () => this.openBackroomsLogBrowserWindow(),
      backroomsPickerInfo: () => {
        const api = this.getBackroomsPickerApi();
        if (!api?.info) return { active: false, error: "Backrooms picker not active" };
        return api.info();
      },
      backroomsPickerSelect: (args) => {
        const api = this.getBackroomsPickerApi();
        if (!api?.select) return { selected: false, error: "Backrooms picker not active" };
        const index = Number(args?.index);
        if (!Number.isFinite(index)) return { selected: false, error: "index must be a number" };
        return api.select(index);
      },
      backroomsPickerConfirm: () => {
        const api = this.getBackroomsPickerApi();
        if (!api?.confirm) return { confirmed: false, error: "Backrooms picker not active" };
        return api.confirm();
      },
      backroomsPickerCancel: () => {
        const api = this.getBackroomsPickerApi();
        if (!api?.cancel) return { cancelled: false, error: "Backrooms picker not active" };
        return api.cancel();
      },
      tileWindows: () => this.windowManager.tileWindows(),
      cascadeWindows: () => this.windowManager.cascadeWindows(),
      toggleMaximizeFocused: (args?: Record<string, unknown>) => {
        const byId = typeof args?.windowId === "number"
          ? this.windowManager.getWindowById(args.windowId)
          : undefined;
        const target = byId ?? this.windowManager.getFocusedWindow();
        if (target) this.windowManager.toggleMaximize(target);
      },
      openGallery: () => this.openPrimerGalleryWindow(),
      openBrowserReader: (args) => {
        const filePath =
          typeof args?.filePath === "string" && args.filePath.trim()
            ? args.filePath.trim()
            : undefined;
        this.openBrowserReaderWindow(filePath);
      },
      openChromeBrowser: (args) => {
        const url =
          typeof args?.url === "string" && args.url.trim()
            ? args.url.trim()
            : undefined;
        this.openChromeBrowserWindow(url);
      },
      openFigletBanner: (args) => {
        const text = args?.text as string | undefined;
        if (text) {
          const font = (args?.font as string) || getDefaultFigletFont();
          this.openFigletWindow(text, font);
        } else {
          if (this.isNonInteractiveCommand(args)) {
            return {
              ok: false,
              error:
                "figlet.open requires text when called through a non-interactive control surface",
            };
          }
          this.promptForFigletText();
        }
      },
      listFigletFonts: () => {
        const catalogue = getFigletCatalogue();
        return {
          defaultFont: getDefaultFigletFont(),
          favourites: catalogue.favourites,
          count: catalogue.allFontsSorted.length,
          fonts: catalogue.allFontsSorted.map((font) => ({
            name: font,
            favourite: catalogue.favourites.includes(font),
            meta: catalogue.fontMetadata[font] ?? { height: 0, width: 0 },
          })),
        };
      },
      openMusicPlayer: (args) => {
        const filePath =
          typeof args?.filePath === "string" && args.filePath.trim()
            ? args.filePath.trim()
            : undefined;
        this.openMusicPlayerWindow(filePath ? { filePath } : undefined);
      },
      openSy2Chronicles: (args) => {
        const result = this.commands.runDynamic("microapp.wibwob.sy2chronicles.open", args);
        if (!result.ok) {
          this.overlays.flash(result.error);
        }
      },
      openPatternWindow: () => this.openPatternWindow(),
      openCompanionWindow: () => this.openCompanionWindow(),
      openScrambleSmol: () => { this.openScrambleSmol(); },
      openScrambleFloating: () => { this.openScrambleFloating(); },
      scrambleSay: (args) => {
        const text = typeof args?.text === "string" ? args.text.trim() : "";
        if (!text) return;
        const win = this.findWindowByAppType("companion-widget");
        if (win?.writeInput) {
          win.writeInput(text);
        } else {
          void this.scrambleBrain.send(text).then(() => this.shellChrome.updateStatusLine());
        }
      },
      scrambleExpand: () => {
        const win = this.findWindowByAppType("companion-widget");
        if (win) {
          const expand = (win as unknown as Record<string, unknown>)._scrambleExpand;
          if (typeof expand === "function") (expand as () => void)();
        }
      },
      scramblePopOut: () => {
        const win = this.findWindowByAppType("companion-widget");
        if (win) {
          const popOut = (win as unknown as Record<string, unknown>)._scramblePopOut;
          if (typeof popOut === "function") (popOut as () => void)();
        }
      },
      scramblePet: () => {
        void this.scrambleBrain.send("/pet").then(() => this.shellChrome.updateStatusLine());
        const win = this.findWindowByAppType("companion-widget");
        win?.writeInput?.("/pet");
      },
      scrambleSleep: () => {
        void this.scrambleBrain.send("/sleep").then(() => this.shellChrome.updateStatusLine());
      },
      scrambleWake: () => {
        void this.scrambleBrain.send("/wake").then(() => this.shellChrome.updateStatusLine());
      },
      scrambleMeow: () => {
        void this.scrambleBrain.send("/meow").then(() => this.shellChrome.updateStatusLine());
        const win = this.findWindowByAppType("companion-widget");
        win?.writeInput?.("/meow");
      },
      openWorkspaceManager: () => this.openWorkspaceManagerWindow(),
      openCommandPalette: () => this.openCommandPaletteWindow(),
      openStateInspector: () => this.openStateInspectorWindow(),
      saveWorkspace: (args) => {
        const name =
          typeof args?.name === "string" && args.name.trim()
            ? args.name.trim()
            : undefined;
        if (name) {
          this.saveWorkspaceNamed(name);
        } else {
          this.saveWorkspace();
        }
      },
      loadWorkspace: (args) => {
        const name =
          typeof args?.name === "string" && args.name.trim()
            ? args.name.trim()
            : undefined;
        if (name) {
          this.loadWorkspaceNamed(name);
        } else {
          this.loadWorkspace();
        }
      },
      toggleTheme: () => this.toggleTheme(),
      chooseTheme: () => this.chooseTheme(),
      setTheme: (args) => this.setThemeByName(args),
      // ── Finder ──────────────────────────────────────────
      finderSearch: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const query = typeof args?.query === "string" ? args.query : "";
        const glob = typeof args?.glob === "string" ? args.glob : undefined;
        finder.search(query, glob);
      },
      finderNavigate: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const dirPath = typeof args?.path === "string" ? args.path : "";
        finder.navigateTo(dirPath);
      },
      finderToggleView: () => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        finder.toggleView();
      },

      finderAdvancedSearch: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const query = typeof args?.query === "string" ? args.query : "";
        // Stub — will dispatch to QMD when implemented
        this.overlays.flash("Advanced search (QMD) coming soon");
        void query;
      },
      finderBookmarkPath: () => {
        this.overlays.flash("Bookmarks coming soon");
      },
      finderGoToBookmark: (_args) => {
        this.overlays.flash("Bookmarks coming soon");
      },
      finderNewFolder: () => {
        this.overlays.flash("New folder coming soon");
      },
      finderRefresh: () => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        finder.refresh();
      },
      finderSortBy: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const field =
          typeof args?.field === "string" &&
          ["name", "size", "modified", "type"].includes(args.field)
            ? (args.field as "name" | "size" | "modified" | "type")
            : "name";
        finder.sortBy(field);
      },
      // ── Monster Cam ─────────────────────────────────────
      openMonsterCam: () => this.openMonsterCam(),
      // ── Canvas documents ─────────────────────────────────
      loadCanvas: (args) => {
        const filePath = typeof args?.filePath === "string" ? args.filePath : "";
        if (!filePath) {
          this.overlays.flash("canvas.load requires filePath arg");
          return;
        }
        try {
          const doc = loadCanvasFile(filePath);
          const result = restoreCanvas(doc, this.getRestoreActions());
          this.overlays.flash(`Canvas loaded: ${result.loaded} windows (${result.skipped} skipped)`);
          if (result.errors.length > 0) {
            for (const err of result.errors) log.app(err);
          }
        } catch (e) {
          this.overlays.flash(`Canvas load failed: ${e}`);
        }
      },
      exportCanvas: (args) => {
        const filePath = typeof args?.filePath === "string" ? args.filePath : "";
        if (!filePath) {
          this.overlays.flash("canvas.export requires filePath arg");
          return;
        }
        const title = typeof args?.title === "string" ? args.title : "Untitled Canvas";
        try {
          const windows = this.windowManager.getWindows();
          const yaml = exportCanvasDocument(windows, this.windowManager, title);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, yaml, "utf8");
          this.overlays.flash(`Canvas exported: ${filePath}`);
        } catch (e) {
          this.overlays.flash(`Canvas export failed: ${e}`);
        }
      },
      // ── Help ────────────────────────────────────────────
      viewReadme: () => {
        const rec = this.openMarkdownViewerWindow(README_PATH);
        if (rec) {
          const sw = Number(this.screen.width);
          const sh = Number(this.screen.height);
          const w = Math.round(sw * 0.8);
          const h = Math.round(sh * 0.7);
          rec.frame.width = w;
          rec.frame.height = h;
          rec.frame.left = Math.round((sw - w) / 2);
          rec.frame.top = Math.round((sh - h) / 2);
          if (rec.shadow) {
            rec.shadow.width = w;
            rec.shadow.height = h;
            rec.shadow.left = Number(rec.frame.left) + 2;
            rec.shadow.top = Number(rec.frame.top) + 1;
          }
          this.screen.render();
        }
      },
    };
  }

  /** Return the current desktop state snapshot. Fed to control API and agent state injection. */
  getDesktopState(): DesktopState {
    return this.state.getState();
  }

  /** Resolve a primer by path or name and return measured content info. Used by control API. */
  getPrimerInfo(pathOrName: string): Record<string, unknown> {
    const entry = this.content.getPrimerInfo(pathOrName);
    if (!entry) {
      return { ok: false, path: pathOrName, error: "Primer not found" };
    }
    // Measure on demand — not at gallery scan time
    const m = this.content.measureEntry(entry);
    return {
      ok: true,
      path: entry.filePath,
      name: entry.label,
      content_width: m?.columnWidth ?? 0,
      content_lines: m?.lineCount ?? 0,
      recommended_w: m?.recommendedWidth ?? 0,
      recommended_h: m?.recommendedHeight ?? 0,
      animated: m?.animated ?? false,
      frame_count: m?.frameCount ?? 1,
    };
  }

  // writeEditorTextById delegated to this.editor.writeTextById via setEditorWriteHook

  /** Cheap live state sync: rebuild in-memory state and update status line. No disk write, no listener fanout.
   *  Use for routine mutations: drag, resize, focus, typing, window-internal state changes. */
  private syncLiveState(): void {
    this.shellChrome.updateStatusLine();
  }

  /** Expensive state checkpoint: rebuild, write to disk, fire listeners.
   *  Use for significant events: startup, theme change, workspace load/save, editor save. */
  private persistState(): void {
    this.shellChrome.updateStatusLine();
    this.state.persistAndNotify();
  }

  private destroy(): void {
    this.autoSaveWorkspace();
    this.controlApi.stop();
    this.runtimeStats.destroy();
    this.shellChrome.destroy();
    this.screen.destroy();
    process.exit(0);
  }
}
