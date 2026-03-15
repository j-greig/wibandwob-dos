import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  renderFiglet,
  measureFiglet,
  getDefaultFigletFont,
  getFigletFontChoices,
  getFigletCatalogue,
  getFigletWindowContentSize,
} from "../../src/services/microapp-sdk.js";
import blessed from "blessed";

export default function setup(host: MicroappHost) {
  // Track open windows for write command
  const writeHandlers = new Map<number, (text: string) => void>();
  // ── "fonts" command — pure data, no window ──
  host.registerCommand({
    id: "fonts",
    label: "Figlet Fonts",
    description:
      "List available FIGlet fonts with default and metadata.",
    action: () => {
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
    palette: false,
    menu: false,
    direct: true,
  });

  // ── "open" command — main entry point ──
  host.registerCommand({
    id: "open",
    label: "Figlet Banner",
    description:
      "Open a FIGlet banner. Args: text (string), font (string, optional). Without args opens interactive prompt.",
    action: (args) => {
      const text = args?.text as string | undefined;
      if (text) {
        const font = (args?.font as string) || getDefaultFigletFont();
        openBanner(text, font);
      } else {
        // Interactive: prompt for text first
        host.promptValue("Figlet Text", "WIB WOB", (value) => {
          openBanner(value, getDefaultFigletFont());
        });
      }
    },
    palette: { order: 50, label: "Figlet Banner" },
    menu: [{ category: "applications", order: 70, label: "Figlet Banner" }],
    direct: true,
  });

  // ── "write" command — update text on an existing window ──
  host.registerCommand({
    id: "write",
    label: "Write to Figlet",
    description:
      "Update the text on an existing figlet banner window. Args: text (string, required), windowId (number, required).",
    action: (args) => {
      const text = args?.text as string | undefined;
      const windowId = args?.windowId as number | undefined;
      if (!text) return { error: "text is required" };
      if (windowId === undefined) return { error: "windowId is required" };
      const handler = writeHandlers.get(windowId);
      if (!handler) return { error: `no figlet window with id ${windowId}` };
      handler(text);
      return { ok: true, windowId, text };
    },
    palette: false,
    menu: false,
    direct: true,
  });

  // ── Banner window ──
  function openBanner(text: string, initialFont: string) {
    const win = host.createWindow({
      title: `Banner: ${text.slice(0, 18) || "Banner"}`,
      width: 80,
      height: 20,
    });

    const t = host.theme();

    // ── Toolbar ──
    const toolbar = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: t.header,
    });

    const toolbarLabel = blessed.box({
      parent: toolbar,
      top: 0,
      left: 0,
      width: 6,
      height: 1,
      content: " Text:",
      style: t.header,
    });

    const textInput = blessed.textbox({
      parent: toolbar,
      top: 0,
      left: 6,
      right: 24,
      height: 1,
      mouse: true,
      keys: true,
      inputOnFocus: true,
      style: t.input,
      value: text,
    });

    const fontBtn = blessed.box({
      parent: toolbar,
      top: 0,
      right: 12,
      width: 12,
      height: 1,
      mouse: true,
      clickable: true,
      content: ` [F] ${initialFont.slice(0, 8)} `,
      style: { ...t.footer, hover: t.selected },
    });

    const editBtn = blessed.box({
      parent: toolbar,
      top: 0,
      right: 0,
      width: 12,
      height: 1,
      mouse: true,
      clickable: true,
      content: " [E] Edit ",
      style: { ...t.footer, hover: t.selected },
    });

    // ── Viewer ──
    const viewer = blessed.box({
      parent: win.body,
      top: 1,
      left: 0,
      right: 0,
      bottom: 0,
      mouse: true,
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "▐",
        track: { bg: "default" },
        style: { bg: "default", fg: "grey" },
      },
      style: t.body,
    });

    let currentText = text;
    let currentFont = initialFont;
    let lastMeasurement = measureFiglet(currentText, currentFont, 0);

    function syncTitle() {
      win.setTitle(`Banner: ${currentText.slice(0, 18) || "Banner"}`);
    }

    function rerenderFiglet() {
      const availableWidth = Math.max(20, Number(viewer.width));
      const measured = measureFiglet(currentText, currentFont, availableWidth);
      lastMeasurement = measured;
      viewer.setContent(measured.rendered);
      fontBtn.setContent(` [F] ${currentFont.slice(0, 8)} `);
      syncTitle();
      host.screen.render();
    }

    function submitText() {
      const val = textInput.getValue().trim();
      if (val && val !== currentText) {
        currentText = val;
        rerenderFiglet();
      }
    }

    function editText() {
      textInput.focus();
      textInput.readInput();
    }

    function pickFont() {
      const allChoices = getFigletFontChoices();
      let filtered = allChoices;
      let query = "";
      const idx = Math.max(0, allChoices.findIndex((c) => c.value === currentFont));

      const pickerContainer = blessed.box({
        parent: win.body,
        top: 1,
        left: 0,
        right: 0,
        bottom: 0,
        style: host.theme().body,
      });

      // ── Left pane: search + scrollable list ──
      const leftPane = blessed.box({
        parent: pickerContainer,
        top: 0,
        left: 0,
        width: "40%",
        bottom: 0,
        border: "line",
        label: " Fonts ",
        style: {
          ...host.theme().body,
          border: { fg: host.theme().accent.fg },
        },
      });

      const fontList = blessed.list({
        parent: leftPane,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        mouse: true,
        keys: true,
        vi: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: "▐",
          track: { bg: "default" },
          style: { bg: "default", fg: "grey" },
        },
        style: {
          ...host.theme().body,
          selected: host.theme().selected,
        },
        items: allChoices.map((c) => c.label),
      });

      // ── Right pane: live preview ──
      const preview = blessed.box({
        parent: pickerContainer,
        top: 0,
        left: "40%",
        right: 0,
        bottom: 0,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        border: "line",
        label: " Preview ",
        style: {
          ...host.theme().body,
          border: { fg: host.theme().muted.fg },
        },
      });

      fontList.select(idx);

      // Show initial preview
      const initialChoice = filtered[idx];
      if (initialChoice) {
        preview.setContent(renderFiglet(currentText || "WIB WOB", initialChoice.value));
      }

      function updatePreview() {
        const selIdx = (fontList as unknown as { selected: number }).selected ?? 0;
        const choice = filtered[selIdx];
        if (choice) {
          preview.setContent(renderFiglet(currentText || "WIB WOB", choice.value));
        }
      }

      function refilter() {
        const q = query.toLowerCase();
        filtered = q
          ? allChoices.filter((c) => c.label.toLowerCase().includes(q))
          : allChoices;
        fontList.setItems(filtered.map((c) => c.label) as unknown as blessed.Widgets.BlessedElement[]);
        fontList.select(0);
        updatePreview();
        leftPane.setLabel(query ? ` Search: ${query}_ ` : " Fonts ");
        host.screen.render();
      }

      // Preview on move
      fontList.on("select item", () => {
        updatePreview();
        host.screen.render();
      });

      function closePicker() {
        pickerContainer.detach();
        textInput.show();
        viewer.show();
        viewer.focus();
        rerenderFiglet();
      }

      // Enter = confirm selection
      fontList.on("select", (_item: unknown, index: number) => {
        const choice = filtered[index];
        if (choice) {
          currentFont = choice.value;
        }
        closePicker();
      });

      // Escape = close (clear search first if active)
      fontList.key(["escape"], () => {
        if (query) {
          query = "";
          refilter();
        } else {
          closePicker();
        }
      });

      // Type-to-filter: capture printable chars and backspace
      fontList.on("keypress", (ch: string, key: { name: string; ctrl?: boolean }) => {
        if (!key) return;
        if (key.name === "backspace") {
          if (query.length > 0) {
            query = query.slice(0, -1);
            refilter();
          }
          return;
        }
        if (ch && ch.length === 1 && !key.ctrl && ch.charCodeAt(0) >= 32
          && key.name !== "enter" && key.name !== "return"
          && key.name !== "up" && key.name !== "down"
          && key.name !== "escape") {
          query += ch;
          refilter();
        }
      });

      textInput.hide();
      viewer.hide();
      fontList.focus();
      host.screen.render();
    }

    // ── Input wiring ──
    textInput.on("submit", () => {
      submitText();
      viewer.focus();
    });
    textInput.on("cancel", () => {
      textInput.setValue(currentText);
      viewer.focus();
      host.screen.render();
    });
    editBtn.on("click", editText);
    fontBtn.on("click", pickFont);

    // Keyboard shortcuts on the viewer
    viewer.key(["e"], editText);
    viewer.key(["f"], pickFont);

    // ── SDK hooks ──
    win.describeState(() => ({
      summary: `Figlet banner: "${currentText}" in ${currentFont}`,
      appType: "figlet-banner",
      inputText: currentText,
      font: currentFont,
      lineCount: lastMeasurement.measurement.lineCount,
      contentWidth: lastMeasurement.measurement.columnWidth,
      contentHeight: lastMeasurement.measurement.lineCount,
      contentPreview: viewer
        .getContent()
        .split("\n")
        .slice(0, 8)
        .join("\n"),
    }));

    win.captureText(() => viewer.getContent());

    win.onResize(() => rerenderFiglet());

    win.onRestyle(() => {
      const nt = host.theme();
      toolbar.style = nt.header;
      toolbarLabel.style = nt.header;
      textInput.style = nt.input;
      fontBtn.style = { ...nt.footer, hover: nt.selected };
      editBtn.style = { ...nt.footer, hover: nt.selected };
      viewer.style = nt.body;
      host.screen.render();
    });

    win.onCleanup(() => {
      writeHandlers.delete(win.id);
    });

    // Register write handler for this window
    writeHandlers.set(win.id, (newText: string) => {
      currentText = newText;
      textInput.setValue(newText);
      rerenderFiglet();
    });

    win.setFocusTarget(viewer);
    win.focus();

    // Initial render + auto-size
    rerenderFiglet();
    const measured = measureFiglet(currentText, currentFont, 0);
    const contentSize = getFigletWindowContentSize(measured);
    const targetW = Math.min(
      Math.max(contentSize.width + 4, 24),
      Math.max(24, (host.geometry?.width ?? 120) - 10),
    );
    const targetH = Math.min(
      Math.max(contentSize.height + 6, 8),
      Math.max(8, (host.geometry?.height ?? 60) - 4),
    );
    host.windows.resizeWindow(win.id, targetW, targetH);
  }

  // ── Workspace snapshot — COAT workspace seam ──
  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return {
        text: state.inputText ?? "WibWob",
        font: state.font ?? getDefaultFigletFont(),
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", payload);
    },
  });
}
