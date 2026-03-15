import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createSimpleStatusBar, createTextViewer } from "../../src/services/microapp-sdk.js";

/**
 * Notepad — the simplest possible text editor.
 * One buffer. Read/write via plumb. No frills.
 */
export default function setup(host: MicroappHost) {
  const writeHandlers = new Map<number, (text: string) => void>();

  host.registerCommand({
    id: "write",
    label: "Write to Notepad",
    description:
      "Set the text content of an open notepad. Args: text (string), windowId (number).",
    action: (args) => {
      const text = args?.text as string | undefined;
      const windowId = args?.windowId as number | undefined;
      if (text === undefined) return { error: "text is required" };
      if (windowId === undefined) return { error: "windowId is required" };
      const handler = writeHandlers.get(windowId);
      if (!handler)
        return { error: `no notepad window with id ${windowId}` };
      handler(text);
      return { ok: true, windowId, bytesWritten: text.length };
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

  function openNotepad(initialText: string, title: string) {
    const win = host.createWindow({
      title,
      width: 60,
      height: 20,
    });

    // ── SDK composition helpers ──
    const viewer = createTextViewer(win.body, {
      content: initialText,
      wrap: false,
      bottomOffset: 1,
    });

    const statusBar = createSimpleStatusBar(win.body);

    let buffer = initialText;

    function updateStatus() {
      const lines = buffer.split("\n").length;
      const chars = buffer.length;
      statusBar.update({
        left: ` ${title}  │  ${lines} lines  ${chars} chars`,
      });
    }

    win.setFocusTarget(viewer.element);
    win.captureText(() => buffer);

    win.describeState(() => ({
      title,
      lines: buffer.split("\n").length,
      chars: buffer.length,
      preview: buffer.slice(0, 200),
      appType: "wibwob.notepad",
    }));

    win.onRestyle(() => {
      viewer.update({ content: buffer });
      statusBar.update({});
    });

    writeHandlers.set(win.id, (newText: string) => {
      buffer = newText;
      viewer.update({ content: newText });
      updateStatus();
      host.screen.render();
    });

    win.onCleanup(() => {
      writeHandlers.delete(win.id);
      viewer.destroy();
      statusBar.destroy();
    });

    updateStatus();
  }
}
