/**
 * Control API — typed route table with derived catalogue.
 *
 * Each route is a RouteDefinition in a flat array. The dispatch loop
 * matches method + path and delegates to one of three modes:
 *   - commandId → runApiCommand(id, body)
 *   - get       → handler(url, ctx)
 *   - post      → handler(body, ctx)
 *
 * ENDPOINT_CATALOGUE and OpenAPI spec are derived from the route table.
 * Adding a route = one object literal.
 */

import fs from "node:fs";
import { safeWriteFile } from "../core/safe-fs.js";
import path from "node:path";
import type { BackroomsChannel } from "../core/types.js";
import type { CommandListItem, CommandSurface } from "../core/command-registry.js";
import { log } from "./app-logger.js";
import { getRecentErrors } from "../core/error-buffer.js";
import { getCommandDefinition } from "../core/command-catalog.js";
import { typedArg, trimmedArg, enumArg, clampedArg } from "../core/arg-helpers.js";
import { worldChatService, formatWorldChannelText } from "./world-chat-service.js";
import { stripAnsi, stripBlessedChrome } from "./strip-ansi.js";

import { setActualControlApiPort } from "../runtime/runtime-node.js";
import type { RuntimeCommandService } from "../application/runtime-command-service.js";
import type { RuntimeInspectionService } from "../application/runtime-inspection-service.js";
import type { RuntimeWindowService } from "../application/runtime-window-service.js";
import type { RuntimeWorkspaceService } from "../application/runtime-workspace-service.js";
import type { RateLimitService } from "../application/rate-limit-service.js";
import type { InstanceDescriptor } from "../domain/instance-descriptor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trimTrailingBlankLines(text: string): string {
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}$/g, "\n\n");
}

function isTinyScreenshot(text: string): boolean {
  return text.trim().length <= 2;
}

function formatPrettyScreenshot(text: string, kind: "text" | "ansi"): string {
  const stamp = new Date().toISOString();
  const title = kind === "ansi" ? "WibWob Screenshot (ANSI)" : "WibWob Screenshot (text)";
  const body = trimTrailingBlankLines(text);
  const safeBody = body.length > 0 ? body : "(empty screenshot)";
  return [
    `╭─ ${title} ─ ${stamp} ─╮`,
    safeBody,
    "╰─ tip: use /state and /windows/text?id=N for semantic inspection ─╯",
  ].join("\n");
}

function normalizeBackroomsChannel(raw: unknown): BackroomsChannel {
  const body = (raw ?? {}) as Record<string, unknown>;
  return {
    theme: trimmedArg(body, "theme") ?? "liminal fluorescent maze",
    primers: typedArg(body, "primers", "string")?.trim() ?? "",
    turns: clampedArg(body, "turns", 1, 20) ?? 3,
    model: enumArg(body, "model", ["haiku", "sonnet", "opus"] as const) ?? "sonnet",
    mode: enumArg(body, "mode", ["auto", "live", "fake-live"] as const) ?? "auto",
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlApiDeps {
  commands: RuntimeCommandService;
  inspection: RuntimeInspectionService;
  windows: RuntimeWindowService;
  workspace: RuntimeWorkspaceService;
  stateService?: import("../services/state-service.js").StateService;
}

type RuntimeControlApiIdentity = Pick<
  InstanceDescriptor,
  | "instanceId"
  | "instanceDisplayId"
  | "instanceLabel"
  | "host"
  | "apiPort"
  | "scratchBase"
  | "dataRoot"
  | "instanceRoot"
  | "exportsDir"
  | "capturesDir"
  | "workspacesDir"
  | "statePath"
>;

/** Context available to every route handler. */
interface RouteContext {
  deps: ControlApiDeps;
  identity: RuntimeControlApiIdentity;
  runCommand: (id: string, args?: Record<string, unknown>) => { ok: boolean; result?: unknown; [k: string]: unknown };
  actualPort: number | undefined;
  startedAt: number;
  getScreenSize?: () => { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Route table type
// ---------------------------------------------------------------------------

type RouteHandler =
  | { commandId: string; argsMapper?: (body: Record<string, unknown>) => Record<string, unknown> | undefined; validate?: (body: Record<string, unknown>) => string | undefined }
  | { get: (url: URL, ctx: RouteContext) => unknown | Response | Promise<unknown | Response> }
  | { post: (body: Record<string, unknown>, ctx: RouteContext) => unknown | Response | Promise<unknown | Response> };

interface RouteDefinition {
  method: "GET" | "POST";
  path: string;
  description: string;
  body?: Record<string, string>;
  handler: RouteHandler;
}

// ---------------------------------------------------------------------------
// Route table — single source of truth for dispatch + docs
// ---------------------------------------------------------------------------

function buildRoutes(): RouteDefinition[] {
  return [
    // ── Service info ──
    {
      method: "GET", path: "/", description: "Service info + endpoint list (this response)",
      handler: { get: (_url, ctx) => ({
        ok: true,
        service: "wibwob-ts-tui-control-api",
        port: ctx.actualPort,
        requestedPort: ctx.identity.apiPort,
        host: ctx.identity.host,
        instanceLabel: ctx.identity.instanceLabel,
        instanceId: ctx.identity.instanceId,
        scratchBase: ctx.identity.scratchBase,
        capturesDir: ctx.identity.capturesDir,
        workspacesDir: ctx.identity.workspacesDir,
        statePath: ctx.identity.statePath,
        docs: "GET /openapi.json for full OpenAPI 3.0 spec",
        endpoints: deriveEndpointCatalogue(buildRoutes()),
      }) },
    },
    {
      method: "GET", path: "/help", description: "Alias for /",
      handler: { get: (_url, ctx) => ({
        ok: true,
        service: "wibwob-ts-tui-control-api",
        port: ctx.actualPort,
        requestedPort: ctx.identity.apiPort,
        host: ctx.identity.host,
        instanceLabel: ctx.identity.instanceLabel,
        instanceId: ctx.identity.instanceId,
        scratchBase: ctx.identity.scratchBase,
        capturesDir: ctx.identity.capturesDir,
        workspacesDir: ctx.identity.workspacesDir,
        statePath: ctx.identity.statePath,
        docs: "GET /openapi.json for full OpenAPI 3.0 spec",
        endpoints: deriveEndpointCatalogue(buildRoutes()),
      }) },
    },

    // ── Health + config ──
    {
      method: "GET", path: "/health", description: "Instance identity: id, label, pid, uptime, port, socketPath",
      handler: { get: (_url, ctx) => {
        const uptimeMs = Date.now() - ctx.startedAt;
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const h = Math.floor(uptimeSec / 3600);
        const m = Math.floor((uptimeSec % 3600) / 60);
        const uptime = h > 0 ? `${h}h ${m}m` : `${m}m`;
        const screen = ctx.getScreenSize?.() ?? null;
        return {
          ok: true,
          instanceId: ctx.identity.instanceId,
          instanceDisplayId: ctx.identity.instanceDisplayId,
          instanceLabel: ctx.identity.instanceLabel ?? null,
          pid: process.pid,
          startedAt: new Date(ctx.startedAt).toISOString(),
          uptime,
          port: ctx.actualPort,
          host: ctx.identity.host,
          socketPath: null, // filled by class method
          dataRoot: ctx.identity.dataRoot,
          instanceRoot: ctx.identity.instanceRoot,
          screen: screen ? { width: screen.width, height: screen.height } : null,
          cwd: process.cwd(),
        };
      } },
    },
    {
      method: "GET", path: "/config", description: "Instance config: paths (scratch, captures, workspaces, state)",
      handler: { get: (_url, ctx) => ({
        instanceId: ctx.identity.instanceId,
        requestedPort: ctx.identity.apiPort,
        scratchBase: ctx.identity.scratchBase,
        dataRoot: ctx.identity.dataRoot,
        instanceRoot: ctx.identity.instanceRoot,
        exportsDir: ctx.identity.exportsDir,
        capturesDir: ctx.identity.capturesDir,
        workspacesDir: ctx.identity.workspacesDir,
        statePath: ctx.identity.statePath,
      }) },
    },

    // ── State + inspection ──
    {
      method: "GET", path: "/state", description: "Full live desktop + window state",
      handler: { get: (_url, ctx) => ctx.deps.inspection.syncState() },
    },
    {
      method: "GET", path: "/skin", description: "Effective TUI skin: borderStyle, borderChar, shadowEnabled",
      handler: { get: (_url, ctx) => ({ ok: true, skin: ctx.deps.inspection.syncState().skin }) },
    },
    {
      method: "POST", path: "/skin/set", description: "Set TUI skin properties. Applies live to all open windows and persists to settings.json.",
      body: { borderStyle: "'line'|'bg'|'none' (optional)", borderChar: "string (optional)", shadowEnabled: "boolean (optional)" },
      handler: { commandId: "skin.set" },
    },
    {
      method: "GET", path: "/errors/recent", description: "Last 20 runtime errors from microapp lifecycle hooks",
      handler: { get: () => ({ ok: true, errors: getRecentErrors() }) },
    },
    {
      method: "GET", path: "/runtime/inspection", description: "Structured runtime snapshot: desktop state, menu/overlay UI state, runtime stats, and Scramble inspection.",
      handler: { get: (_url, ctx) => ({ ok: true, snapshot: ctx.deps.inspection.getSnapshot() }) },
    },
    {
      method: "GET", path: "/runtime/stats", description: "Shell-level runtime stats: render FPS, frame time, RAM, and agent activity",
      handler: { get: (_url, ctx) => ({ ok: true, stats: ctx.deps.inspection.getSnapshot().stats }) },
    },

    // ── Scramble ──
    {
      method: "GET", path: "/scramble/state", description: "Scramble brain state: status, model, sessionId, messageCount, lastMessage, sleeping, logPath",
      handler: { get: (_url, ctx) => ctx.deps.inspection.getSnapshot().scramble },
    },
    {
      method: "GET", path: "/scramble/history", description: "Full Scramble conversation history as JSON array",
      handler: { get: (_url, ctx) => ({ history: ctx.deps.inspection.getSnapshot().history }) },
    },
    {
      method: "POST", path: "/scramble/say", description: "Send a message to Scramble (returns reply)",
      body: { text: "string" },
      handler: { commandId: "scramble.say", argsMapper: (b) => b.text ? { text: b.text } : undefined },
    },
    {
      method: "POST", path: "/scramble/pop-out", description: "Pop Scramble out to floating window",
      handler: { commandId: "scramble.pop-out" },
    },
    {
      method: "POST", path: "/scramble/pet", description: "Pet Scramble",
      handler: { commandId: "scramble.pet" },
    },
    {
      method: "POST", path: "/scramble/sleep", description: "Put Scramble to sleep",
      handler: { commandId: "scramble.sleep" },
    },
    {
      method: "POST", path: "/scramble/wake", description: "Wake Scramble up",
      handler: { commandId: "scramble.wake" },
    },
    {
      method: "POST", path: "/scramble/meow", description: "Make Scramble meow",
      handler: { commandId: "scramble.meow" },
    },

    // ── Browser ──
    {
      method: "GET", path: "/browser/state", description: "Chrome browser state: currentUrl, currentTitle, historyLength, loading.",
      handler: { get: (_url, ctx) => {
        const state = ctx.deps.inspection.getSnapshot().state;
        const browserWin = state.windows.find(w => w.appType === "web-reader");
        if (!browserWin) return new Response(JSON.stringify({ ok: false, error: "No browser window open" }), { status: 404, headers: { "Content-Type": "application/json" } });
        return { ok: true, ...browserWin };
      } },
    },
    {
      method: "POST", path: "/browser/navigate", description: "Navigate a Chrome browser window to a URL.",
      body: { url: "string (required)" },
      handler: { post: (body, ctx) => {
        const targetUrl = body.url as string | undefined;
        if (!targetUrl) return new Response(JSON.stringify({ ok: false, error: "url is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const state = ctx.deps.inspection.getSnapshot().state;
        const browserWin = state.windows.find(w => w.appType === "web-reader");
        if (!browserWin) return new Response(JSON.stringify({ ok: false, error: "No browser window open" }), { status: 404, headers: { "Content-Type": "application/json" } });
        const sent = ctx.deps.windows.sendInput(browserWin.id, targetUrl);
        return { ok: sent, windowId: browserWin.id, url: targetUrl };
      } },
    },

    // ── Commands ──
    {
      method: "GET", path: "/commands/list", description: "All registered commands (optional ?surface=menu|palette|api|agent&includeUnavailable=1)",
      handler: { get: (url, ctx) => {
        const surface = url.searchParams.get("surface") as CommandSurface | null;
        const tierFilter = url.searchParams.get("tier");
        const includeUnavailableRaw = url.searchParams.get("includeUnavailable");
        const includeUnavailable = includeUnavailableRaw === "1" || includeUnavailableRaw === "true" || includeUnavailableRaw === "yes";
        let commands = ctx.deps.commands.list(surface ?? undefined, { includeUnavailable });
        if (tierFilter) {
          const tiers = new Set(tierFilter.split(","));
          commands = commands.filter((cmd) => {
            const tier = (cmd as CommandListItem & { tier?: string }).tier;
            return tiers.has(tier ?? "builtin");
          });
        }
        return { ok: true, commands };
      } },
    },
    {
      method: "POST", path: "/commands/run", description: "Execute a command by id. Canonical command execution endpoint.",
      body: { id: "string (command id, canonical)", args: "object (optional)" },
      handler: { post: (body, ctx) => handleCommandsRun(body, ctx) },
    },

    // ── Content ──
    {
      method: "GET", path: "/content/primer-info", description: "Primer content metadata. ?path=/abs/path.txt",
      handler: { get: (url, ctx) => {
        const pathOrName = url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
        return ctx.deps.inspection.getPrimerInfo(pathOrName);
      } },
    },

    // ── World chat ──
    {
      method: "GET", path: "/world-chat/state", description: "Structured world chat snapshot outside the TUI",
      handler: { get: () => ({ ok: true, ...worldChatService.snapshot() }) },
    },
    {
      method: "GET", path: "/world-chat/channels", description: "List world chat channels outside the TUI",
      handler: { get: () => ({
        ok: true,
        worldKey: worldChatService.getCurrentWorldKey(),
        transport: worldChatService.getTransportStatus(),
        channels: worldChatService.listChannels(),
      }) },
    },
    {
      method: "GET", path: "/world-chat/channel", description: "Read one world chat channel. ?id=%23world-ridge-overlook",
      handler: { get: (url) => {
        const channelId = url.searchParams.get("id") ?? "";
        const channel = channelId ? worldChatService.readChannel(channelId) : undefined;
        if (!channel) return new Response(JSON.stringify({ ok: false, error: "channel not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        return { ok: true, channel };
      } },
    },
    {
      method: "GET", path: "/world-chat/channel/text", description: "Plain text export of one world chat channel. ?id=%23world-ridge-overlook",
      handler: { get: (url) => {
        const channelId = url.searchParams.get("id") ?? "";
        const channel = channelId ? worldChatService.readChannel(channelId) : undefined;
        if (!channel) return new Response("channel not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        return new Response(`${formatWorldChannelText(channel)}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      } },
    },

    // ── Screenshots ──
    {
      method: "GET", path: "/screenshot", description: "Friendly screenshot alias. Defaults to clean text output.",
      handler: { get: (url, ctx) => handleScreenshotText(url, ctx) },
    },
    {
      method: "GET", path: "/screenshot/text", description: "Clean readable text screenshot. ?id=N uses semantic captureText.",
      handler: { get: (url, ctx) => handleScreenshotText(url, ctx) },
    },
    {
      method: "GET", path: "/screenshot/ansi", description: "Raw ANSI text screenshot (blessed screen dump). ?id=N to crop to window rect.",
      handler: { get: (url, ctx) => handleScreenshotAnsi(url, ctx) },
    },

    // ── Windows: text ──
    {
      method: "GET", path: "/windows/text", description: "Raw text content of a window. ?id=N or ?appType=wibwob.figlet.",
      handler: { get: (url, ctx) => handleWindowsText(url, ctx) },
    },
    {
      method: "GET", path: "/windows/clickables", description: "List clickable elements for a window. ?id=N",
      handler: { get: (url, ctx) => {
        const id = Number(url.searchParams.get("id"));
        if (!Number.isFinite(id)) return new Response(JSON.stringify({ ok: false, error: "id is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        return { ok: true, id, clickables: ctx.deps.windows.getClickables(id) };
      } },
    },

    // ── Windows: mutations ──
    {
      method: "POST", path: "/windows/focus", description: "Focus a window by id",
      body: { id: "number" },
      handler: { commandId: "window.focus", argsMapper: (b) => ({ id: Number(b.id) }) },
    },
    {
      method: "POST", path: "/windows/click", description: "Click a named element in a window.",
      body: { id: "number", label: "string" },
      handler: { commandId: "window.click", argsMapper: (b) => ({ id: Number(b.id), label: b.label }) },
    },
    {
      method: "POST", path: "/windows/move", description: "Move a window to absolute coordinates",
      body: { id: "number", left: "number", top: "number" },
      handler: { post: (body, ctx) => {
        const b = body;
        if (!Number.isFinite(Number(b.left)) || !Number.isFinite(Number(b.top))) {
          return new Response(JSON.stringify({ ok: false, error: "left and top are required numbers" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        return { ok: ctx.deps.windows.move(Number(b.id), Number(b.left), Number(b.top)) };
      } },
    },
    {
      method: "POST", path: "/windows/resize", description: "Resize a window",
      body: { id: "number", width: "number", height: "number" },
      handler: { post: (body, ctx) => {
        const b = body;
        if (!Number.isFinite(Number(b.width)) || !Number.isFinite(Number(b.height))) {
          return new Response(JSON.stringify({ ok: false, error: "width and height are required numbers" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        return { ok: ctx.deps.windows.resize(Number(b.id), Number(b.width), Number(b.height)) };
      } },
    },
    {
      method: "POST", path: "/windows/close", description: "Close a window by id",
      body: { id: "number" },
      handler: { commandId: "window.close", argsMapper: (b) => ({ id: Number(b.id) }) },
    },
    {
      method: "POST", path: "/windows/maximize", description: "Toggle maximize for a window",
      body: { id: "number" },
      handler: { commandId: "window.toggle_maximize", argsMapper: (b) => ({ id: Number(b.id) }) },
    },
    {
      method: "POST", path: "/windows/batch", description: "Move/resize/close multiple windows in one request.",
      body: { ops: "[{id, left?, top?, width?, height?, close?}]" },
      handler: { post: (body, ctx) => handleWindowsBatch(body, ctx) },
    },
    {
      method: "POST", path: "/windows/input", description: "Send text input to a window",
      body: { id: "number", input: "string (trailing \\r submits)" },
      handler: { post: (body, ctx) => ({
        ok: ctx.deps.windows.sendInput(Number(body.id), String(body.input ?? ""), body.sender ? String(body.sender) : undefined),
      }) },
    },
    {
      method: "POST", path: "/windows/agent-message", description: "Send a message to the Wib&Wob Agent window",
      body: { id: "number", text: "string", sender: "string (optional)" },
      handler: { post: (body, ctx) => ({
        ok: ctx.deps.windows.sendInput(Number(body.id), String(body.text ?? body.input ?? ""), body.sender ? String(body.sender) : undefined),
      }) },
    },
    {
      method: "POST", path: "/windows/editor/write", description: "Write content to an editor window buffer",
      body: { id: "number", content: "string" },
      handler: { post: (body, ctx) => ({
        ok: ctx.deps.windows.writeEditorText(Number(body.id), String(body.text ?? "")),
      }) },
    },
    {
      method: "POST", path: "/windows/text/export", description: "Export window text content to scratch/captures/",
      body: { id: "number", name: "string (optional)" },
      handler: { post: (body, ctx) => handleWindowsTextExport(body, ctx) },
    },

    // ── View endpoints — backward compat aliases for /commands/run ──
    {
      method: "POST", path: "/view/primer-browser/open", description: "Open primer browser. Alias: primer.browse",
      handler: { commandId: "primer.browse" },
    },
    {
      method: "POST", path: "/view/file-manager/open", description: "Open file manager. Alias: finder.open",
      handler: { commandId: "finder.open" },
    },
    {
      method: "POST", path: "/view/primer-gallery/open", description: "Open primer gallery. Alias: primer-gallery.open",
      handler: { commandId: "primer-gallery.open" },
    },
    {
      method: "POST", path: "/view/primer/open", description: "Open primer viewer. Alias: primer.open",
      body: { filePath: "string (absolute path)" },
      handler: { commandId: "primer.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath, x: b.x, y: b.y, w: b.w, h: b.h } : undefined, validate: (b) => b.filePath ? undefined : "filePath required" },
    },
    {
      method: "POST", path: "/view/reader/open", description: "Open document reader. Alias: markdown.open",
      body: { filePath: "string (absolute .md path)" },
      handler: { commandId: "markdown.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath } : undefined },
    },
    {
      method: "POST", path: "/view/figlet/open", description: "Open figlet banner. Alias: figlet.open",
      body: { text: "string", font: "string (optional)" },
      handler: { commandId: "figlet.open", argsMapper: (b) => b.text ? { text: b.text, font: b.font } : undefined },
    },
    {
      method: "GET", path: "/view/figlet/fonts", description: "List figlet fonts, default font, and metadata. Alias: figlet.fonts",
      handler: { get: (_url, ctx) => ctx.runCommand("figlet.fonts") },
    },
    {
      method: "POST", path: "/view/figlet/open-default", description: "Open figlet banner without interactive prompts.",
      body: { text: "string (optional)", font: "string (optional)" },
      handler: { post: (body, ctx) => {
        const text = trimmedArg(body, "text") ?? "WIB WOB";
        const font = trimmedArg(body, "font");
        return ctx.runCommand("figlet.open", font ? { text, font } : { text });
      } },
    },
    {
      method: "POST", path: "/view/generative-art/open", description: "Open generative art. Alias: art.open",
      handler: { commandId: "art.open" },
    },
    {
      method: "POST", path: "/view/monster-cam/open", description: "Open Monster Cam. Alias: monster-cam.open",
      handler: { commandId: "monster-cam.open" },
    },
    {
      method: "POST", path: "/view/agent/open", description: "Open Wib&Wob Agent. Alias: agent.open",
      handler: { commandId: "agent.open" },
    },
    {
      method: "POST", path: "/view/companion/open", description: "Open Scramble companion (floating). Alias: companion.open",
      handler: { commandId: "companion.open" },
    },
    {
      method: "POST", path: "/view/companion/compact", description: "Open Scramble companion (popup). Alias: companion.smol",
      handler: { commandId: "companion.smol" },
    },
    {
      method: "POST", path: "/view/music-player/open", description: "Open music player. Alias: music-player.open",
      body: { filePath: "string (optional)" },
      handler: { commandId: "music-player.open" },
    },
    {
      method: "POST", path: "/view/workspace/open", description: "Open workspace manager. Alias: workspace.manage",
      handler: { commandId: "workspace.manage" },
    },
    {
      method: "POST", path: "/view/palette/open", description: "Open command palette. Alias: palette.open",
      handler: { commandId: "palette.open" },
    },
    {
      method: "POST", path: "/view/inspector/open", description: "Open state inspector. Alias: inspector.open",
      handler: { commandId: "inspector.open" },
    },
    {
      method: "POST", path: "/view/editor/open", description: "Open text editor. Alias: editor.open",
      body: { filePath: "string (optional)", title: "string (optional)", initial: "string (optional)" },
      handler: { commandId: "editor.open", argsMapper: (b) => {
        const args: Record<string, unknown> = {};
        if (typedArg(b, "filePath", "string")) args.filePath = b.filePath;
        if (typedArg(b, "title", "string")) args.title = b.title;
        if (typedArg(b, "initial", "string")) args.initial = b.initial;
        return Object.keys(args).length ? args : undefined;
      } },
    },
    {
      method: "GET", path: "/view/zine/canvases", description: "List selectable Zine canvases. Alias: microapp.wibwob.zine.list-canvases",
      handler: { get: (_url, ctx) => ctx.runCommand("microapp.wibwob.zine.list-canvases") },
    },
    {
      method: "POST", path: "/view/zine/open", description: "Open Zine canvas without interactive picker.",
      body: { filePath: "string (optional)", index: "number (optional)" },
      handler: { post: (body, ctx) => handleZineOpen(body, ctx) },
    },
    {
      method: "POST", path: "/view/backrooms/open", description: "Start backrooms session. Alias: backrooms.open",
      body: { theme: "string", mode: "auto|live|fake-live", model: "haiku|sonnet|opus", turns: "number", primers: "string (optional csv)" },
      handler: { post: (body, ctx) => {
        const channel = normalizeBackroomsChannel(body);
        const result = ctx.runCommand("backrooms.open", channel as unknown as Record<string, unknown>);
        return { ...result, channel };
      } },
    },

    // ── Menu + overlay ──
    {
      method: "GET", path: "/menu/list", description: "List all menus with items, col positions, and row indices for click targeting.",
      handler: { get: (_url, ctx) => ctx.runCommand("menu.list") },
    },
    {
      method: "GET", path: "/overlay/info", description: "Check if a modal overlay is active.",
      handler: { get: (_url, ctx) => ctx.runCommand("overlay.info") },
    },
    {
      method: "POST", path: "/overlay/confirm", description: "Confirm the active modal overlay (OK/Enter).",
      handler: { post: (_body, ctx) => {
        const result = ctx.runCommand("overlay.confirm");
        const inner = result.ok ? result.result as { confirmed?: boolean; error?: string } | undefined : undefined;
        if (inner && !inner.confirmed) return { ok: false, error: inner.error ?? "No active overlay" };
        return result;
      } },
    },
    {
      method: "POST", path: "/overlay/cancel", description: "Cancel the active modal overlay (Cancel/Escape).",
      handler: { post: (_body, ctx) => {
        const result = ctx.runCommand("overlay.cancel");
        const inner = result.ok ? result.result as { cancelled?: boolean; error?: string } | undefined : undefined;
        if (inner && !inner.cancelled) return { ok: false, error: inner.error ?? "No active overlay" };
        return result;
      } },
    },
    {
      method: "POST", path: "/overlay/select", description: "Select item index in active overlay.",
      body: { index: "number (required)" },
      handler: { post: (body, ctx) => {
        const index = Number(body.index);
        if (!Number.isFinite(index)) return new Response(JSON.stringify({ ok: false, error: "index is required and must be a number" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const result = ctx.runCommand("overlay.select", { index });
        const inner = result.ok ? result.result as { selected?: boolean; error?: string } | undefined : undefined;
        if (inner && !inner.selected) return { ok: false, error: inner.error ?? "Overlay selection failed" };
        return result;
      } },
    },
    {
      method: "POST", path: "/overlay/set-text", description: "Set the text value in the active overlay input.",
      body: { text: "string (required)" },
      handler: { post: (body, ctx) => {
        if (typeof body.text !== "string") return new Response(JSON.stringify({ ok: false, error: "text (string) is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        return ctx.runCommand("overlay.set-text", { text: body.text });
      } },
    },

    // ── Workspace persistence ──
    {
      method: "POST", path: "/workspace/save", description: "Save current workspace layout",
      body: { name: "string" },
      handler: { post: (body, ctx) => ctx.deps.workspace.save(typedArg(body, "name", "string")) },
    },
    {
      method: "POST", path: "/workspace/load", description: "Load a named workspace layout",
      body: { name: "string" },
      handler: { post: (body, ctx) => ctx.deps.workspace.load(typedArg(body, "name", "string")) },
    },

    // ── SSE ──
    {
      method: "GET", path: "/events", description: "SSE stream of runtime events. ?type= filter. ?window=N filter.",
      handler: { get: (url, ctx) => handleSSE(url, ctx) },
    },

  ];
}

// ---------------------------------------------------------------------------
// Complex route handlers (extracted named functions)
// ---------------------------------------------------------------------------

function handleCommandsRun(body: Record<string, unknown>, ctx: RouteContext): Response {
  const id = typedArg(body, "id", "string") ?? "";
  if (!id) {
    return Response.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const rawArgs = typeof body.args === "object" && body.args !== null
    ? body.args as Record<string, unknown>
    : undefined;
  let args = rawArgs;
  const cmdDef = getCommandDefinition(id);
  if (cmdDef?.params && rawArgs) {
    const result = cmdDef.params.safeParse(rawArgs);
    if (!result.success) {
      return Response.json({
        ok: false,
        error: "Invalid arguments",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
          ...("expected" in i ? { expected: i.expected } : {}),
          ...("received" in i ? { received: i.received } : {}),
        })),
      }, { status: 400 });
    }
    args = result.data as Record<string, unknown>;
  }
  try {
    const errorsBefore = getRecentErrors().length;
    const result = ctx.runCommand(id, args);
    const microappId = id.startsWith("microapp.") && id.split(".").length >= 4
      ? id.split(".").slice(1, -1).join(".")
      : undefined;
    const newErrors = getRecentErrors()
      .slice(errorsBefore)
      .filter(e => !microappId || !e.microappId || e.microappId === microappId);
    const response = newErrors.length > 0 ? { ...result, errors: newErrors } : result;
    const windowId = typeof (result as Record<string, unknown>)?.windowId === "number"
      ? (result as Record<string, unknown>).windowId as number : undefined;
    ctx.deps.stateService?.emitEvent({ type: "command-completed", commandId: id, windowId });
    return Response.json(response, { status: result.ok ? 200 : 404 });
  } catch (err: unknown) {
    ctx.deps.stateService?.emitEvent({ type: "command-failed", commandId: id, error: err instanceof Error ? err.message : String(err) });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
  }
}

function handleScreenshotText(url: URL, ctx: RouteContext): Response {
  const rawId = url.searchParams.get("id");
  const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

  if (rawId !== null) {
    const id = Number(rawId);
    const semantic = ctx.deps.windows.captureText(id);
    if (semantic !== undefined) {
      return new Response(trimTrailingBlankLines(stripAnsi(semantic)), { headers: TEXT_HEADERS });
    }
    const raw = ctx.deps.inspection.screenshotText();
    const win = ctx.deps.windows.getWindowById(id);
    if (win) {
      const x = Number(win.frame.left);
      const y = Number(win.frame.top);
      const w = Number(win.frame.width);
      const h = Number(win.frame.height);
      const lines = raw.split("\n");
      const cropped = lines.slice(y, y + h).map((line: string) => stripBlessedChrome(line).slice(x, x + w));
      return new Response(trimTrailingBlankLines(cropped.join("\n")), { headers: TEXT_HEADERS });
    }
    return new Response("window not found", { status: 404, headers: TEXT_HEADERS });
  }
  const raw = stripBlessedChrome(ctx.deps.inspection.screenshotText());
  const text = trimTrailingBlankLines(raw);
  const pretty = isTinyScreenshot(text) ? formatPrettyScreenshot(text, "text") : text;
  return new Response(pretty, { headers: TEXT_HEADERS });
}

function handleScreenshotAnsi(url: URL, ctx: RouteContext): Response {
  const rawId = url.searchParams.get("id");
  let text = ctx.deps.inspection.screenshotText();
  const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

  if (rawId !== null) {
    const id = Number(rawId);
    const win = ctx.deps.windows.getWindowById(id);
    if (win) {
      const y = Number(win.frame.top);
      const h = Number(win.frame.height);
      const lines = text.split("\n");
      const cropped = lines.slice(y, y + h).map((line: string) => line);
      text = cropped.join("\n");
    }
  }
  const out = rawId === null && isTinyScreenshot(stripAnsi(text))
    ? formatPrettyScreenshot(text, "ansi")
    : text;
  return new Response(out, { headers: TEXT_HEADERS });
}

function handleWindowsText(url: URL, ctx: RouteContext): unknown {
  let id = Number(url.searchParams.get("id"));
  const appType = url.searchParams.get("appType");
  if (!id && appType) {
    const stateWins = ctx.deps.stateService?.getState()?.windows ?? [];
    const wins = stateWins.filter(w => w.appType === appType)
      .map(sw => ctx.deps.windows.getWindowById(sw.id))
      .filter((w): w is NonNullable<typeof w> => w !== undefined);
    const focusedId = ctx.deps.stateService?.getState()?.focus?.windowId;
    const win = wins.find(w => w.id === focusedId) ?? wins.at(-1);
    if (!win) return new Response(JSON.stringify({ ok: false, error: `No window with appType: ${appType}` }), { status: 404, headers: { "Content-Type": "application/json" } });
    id = win.id;
  }
  const text = ctx.deps.windows.captureText(id);
  return { ok: text !== undefined, text: text ?? null };
}

function handleWindowsBatch(body: Record<string, unknown>, ctx: RouteContext): unknown | Response {
  const ops = body.ops as Array<{ id: number; left?: number; top?: number; width?: number; height?: number; close?: boolean }>;
  if (!Array.isArray(ops)) {
    return new Response(JSON.stringify({ ok: false, error: "ops must be an array" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  for (const [index, op] of ops.entries()) {
    const hasMove = op.left !== undefined || op.top !== undefined;
    const hasResize = op.width !== undefined || op.height !== undefined;
    if (op.close) continue;
    if (hasMove !== (op.left !== undefined && op.top !== undefined)) {
      return new Response(JSON.stringify({ ok: false, error: `op ${index} requires canonical left and top fields` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (hasResize !== (op.width !== undefined && op.height !== undefined)) {
      return new Response(JSON.stringify({ ok: false, error: `op ${index} requires canonical width and height fields` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!hasMove && !hasResize) {
      return new Response(JSON.stringify({ ok: false, error: `op ${index} must include canonical move/resize fields or close=true` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }
  const results = ctx.deps.windows.batch(
    ops.map((op) => ({ id: Number(op.id), left: op.left, top: op.top, width: op.width, height: op.height, close: op.close })),
  );
  return { ok: results.every(Boolean), results };
}

function handleWindowsTextExport(body: Record<string, unknown>, ctx: RouteContext): unknown {
  const id = Number(body.id);
  const text = ctx.deps.windows.captureText(id);
  if (!text) return { ok: false, path: null };
  const capturesDir = ctx.identity.capturesDir
    ? path.resolve(ctx.identity.capturesDir)
    : path.join(process.cwd(), "scratch", "captures");
  fs.mkdirSync(capturesDir, { recursive: true });
  const name = typedArg(body, "name", "string") ?? typedArg(body, "label", "string") ?? `window-${id}`;
  const safeName = name.replace(/[^a-z0-9._-]+/gi, "-");
  const fileName = `${new Date().toISOString().replaceAll(":", "-")}_${safeName}.txt`;
  const filePath = path.join(capturesDir, fileName);
  safeWriteFile(filePath, `${text}\n`);
  return { ok: true, path: filePath };
}

function handleZineOpen(body: Record<string, unknown>, ctx: RouteContext): unknown | Response {
  const filePath = trimmedArg(body, "filePath");
  let args: Record<string, unknown> | undefined;
  if (filePath) {
    args = { filePath };
  } else if (typedArg(body, "index", "number") !== undefined) {
    const listed = ctx.runCommand("microapp.wibwob.zine.list-canvases");
    if (!listed.ok) return listed;
    const listResult = listed.result as { files?: { index?: number; filePath?: string }[] } | undefined;
    const files = listResult?.files;
    const picked = Array.isArray(files) ? files.find((f) => Number(f?.index) === Number(body.index)) : undefined;
    if (!picked?.filePath) return new Response(JSON.stringify({ ok: false, error: "Invalid zine canvas index" }), { status: 400, headers: { "Content-Type": "application/json" } });
    args = { filePath: picked.filePath };
  } else {
    return new Response(JSON.stringify({ ok: false, error: "filePath or index required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  return ctx.runCommand("microapp.wibwob.zine.open", args);
}

function handleSSE(url: URL, ctx: RouteContext): Response {
  const typeFilter = url.searchParams.get("type");
  const windowFilter = url.searchParams.get("window") ? Number(url.searchParams.get("window")) : undefined;
  const stateService = ctx.deps.stateService;
  if (!stateService) return Response.json({ ok: false, error: "SSE not available" }, { status: 503 });
  let unsub: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      unsub = stateService.subscribeEvents((event) => {
        if (typeFilter && event.type !== typeFilter) return;
        if (windowFilter && !("windowId" in event && event.windowId === windowFilter)) return;
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`));
      });
    },
    cancel() { unsub?.(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}

// ---------------------------------------------------------------------------
// Derive ENDPOINT_CATALOGUE from route table (no more manual maintenance)
// ---------------------------------------------------------------------------

function deriveEndpointCatalogue(routes: RouteDefinition[]): { method: string; path: string; description: string; body?: Record<string, string> }[] {
  const seen = new Set<string>();
  const catalogue: { method: string; path: string; description: string; body?: Record<string, string> }[] = [];
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    catalogue.push({ method: r.method, path: r.path, description: r.description, ...(r.body ? { body: r.body } : {}) });
  }
  return catalogue;
}

// Cached route table + lookup maps (built once, reused per request)
let cachedRoutes: RouteDefinition[] | undefined;
let getMap: Map<string, RouteDefinition> | undefined;
let postMap: Map<string, RouteDefinition> | undefined;

function getRoutes() {
  if (!cachedRoutes) {
    cachedRoutes = buildRoutes();
    getMap = new Map();
    postMap = new Map();
    for (const r of cachedRoutes) {
      const map = r.method === "GET" ? getMap : postMap;
      if (!map.has(r.path)) map.set(r.path, r);
    }
  }
  return { routes: cachedRoutes, getMap: getMap!, postMap: postMap! };
}

function buildOpenApiSpec(port: number) {
  const { routes } = getRoutes();
  const catalogue = deriveEndpointCatalogue(routes);
  const paths: Record<string, unknown> = {};
  for (const ep of catalogue) {
    const key = ep.path;
    const method = ep.method.toLowerCase();
    if (!paths[key]) paths[key] = {};
    const op: Record<string, unknown> = {
      summary: ep.description,
      responses: { "200": { description: "OK" } },
    };
    if (method === "post" && ep.body && Object.keys(ep.body).length > 0) {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ep.body)) {
        props[k] = { type: "string", description: v };
      }
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: props } } },
      };
    }
    (paths[key] as Record<string, unknown>)[method] = op;
  }
  return {
    openapi: "3.0.0",
    info: { title: "WibWob-DOS Control API", version: "1.0.0", description: "Local HTTP control surface for the WibWob-DOS TUI" },
    servers: [{ url: `http://127.0.0.1:${port}` }],
    paths,
  };
}

// ---------------------------------------------------------------------------
// ControlApiService — owns transport (Bun.serve, sockets, PID), delegates
// route dispatch to the route table.
// ---------------------------------------------------------------------------

export class ControlApiService {
  setStateService(s: import("../services/state-service.js").StateService): void {
    (this.deps as { stateService: unknown }).stateService = s;
  }
  private server?: { stop: (closeActiveConnections?: boolean) => void };
  private socketServer?: { stop: (closeActiveConnections?: boolean) => void };
  private actualPort?: number;
  private socketPath?: string;
  private pidPath?: string;
  private discoveryPath?: string;
  private runtimeManifestPath?: string;
  private readonly startedAt = Date.now();
  private enabled = false;
  private getScreenSize?: () => { width: number; height: number };

  constructor(
    private readonly port: number,
    private readonly deps: ControlApiDeps,
    private readonly identity: RuntimeControlApiIdentity,
    private readonly rateLimiter?: RateLimitService,
  ) {}

  setScreenSizeGetter(fn: () => { width: number; height: number }): void {
    this.getScreenSize = fn;
  }

  hasSocket(): boolean {
    return this.socketPath != null;
  }

  private writeRuntimeControlManifest(socketPath: string): void {
    if (!this.identity.dataRoot) return;
    const manifestPath = path.join(this.identity.dataRoot, "runtime", "control-manifest.json");
    this.runtimeManifestPath = manifestPath;
    safeWriteFile(
      manifestPath,
      `${JSON.stringify({
        instanceId: this.identity.instanceId,
        instanceDisplayId: this.identity.instanceDisplayId,
        instanceLabel: this.identity.instanceLabel ?? null,
        pid: process.pid,
        host: this.identity.host,
        apiPort: this.actualPort ?? this.port,
        socketPath,
        instanceRoot: this.identity.instanceRoot,
        dataRoot: this.identity.dataRoot,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
    );
  }

  private cleanupRuntimeControlManifest(): void {
    const manifestPath = this.runtimeManifestPath;
    if (!manifestPath) return;
    try {
      const current = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { instanceId?: string; pid?: number };
      const sameProcess = current?.pid === process.pid;
      const sameInstance = current?.instanceId === this.identity.instanceId;
      if (sameProcess || sameInstance) {
        try { fs.unlinkSync(manifestPath); } catch {}
      }
    } catch {
      // Ignore parse/read errors on cleanup.
    }
  }

  start(): void {
    this.startHttpOnly();
    if (!this.enabled) return;
    this.registerSocket();
  }

  private startHttpOnly(): void {
    const bunRuntime = (
      globalThis as {
        Bun?: {
          serve: (options: {
            hostname?: string;
            port?: number;
            unix?: string;
            fetch: (request: Request) => Promise<Response> | Response;
          }) => { stop: (closeActiveConnections?: boolean) => void };
        };
      }
    ).Bun;
    if (!bunRuntime) {
      this.enabled = false;
      this.actualPort = undefined;
      return;
    }

    const ports = [this.port, this.port + 1, this.port + 2, this.port + 3, this.port + 4];
    for (const port of ports) {
      try {
        this.server = bunRuntime.serve({
          hostname: this.identity.host,
          port,
          fetch: async (request) => this.handleWithIngressLimit(request),
        });
        this.actualPort = port;
        this.enabled = true;
        setActualControlApiPort(port);
        log.app(`control API listening on port ${port}`);
        process.stderr.write(`⚡ port=${port}  instance=${this.identity.instanceDisplayId}  label=${this.identity.instanceLabel ?? "(none)"}\n`);
        break;
      } catch {
        continue;
      }
    }

    if (!this.enabled) {
      this.server = undefined;
      this.actualPort = undefined;
      return;
    }

    const cleanup = () => {
      for (const fp of [this.socketPath, this.pidPath, this.discoveryPath]) {
        if (!fp) continue;
        try { fs.unlinkSync(fp); } catch {}
      }
      this.cleanupRuntimeControlManifest();
    };
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
    process.on("exit", cleanup);
  }

  registerSocket(): void {
    if (this.socketServer) return;
    if (!this.identity.instanceRoot) return;
    const bunRuntime = (globalThis as any).Bun;
    if (!bunRuntime) return;

    const instanceRoot = this.identity.instanceRoot;
    const canonicalSockPath = path.join(instanceRoot, "control.sock");
    const canonicalPidPath = path.join(instanceRoot, "control.pid");
    const discoveryPath = path.join(instanceRoot, "discovery.json");

    try {
      fs.mkdirSync(instanceRoot, { recursive: true });
      try { fs.unlinkSync(canonicalSockPath); } catch {}

      this.socketServer = bunRuntime.serve({
        unix: canonicalSockPath,
        fetch: async (request: Request) => this.handleWithIngressLimit(request),
      });

      this.socketPath = canonicalSockPath;
      this.pidPath = canonicalPidPath;
      this.discoveryPath = discoveryPath;

      fs.writeFileSync(canonicalPidPath, String(process.pid));
      safeWriteFile(
        discoveryPath,
        `${JSON.stringify({
          instanceId: this.identity.instanceId,
          instanceDisplayId: this.identity.instanceDisplayId,
          instanceLabel: this.identity.instanceLabel ?? null,
          socketPath: canonicalSockPath,
          pid: process.pid,
          port: this.actualPort,
          updatedAt: new Date().toISOString(),
        }, null, 2)}\n`,
      );

      this.writeRuntimeControlManifest(canonicalSockPath);
      log.app(`control API socket at ${canonicalSockPath} (pid ${process.pid})`);
    } catch (err) {
      log.err(`control API socket failed: ${err}`);
    }
  }

  deregisterSocket(): void {
    if (this.socketServer) {
      this.socketServer.stop(true);
      this.socketServer = undefined;
    }
    for (const fp of [this.socketPath, this.pidPath, this.discoveryPath]) {
      if (!fp) continue;
      try { fs.unlinkSync(fp); } catch {}
    }
    this.socketPath = undefined;
    this.pidPath = undefined;
    this.discoveryPath = undefined;
    this.cleanupRuntimeControlManifest();
    log.app("control API socket deregistered");
  }

  stop(): void {
    this.server?.stop(true);
    this.server = undefined;
    this.deregisterSocket();
    this.actualPort = undefined;
    this.enabled = false;
  }

  getStatus(): { enabled: boolean; port?: number; host?: string; baseUrl?: string; socketPath?: string } {
    const host = this.identity.host;
    const baseUrl = this.enabled && this.actualPort ? `http://${host}:${this.actualPort}` : undefined;
    return {
      enabled: this.enabled,
      port: this.actualPort,
      host: this.enabled ? host : undefined,
      baseUrl,
      socketPath: this.socketPath,
    };
  }

  private async handleWithIngressLimit(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const decision = this.rateLimiter?.ingress(request.method, pathname);
    if (decision && !decision.allowed) {
      const retrySeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      return new Response(
        JSON.stringify({
          ok: false,
          error: "rate_limited",
          retryAfterMs: decision.retryAfterMs,
          surface: "api",
          path: pathname,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(retrySeconds),
          },
        },
      );
    }

    try {
      return await this.handleRequest(request);
    } finally {
      decision?.lease?.release();
    }
  }

  private buildRouteContext(): RouteContext {
    return {
      deps: this.deps,
      identity: this.identity,
      runCommand: (id, args) => this.deps.commands.run(id, args, { source: "api", interactive: false }),
      actualPort: this.actualPort,
      startedAt: this.startedAt,
      getScreenSize: this.getScreenSize,
    };
  }

  // ── Generic dispatcher — replaces the 674-line if-chain ──

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { getMap: gm, postMap: pm } = getRoutes();

    // Special: /openapi.json and /docs are meta-routes not in the table
    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return Response.json(buildOpenApiSpec(this.actualPort ?? this.port));
    }
    if (request.method === "GET" && url.pathname === "/docs") {
      return new Response(scalarDocsHtml(this.actualPort ?? this.port), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const route = request.method === "GET" ? gm.get(url.pathname) : pm.get(url.pathname);
    if (!route) {
      return new Response("not found", { status: 404 });
    }

    const ctx = this.buildRouteContext();
    const handler = route.handler;

    // Parse body for POST
    const body: Record<string, unknown> = request.method === "POST"
      ? await request.json().catch(() => ({}))
      : {};

    if (request.method === "POST") {
      log.api(`POST ${url.pathname}`);
    }

    // Patch /health socketPath (needs instance state)
    if (url.pathname === "/health") {
      const result = (handler as { get: (url: URL, ctx: RouteContext) => unknown }).get(url, ctx);
      (result as Record<string, unknown>).socketPath = this.socketPath ?? null;
      return Response.json(result);
    }

    // Command dispatch
    if ("commandId" in handler) {
      if (handler.validate) {
        const err = handler.validate(body);
        if (err) return Response.json({ ok: false, error: err }, { status: 400 });
      }
      const args = handler.argsMapper ? handler.argsMapper(body) : body;
      try {
        const result = ctx.runCommand(handler.commandId, args);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      } catch (err: unknown) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // GET handler
    if ("get" in handler) {
      const result = await handler.get(url, ctx);
      if (result instanceof Response) return result;
      return Response.json(result);
    }

    // POST handler
    if ("post" in handler) {
      const result = await handler.post(body, ctx);
      if (result instanceof Response) return result;
      return Response.json(result);
    }

    return new Response("not found", { status: 404 });
  }
}

// ── Scalar API docs ───────────────────────────────────────────────────────

function scalarDocsHtml(port: number): string {
  const config = JSON.stringify({
    theme: "kepler",
    hideModels: true,
    defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  });
  return `<!doctype html>
<html>
<head>
  <title>WibWob-DOS API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .custom-header { background: #1a1a2e; color: #e0e0e0; padding: 12px 24px; font-size: 14px; }
    .custom-header code { background: #2a2a4e; padding: 2px 8px; border-radius: 3px; }
    .custom-header a { color: #7dc4e4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="custom-header">
    WibWob-DOS Control API &middot; <code>http://127.0.0.1:${port}</code>
    &middot; <a href="/openapi.json">OpenAPI spec</a>
    &middot; <a href="/health">Health</a>
    &middot; <a href="/help">Endpoints</a>
  </div>
  <script id="api-reference" data-url="/openapi.json" data-configuration='${config}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
