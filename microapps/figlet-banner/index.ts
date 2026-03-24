import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  renderFiglet,
  measureFiglet,
  getDefaultFigletFont,
  getFigletFontChoices,
  getFigletCatalogue,
  getFigletWindowContentSize,
  toggleFigletFavourite,
  safeSetStyle,
} from "../../src/services/microapp-sdk.js";
// eslint-disable-next-line no-restricted-imports
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

  // ── "favourites" command — pure data, no window ──
  host.registerCommand({
    id: "favourites",
    label: "Figlet Favourite Fonts",
    description:
      "List favourite FIGlet fonts with metadata.",
    action: () => {
      const catalogue = getFigletCatalogue();
      const favourites = catalogue.favourites;
      return {
        defaultFont: getDefaultFigletFont(),
        count: favourites.length,
        favourites: favourites.map((font) => ({
          name: font,
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

  // ── "view-all" command — render one text in all available fonts ──
  host.registerCommand({
    id: "view-all",
    label: "Figlet View All Fonts",
    description:
      "Open a scrollable viewer with the current text rendered in every available FIGlet font. Args: text (string, optional).",
    action: (args) => {
      const textArg = (args?.text as string | undefined)?.trim();
      if (textArg) {
        openAllFontsWindow(textArg);
      } else {
        host.promptValue("Figlet Text (All Fonts)", "WIB WOB", (value) => {
          openAllFontsWindow(value.trim() || "WIB WOB");
        });
      }
      return { ok: true };
    },
    palette: { order: 51, label: "Figlet: View All Fonts" },
    menu: false,
    direct: true,
  });

  // ── "view-favourites" command — render one text in favourite fonts only ──
  host.registerCommand({
    id: "view-favourites",
    label: "Figlet View Favourite Fonts",
    description:
      "Open a scrollable viewer with the current text rendered only in favourite FIGlet fonts. Args: text (string, optional).",
    action: (args) => {
      const textArg = (args?.text as string | undefined)?.trim();
      if (textArg) {
        openAllFontsWindow(textArg, true);
      } else {
        host.promptValue("Figlet Text (Favourite Fonts)", "WIB WOB", (value) => {
          openAllFontsWindow(value.trim() || "WIB WOB", true);
        });
      }
      return { ok: true };
    },
    palette: { order: 52, label: "Figlet: View Favourite Fonts" },
    menu: false,
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

  // ── All/favourite fonts window ──
  function openAllFontsWindow(rawText: string, favouritesOnly = false) {
    const text = rawText.trim() || "WIB WOB";
    const catalogue = getFigletCatalogue();
    const fonts = favouritesOnly ? catalogue.favourites : catalogue.allFontsSorted;
    const modeLabel = favouritesOnly ? "Favourites" : "All Fonts";

    const win = host.createWindow({
      title: `${modeLabel}: ${text.slice(0, 18) || "Banner"}`,
      width: Math.max(90, Math.min(140, (host.geometry?.width ?? 160) - 8)),
      height: Math.max(24, Math.min(50, (host.geometry?.height ?? 70) - 6)),
    });

    const header = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: host.theme().header,
      content: ` Rendering ${fonts.length} ${favouritesOnly ? "favourite" : "fonts"} for \"${text}\"... `,
    });

    const viewer = blessed.box({
      parent: win.body,
      top: 1,
      left: 0,
      right: 0,
      bottom: 0,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "▐",
        track: { bg: "default" },
        style: { bg: "default", fg: "grey" },
      },
      style: host.theme().body,
      content: "Rendering…",
    });

    let renderedContent = "";

    function renderAllFonts() {
      if (fonts.length === 0) {
        renderedContent = `${text}\n\n(no figlet fonts discovered)`;
      } else {
        const sections: string[] = [];
        for (const font of fonts) {
          sections.push(`{bold}${font}{/bold}`);
          sections.push(renderFiglet(text, font));
          sections.push("");
        }
        renderedContent = sections.join("\n").trimEnd();
      }

      viewer.setContent(renderedContent || text);
      header.setContent(` ${modeLabel} · ${fonts.length} · \"${text}\" · scroll with ↑↓/PgUp/PgDn `);
      host.screen.render();
    }

    win.describeState(() => ({
      summary: `Figlet ${favouritesOnly ? "favourites" : "all-fonts"}: \"${text}\" (${fonts.length} fonts)`,
      appType: favouritesOnly ? "figlet-banner.favourites" : "figlet-banner.all-fonts",
      inputText: text,
      fontCount: fonts.length,
      contentPreview: viewer
        .getContent()
        .split("\n")
        .slice(0, 12)
        .join("\n"),
    }));

    win.captureText(() => viewer.getContent());

    win.onRestyle(() => {
      const nt = host.theme();
      header.style = nt.header;
      safeSetStyle(viewer, nt.body);
      host.screen.render();
    });

    win.setFocusTarget(viewer);
    win.focus();

    // Let the loading state paint before doing potentially heavy rendering.
    host.screen.render();
    setTimeout(renderAllFonts, 0);
  }

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
      right: 48,
      height: 1,
      mouse: true,
      keys: true,
      inputOnFocus: true,
      style: t.input,
      value: text,
    });

    const viewAllBtn = blessed.box({
      parent: toolbar,
      top: 0,
      right: 36,
      width: 12,
      height: 1,
      mouse: true,
      clickable: true,
      content: " [V] All ",
      style: { ...t.footer, hover: t.selected },
    });

    const favsBtn = blessed.box({
      parent: toolbar,
      top: 0,
      right: 24,
      width: 12,
      height: 1,
      mouse: true,
      clickable: true,
      content: " [S] Favs",
      style: { ...t.footer, hover: t.selected },
    });

    const fontBtn = blessed.box({
      parent: toolbar,
      top: 0,
      right: 12,
      width: 12,
      height: 1,
      mouse: true,
      clickable: true,
      content: " [F] Font ",
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
    let pickerPreviewBox: blessed.Widgets.BoxElement | null = null;

    function syncTitle() {
      win.setTitle(`Banner: ${currentText.slice(0, 18) || "Banner"}`);
    }

    function autoSizeWindow() {
      const measured = measureFiglet(currentText, currentFont, 0);
      const contentSize = getFigletWindowContentSize(measured);
      // Toolbar: Text input + 4 buttons (48 chars) + label (6 chars) + borders (2)
      const toolbarMinWidth = 56;
      const targetW = Math.min(
        Math.max(contentSize.width + 4, toolbarMinWidth, 24),
        Math.max(24, (host.geometry?.width ?? 120) - 10),
      );
      const targetH = Math.min(
        Math.max(contentSize.height + 6, 8),
        Math.max(8, (host.geometry?.height ?? 60) - 4),
      );
      host.windows.resizeWindow(win.id, targetW, targetH);
    }

    function rerenderFiglet() {
      const availableWidth = Math.max(20, Number(viewer.width));
      const measured = measureFiglet(currentText, currentFont, availableWidth);
      lastMeasurement = measured;
      viewer.setContent(measured.rendered);
      fontBtn.setContent(" [F] Font ");
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

    function viewAllFonts() {
      openAllFontsWindow(currentText || "WIB WOB");
    }

    function viewFavouriteFonts() {
      openAllFontsWindow(currentText || "WIB WOB", true);
    }

    function pickFont() {
      let allChoices = getFigletFontChoices();
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
        label: " Fonts (SPACE=★) ",
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
      pickerPreviewBox = preview;

      // Show initial preview
      const initialChoice = filtered[idx];
      if (initialChoice) {
        preview.setContent(renderFiglet(currentText || "WIB WOB", initialChoice.value));
      }

      function getSelectedChoice(): { value: string; label: string } | undefined {
        const selIdx = (fontList as unknown as { selected: number }).selected ?? 0;
        return filtered[selIdx];
      }

      function updatePreview(status?: string) {
        const choice = getSelectedChoice();
        if (choice) {
          preview.setContent(renderFiglet(currentText || "WIB WOB", choice.value));
          preview.setLabel(status ?? ` Preview · ${choice.value} `);
        } else {
          preview.setContent("No matching fonts");
          preview.setLabel(status ?? " Preview ");
        }
      }

      function refilter(preferredFont?: string) {
        const q = query.toLowerCase();
        filtered = q
          ? allChoices.filter((c) => c.label.toLowerCase().includes(q))
          : allChoices;
        fontList.setItems(filtered.map((c) => c.label) as unknown as blessed.Widgets.BlessedElement[]);
        let nextIndex = 0;
        if (preferredFont) {
          const preferredIndex = filtered.findIndex((c) => c.value === preferredFont);
          if (preferredIndex >= 0) nextIndex = preferredIndex;
        }
        fontList.select(Math.max(0, Math.min(nextIndex, Math.max(0, filtered.length - 1))));
        updatePreview();
        leftPane.setLabel(query ? ` Search: ${query}_ ` : " Fonts (SPACE=★) ");
        host.screen.render();
      }

      // Preview on move
      fontList.on("select item", () => {
        updatePreview();
        host.screen.render();
      });

      function closePicker() {
        pickerPreviewBox = null;
        pickerContainer.detach();
        textInput.show();
        viewer.show();
        viewer.focus();
        rerenderFiglet();
        autoSizeWindow();
      }

      // Enter = confirm selection
      fontList.on("select", (_item: unknown, index: number) => {
        const choice = filtered[index];
        if (choice) {
          currentFont = choice.value;
        }
        closePicker();
      });

      // SPACE = toggle favourite and persist to private fonts.json
      fontList.key(["space"], () => {
        const choice = getSelectedChoice();
        if (!choice) return;
        const result = toggleFigletFavourite(choice.value);
        allChoices = getFigletFontChoices();
        refilter(choice.value);
        updatePreview(result.ok
          ? ` Preview · ${choice.value}${result.isFavourite ? " ★" : ""} `
          : ` Preview · save failed: ${result.error ?? "unknown"} `);
        host.screen.render();
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
          && key.name !== "escape" && key.name !== "space") {
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
    viewAllBtn.on("click", viewAllFonts);
    favsBtn.on("click", viewFavouriteFonts);

    // Register toolbar buttons as named clickables for agent/API access
    win.registerClickable(viewAllBtn, "[V] All");
    win.registerClickable(favsBtn, "[S] Favs");
    win.registerClickable(fontBtn, "[F] Font");
    win.registerClickable(editBtn, "[E] Edit");

    // Keyboard shortcuts on the viewer
    viewer.key(["e"], editText);
    viewer.key(["f"], pickFont);
    viewer.key(["v"], viewAllFonts);
    viewer.key(["s"], viewFavouriteFonts);

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

    win.captureText(() => {
      if (pickerPreviewBox) {
        const label = pickerPreviewBox.getLabel?.() ?? "";
        return `Font picker · ${label}\n\n${pickerPreviewBox.getContent()}`;
      }
      return viewer.getContent();
    });

    win.onResize(() => rerenderFiglet());

    win.onRestyle(() => {
      const nt = host.theme();
      toolbar.style = nt.header;
      toolbarLabel.style = nt.header;
      textInput.style = nt.input;
      viewAllBtn.style = { ...nt.footer, hover: nt.selected };
      favsBtn.style = { ...nt.footer, hover: nt.selected };
      fontBtn.style = { ...nt.footer, hover: nt.selected };
      editBtn.style = { ...nt.footer, hover: nt.selected };
      safeSetStyle(viewer, nt.body);
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
    autoSizeWindow();
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
