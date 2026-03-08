/**
 * Application composition root. Owns startup, menus, window openers,
 * workspace restore, theme application, global keybindings, and
 * control API wiring. Coordinates services and window factories
 * but should not accumulate utility logic.
 */

import blessed from "blessed";
import stringWidth from "string-width";
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
  SPIKE_NOTES_PATH,
  SPIKE_ROOT,
  STATE_PATH,
  WORKSPACES_DIR,
} from "./config.js";
import { appFlags } from "./cli.js";
import { ModuleRuntimeService } from "../services/module-loader.js";
import type { MicroappHostDeps } from "../services/module-loader.js";
import type { AppMenuActions } from "./command-catalog.js";
import { CommandRegistry } from "./command-registry.js";
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
} from "../windows/content-windows.js";
import {
  openBrowserReaderWindow as openBrowserReaderContentWindow,
  openFigletFontPicker as openFigletFontPickerWindow,
  openFigletWindow as openFigletBannerWindow,
  promptForFigletText as promptForFigletBannerText,
} from "../windows/figlet-windows.js";
import {
  openCommandPaletteWindow as openPaletteWindow,
  openCompanionWindow as openScrambleWindow,
  openArtWindow as openGenerativeArtWindow,
  openPatternWindow as openPatternAnimationWindow,
  openStateInspectorWindow as openInspectorWindow,
  openWorkspaceManagerWindow as openWorkspaceCommandWindow,
} from "../windows/misc-windows.js";
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

/** Exit code used by dev-mode reload. The launcher script watches for this. */
export const DEV_RELOAD_EXIT_CODE = 75;

/** Top-level application coordinator. Builds the screen, service graph, menus, and window manager. */
export class TsTuiMvpApp {
  private readonly screen: blessed.Widgets.Screen;
  private readonly menuBar: Box;
  private readonly desktop: Box;
  private readonly statusLine: Box;
  private statusKaomoji?: Box;
  private statusIdentity?: Box;
  private kaomojiBlink = false;
  private desktopChromeless = false;
  private kaomojiTimer?: NodeJS.Timeout;
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
  private readonly moduleRuntime: ModuleRuntimeService;
  private readonly editor: EditorCoordinator;
  private activeAgentSession?: WibWobAgentSession;
  private readonly instanceLabel?: string;
  private readonly sessionId: string;

  constructor(opts?: { instanceLabel?: string; sessionId?: string }) {
    this.instanceLabel = opts?.instanceLabel?.trim() || undefined;
    this.sessionId = opts?.sessionId?.trim() || "???";
    log.setIdentity(this.getInstanceDisplayLabel());
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
      style: theme().statusLine,
    });

    this.windowManager = new WindowManager(
      this.screen,
      this.desktop,
      () => {
        this.repaintDesktop();
        this.syncLiveState();
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
    );
    this.editor = new EditorCoordinator({
      windowManager: this.windowManager,
      overlays: this.overlays,
      content: this.content,
      screen: this.screen,
      isMenuOpen: () => this.menuUi.isAnyMenuOpen(),
      syncLiveState: () => this.syncLiveState(),
      persistState: () => this.persistState(),
      defaultDir: SPIKE_ROOT,
      editorStartDir: path.dirname(SPIKE_NOTES_PATH),
    });
    const microappDeps: MicroappHostDeps = {
      screen: this.screen,
      windowManager: this.windowManager,
      commands: this.commands,
      geometry: this.geometry.getGeometry(),
      focusOrCreate: (appType, createFn, multiInstance) => {
        this.focusOrCreate(appType, createFn, multiInstance);
      },
      worldChat: worldChatService,
      onModuleCommandsChanged: () => this.rebuildMenus(),
      onRuntimeStateChanged: () => this.syncLiveState(),
    };
    this.moduleRuntime = new ModuleRuntimeService(microappDeps);
    this.controlApi = new ControlApiService(
      CONTROL_API_PORT,
      {
        getState: () => this.getDesktopState(),
        syncState: () => this.state.sync(),
        listModules: () => this.moduleRuntime.listModules(),
        reloadModule: (id) => this.moduleRuntime.reloadModule(id),
        unloadModule: (id) => this.moduleRuntime.unloadModule(id),
        getPrimerInfo: (pathOrName) => this.getPrimerInfo(pathOrName),
        listCommands: (surface, opts) => this.commands.list(surface, opts),
        runCommand: (id, args) => this.commands.run(id, args),
        windows: this.windowManager,
        screenshotText: () => (this.screen as any).screenshot() as string,
      },
      {
        instanceLabel: this.instanceLabel,
        sessionId: this.sessionId,
      },
    );
    this.state = new StateService(
      {
        appName: "WibWob-DOS TS MVP",
        appMode: "terminal-native",
        cwd: REPO_ROOT,
        statePath: STATE_PATH,
        instanceLabel: this.instanceLabel,
        sessionId: this.sessionId,
        getControlApiStatus: () => this.controlApi.getStatus(),
      },
      {
        getScreenSize: () => this.geometry.getGeometry(),
        getWindows: () => this.windowManager.getWindows(),
        getFocusedWindow: () => this.windowManager.getFocusedWindow(),
        getOpenMenuLabel: () => this.menuUi.getOpenMenuLabel(),
        getModuleRuntime: () => this.moduleRuntime.listModules(),
      },
    );
  }

  /** Boot the app: load modules, rebuild menus, render chrome, bind global keys, restore workspace, start control API. */
  async run(): Promise<void> {
    // Load external modules (themes + microapps) before workspace restore
    // so that external themes and commands are available for restoration.
    await this.moduleRuntime.loadAllModules();
    this.rebuildMenus();

    this.renderChrome();
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
    this.updateStatusLine();
    this.repaintDesktop();
    if (appFlags().dev) this.renderDevControls();
    this.renderTopIdentity();
    this.renderTopKaomoji();
    this.startKaomojiBlink();
    this.screen.on("resize", () => {
      this.repaintDesktop();
      this.syncLiveState();
      this.renderTopIdentity();
      this.renderTopKaomoji();
      this.screen.render();
    });
  }

  /** Dev-mode controls: restart button top-right, Ctrl+R to restart. */
  private renderDevControls(): void {
    const t = theme();
    const restartBtn = blessed.box({
      parent: this.screen,
      top: 0,
      right: 0,
      height: 1,
      width: 5,
      tags: true,
      content: " ↻  ",
      style: { ...t.menuBar, hover: t.selected },
      mouse: true,
      clickable: true,
    });
    restartBtn.on("click", () => this.devRestart());
    this.screen.key(["C-r"], () => this.devRestart());
  }

  /** Save workspace, quit, then send Up arrow to terminal so last command is ready to re-run. */
  private devRestart(): void {
    try {
      this.workspace.save(this.snapshotWindows(), themeName());
    } catch {
      /* best effort */
    }
    this.screen.destroy();
    // After blessed releases the terminal, send Up arrow keystroke
    // so the shell shows the last command (e.g. bun run dev) ready to press Enter
    setTimeout(() => {
      process.stdout.write("\x1b[A"); // Up arrow escape sequence
      process.exit(0);
    }, 300);
  }

  private getStatusKaomoji(): string {
    // Old arms (double-width): this.kaomojiBlink ? "༼つ-‿-‿-༽つ" : "༼つ◕‿◕‿◕༽つ";
    return this.kaomojiBlink ? "༼ﾂ-‿-‿-༽ﾂ" : "༼ﾂ◕‿◕‿◕༽ﾂ";
  }

  private startKaomojiBlink(): void {
    if (this.kaomojiTimer) return;
    const scheduleNext = () => {
      const delay = 120_000 + Math.random() * 60_000; // 2-3 minutes
      this.kaomojiTimer = setTimeout(() => {
        this.kaomojiBlink = true;
        this.renderTopKaomoji();
        this.screen.render();
        setTimeout(() => {
          this.kaomojiBlink = false;
          this.renderTopKaomoji();
          this.screen.render();
          scheduleNext();
        }, 250);
      }, delay);
    };
    scheduleNext();
  }

  private renderTopKaomoji(): void {
    const text = this.getStatusKaomoji();
    const identityWidth = stringWidth(` ${this.getInstanceDisplayLabel()} `);
    const baseOffset = appFlags().dev ? 6 : 1;
    const rightOffset = Math.max(0, baseOffset + identityWidth);
    const width = Math.max(1, stringWidth(text));
    if (!this.statusKaomoji) {
      this.statusKaomoji = blessed.box({
        parent: this.menuBar,
        top: 0,
        right: rightOffset,
        height: 1,
        width,
        tags: true,
        content: text,
        style: theme().menuBar,
      });
      return;
    }
    this.statusKaomoji.right = rightOffset;
    this.statusKaomoji.width = width;
    this.statusKaomoji.setContent(text);
    this.statusKaomoji.style = theme().menuBar;
  }

  private getInstanceDisplayLabel(): string {
    return this.instanceLabel
      ? `${this.instanceLabel} · ${this.sessionId}`
      : this.sessionId;
  }

  private renderTopIdentity(): void {
    const text = ` ${this.getInstanceDisplayLabel()} `;
    const rightOffset = Math.max(0, appFlags().dev ? 6 : 1);
    const width = Math.max(1, stringWidth(text));
    if (!this.statusIdentity) {
      this.statusIdentity = blessed.box({
        parent: this.menuBar,
        top: 0,
        right: rightOffset,
        height: 1,
        width,
        tags: true,
        content: text,
        style: theme().menuBar,
      });
      return;
    }
    this.statusIdentity.right = rightOffset;
    this.statusIdentity.width = width;
    this.statusIdentity.setContent(text);
    this.statusIdentity.style = theme().menuBar;
  }

  private updateStatusLine(): void {
    const current = this.state.sync();
    const focus = current.windows.find((window) => window.focused);
    const focusSummary = focus
      ? ` Focus ${focus.id}:${focus.kind} ${focus.width ?? "?"}x${focus.height ?? "?"}@${focus.left ?? 0},${focus.top ?? 0}`
      : " Focus none";
    const left = `Alt-F File  Alt-E Edit  Alt-V View  Alt-W Window  Alt-A Applications  Tab Next  Shift-Tab Prev  Alt-Shift-Arrows Resize  Ctrl-S Save  Ctrl-Q Quit  |  Term ${current.screen.width}x${current.screen.height}  Theme ${themeName()}  Windows ${current.screen.openWindowCount}${focusSummary}`;
    const width = Math.max(1, Number(this.screen.width));
    const content = left.slice(0, width);
    this.statusLine.setContent(content);
  }

  private rebuildMenus(): void {
    this.menus.length = 0;
    this.menus.push(...this.commands.buildMenus());
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
    this.menuBar.style = theme().menuBar;
    this.desktop.style = theme().desktop;
    this.statusLine.style = theme().statusLine;
    this.menuUi.restyle();
    this.customCursor?.restyle();
    this.windowManager.restyleAll();
    this.renderTopIdentity();
    this.renderTopKaomoji();
    this.repaintDesktop();
    this.persistState();
    this.screen.render();
  }

  private repaintDesktop(): void {
    const width = Math.max(1, Number(this.screen.width));
    const height = Math.max(1, Number(this.screen.height) - 2);
    const pattern = theme().desktopPattern;
    if (pattern && pattern.length > 0) {
      const rows: string[] = [];
      for (let y = 0; y < height; y++) {
        const patRow = pattern[y % pattern.length];
        let line = "";
        while (line.length < width) line += patRow;
        rows.push(line.slice(0, width));
      }
      this.desktop.setContent(rows.join("\n"));
    } else {
      const fill = theme().desktopFillChar || " ";
      const line = fill.repeat(width);
      this.desktop.setContent(
        Array.from({ length: height }, () => line).join("\n"),
      );
    }
  }

  /** Global input contract: menu triggers, window cycling/resizing, editor save, mouse delegation. */
  private bindGlobalKeys(): void {
    this.screen.key(["C-q"], () => this.destroy());
    this.screen.key(["M-f"], () => this.openMenu("File"));
    this.screen.key(["M-e"], () => this.openMenu("Edit"));
    this.screen.key(["M-v"], () => this.openMenu("View"));
    this.screen.key(["M-w"], () => this.openMenu("Window"));
    this.screen.key(["M-a"], () => this.openMenu("Applications"));
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
    this.desktopChromeless = !this.desktopChromeless;
    if (this.desktopChromeless) {
      this.menuBar.hide();
      this.statusLine.hide();
      this.desktop.top = 0 as any;
      this.desktop.bottom = 0 as any;
    } else {
      this.menuBar.show();
      this.statusLine.show();
      this.desktop.top = 1 as any;
      this.desktop.bottom = 1 as any;
    }
    this.screen.render();
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

  /** Build TuiToolContext, create the agent session, and open/focus the native agent window. */
  private openWibWobAgentWindow(): WindowRecord | undefined {
    const tuiContext: TuiToolContext = {
      getState: () => this.state.sync(),
      listCommands: () => this.commands.list("agent"),
      runCommand: (id, args) => this.commands.run(id, args),
      openWindow: (type) => {
        const map: Record<string, () => WindowRecord | undefined> = {
          editor: () => this.editor.openWindow(),
          art: () => this.openArtWindow(),
          gallery: () => this.openPrimerGalleryWindow(),
          browser: () => this.openBrowserReaderWindow(),
          pattern: () => this.openPatternWindow(),
          plasma: () => {
            this.openPlasmaWindow();
            return undefined;
          },
          companion: () => this.openCompanionWindow(),
          inspector: () => this.openStateInspectorWindow(),
          "music-player": () => this.openMusicPlayerWindow(),
          primer: () => this.openPrimerBrowserWindow(),
          figlet: () => this.openFigletWindow("WibWob"),
        };
        const fn = map[type];
        if (!fn) return { error: `unknown window type: ${type}` };
        const window = fn();
        return window
          ? { id: window.id }
          : { error: `${type} window failed to open` };
      },
      openFigletWindow: (text, font) => {
        const window = this.openFigletWindow(
          text,
          font ?? getDefaultFigletFont(),
        );
        return window
          ? { id: window.id }
          : { error: "figlet window failed to open" };
      },
      openChromeBrowser: (url) => {
        const window = this.openChromeBrowserWindow(url);
        return window
          ? { id: window.id }
          : { error: "chrome browser window failed to open" };
      },
      browserSearch: async (query, numResults) => {
        const svc = new ChromeBrowserService();
        try {
          const results = await svc.search(query, numResults);
          return results;
        } finally {
          svc.disconnect();
        }
      },
      windows: this.windowManager,
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

  private openFileManagerWindow(
    restore?: FileManagerRestore,
  ): WindowRecord | undefined {
    return this.focusOrCreate("farjs-file-manager", () => {
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
      "chrome-browser",
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
          onStateChanged: () => this.syncLiveState(),
        },
        restore,
      );
    });
  }

  private openCompanionWindow(restore?: {
    tick?: number;
  }): WindowRecord | undefined {
    return this.focusOrCreate("companion-widget", () => {
      openScrambleWindow(
        {
          screen: this.screen,
          windowManager: this.windowManager,
        },
        restore,
      );
    });
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
          const initial =
            typeof args?.initial === "string" ? args.initial : undefined;
          this.editor.openWindow(undefined, title, initial);
        } else {
          // Path C: interactive file picker
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
      reloadMicroappModule: (args) => {
        const explicitId =
          typeof args?.id === "string" && args.id.trim() ? args.id.trim() : undefined;
        const focusedId = this.windowManager.getFocusedWindow()?.microappId;
        const id = explicitId ?? focusedId;
        if (!id) {
          this.overlays.flash("No microapp id provided and no microapp window focused");
          return;
        }
        void this.moduleRuntime.reloadModule(id).then((result) => {
          this.overlays.flash(
            result.ok ? `Reloaded microapp: ${id}` : `Microapp reload failed: ${result.error}`,
          );
        });
      },
      quit: () => this.destroy(),
      focusNextWindow: () => this.windowManager.focusNextWindow(1),
      focusPreviousWindow: () => this.windowManager.focusNextWindow(-1),
      closeFocusedWindow: () => this.windowManager.closeFocusedWindow(),
      clearDesktop: () => {
        const windows = this.windowManager.getWindows();
        for (const w of windows) {
          if (w.kind !== "chat") {
            this.windowManager.closeWindow(w.id);
          }
        }
      },
      toggleDesktopChrome: () => this.toggleDesktopChrome(),
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
          this.promptForFigletText();
        }
      },
      openMusicPlayer: (args) => {
        const filePath =
          typeof args?.filePath === "string" && args.filePath.trim()
            ? args.filePath.trim()
            : undefined;
        this.openMusicPlayerWindow(filePath ? { filePath } : undefined);
      },
      openPatternWindow: () => this.openPatternWindow(),
      openCompanionWindow: () => this.openCompanionWindow(),
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
      // ── Help ────────────────────────────────────────────
      viewReadme: () => this.openBrowserReaderWindow(README_PATH),
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
    this.updateStatusLine();
  }

  /** Expensive state checkpoint: rebuild, write to disk, fire listeners.
   *  Use for significant events: startup, theme change, workspace load/save, editor save. */
  private persistState(): void {
    this.updateStatusLine();
    this.state.persistAndNotify();
  }

  private destroy(): void {
    this.autoSaveWorkspace();
    this.controlApi.stop();
    this.screen.destroy();
    process.exit(0);
  }
}
