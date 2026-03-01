import fs from "node:fs";

import { getDefaultFigletFont } from "../services/figlet-service.js";
import type { BackroomsChannel, WindowRecord, WindowSnapshot } from "./types.js";

export function serializeWindowSnapshot(window: WindowRecord, focusedId?: number): WindowSnapshot {
  return {
    kind: window.kind,
    title: window.title,
    left: Number(window.frame.left),
    top: Number(window.frame.top),
    width: Number(window.frame.width),
    height: Number(window.frame.height),
    filePath: window.filePath,
    focused: window.id === focusedId,
    payload: buildWindowSnapshotPayload(window)
  };
}

export function buildWindowSnapshotPayload(window: WindowRecord): Record<string, unknown> | undefined {
  switch (window.kind) {
    case "editor":
      return window.editor
        ? {
            content: window.editor.value,
            cursor: window.editor.cursor
          }
        : undefined;
    case "browser": {
      const details = window.describeState?.();
      return {
        appType: typeof details?.appType === "string" ? details.appType : "primer-browser",
        currentPath: typeof details?.currentPath === "string" ? details.currentPath : undefined,
        selectedIndex: typeof details?.selectedIndex === "number" ? details.selectedIndex : 0
      };
    }
    case "gallery": {
      const details = window.describeState?.();
      return {
        activeTabIndex: typeof details?.activeTabIndex === "number" ? details.activeTabIndex : 0,
        searchValue: typeof details?.searchValue === "string" ? details.searchValue : "",
        selectedIndex: typeof details?.selectedIndex === "number" ? details.selectedIndex : 0
      };
    }
    case "figlet": {
      const details = window.describeState?.();
      return {
        inputText: typeof details?.inputText === "string" ? details.inputText : window.title.replace(/^Banner:\s*/, ""),
        font: typeof details?.font === "string" ? details.font : getDefaultFigletFont()
      };
    }
    case "chat":
      return window.chat
        ? {
            appType: window.describeState?.().appType ?? "chat-transcript",
            transcriptLines: window.chat.getTranscriptLines(),
            draft: window.chat.getDraft(),
            messages: window.describeState?.().messages
          }
        : undefined;
    case "backrooms": {
      const details = window.describeState?.();
      return {
        theme: typeof details?.theme === "string" ? details.theme : "liminal fluorescent maze",
        primers: typeof details?.primers === "string" ? details.primers : "",
        turns: typeof details?.turns === "number" ? details.turns : 3,
        model:
          details?.model === "haiku" || details?.model === "opus" || details?.model === "sonnet"
            ? details.model
            : "sonnet",
        mode:
          details?.requestedMode === "live" || details?.requestedMode === "fake-live" || details?.requestedMode === "auto"
            ? details.requestedMode
            : "auto"
      };
    }
    case "terminal": {
      const details = window.describeState?.();
      return {
        appType: typeof details?.appType === "string" ? details.appType : "terminal-shell"
      };
    }
    case "companion": {
      const details = window.describeState?.();
      return {
        tick: typeof details?.tick === "number" ? details.tick : 0
      };
    }
    default:
      return undefined;
  }
}

export interface WorkspaceRestoreActions {
  openPrimerWindow: (filePath: string) => void;
  openEditorWindow: (filePath: string | undefined, title: string, initial: string, restore?: { cursor?: number }) => void;
  openBrowserReaderWindow: (filePath?: string) => void;
  openFigletWindow: (text: string, font: string) => void;
  openPatternWindow: () => void;
  openOrbitWindow: () => void;
  openGlitchWindow: () => void;
  openChatWindow: (restore?: { transcriptLines?: string[]; draft?: string }) => void;
  openWibWobChatWindow: (restore?: {
    transcriptLines?: string[];
    draft?: string;
    messages?: unknown;
  }) => void;
  openPrimerGalleryWindow: (restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number }) => void;
  openPrimerBrowserWindow: (restore?: { selectedIndex?: number }) => void;
  openFileManagerWindow: (restore?: { currentPath?: string; selectedIndex?: number }) => void;
  openTerminalWindow: () => void | Promise<void>;
  openXTermShellWindow: () => void | Promise<void>;
  openPiChatWindow: () => void | Promise<void>;
  openBackroomsTv: (channel: BackroomsChannel) => void;
  openCompanionWindow: (restore?: { tick?: number }) => void;
  openArtWindow: () => void;
  openStateInspectorWindow: () => void;
  getLastWindow: () => WindowRecord | undefined;
  moveWindow: (id: number, left: number, top: number) => void;
  resizeWindow: (id: number, width: number, height: number) => void;
}

export function restoreWindowSnapshot(snapshot: WindowSnapshot, actions: WorkspaceRestoreActions): WindowRecord | undefined {
  const payload = snapshot.payload ?? {};
  switch (snapshot.kind) {
    case "primer":
      if (snapshot.filePath) {
        actions.openPrimerWindow(snapshot.filePath);
      }
      break;
    case "editor":
      actions.openEditorWindow(
        snapshot.filePath,
        snapshot.title,
        typeof payload.content === "string"
          ? payload.content
          : snapshot.filePath && fs.existsSync(snapshot.filePath)
            ? fs.readFileSync(snapshot.filePath, "utf8")
            : "",
        { cursor: typeof payload.cursor === "number" ? payload.cursor : undefined }
      );
      break;
    case "reader":
      actions.openBrowserReaderWindow(snapshot.filePath);
      break;
    case "figlet":
      actions.openFigletWindow(
        typeof payload.inputText === "string" ? payload.inputText : snapshot.title.replace(/^Banner:\s*/, ""),
        typeof payload.font === "string" ? payload.font : getDefaultFigletFont()
      );
      break;
    case "pattern":
      actions.openPatternWindow();
      break;
    case "orbit":
      actions.openOrbitWindow();
      break;
    case "glitch":
      actions.openGlitchWindow();
      break;
    case "chat":
      if (payload.appType === "wibwob-chat-v2") {
        actions.openWibWobChatWindow({
          transcriptLines: Array.isArray(payload.transcriptLines)
            ? payload.transcriptLines.filter((line): line is string => typeof line === "string")
            : undefined,
          draft: typeof payload.draft === "string" ? payload.draft : undefined,
          messages: payload.messages
        });
      } else {
        actions.openChatWindow({
          transcriptLines: Array.isArray(payload.transcriptLines)
            ? payload.transcriptLines.filter((line): line is string => typeof line === "string")
            : undefined,
          draft: typeof payload.draft === "string" ? payload.draft : undefined
        });
      }
      break;
    case "gallery":
      actions.openPrimerGalleryWindow({
        activeTabIndex: typeof payload.activeTabIndex === "number" ? payload.activeTabIndex : undefined,
        searchValue: typeof payload.searchValue === "string" ? payload.searchValue : undefined,
        selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined
      });
      break;
    case "browser":
      if (payload.appType === "farjs-file-manager") {
        actions.openFileManagerWindow({
          currentPath: typeof payload.currentPath === "string" ? payload.currentPath : undefined,
          selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined
        });
      } else {
        actions.openPrimerBrowserWindow({
          selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined
        });
      }
      break;
    case "terminal":
      if (payload.appType === "xterm-shell") {
        void actions.openXTermShellWindow();
      } else if (payload.appType === "pi-chat") {
        void actions.openPiChatWindow();
      } else {
        void actions.openTerminalWindow();
      }
      break;
    case "backrooms":
      actions.openBackroomsTv({
        theme: typeof payload.theme === "string" ? payload.theme : "liminal fluorescent maze",
        primers: typeof payload.primers === "string" ? payload.primers : "",
        turns: typeof payload.turns === "number" ? payload.turns : 3,
        model:
          payload.model === "haiku" || payload.model === "opus" || payload.model === "sonnet"
            ? payload.model
            : "sonnet",
        mode:
          payload.mode === "live" || payload.mode === "fake-live" || payload.mode === "auto"
            ? payload.mode
            : "auto"
      });
      break;
    case "companion":
      actions.openCompanionWindow({
        tick: typeof payload.tick === "number" ? payload.tick : undefined
      });
      break;
    case "art":
      actions.openArtWindow();
      break;
    case "inspector":
      actions.openStateInspectorWindow();
      break;
    default:
      break;
  }
  const restored = actions.getLastWindow();
  if (restored) {
    actions.moveWindow(restored.id, snapshot.left, snapshot.top);
    actions.resizeWindow(restored.id, snapshot.width, snapshot.height);
  }
  return restored;
}
