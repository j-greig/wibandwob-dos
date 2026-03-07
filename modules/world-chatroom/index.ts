import blessed from "blessed";

import { worldChatService } from "../../src/services/world-chat-service.js";
import { applyRect } from "../../src/core/ui-parts.js";
import type { Rect, UiPart, StackChild } from "../../src/core/ui-parts.js";
import type { MicroappSnapshotWindow } from "../../src/services/module-loader.js";

type MicroappWindowHandle = {
  readonly id: number;
  readonly body: blessed.Widgets.BoxElement;
  onCleanup(fn: () => void): void;
  onRestyle(fn: () => void): void;
  onResize(fn: () => void): void;
  onInput(fn: (input: string) => void): void;
  describeState(fn: () => Record<string, unknown>): void;
  captureText(fn: () => string): void;
  focus(): void;
  close(): void;
};



type MicroappHost = {
  createWindow(init: { title: string; width?: number; height?: number }): MicroappWindowHandle;
  registerCommand(def: {
    id: string;
    label: string;
    description?: string;
    action: (args?: Record<string, unknown>) => void;
    direct?: boolean;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
  }): void;
  registerSnapshot(handlers: {
    serialize: (window: MicroappSnapshotWindow) => Record<string, unknown> | undefined;
    restore: (_snapshot: unknown, payload: Record<string, unknown>) => void;
  }): void;
  runCommand(localId: string, args?: Record<string, unknown>): void;
  readonly screen: blessed.Widgets.Screen;
  readonly geometry: { width: number; height: number; cellAspect: number };
  readonly theme: () => {
    body: Record<string, unknown>;
    muted?: Record<string, unknown>;
    footer?: Record<string, unknown>;
  };
  readonly ui: {
    createHeaderBar(parent: unknown, opts?: { leftInset?: number }): UiPart<{ left: string; right?: string }>;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function firstChannelId(): string | undefined {
  return worldChatService.listChannels()[0]?.id;
}

export default function setup(host: MicroappHost) {
  let control:
    | {
        setChannel: (channelId: string) => void;
        send: (sender: string, text: string) => void;
      }
    | undefined;

  function openChatroom(args?: Record<string, unknown>) {
    let channelId = typeof args?.channelId === "string" ? args.channelId : firstChannelId();
    let sender = typeof args?.sender === "string" ? args.sender : "wibwob-player";
    let lastText = "";
    let draft = "";
    const MAX_INPUT_ROWS = 4;
    let unsubscribe: (() => void) | undefined;

    const desktopWidth = Math.max(40, Math.floor(host.geometry.width));
    const desktopHeight = Math.max(16, Math.floor(host.geometry.height));
    const initialWidth = clamp(Math.floor(desktopWidth * 0.45), 42, 120);
    const initialHeight = clamp(Math.floor(desktopHeight * 0.4), 12, 24);

    const win = host.createWindow({
      title: "World Chatroom",
      width: initialWidth,
      height: initialHeight,
    });

    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const bodyNode = blessed.box({
      parent: win.body,
      top: 1,
      left: 0,
      right: 0,
      bottom: 2,
      style: host.theme().body,
    });
    const transcript = blessed.box({
      parent: bodyNode,
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
    const gameLog = blessed.box({
      parent: bodyNode,
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
    const statusBar = blessed.box({
      parent: win.body,
      left: 0,
      right: 0,
      height: 1,
      tags: true,
      style: host.theme().footer ?? host.theme().body,
    });
    const input = blessed.box({
      parent: win.body,
      left: 0,
      right: 0,
      height: 1,
      keys: true,
      mouse: true,
      tags: true,
      style: {
        ...(host.theme().body ?? {}),
        inverse: true,
      },
    });

    const renderInput = () => {
      const width = Math.max(1, Number(input.width) || 1);
      const cursor = input === host.screen.focused ? "_" : " ";
      const prefix = "{black-fg}{white-bg} CHAT > {/white-bg}{/black-fg}";
      const full = `${prefix} ${draft}${cursor}`;
      const rows: string[] = [];
      for (let i = 0; i < full.length || rows.length === 0; i += width) {
        rows.push(full.slice(i, i + width).padEnd(width, " "));
      }
      const inputRows = Math.min(MAX_INPUT_ROWS, Math.max(1, rows.length));
      input.height = inputRows;
      input.setContent(rows.join("\n"));
      return inputRows;
    };

    const armInput = () => {
      input.focus();
      renderInput();
      host.screen.render();
    };

    // Cache actual window dimensions from resize events — blessed body.width can return
    // a style string expression before the first layout pass, giving wrong dimensions.
    let cachedW = 80;
    let cachedH = 24;


    const render = () => {
      const innerW = Math.max(0, cachedW);
      const innerH = Math.max(0, cachedH);
      const inputRows = renderInput();
      const headerHeight = 1;
      const statusHeight = 1;
      const bodyTop = headerHeight;
      const bodyHeight = Math.max(1, innerH - headerHeight - statusHeight - inputRows);
      const footerTop = bodyTop + bodyHeight;

      headerBar.layout({ top: 0, left: 0, width: innerW, height: headerHeight });
      applyRect(bodyNode,  { top: bodyTop,              left: 0,              width: innerW,         height: bodyHeight   });
      applyRect(statusBar, { top: footerTop,            left: 0,              width: innerW,         height: statusHeight });
      applyRect(input,     { top: footerTop + statusHeight, left: 0,          width: innerW,         height: inputRows    });

      const sidebarWidth = 26;
      const transcriptWidth = Math.max(12, innerW - sidebarWidth);
      applyRect(transcript, { top: 0, left: 0,              width: transcriptWidth, height: bodyHeight });
      applyRect(gameLog,    { top: 0, left: transcriptWidth, width: sidebarWidth,   height: bodyHeight });

      const channel = channelId ? worldChatService.readChannel(channelId) : undefined;
      const transport = worldChatService.getTransportStatus();
      if (!channel) {
        lastText = "No world chat channel available yet.";
        headerBar.update({ left: "World Chatroom", right: "no channel" });
        transcript.setContent(lastText);
        gameLog.setContent("Players\n\n(join a chatspot)");
        const noChTag = transport.kind === "irc"
          ? (transport.connected ? `{green-fg}IRC●{/green-fg}` : `{red-fg}IRC○{/red-fg}`)
          : `{yellow-fg}LOCAL{/yellow-fg}`;
        statusBar.setContent(` ${noChTag}  join a chatspot with c in WibWobWorld`);
        host.screen.render();
        return;
      }

      // Fill transcript to bodyHeight — bottom-anchored like a real chat.
      // Slice to exactly as many lines as fit, pad top with empty lines so
      // newest messages always appear at the bottom of the visible area.
      const maxMsgs = Math.max(1, bodyHeight);
      const msgLines = channel.messages
        .filter((message) => message.kind === "chat")
        .slice(-maxMsgs)
        .map((message) => `[${message.at.slice(11, 16)}] <${message.sender}> ${message.text}`);
      const topPad = Math.max(0, bodyHeight - msgLines.length);
      lastText = msgLines.join("\n");
      const paddedTranscript = "\n".repeat(topPad) + (lastText || "(no player messages yet)");

      // Sidebar: participants at top, recent events below
      const sw = Math.max(4, sidebarWidth - 2); // usable chars per line inside border
      const trunc = (s: string) => s.length > sw ? s.slice(0, sw - 1) + "…" : s;
      const participants = channel.participants.length > 0
        ? channel.participants.map((p) => trunc(`  ${p}`))
        : ["  (empty)"];
      const maxParticipants = Math.min(participants.length, Math.floor(bodyHeight * 0.4));
      const participantBlock = ["Players", ...participants.slice(0, maxParticipants)];

      const eventsAvail = Math.max(1, bodyHeight - participantBlock.length - 2);
      const eventLines = channel.messages
        .filter((m) => m.kind === "system")
        .slice(-eventsAvail)
        .map((m) => trunc(`${m.at.slice(11, 16)} ${m.text}`));
      const eventTopPad = Math.max(0, eventsAvail - eventLines.length);
      const logText = [
        ...participantBlock,
        "",
        ...Array(eventTopPad).fill(""),
        ...eventLines,
      ].join("\n");
      headerBar.update({
        left: `World Chatroom  ${channel.label}`,
        right: channel.id,
      });
      transcript.setContent(paddedTranscript);
      gameLog.setContent(logText);
      const transportTag = transport.kind === "irc"
        ? (transport.connected ? `{green-fg}IRC●{/green-fg}` : `{red-fg}IRC○{/red-fg}`)
        : `{yellow-fg}LOCAL{/yellow-fg}`;
      statusBar.setContent(
        ` ${transportTag}  ${channel.participants.length} online  ${sender}  / input  Esc read  Enter send`,
      );
      win.describeState(() => ({
        summary: `World chatroom for ${channel.label}`,
        contentPreview: lastText.split("\n").slice(0, 10).join("\n"),
        channelId: channel.id,
        channelLabel: channel.label,
        participantCount: channel.participants.length,
        participants: [...channel.participants],
        messageCount: channel.messages.length,
        lastMessageAt: channel.messages[channel.messages.length - 1]?.at,
        transport,
        sidebarPreview: logText.split("\n").slice(0, 10).join("\n"),
      }));
      host.screen.render();
    };

    control = {
      setChannel(nextChannelId) {
        channelId = nextChannelId;
        worldChatService.joinChannel(sender, nextChannelId);
        render();
      },
      send(nextSender, text) {
        sender = nextSender;
        if (channelId && text.trim().length > 0) {
          worldChatService.sendMessage(sender, channelId, text.trim());
        }
        render();
      },
    };

    win.onResize(() => {
      // Use frame element (parent of body) outer dimensions minus chrome to get reliable sizes.
      // body.width/height and body.a* values are unreliable before layout settles.
      const frame = (win.body as any).parent;
      const fw = Number(frame?.width);
      const fh = Number(frame?.height);
      // frame has 1-char borders on each side; body has left:2, right:2, top:1, bottom:1
      if (fw >= 20) cachedW = fw - 6; // frame_w - borders(2) - body_left(2) - body_right(2)
      if (fh >= 10) cachedH = fh - 4; // frame_h - borders(2) - body_top(1) - body_bottom(1)
      render();
    });
    win.onRestyle(() => {
      bodyNode.style = host.theme().body;
      transcript.style = host.theme().body;
      gameLog.style = host.theme().body;
      statusBar.style = host.theme().footer ?? host.theme().body;
      input.style = {
        ...(host.theme().body ?? {}),
        inverse: true,
      };
      host.screen.render();
    });
    win.onCleanup(() => {
      unsubscribe?.();
      control = undefined;
    });
    win.captureText(() => lastText);

    transcript.on("click", () => {
      transcript.focus();
      host.screen.render();
    });
    gameLog.on("click", () => {
      gameLog.focus();
      host.screen.render();
    });
    // Arm input on / from any node in the chatroom that could hold focus
    const slashToInput = (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (key?.name === "slash") armInput();
    };
    transcript.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (key?.name === "slash") { armInput(); return; }
      if (key?.name === "escape") { transcript.focus(); host.screen.render(); }
    });
    gameLog.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (key?.name === "slash") { armInput(); return; }
      if (key?.name === "escape") { transcript.focus(); host.screen.render(); }
    });
    win.body.on("keypress", slashToInput);
    bodyNode.on("keypress", slashToInput);
    input.on("click", armInput);
    input.on("keypress", (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (!key) return;
      if (key.name === "escape") {
        transcript.focus();
        host.screen.render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        const text = draft.trim();
        if (text.length > 0 && channelId) {
          worldChatService.sendMessage(sender, channelId, text);
          draft = "";
          render();
        }
        return;
      }
      if (key.name === "backspace") {
        draft = draft.slice(0, -1);
        renderInput();
        host.screen.render();
        return;
      }
      const char = (key.sequence && key.sequence.length === 1)
        ? key.sequence
        : (ch && ch.length === 1 && ch >= " " ? ch : null);
      if (char && !key.ctrl && !key.meta) {
        draft += char;
        renderInput();
        host.screen.render();
      }
    });

    if (channelId) {
      worldChatService.joinChannel(sender, channelId);
    }
    unsubscribe = worldChatService.subscribe((event) => {
      if (event.type === "transport") {
        render();
        return;
      }
      if (event.type === "world-reset") {
        render();
        return;
      }
      if (event.type === "channel" && event.channelId === channelId) {
        render();
      }
    });
    render();
    win.focus();
    armInput();
  }

  host.registerCommand({
    id: "open",
    label: "Open World Chatroom",
    description: "Open a world chatroom window for a chatspot channel.",
    menu: [{ category: "applications", order: 90, label: "World Chatroom" }],
    palette: { order: 60, label: "World Chatroom" },
    action: (args) => {
      openChatroom(args);
    },
  });

  host.registerCommand({
    id: "set-channel",
    label: "World Chatroom: Set Channel",
    description: "Args: { channelId: string, sender?: string }",
    direct: true,
    action: (args) => {
      const nextChannelId = typeof args?.channelId === "string" ? args.channelId : "";
      if (!nextChannelId) return;
      if (control) control.setChannel(nextChannelId);
      else openChatroom(args);
    },
  });

  host.registerCommand({
    id: "send",
    label: "World Chatroom: Send",
    description: "Args: { channelId?: string, sender?: string, text: string }",
    direct: true,
    action: (args) => {
      const text = typeof args?.text === "string" ? args.text : "";
      const sender = typeof args?.sender === "string" ? args.sender : "wibwob-player";
      const explicitChannelId = typeof args?.channelId === "string" ? args.channelId : undefined;
      if (!text) return;
      if (control && !explicitChannelId) {
        control.send(sender, text);
        return;
      }
      const channelId = explicitChannelId ?? firstChannelId();
      if (!channelId) return;
      worldChatService.joinChannel(sender, channelId);
      worldChatService.sendMessage(sender, channelId, text);
      if (!control) openChatroom({ channelId, sender });
    },
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      if (state.appType !== "world-chatroom") return undefined;
      return {
        channelId: state.channelId,
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", payload);
    },
  });
}
