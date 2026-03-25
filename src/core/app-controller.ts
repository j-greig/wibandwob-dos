/**
 * Application composition root. Owns startup, menus, window openers,
 * workspace restore, theme application, global keybindings, and
 * control API wiring. Coordinates services and window factories
 * but should not accumulate utility logic.
 */

import blessed from "blessed";
import { patchBlessedUnicode } from "./unicode-patch.js";
import fs from "node:fs";
import { safeReadFile, safeWriteFile } from "./safe-fs.js";
import os from "node:os";
import path from "node:path";
// child_process no longer needed here — FX pipeline extracted to fx-pipeline.ts
import { log } from "../services/app-logger.js";
import { typedArg, trimmedArg, enumArg, clampedArg } from "./arg-helpers.js";
import { shaderSet, shaderList, shaderStatus, shaderLabel } from "../services/ghostty-shader-service.js";
import {
  resolveSmearSource as fxResolveSmearSource,
  runFxScript as fxRunFxScript,
  smearTextSurface as fxSmearTextSurface,
  type FxPipelineDeps,
} from "./fx-pipeline.js";

import {
  CONTROL_API_PORT,
  DATA_ROOT,
  MASTER_PHILOSOPHY_PATH,
  README_PATH,
  APP_NOTES_PATH,
  APP_ROOT,
  REPO_ROOT,
  SCRATCH_BASE,
} from "./config.js";
import { appFlags } from "./cli.js";
import { loadMicroapps, reloadMicroapps } from "../services/microapp-loader.js";
import type { MicroappHostDeps } from "../sdk/microapp-host.js";
import { copyToClipboard } from "./clipboard.js";
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
  TuiSkin,
  WindowKind,
  WindowRecord,
  WindowSnapshot,
} from "./types.js";
import { DEFAULT_SKIN } from "./types.js";
import {
  contentToWindowSize,
  getChromeModeForWindow,
} from "./window-chrome.js";
import {
  loadSettings,
  getSettingsSkin,
  patchSkin as patchSettingsSkin,
} from "./settings-service.js";
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
// file-manager-window — now registered via host-window-registry
import { openTextViewerWindow as openContentViewerWindow } from "../windows/text-viewer-window.js";
// browser-reader-window — now registered via host-window-registry
import {
  openStateInspectorWindow as openInspectorWindow,
  openWorkspaceManagerWindow as openWorkspaceCommandWindow,
} from "../windows/generative-windows.js";
import { registerAllHostWindows } from "./host-window-registrations.js";
import { getHostWindow, openRegisteredWindow, type HostWindowDeps } from "./host-window-registry.js";
import {
  openScrambleFloatingWindow,
  openScrambleSmolPopup,
} from "../windows/scramble-window.js";
import { ScrambleBrain } from "../services/scramble-brain.js";


// music-player-window — now registered via host-window-registry
// terrain-lab-window — now registered via host-window-registry
// Editor window factory now used via EditorCoordinator
import { type TuiToolContext } from "../services/agent-tools.js";
import { WibWobAgentSession } from "../services/wibwob-agent-session.js";
import { ChromeBrowserService } from "../services/chrome-browser-service.js";
// chrome-browser-window — now registered via host-window-registry
import { openWibWobAgentWindow as openNativeWibWobAgentWindow } from "../windows/wibwob-agent-window.js";
import { CustomCursor } from "./custom-cursor.js";

import { worldChatService } from "../services/world-chat-service.js";
import {
  createRuntimeCommandService,
  type RuntimeCommandService,
} from "../application/runtime-command-service.js";
import {
  RateLimitService,
  resolveRateLimitConfig,
} from "../application/rate-limit-service.js";
import {
  createRuntimeInspectionService,
  type RuntimeInspectionService,
} from "../application/runtime-inspection-service.js";
import {
  createRuntimeWindowService,
  type RuntimeWindowService,
} from "../application/runtime-window-service.js";
import {
  createRuntimeWorkspaceService,
  type RuntimeWorkspaceResult,
  type RuntimeWorkspaceService,
} from "../application/runtime-workspace-service.js";
import type {
  RuntimeInspectionSnapshot,
  RuntimeOverlayInspection,
  RuntimeUiBlockerInspection,
} from "../domain/runtime-inspection.js";
import {
  createRuntimeNode,
  type RuntimeNodeDescriptor,
} from "../runtime/runtime-node.js";

/** Exit code used by dev-mode reload. The launcher script watches for this. */
const DEV_RELOAD_EXIT_CODE = 75;

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
  private readonly workspace: WorkspaceService;
  private readonly geometry: DesktopGeometryService;
  private readonly customCursor: CustomCursor | null;
  private readonly state: StateService;
  private readonly controlApi: ControlApiService;
  private readonly runtimeCommands: RuntimeCommandService;
  private readonly runtimeInspection: RuntimeInspectionService;
  private readonly runtimeWindows: RuntimeWindowService;
  private readonly runtimeWorkspace: RuntimeWorkspaceService;
  private readonly rateLimiter: RateLimitService;
  private readonly invalidation: RenderScheduler;
  private readonly editor: EditorCoordinator;
  private activeAgentSession?: WibWobAgentSession;
  private readonly scrambleBrain: ScrambleBrain = new ScrambleBrain();
  private scramblePopupWindowId?: string;
  /** Workspace-level skin override — merged on top of settings.json skin at load time. */
  private workspaceSkin: Partial<TuiSkin> | undefined;
  private readonly instanceLabel?: string;
  private readonly instanceId: string;
  private readonly instanceDisplayId: string;
  private readonly runtimeNode: RuntimeNodeDescriptor;
  private readonly bootedAtMs = Date.now();
  private microappReloadEpoch = 0;
  private microappDeps?: MicroappHostDeps;

  constructor(opts?: {
    instanceLabel?: string;
    instanceId?: string;
    instanceDisplayId?: string;
    runtimeNode?: RuntimeNodeDescriptor;
  }) {
    this.runtimeNode = opts?.runtimeNode ?? createRuntimeNode({
      instanceLabel: opts?.instanceLabel,
      instanceId: opts?.instanceId?.trim() || "???",
      instanceDisplayId: opts?.instanceDisplayId || "???",
    });
    this.instanceLabel = this.runtimeNode.instanceLabel;
    this.instanceId = this.runtimeNode.instanceId;
    this.instanceDisplayId = this.runtimeNode.instanceDisplayId;
    log.setIdentity(this.getInstanceDisplayLabel());
    patchBlessedUnicode();
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      title: `WibWob-DOS · ${this.instanceDisplayId} · ${process.pid}`,
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
      onFlash: (msg) => this.overlays.flash(msg),
      getSessionClipboardText: () => {
        const state = this.state.getState();
        const w = this.screen.width as number;
        const h = this.screen.height as number;
        const port = this.controlApi.getStatus().port
          ?? parseInt(process.env.WIBWOB_PORT ?? String(CONTROL_API_PORT), 10);
        return [
          `[WibWob-DOS session]`,
          `id: ${this.instanceId}`,
          `label: ${this.instanceLabel ?? this.instanceDisplayId}`,
          `pid: ${process.pid}`,
          `port: ${port}`,
          `screen: ${w}×${h}`,
          `theme: ${themeName()}`,
          `windows: ${state.windows.length}`,
          `api: http://127.0.0.1:${port}/`,
        ].join("\n");
      },
      getDesktopState: () => this.state.sync(),
      getScrambleFace: () =>
        this.scrambleBrain.sleeping ? "(-.-)"
        : this.scrambleBrain.status === "thinking" ? "(o.O)"
        : this.scrambleBrain.status === "error" ? "(x.x)"
        : this.scrambleBrain.status === "offline" ? "(-.-)"
        : "(=^=)",
      onResize: () => this.syncLiveState(),
      onReloadMicroapps: () => this.reloadMicroappsFromDisk(),
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
    // S06: snapshot of prev window IDs and appTypes for open/close event diffing
    let _prevWindowIds: Set<number> | null = null;
    let _prevWindowSnapshot = new Map<number, string>();
    this.windowManager = new WindowManager(
      this.screen,
      this.desktop,
      this.invalidation,
      () => {
        this.shellChrome.repaintDesktop();
        this.invalidation.requestSync();
        // S06: emit window-opened / window-closed events
        const current = this.windowManager.getWindows();
        const currentIds = new Set(current.map(w => w.id));
        // First call — seed from current state, emit nothing (avoids spurious events at startup/restore)
        if (_prevWindowIds === null) { _prevWindowIds = currentIds; return; }
        for (const w of current) {
          if (!_prevWindowIds.has(w.id)) {
            this.state?.emitEvent({ type: "window-opened", windowId: w.id, appType: String(w.describeState?.()?.appType ?? w.kind), title: w.title });
          }
        }
        for (const [id, appType] of _prevWindowSnapshot) {
          if (!currentIds.has(id)) {
            this.state?.emitEvent({ type: "window-closed", windowId: id, appType });
          }
        }
        _prevWindowIds = currentIds;
        _prevWindowSnapshot = new Map(current.map(w => [w.id, String(w.describeState?.()?.appType ?? w.kind)]));
      },
      (window, x, y) => this.openWindowContextMenu(window, x, y),
    );
    this.windowManager.setEditorWriteHook((id, text) =>
      this.editor.writeTextById(id, text),
    );
    this.windowManager.setSkinProvider(() => this.getEffectiveSkin());
    this.geometry = new DesktopGeometryService(this.screen);
    this.customCursor = appFlags().customCursor
      ? new CustomCursor(this.screen)
      : null;
    this.overlays = new OverlayManager(this.screen, () =>
      this.windowManager.restoreWindowFocus(),
    );
    capabilityService.probe();
    loadSettings(); // load ~/.wibwob/settings.json (or project .wibwob/settings.json)
    this.workspace = new WorkspaceService(this.runtimeNode.workspacesDir);
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
      defaultDir: APP_ROOT,
      editorStartDir: path.dirname(APP_NOTES_PATH),
    });
    this.rateLimiter = new RateLimitService(resolveRateLimitConfig());
    this.runtimeCommands = createRuntimeCommandService({
      listCommands: (
        surface?: CommandSurface,
        opts?: { includeUnavailable?: boolean },
      ) => this.commands.list(surface, opts),
      runCommand: (id: string, args?: Record<string, unknown>) =>
        this.commands.run(id, args),
      rateLimiter: this.rateLimiter,
    });
    this.runtimeInspection = createRuntimeInspectionService({
      getState: () => this.getDesktopState(),
      syncState: () => this.state.sync(),
      getPrimerInfo: (pathOrName: string) => this.getPrimerInfo(pathOrName),
      screenshotText: () => this.screen.screenshot(),
      getSnapshot: (): RuntimeInspectionSnapshot => {
        const blockers = this.getRuntimeUiBlockers();
        return {
          ui: {
            menu: {
              open: this.menuUi.isAnyMenuOpen(),
              label: this.menuUi.getOpenMenuLabel(),
            },
            overlay: this.getRuntimeOverlayInspection(),
            blockers,
            blocked: blockers.length > 0,
          },
          state: this.getDesktopState(),
          stats: this.runtimeStats.snapshot(),
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
          rateLimit: this.rateLimiter.snapshot(),
        };
      },
    });
    this.runtimeWindows = createRuntimeWindowService({
      commands: this.runtimeCommands,
      windows: this.windowManager,
    });
    this.runtimeWorkspace = createRuntimeWorkspaceService({
      workspace: this.workspace,
      snapshotWindows: () => this.snapshotWindows(),
      getThemeName: () => themeName(),
      getSkin: () => this.getEffectiveSkin(),
      clearWindows: () => this.clearWorkspaceWindows(),
      restoreWindows: (snapshots) => this.restoreWorkspaceSnapshots(snapshots),
      applyThemeByName: (name) => this.applyThemeByName(name),
      applyWorkspaceSkin: (skin) => this.applyWorkspaceSkin(skin),
      persistState: () => this.persistState(),
    });
    this.controlApi = new ControlApiService(
      CONTROL_API_PORT,
      {
        commands: this.runtimeCommands,
        inspection: this.runtimeInspection,
        windows: this.runtimeWindows,
        workspace: this.runtimeWorkspace,
        stateService: undefined, // wired after StateService is constructed below
      },
      this.runtimeNode,
      this.rateLimiter,
    );
    this.state = new StateService(
      {
        appName: "WibWob-DOS TS MVP",
        appMode: "terminal-native",
        cwd: REPO_ROOT,
        runtimeNode: this.runtimeNode,
        getMicroappReloadEpoch: () => this.microappReloadEpoch,
        getControlApiStatus: () => this.controlApi.getStatus(),
      },
      {
        getScreenSize: () => this.geometry.getGeometry(),
        getWindows: () => this.windowManager.getWindows(),
        getFocusedWindow: () => this.windowManager.getFocusedWindow(),
        getOpenMenuLabel: () => this.menuUi.getOpenMenuLabel(),
        getEffectiveSkin: () => this.getEffectiveSkin(),
      },
    );

    // Wire StateService into ControlApi for SSE events (S06)
    this.controlApi.setStateService(this.state);

    // Set scramble session log path
    const scrambleLogDir = path.join(this.runtimeNode.scratchBase, "scramble-sessions");
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
    this.microappDeps = this.buildMicroappDeps();
    await loadMicroapps(this.microappDeps);

    // Register dynamic commands, then rebuild menus so they're included
    this.registerShaderMenu();
    this.rebuildMenusFromCommands();
    registerAllHostWindows();

    this.renderChrome();
    this.runtimeStats.init();
    this.bindGlobalKeys();
    this.menuUi.bindMenuClicks((label) => this.openMenu(label));
    this.restoreDefaultWorkspace();

    // ── Startup scan: clean stale sockets from crashed instances ──
    this.cleanStaleSockets();

    // ── Screen size guard: skip socket registration if below usable minimum ──
    this.controlApi.setScreenSizeGetter(() => ({
      width: this.screen.width as number,
      height: this.screen.height as number,
    }));
    // Always register socket — discovery is not rendering.
    // Consumer health gate in resolveBase warns/refuses headless (screen ≤1×1) targets.
    this.controlApi.start();

    // Update env var with actual bound port (may differ from requested 8099)
    const apiStatus = this.controlApi.getStatus();
    if (apiStatus.baseUrl) {
      process.env.WIBWOB_API_BASE_URL = apiStatus.baseUrl;
    }

    this.persistState();
    this.screen.render();
    log.app(
      `started ${this.screen.width}x${this.screen.height} theme:${themeName()} instance:${this.getInstanceDisplayLabel()}`,
    );
  }

  private buildMicroappDeps(): MicroappHostDeps {
    return {
      screen: this.screen,
      windowManager: this.windowManager,
      commands: this.commands,
      geometry: this.geometry.getGeometry(),
      focusOrCreate: (appType, createFn, multiInstance) => {
        const wasFocused = !multiInstance && Boolean(this.findWindowByAppType(appType as AppType));
        this.focusOrCreate(appType as AppType, createFn, multiInstance);
        const windowId = wasFocused
          ? this.findWindowByAppType(appType as AppType)?.id
          : this.windowManager.getLastCreatedId();
        return { focused: wasFocused, windowId };
      },
      worldChat: worldChatService,
      overlays: this.overlays,
      repoRoot: REPO_ROOT,
    };
  }

  private rebuildMenusFromCommands(): void {
    this.menus.length = 0;
    this.menus.push(...this.commands.buildMenus());
  }

  /** Register "Shaders ▸" in the View menu — opens a popup with live shader list. */
  private registerShaderMenu(): void {
    this.commands.addDynamic({
      id: "ghostty.shaders",
      label: "Shaders ▸",
      group: "system",
      description: "Toggle Ghostty GPU shaders",
      menuPlacements: [{ category: "view" as any, order: 96, submenu: true }],
      action: () => {
        const shaders = shaderList();
        const { active } = shaderStatus();
        const items = shaders.map((name) => ({
          label: `${active === name ? "✓ " : "  "}${shaderLabel(name)}`,
          action: () => { shaderSet(name); this.menuUi.closeMenus(); },
        }));
        items.push({
          label: `${active === null ? "✓ " : "  "}Off`,
          action: () => { shaderSet("off"); this.menuUi.closeMenus(); },
        });
        // Position submenu to the right of the View dropdown
        const viewMenu = this.menus.find((m) => m.category === "view");
        const viewLeft = viewMenu?.left ?? 15;
        const viewItems = viewMenu?.items ?? [];
        const dropdownWidth = Math.max(...viewItems.map((i) => i.label.length), 10) + 4;
        // Align submenu top with the "Shaders ▸" row — same y as the item, not below the whole menu.
        // +2 accounts for the menu border (top:1 for menubar + 1 for border).
        const shadersIndex = viewItems.findIndex((i) => i.label === "Shaders ▸");
        const shaderRow = 1 + (shadersIndex >= 0 ? shadersIndex : viewItems.length);
        this.openPopupMenu(items, viewLeft + dropdownWidth, shaderRow, true);
      },
    });
  }

  private collectReloadInvalidationFiles(limit = 6): string[] {
    const hostSensitiveDirs = [
      path.join(REPO_ROOT, "src", "core"),
      path.join(REPO_ROOT, "src", "services"),
      path.join(REPO_ROOT, "src", "windows"),
      path.join(REPO_ROOT, "src", "sdk"),
      path.join(REPO_ROOT, "src", "ui"),
    ];
    const hostSensitiveFiles = [
      path.join(REPO_ROOT, "package.json"),
      path.join(REPO_ROOT, "bun.lock"),
      path.join(REPO_ROOT, "bun.lockb"),
      path.join(REPO_ROOT, "tsconfig.json"),
    ];

    const changed: string[] = [];
    const visit = (targetPath: string) => {
      if (changed.length >= limit) return;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(targetPath);
      } catch {
        return;
      }

      if (stat.isDirectory()) {
        let entries: string[];
        try {
          entries = fs.readdirSync(targetPath);
        } catch {
          return;
        }
        for (const entry of entries) {
          visit(path.join(targetPath, entry));
          if (changed.length >= limit) return;
        }
        return;
      }

      if (!stat.isFile()) return;
      if (stat.mtimeMs <= this.bootedAtMs) return;
      changed.push(path.relative(REPO_ROOT, targetPath));
    };

    for (const file of hostSensitiveFiles) visit(file);
    for (const dir of hostSensitiveDirs) visit(dir);
    return changed;
  }

  private async reloadMicroappsFromDisk(): Promise<{
    reloaded: number;
    clearedCommands: number;
    clearedSnapshots: number;
    requiresRestart?: boolean;
    blockedFiles?: string[];
  }> {
    const blockedFiles = this.collectReloadInvalidationFiles();
    if (blockedFiles.length > 0) {
      return {
        reloaded: 0,
        clearedCommands: 0,
        clearedSnapshots: 0,
        requiresRestart: true,
        blockedFiles,
      };
    }

    this.microappDeps ??= this.buildMicroappDeps();
    try {
      const result = await reloadMicroapps(this.microappDeps);
      this.rebuildMenusFromCommands();
      return result;
    } finally {
      this.microappReloadEpoch += 1;
      this.syncLiveState();
      this.screen.render();
    }
  }

  /** Restore default workspace on boot. Empty desktop if none exists. */
  private restoreDefaultWorkspace(): void {
    const flags = appFlags();

    // --workspace flag or WIBWOB_WORKSPACE env: boot into a named workspace
    if (flags.workspace) {
      const result = this.runtimeWorkspace.load(flags.workspace, { replaceExisting: true });
      if (result.ok) {
        log.app(`booted into workspace: ${flags.workspace}`);
      } else {
        log.app(`workspace '${flags.workspace}' failed: ${result.error} — falling back to default`);
        const restored = this.runtimeWorkspace.restoreDefault();
        if (restored && !restored.ok) {
          log.app(`default workspace restore skipped: ${restored.error}`);
        }
      }
      return;
    }

    // Auto-detect orphan workspace if no flag given
    // Use instanceLabel if set, otherwise instanceDisplayId, otherwise instanceId
    const idForOrphan = this.instanceLabel ?? this.runtimeNode.instanceDisplayId ?? this.instanceId;
    const orphanName = `orphan-${idForOrphan}`;
    const orphanPath = path.join(this.runtimeNode.workspacesDir, `${orphanName}.json`);
    if (fs.existsSync(orphanPath)) {
      log.app(`orphan workspace detected: ${orphanName}`);
      const result = this.runtimeWorkspace.load(orphanName, { replaceExisting: true });
      if (result.ok) {
        log.app(`restored orphan workspace: ${orphanName} (${result.windows} windows)`);
        // Rename to avoid re-loading on next boot
        try { fs.renameSync(orphanPath, orphanPath.replace(".json", ".restored.json")); } catch {}
        return;
      }
      log.app(`orphan workspace load failed: ${result.error} — falling back to default`);
    }

    const restored = this.runtimeWorkspace.restoreDefault();
    if (restored && !restored.ok) {
      log.app(`default workspace restore skipped: ${restored.error}`);
    }
  }

  private renderChrome(): void {
    this.shellChrome.init();
  }

  /** Save workspace, quit, then send Up arrow to terminal so last command is ready to re-run. */
  private devRestart(): void {
    this.runtimeWorkspace.autoSave();
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
    const pid = process.pid;
    // Use short display ID (3 chars) for TUI, full ID for machine contexts
    return this.instanceLabel
      ? `${this.instanceLabel} · ${this.instanceDisplayId} · ${pid}`
      : `${this.instanceDisplayId} · ${pid}`;
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

  /** Apply current theme tokens and effective skin to all shell chrome and open windows. */
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

  // ── TUI Skin ─────────────────────────────────────────────────────────────

  /**
   * Resolve the effective skin using the merge stack:
   *   DEFAULT_SKIN → theme().skin → settings.json skin → workspace skin
   */
  private getEffectiveSkin(): TuiSkin {
    return {
      ...DEFAULT_SKIN,
      ...theme().skin,
      ...getSettingsSkin(),
      ...this.workspaceSkin,
    };
  }

  /** Apply a workspace-level skin override (called on workspace load). */
  private applyWorkspaceSkin(skin: Partial<TuiSkin> | undefined): void {
    this.workspaceSkin = skin;
    // Don't call restyleAll here — workspace load handles full apply after windows are restored.
  }

  /** Cycle through border style presets: line → bg → none → line. */
  private skinCycle(): void {
    const current = this.getEffectiveSkin();
    const next: Record<string, "line" | "bg" | "none"> = {
      line: "bg",
      bg: "none",
      none: "line",
    };
    patchSettingsSkin({ borderStyle: next[current.borderStyle] ?? "line" });
    this.applySkinLive();
  }

  /** Set one or more skin properties from command args. */
  private skinSet(args?: Record<string, unknown>): void {
    const partial: Partial<TuiSkin> = {};
    const borderStyle = enumArg(args, "borderStyle", ["line", "bg", "none"] as const);
    if (borderStyle) partial.borderStyle = borderStyle;
    const borderChar = typedArg(args, "borderChar", "string");
    if (borderChar && borderChar.length > 0) partial.borderChar = borderChar[0];
    const shadowEnabled = typedArg(args, "shadowEnabled", "boolean");
    if (shadowEnabled !== undefined) partial.shadowEnabled = shadowEnabled;
    if (Object.keys(partial).length === 0) return;
    patchSettingsSkin(partial);
    this.applySkinLive();
  }

  /** Re-apply the effective skin to all open windows and re-render. */
  private applySkinLive(): void {
    const skin = this.getEffectiveSkin();
    log.app(`skin → borderStyle:${skin.borderStyle} shadow:${skin.shadowEnabled}`);
    this.windowManager.restyleAll();
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
    this.screen.key(["M-tab"], () => {
      this.windowManager.focusNextWindow(1);
    });
    this.screen.key(["M-S-tab"], () => this.windowManager.focusNextWindow(-1));
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
    keepDropdown = false,
  ): void {
    this.menuUi.openPopupMenu(items, x, y, keepDropdown);
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
  /** Build the standard deps object for host window factories. */
  private buildHostWindowDeps(): HostWindowDeps {
    return {
      screen: this.screen,
      windowManager: this.windowManager,
      overlays: this.overlays,
      content: this.content,
      backrooms: this.backrooms,
      editor: this.editor,
      geometry: this.geometry,
      runtimeNode: this.runtimeNode,
      runtimeCommands: this.runtimeCommands,
      runtimeInspection: this.runtimeInspection,
      runtimeWindows: this.runtimeWindows,
      runtimeWorkspace: this.runtimeWorkspace,
      invalidation: this.invalidation,
      commands: this.commands,
      scrambleBrain: this.scrambleBrain,
      onStateChanged: () => this.syncLiveState(),
      openTextViewer: (title, content, kind, filePath) =>
        this.openTextViewerWindow(title, content, kind, filePath),
      openFile: (filePath) => this.editor.openFile(filePath),
      flash: (msg) => this.overlays.flash(msg),
    };
  }

  /**
   * Open a host window via the declarative registry.
   * Falls back to undefined if the appType is not registered.
   */
  openHostWindow(appType: string, restore?: Record<string, unknown>): WindowRecord | undefined {
    return openRegisteredWindow(appType, this.buildHostWindowDeps(), restore);
  }

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
    const type = typedArg(info, "type", "string");
    if (!type) return null;
    return {
      type,
      label: typedArg(info, "label", "string"),
      selectedIndex: typedArg(info, "selectedIndex", "number"),
      count: typedArg(info, "count", "number"),
      currentDirectory: typedArg(info, "currentDirectory", "string"),
    };
  }

  private getRuntimeUiBlockers(): RuntimeUiBlockerInspection[] {
    const blockers: RuntimeUiBlockerInspection[] = [];

    if (this.menuUi.isAnyMenuOpen()) {
      blockers.push({
        kind: "menu",
        type: "menu",
        label: this.menuUi.getOpenMenuLabel(),
        escapeCommands: ["menu.close", "desktop.clear-all"],
      });
    }

    const overlay = this.getRuntimeOverlayInspection();
    if (overlay) {
      blockers.push({
        kind: "overlay",
        type: overlay.type,
        label: overlay.label,
        selectedIndex: overlay.selectedIndex,
        count: overlay.count,
        currentDirectory: overlay.currentDirectory,
        escapeCommands: ["overlay.cancel", "desktop.clear-all"],
        continueCommands:
          overlay.type === "browser" ||
          overlay.type === "file-browser" ||
          overlay.type === "centered-list" ||
          overlay.type === "list"
            ? ["overlay.select", "overlay.confirm"]
            : ["overlay.confirm"],
      });
    }

    const pickerApi = this.getBackroomsPickerApi();
    const pickerInfo =
      typeof pickerApi?.info === "function" ? pickerApi.info() : null;
    if (pickerInfo && typeof pickerInfo === "object") {
      const info = pickerInfo as Record<string, unknown>;
      blockers.push({
        kind: "picker-window",
        type: "backrooms-primer-picker",
        label: typedArg(info, "theme", "string")
          ? `Backrooms Primer Picker: ${info.theme}`
          : "Backrooms Primer Picker",
        windowId: this.findWindowByAppType("backrooms-primer-picker")?.id,
        selectedIndex: typedArg(info, "selectedIndex", "number"),
        count: typedArg(info, "filteredCount", "number"),
        escapeCommands: ["backrooms.picker.cancel", "desktop.clear-all"],
        continueCommands: ["backrooms.picker.select", "backrooms.picker.confirm"],
      });
    }

    return blockers;
  }

  private openSharedOverlayPicker(
    openPicker: () => void,
    missingOverlayError: string,
  ): { ok: true; opened: true; type?: string; label?: string } | { ok: false; error: string } {
    if (this.overlays.hasActiveOverlay()) {
      const active = this.overlays.getActiveOverlayInfo();
      return {
        error:
          active && typeof active.type === "string"
            ? `Another overlay is already active: ${active.type}`
            : "Another overlay is already active",
        ok: false,
      };
    }

    openPicker();

    const active = this.overlays.getActiveOverlayInfo();
    if (!active || typeof active.type !== "string") {
      return { ok: false, error: missingOverlayError };
    }

    return {
      ok: true,
      opened: true,
      type: active.type,
      label: typeof active.label === "string" ? active.label : undefined,
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

  // openBackroomsLogBrowserWindow, promptForBackroomsTv — inlined as openHostWindow calls

  private openBackroomsPrimerPicker(
    theme: string,
    defaults: BackroomsChannel,
  ): WindowRecord | undefined {
    // Primer picker with specific theme/defaults uses its own context (not registry)
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
    return this.openHostWindow("backrooms-tv", channel as unknown as Record<string, unknown>);
  }

  // openPrimerBrowserWindow — inlined as openHostWindow("primer-browser", restore)

  private getFocusedFinder() {
    const win = this.windowManager.getFocusedWindow();
    return win?.finder ?? null;
  }

  private getBackroomsPickerApi(): {
    info?: () => unknown;
    select?: (index: number) => unknown;
    toggle?: (index?: number) => unknown;
    toggleByLabel?: (label: string) => unknown;
    search?: (query: string) => unknown;
    confirm?: () => unknown;
    cancel?: () => unknown;
  } | null {
    const win = this.findWindowByAppType("backrooms-primer-picker");
    if (!win) return null;
    const dyn = win as unknown as Record<string, unknown>;
    return {
      info: typeof dyn._backroomsPickerInfo === "function" ? (dyn._backroomsPickerInfo as () => unknown) : undefined,
      select: typeof dyn._backroomsPickerSelect === "function" ? (dyn._backroomsPickerSelect as (index: number) => unknown) : undefined,
      toggle: typeof dyn._backroomsPickerToggle === "function" ? (dyn._backroomsPickerToggle as (index?: number) => unknown) : undefined,
      toggleByLabel: typeof dyn._backroomsPickerToggleByLabel === "function" ? (dyn._backroomsPickerToggleByLabel as (label: string) => unknown) : undefined,
      search: typeof dyn._backroomsPickerSearch === "function" ? (dyn._backroomsPickerSearch as (query: string) => unknown) : undefined,
      confirm: typeof dyn._backroomsPickerConfirm === "function" ? (dyn._backroomsPickerConfirm as () => unknown) : undefined,
      cancel: typeof dyn._backroomsPickerCancel === "function" ? (dyn._backroomsPickerCancel as () => unknown) : undefined,
    };
  }

  // openFileManagerWindow — inlined as openHostWindow("file-manager", restore)

  // openPrimerGalleryWindow — inlined as openHostWindow("primer-gallery", restore)

  // openChromeBrowserWindow — inlined as openHostWindow("web-reader", ...)

  // openBrowserReaderWindow — inlined as openHostWindow("reader-viewer", ...)

  // openContourWindow — removed, migrated to microapp.wibwob.contour.open

  // openTerrainLabWindow — removed, use openHostWindow("terrain-lab") directly

  // openPlasmaWindow — removed, migrated to microapp.wibwob.plasma.open

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

  // openPlasmaFromPrimer — removed, migrated to microapp.wibwob.plasma.from-primer

  // openMusicPlayerWindow — removed, use openHostWindow("music-player", restore) directly

  private openCompanionWindow(restore?: {
    tick?: number;
    displayMode?: string;
  }): WindowRecord | undefined {
    const mode = restore?.displayMode;
    if (mode === "smol" || mode === "tall" || mode === "popup") {
      return this.openScrambleSmol();
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

  private openScrambleSmol(): WindowRecord | undefined {
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
        openCommandPaletteWindow: () => this.openHostWindow("command-palette"),
      });
    });
  }

  // openCommandPaletteWindow — inlined as openHostWindow("command-palette")

  private promptForPrimer(): void {
    promptForPrimerFile({
      overlays: this.overlays,
      content: this.content,
      repoRoot: REPO_ROOT,
      onOpenPrimer: (filePath) => this.openPrimerWindow(filePath),
    });
  }

  private openPrimerPicker(): {
    ok: true;
    opened: true;
    type?: string;
    label?: string;
  } | { ok: false; error: string } {
    return this.openSharedOverlayPicker(
      () => this.promptForPrimer(),
      "Primer picker did not open",
    );
  }

  private openEditorPicker(): {
    ok: true;
    opened: true;
    type?: string;
    label?: string;
  } | { ok: false; error: string } {
    return this.openSharedOverlayPicker(
      () => this.editor.openPicker(),
      "Text file picker did not open",
    );
  }

  private openMarkdownPicker(): {
    ok: true;
    opened: true;
    type?: string;
    label?: string;
  } | { ok: false; error: string } {
    return this.openSharedOverlayPicker(
      () => {
        this.openMarkdownViewerWindow(undefined);
      },
      "Markdown picker did not open",
    );
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

  // openArtWindow — removed, migrated to microapp.wibwob.generative.art

  // openMonsterCam — removed, migrated to microapps/monster-cam/

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
    if (copyToClipboard(text)) {
      this.overlays.flash(
        `Copied ${text.split("\n").length} lines to clipboard.`,
      );
    } else {
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
    const capturesDir = this.runtimeNode.capturesDir;
    fs.mkdirSync(capturesDir, { recursive: true });
    const slug = (label ?? windowTitle)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const fileName = `${slug}_${Date.now()}.txt`;
    const filePath = path.join(capturesDir, fileName);
    safeWriteFile(filePath, text);
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
        statePath: this.runtimeNode.statePath,
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

  private applyThemeByName(name: string): void {
    const variant = allVariants().find((candidate) => candidate.name === name);
    if (!variant) {
      return;
    }
    setThemeVariant(variant);
    this.applyTheme();
  }

  private clearWorkspaceWindows(): void {
    for (const window of this.windowManager.getWindows()) {
      if (window.kind !== "workspace") {
        window.close();
      }
    }
  }

  private restoreWorkspaceSnapshots(snapshots: WindowSnapshot[]): void {
    let focusedWindow: WindowRecord | undefined;
    const failed: string[] = [];
    for (const snapshot of snapshots) {
      try {
        const restored = restoreWindowSnapshot(
          snapshot,
          this.getRestoreActions(),
        );
        if (snapshot.focused) {
          focusedWindow = restored;
        }
      } catch (err) {
        const label = snapshot.title ?? snapshot.kind ?? "unknown";
        log.err(`[workspace] Failed to restore window "${label}": ${err}`);
        failed.push(label);
      }
    }
    if (failed.length > 0) {
      log.app(`[workspace] Boot completed — ${failed.length} window(s) skipped: ${failed.join(", ")}`);
    }
    focusedWindow?.focus();
  }

  private flashWorkspaceResult(action: "save" | "load", result: RuntimeWorkspaceResult): void {
    if (!result.ok) {
      this.overlays.flash(result.error);
      return;
    }
    this.overlays.flash(
      action === "save"
        ? `Saved workspace to ${result.path}`
        : `Loaded workspace from ${result.path}`,
    );
  }

  private saveWorkspace(): void {
    this.flashWorkspaceResult("save", this.runtimeWorkspace.save());
  }

  /** Auto-save current layout to the active workspace (silent, no flash). */
  private autoSaveWorkspace(): void {
    this.runtimeWorkspace.autoSave();
  }

  private getRestoreActions(): WorkspaceRestoreActions {
    return {
      openPrimerWindow: (filePath) => this.openPrimerWindow(filePath),
      openEditorWindow: (filePath, title, initial, restore) =>
        this.editor.openWindow(filePath, title, initial, restore),
      openBrowserReaderWindow: (filePath) =>
        this.openHostWindow("reader-viewer", { filePath }),
      openFigletWindow: (text, font) => {
        this.commands.runDynamic("microapp.wibwob.figlet.open", { text, font });
        return undefined; // microapp creates its own window
      },
      openPrimerGalleryWindow: (restore) =>
        this.openHostWindow("primer-gallery", restore as Record<string, unknown> | undefined),
      openPrimerBrowserWindow: (restore) =>
        this.openHostWindow("primer-browser", restore as Record<string, unknown> | undefined),
      openFileManagerWindow: (restore) => this.openHostWindow("file-manager", restore as Record<string, unknown> | undefined),
      openBackroomsTv: (channel) => this.openBackroomsTv(channel),
      openBackroomsLogBrowserWindow: () => this.openHostWindow("backrooms-log-browser"),
      openBackroomsPrimerPickerWindow: () =>
        this.openBackroomsPrimerPicker("liminal fluorescent maze", {
          theme: "liminal fluorescent maze",
          primers: "",
          turns: 3,
          model: "sonnet",
        }),
      openChromeBrowserWindow: (restore) =>
        this.openHostWindow("web-reader", restore?.url ? { url: restore.url } : undefined),
      openCompanionWindow: (restore) => this.openCompanionWindow(restore),

      openWibWobAgentWindow: () => this.openWibWobAgentWindow(),
      windows: this.windowManager,
    };
  }

  saveWorkspaceNamed(name: string): void {
    this.flashWorkspaceResult("save", this.runtimeWorkspace.save(name));
  }

  private promptForWorkspaceSave(): void {
    promptForWorkspaceSave({
      overlays: this.overlays,
      workspace: this.runtimeWorkspace,
      onResult: (result) => this.flashWorkspaceResult("save", result),
    });
  }

  private promptForWorkspaceLoad(): void {
    promptForWorkspaceLoad({
      overlays: this.overlays,
      workspace: this.runtimeWorkspace,
      workspaceDir: this.runtimeNode.workspacesDir,
      onResult: (result) => this.flashWorkspaceResult("load", result),
    });
  }

  loadWorkspaceNamed(name: string): void {
    this.flashWorkspaceResult("load", this.runtimeWorkspace.load(name));
  }

  // ── FX Pipeline (delegated to fx-pipeline.ts) ──────────────────────────────

  private buildFxDeps(): FxPipelineDeps {
    return {
      windowManager: this.windowManager,
      overlays: this.overlays,
      openTextViewer: (title, content, kind, filePath, options) =>
        this.openTextViewerWindow(title, content, kind, filePath, options),
      openPrimer: (filePath) => this.openPrimerWindow(filePath),
    };
  }

  private resolveSmearSource(args?: Record<string, unknown>) {
    return fxResolveSmearSource(this.windowManager, args);
  }

  private runFxScript(
    fx: "glitch" | "shear" | "breed" | "flip",
    args?: Record<string, unknown>,
  ) {
    return fxRunFxScript(this.buildFxDeps(), fx, args);
  }

  private smearTextSurface(args?: Record<string, unknown>) {
    return fxSmearTextSurface(this.buildFxDeps(), args);
  }

  /** Restore a workspace: apply theme, tear down existing windows, replay snapshots, restore focus. */
  private loadWorkspace(): void {
    this.flashWorkspaceResult("load", this.runtimeWorkspace.load());
  }

  /** Action bridge between the command catalog/registry and concrete controller behaviour. */
  private getAppMenuActions(): AppMenuActions {
    return {
      browsePrimers: () => this.openHostWindow("primer-browser"),
      openFileManager: () => this.openHostWindow("file-manager"),
      openPrimerPicker: () => this.openPrimerPicker(),
      openPrimerPrompt: (args) => {
        const filePath = trimmedArg(args, "filePath");
        if (!filePath) {
          if (this.isNonInteractiveCommand(args)) {
            return {
              ok: false,
              error:
                "primer.open requires filePath when called through a non-interactive control surface",
            };
          }
          return this.openPrimerPicker();
        }
        const window = this.openPrimerWindow(filePath);
        if (!window) {
          return;
        }
        const x = typedArg(args, "x", "number") ?? Number(window.frame.left);
        const y = typedArg(args, "y", "number") ?? Number(window.frame.top);
        const w = typedArg(args, "w", "number") ?? Number(window.frame.width);
        const h = typedArg(args, "h", "number") ?? Number(window.frame.height);
        if (typedArg(args, "x", "number") !== undefined || typedArg(args, "y", "number") !== undefined) {
          this.windowManager.moveWindow(window.id, x, y);
        }
        if (typedArg(args, "w", "number") !== undefined || typedArg(args, "h", "number") !== undefined) {
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
      openEditorPicker: () => this.openEditorPicker(),
      openTextFile: (args) => {
        const filePath = trimmedArg(args, "filePath");
        if (filePath) {
          // Path A: open a specific file
          this.editor.openFile(filePath, args);
        } else if (
          typedArg(args, "title", "string") !== undefined ||
          typedArg(args, "initial", "string") !== undefined
        ) {
          // Path B: open an unsaved buffer with title/initial content
          const title = typedArg(args, "title", "string");
          const initial = typedArg(args, "initial", "string");
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
          return this.openEditorPicker();
        }
      },
      openEditor: () => this.editor.openWindow(),
      saveFocusedEditor: () => this.editor.saveFocused(),
      saveAsFocusedEditor: () => this.editor.saveAsFocused(),
      saveWorkspaceAs: () => this.promptForWorkspaceSave(),
      loadWorkspacePrompt: () => this.promptForWorkspaceLoad(),
      copyFocusedWindowText: () => this.copyFocusedWindowText(),
      exportFocusedWindowText: (args) => {
        const id = typedArg(args, "id", "number");
        const name = trimmedArg(args, "name");
        this.exportFocusedWindowText(id, name);
      },
      openTerrainLab: () => this.openHostWindow("terrain-lab"),
      openMarkdownPicker: () => this.openMarkdownPicker(),
      openMarkdownViewer: (args) => {
        const filePath = trimmedArg(args, "filePath");
        if (!filePath && this.isNonInteractiveCommand(args)) {
          return {
            ok: false,
            error:
              "markdown.open requires filePath when called through a non-interactive control surface",
          };
        }
        if (!filePath) {
          return this.openMarkdownPicker();
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
      editorWrite: (args?: Record<string, unknown>) => {
        const text = typedArg(args, "text", "string") ?? "";
        const windowId = typedArg(args, "windowId", "number");
        const win = windowId
          ? this.windowManager.getWindowById(windowId)
          : this.windowManager.getFocusedWindow();
        if (win?.writeInput) {
          win.writeInput(text);
        } else {
          // Return error for API/agent callers — don't flash, it's noisy
          return { ok: false, error: "No editor window found" };
        }
      },
      agentSend: (args?: Record<string, unknown>) => {
        const text = typedArg(args, "text", "string") ?? typedArg(args, "message", "string") ?? "";
        if (!text.trim()) return;
        const win = this.findWindowByAppType("wibwob-agent");
        if (win?.writeInput) {
          win.writeInput(text);
        } else {
          this.overlays.flash("No agent chat window open");
        }
      },
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
      reloadMicroapps: () => {
        const blockedFiles = this.collectReloadInvalidationFiles();
        if (blockedFiles.length > 0) {
          const files = blockedFiles.join(", ");
          this.overlays.flash(
            `Reload blocked: host files changed since boot. Restart required${files ? ` (${files})` : ""}`,
          );
          return { ok: false, error: "restart required", requiresRestart: true, blockedFiles };
        }

        void this.reloadMicroappsFromDisk()
          .then((result) => {
            this.overlays.flash(
              `Reloaded microapps: ${result.reloaded} cmds · cleared ${result.clearedCommands} cmds/${result.clearedSnapshots} snaps`,
            );
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            this.overlays.flash(`Microapp reload failed: ${message}`);
          });
        return { ok: true, reloading: true };
      },
      quit: () => this.destroy(),
      focusNextWindow: () => this.windowManager.focusNextWindow(1),
      focusPreviousWindow: () => this.windowManager.focusNextWindow(-1),
      closeFocusedWindow: () => this.windowManager.closeFocusedWindow(),
      closeWindowById: (args) => {
        const id = Number(args?.id);
        if (!this.windowManager.getWindowById(id)) return { ok: false, error: `Window ${id} not found` };
        this.windowManager.closeWindow(id);
      },
      setWindowChrome: (args) => {
        const id = Number(args?.id);
        const mode = String(args?.mode ?? "standard") as "standard" | "none";
        if (!this.windowManager.setWindowChrome(id, mode)) {
          return { ok: false, error: `Window ${id} not found` };
        }
      },
      focusWindowById: (args) => {
        const ok = this.windowManager.focusWindowById(Number(args?.id));
        if (!ok) return { ok: false, error: `Window ${Number(args?.id)} not found` };
      },
      clickWindowElement: (args) => {
        const id = Number(args?.id);
        const label = typedArg(args, "label", "string");
        if (!label) return { ok: false, error: "label (string) is required" };
        const record = this.windowManager.getWindowById(id);
        if (!record) return { ok: false, error: `no window with id ${id}` };
        const clickables = this.windowManager.getClickables(id);
        const target = clickables.find((c) => c.label === label);
        if (!target) {
          return { ok: false, error: `label not found: "${label}"`, available: clickables.map((c) => c.label) };
        }
        // Find the actual node and emit a click event (headless — no AppleScript needed)
        const entry = record.clickables?.find((c) => c.label === label);
        if (entry?.node) {
          entry.node.emit("click");
          return { ok: true, label, row: target.row, col: target.col };
        }
        return { ok: false, error: "node reference lost" };
      },
      moveWindowById: (args) => {
        this.windowManager.moveWindow(
          Number(args?.id),
          Number(args?.left),
          Number(args?.top),
        );
      },
      resizeWindowById: (args) => {
        this.windowManager.resizeWindow(
          Number(args?.id),
          Number(args?.width),
          Number(args?.height),
        );
      },
      clearDesktop: (args) => {
        const closeAll = args?.all === true;
        const overlayCancelled = this.overlays.cancelActiveOverlay();
        this.closeMenus();
        // Snapshot windows before closing — closeWindow splices this.windows synchronously.
        // All close operations complete before this function returns, so /state is
        // immediately consistent after this command (no sleep needed).
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
        // Force a synchronous screen render so the visual state matches the data state
        // before the API response is returned.
        this.screen.render();
        return {
          ok: true,
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
      reloadMicroapp: (args) => {
        const microappId = trimmedArg(args, "microappId");
        if (!microappId) return { ok: false, error: "microappId (string) is required" };
        // 1. Close matching windows
        const closed: number[] = [];
        for (const win of this.windowManager.getWindows()) {
          if (win.microappId === microappId) {
            closed.push(win.id);
            this.windowManager.closeWindowById(win.id);
          }
        }
        // 2. Reload from disk (no auto-reopen — caller decides when/how to reopen)
        this.reloadMicroappsFromDisk();
        return { ok: true, closed, reloading: true };
      },
      menuList: () => {
        const focusedAppType = this.windowManager.getFocusedWindow()?.describeState?.()?.appType as string | undefined;
        const openMenuLabel = this.menuUi.getOpenMenuLabel();
        const menus = this.menus.map((menu) => {
          // Filter to only currently visible items (same logic as menu renderer)
          const visible = menu.items.filter(
            (item) => !item.appTypes || (!!focusedAppType && item.appTypes.includes(focusedAppType)),
          );
          let row = 2; // row 0 = menu bar, row 1 = top border, items start at row 2
          let index = 0;
          const items: { label: string; index: number; row: number }[] = [];
          for (const item of visible) {
            if (item.separator) {
              row++; // separators take a row but aren't clickable
            } else {
              items.push({ label: item.label, index, row });
              index++;
              row++;
            }
          }
          return { label: menu.label, category: menu.category, col: menu.left, items };
        });
        return { openMenu: openMenuLabel ?? null, menus };
      },
      overlaySetText: (args) => {
        const text = typedArg(args, "text", "string");
        if (text === undefined) {
          return { ok: false, error: "text (string) is required" };
        }
        const result = this.overlays.setActiveOverlayText(text);
        return result.ok ? { ok: true, text } : { ok: false, error: result.error };
      },
      overlayInfo: () => {
        const info = this.overlays.getActiveOverlayInfo();
        return info ? { active: true, ...info } : { active: false };
      },
      openBackroomsPrompt: () => this.openHostWindow("backrooms-primer-picker"),
      openBackroomsTv: (args?: Record<string, unknown>) => {
        const theme = trimmedArg(args, "theme") ?? "liminal fluorescent maze";
        const model = enumArg(args, "model", ["haiku", "sonnet", "opus"] as const) ?? "sonnet";
        const turns = clampedArg(args, "turns", 1, 20) ?? 6;
        const mode = enumArg(args, "mode", ["auto", "live", "fake-live"] as const) ?? "auto";
        this.openBackroomsTv({ theme, model, turns, mode, primers: "" });
      },
      openBackroomsLogBrowser: () => this.openHostWindow("backrooms-log-browser"),
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
      backroomsPickerToggle: (args) => {
        const api = this.getBackroomsPickerApi();
        if (!api?.toggle) return { ok: false, error: "Backrooms picker not active" };
        const index = args?.index !== undefined ? Number(args.index) : undefined;
        return api.toggle(Number.isFinite(index) ? index : undefined);
      },
      backroomsPickerToggleByLabel: (args) => {
        const api = this.getBackroomsPickerApi();
        if (!api?.toggleByLabel) return { ok: false, error: "Backrooms picker not active" };
        const label = trimmedArg(args, "label") ?? "";
        if (!label) return { ok: false, error: "label is required" };
        return api.toggleByLabel(label);
      },
      backroomsPickerSearch: (args) => {
        const api = this.getBackroomsPickerApi();
        if (!api?.search) return { ok: false, error: "Backrooms picker not active" };
        const query = typedArg(args, "query", "string") ?? "";
        return api.search(query);
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
        const wId = typedArg(args, "windowId", "number") ?? typedArg(args, "id", "number");
        const byId = wId !== undefined
          ? this.windowManager.getWindowById(wId)
          : undefined;
        const target = byId ?? this.windowManager.getFocusedWindow();
        if (!target) return { ok: false, error: "No window to maximize" };
        this.windowManager.toggleMaximize(target);
      },
      openGallery: () => this.openHostWindow("primer-gallery"),
      openBrowserReader: (args) => {
        const filePath = trimmedArg(args, "filePath");
        this.openHostWindow("reader-viewer", { filePath });
      },
      openChromeBrowser: (args) => {
        const url = trimmedArg(args, "url");
        this.openHostWindow("web-reader", url ? { url } : undefined);
      },
      navigateChromeBrowser: (args) => {
        const url = trimmedArg(args, "url") ?? "";
        if (!url) return { ok: false, error: "url is required" };
        // Find an open browser window and navigate it
        const browserWin = this.windowManager.getWindows().find(w => w.kind === "browser");
        if (!browserWin) return { ok: false, error: "No browser window open" };
        this.windowManager.sendInput(browserWin.id, url);
        return { ok: true, windowId: browserWin.id, url };
      },
      openMusicPlayer: (args) => {
        const filePath = trimmedArg(args, "filePath");
        this.openHostWindow("music-player", filePath ? { filePath } : undefined);
      },
      openCompanionWindow: () => this.openCompanionWindow(),
      openScrambleSmol: () => { this.openScrambleSmol(); },
      openScrambleFloating: () => { this.openScrambleFloating(); },
      scrambleSay: (args) => {
        const text = trimmedArg(args, "text") ?? "";
        if (!text) return;
        const win = this.findWindowByAppType("companion-widget");
        if (win?.writeInput) {
          win.writeInput(text);
        } else {
          void this.scrambleBrain.send(text).then(() => this.shellChrome.updateStatusLine());
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
      openCommandPalette: () => this.openHostWindow("command-palette"),
      openStateInspector: () => this.openStateInspectorWindow(),
      saveWorkspace: (args) => {
        const name = trimmedArg(args, "name");
        if (name) {
          this.saveWorkspaceNamed(name);
        } else {
          this.saveWorkspace();
        }
      },
      loadWorkspace: (args) => {
        const name = trimmedArg(args, "name");
        if (name) {
          this.loadWorkspaceNamed(name);
        } else {
          this.loadWorkspace();
        }
      },
      toggleTheme: () => this.toggleTheme(),
      chooseTheme: () => this.chooseTheme(),
      setTheme: (args) => this.setThemeByName(args),
      skinCycle: () => this.skinCycle(),
      skinSet: (args) => this.skinSet(args),
      // ── Finder ──────────────────────────────────────────
      finderSearch: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const query = typedArg(args, "query", "string") ?? "";
        const glob = typedArg(args, "glob", "string");
        finder.search(query, glob);
      },
      finderNavigate: (args) => {
        const finder = this.getFocusedFinder();
        if (!finder) {
          this.overlays.flash("No Finder window focused");
          return;
        }
        const dirPath = typedArg(args, "path", "string") ?? "";
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
        const query = typedArg(args, "query", "string") ?? "";
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
        const field = enumArg(args, "field", ["name", "size", "modified", "type"] as const) ?? "name";
        finder.sortBy(field);
      },

      // ── Finder: E045/E047 commands via finder controller ──
      finderEdit: () => {
        const finder = this.getFocusedFinder();
        if (finder?.edit) { finder.edit(); }
        else { this.overlays.flash("No Finder window focused"); }
      },
      finderSave: () => {
        // Save is handled by the inline editor (Ctrl+S), not the finder controller
        this.overlays.flash("Use Ctrl+S in edit mode");
      },
      finderYankContents: () => {
        const finder = this.getFocusedFinder();
        if (finder?.yankContents) { finder.yankContents(); }
        else { this.overlays.flash("No Finder window focused"); }
      },
      finderOpenExternal: (args) => {
        const finder = this.getFocusedFinder();
        if (finder?.openExternal) { finder.openExternal(); }
        else { this.overlays.flash("No Finder window focused"); }
      },
      finderShare: (args) => {
        const mode = typedArg(args, "mode", "string") ?? "path";
        const finder = this.getFocusedFinder();
        if (!finder) { this.overlays.flash("No Finder window focused"); return; }
        if (mode === "contents") { finder.yankContents?.(); }
        else { finder.copyPath?.(); }
      },
      finderExportListing: () => {
        this.overlays.flash("finder.export_listing — coming soon");
      },

      // ── Canvas documents ─────────────────────────────────
      loadCanvas: (args) => {
        const filePath = typedArg(args, "filePath", "string") ?? "";
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
        const filePath = typedArg(args, "filePath", "string") ?? "";
        if (!filePath) {
          this.overlays.flash("canvas.export requires filePath arg");
          return;
        }
        const title = typedArg(args, "title", "string") ?? "Untitled Canvas";
        try {
          const windows = this.windowManager.getWindows();
          const yaml = exportCanvasDocument(windows, this.windowManager, title);
          safeWriteFile(filePath, yaml);
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

      // ── Ghostty shader control (logic in ghostty-shader-service.ts) ──
      ghosttyShaderSet: (args) => {
        const name = typedArg(args, "name", "string") ?? "";
        return shaderSet(name);
      },
      ghosttyShaderList: () => {
        const shaders = shaderList();
        return { ok: true, shaders };
      },
      ghosttyShaderStatus: () => {
        const { active, output } = shaderStatus();
        return { ok: true, active, status: output };
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

  /** Scan instance discovery sockets and delete stale sidecars whose PID is dead.
   * Checks new instance-scoped layout first, then legacy scratch layout. */
  private cleanStaleSockets(): void {
    const roots = [
      path.join(this.runtimeNode.dataRoot ?? DATA_ROOT, "instances"),
      path.join(SCRATCH_BASE, "instances"), // legacy fallback
    ];

    for (const instancesDir of new Set(roots)) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(instancesDir, { withFileTypes: true }); } catch { continue; }

      // New layout: <instances>/<instanceId>/control.pid + control.sock
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const instanceRoot = path.join(instancesDir, entry.name);
        const controlPidPath = path.join(instanceRoot, "control.pid");
        const runtimePidPath = path.join(instanceRoot, "wibwob.pid");
        const controlSockPath = path.join(instanceRoot, "control.sock");

        if (!fs.existsSync(controlSockPath)) continue;

        const controlPid = Number(fs.existsSync(controlPidPath)
          ? fs.readFileSync(controlPidPath, "utf8").trim()
          : "NaN");
        const runtimePid = Number(fs.existsSync(runtimePidPath)
          ? fs.readFileSync(runtimePidPath, "utf8").trim()
          : "NaN");
        const pid = Number.isFinite(controlPid) ? controlPid : runtimePid;

        if (!Number.isFinite(pid)) {
          try { fs.unlinkSync(controlSockPath); } catch {}
          try { fs.unlinkSync(controlPidPath); } catch {}
          try { fs.unlinkSync(path.join(instanceRoot, "discovery.json")); } catch {}
          continue;
        }

        try {
          process.kill(pid, 0); // alive — leave it
        } catch {
          try { fs.unlinkSync(controlSockPath); } catch {}
          try { fs.unlinkSync(controlPidPath); } catch {}
          try { fs.unlinkSync(path.join(instanceRoot, "discovery.json")); } catch {}
          log.app(`cleaned stale control socket for dead pid ${pid}: ${entry.name}`);
        }
      }

      // Legacy layout: <instances>/<label>.pid + <label>.sock
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".pid")) continue;
        const pidFile = path.join(instancesDir, entry.name);
        const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
        if (isNaN(pid)) {
          try { fs.unlinkSync(pidFile); } catch {}
          continue;
        }
        try {
          process.kill(pid, 0); // alive — leave it
        } catch {
          try { fs.unlinkSync(pidFile); } catch {}
          const sockFile = path.join(instancesDir, entry.name.replace(".pid", ".sock"));
          try { fs.unlinkSync(sockFile); } catch {}
          log.app(`cleaned stale legacy socket for dead pid ${pid}: ${entry.name.replace(".pid", "")}`);
        }
      }
    }
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
