import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStatusBar, createTextViewer } from "../../src/services/microapp-sdk.js";

/**
 * Notepad — the simplest possible text editor.
 * One buffer. Read/write via plumb. No frills.
 */
export default function setup(host: MicroappHost) {
  const notepadControllers = new Map<number, {
    setText: (text: string) => void;
    setTitle: (title: string) => void;
  }>();

  host.registerCommand({
    id: "write",
    label: "Write to Notepad",
    description:
      "Set the text content of an open notepad. Args: text (string), windowId (number), title (string, optional).",
    action: (args) => {
      const text = args?.text as string | undefined;
      const windowId = args?.windowId as number | undefined;
      const title = args?.title as string | undefined;
      if (text === undefined) return { error: "text is required" };
      if (windowId === undefined) return { error: "windowId is required" };
      const controller = notepadControllers.get(windowId);
      if (!controller)
        return { error: `no notepad window with id ${windowId}` };
      controller.setText(text);
      if (title !== undefined) controller.setTitle(title);
      return { ok: true, windowId, bytesWritten: text.length, title: title ?? null };
    },
    palette: false,
    menu: false,
    direct: true,
  });

  host.registerCommand({
    id: "retitle",
    label: "Retitle Notepad",
    description:
      "Update notepad window title. Args: windowId (number), title (string).",
    action: (args) => {
      const windowId = args?.windowId as number | undefined;
      const title = args?.title as string | undefined;
      if (windowId === undefined) return { error: "windowId is required" };
      if (title === undefined) return { error: "title is required" };
      const controller = notepadControllers.get(windowId);
      if (!controller)
        return { error: `no notepad window with id ${windowId}` };
      controller.setTitle(title);
      return { ok: true, windowId, title };
    },
    palette: false,
    menu: false,
    direct: true,
  });

  host.registerCommand({
    id: "open",
    label: "Open Notepad",
    description:
      "Open a plain text notepad. Args: text (string, optional), title (string, optional).",
    action: (args) => {
      const initialText = (args?.text as string) ?? "";
      const title = (args?.title as string) ?? "Notepad";
      openNotepad(initialText, title);
      return { ok: true };
    },
  });

  function formatTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) return "Notepad";
    if (trimmed === "Notepad" || trimmed.startsWith("Notepad ") || trimmed.startsWith("Notepad-")) {
      return trimmed;
    }
    return `Notepad — ${trimmed}`;
  }

  function openNotepad(initialText: string, title: string) {
    let currentTitle = formatTitle(title);
    const win = host.createWindow({
      title: currentTitle,
      width: 60,
      height: 20,
    });

    // ── SDK composition helpers ──
    const viewer = createTextViewer(win.body, {
      content: initialText,
      wrap: false,
      bottomOffset: 1,
    });

    const statusBar = createStatusBar(win.body);

    let buffer = initialText;

    function updateStatus() {
      const lines = buffer.split("\n").length;
      const chars = buffer.length;
      statusBar.update({
        left: ` ${currentTitle}  │  ${lines} lines  ${chars} chars`,
      });
    }

    win.setFocusTarget(viewer.element);
    win.captureText(() => buffer);

    win.describeState(() => ({
      title: currentTitle,
      lines: buffer.split("\n").length,
      chars: buffer.length,
      preview: buffer.slice(0, 200),
      appType: "wibwob.notepad",
    }));

    win.onRestyle(() => {
      viewer.update({ content: buffer });
      statusBar.update({});
    });

    notepadControllers.set(win.id, {
      setText(newText: string) {
        buffer = newText;
        viewer.update({ content: newText });
        updateStatus();
        host.screen.render();
      },
      setTitle(newTitle: string) {
        currentTitle = formatTitle(newTitle);
        win.setTitle(currentTitle);
        updateStatus();
        host.screen.render();
      },
    });

    win.onCleanup(() => {
      notepadControllers.delete(win.id);
      viewer.destroy();
      statusBar.destroy();
    });

    updateStatus();
  }
}
