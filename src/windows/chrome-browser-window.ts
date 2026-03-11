/**
 * Chrome Browser Window
 *
 * A web browser window that uses Chrome DevTools Protocol to navigate
 * the web and render pages as readable markdown in the terminal.
 * Toolbar: [<] [>] [URL input field] [Go] [Reload] [Search]
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle } from "../core/ui-parts.js";
import type { WindowRecord } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import { ChromeBrowserService, type BrowseResult } from "../services/chrome-browser-service.js";
import { renderMarkdown, DEFAULT_FIGLET_HEADING_CONFIG, PLAIN_HEADING_CONFIG, type FigletHeadingConfig } from "../services/markdown-service.js";

const DEFAULT_HOME = "https://en.wikipedia.org/wiki/Main_Page";

export function openChromeBrowserWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  initialUrl?: string;
  onStateChanged?: () => void;
}): void {
  const { screen, windowManager, overlays } = params;
  const service = new ChromeBrowserService();

  const frame = windowManager.createFrame("Chrome Browser", "browser");
  frame.frame.width = 100;
  frame.frame.height = 30;

  // -- Toolbar row 1: navigation buttons + URL --
  const toolbar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: theme().footer,
  });

  const backBtn = blessed.box({
    parent: toolbar,
    top: 0,
    left: 0,
    width: 4,
    height: 1,
    content: " <- ",
    mouse: true,
    style: { ...theme().footer, hover: theme().header },
  });

  const fwdBtn = blessed.box({
    parent: toolbar,
    top: 0,
    left: 4,
    width: 4,
    height: 1,
    content: " -> ",
    mouse: true,
    style: { ...theme().footer, hover: theme().header },
  });

  const reloadBtn = blessed.box({
    parent: toolbar,
    top: 0,
    left: 8,
    width: 4,
    height: 1,
    content: " @  ",
    mouse: true,
    style: { ...theme().footer, hover: theme().header },
  });

  const goBtn = blessed.box({
    parent: toolbar,
    top: 0,
    right: 0,
    width: 6,
    height: 1,
    content: "  Go  ",
    mouse: true,
    style: { ...theme().input, hover: theme().header },
  });

  const urlBox = blessed.textbox({
    parent: toolbar,
    top: 0,
    left: 13,
    right: 7,
    height: 1,
    inputOnFocus: true,
    mouse: true,
    style: theme().input,
  });

  // -- Status bar --
  const statusBar = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    height: 1,
    style: theme().header,
  });

  // -- Content viewport --
  const content = blessed.box({
    parent: frame.body,
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body,
  });

  // -- State --
  let currentUrl = "";
  let currentTitle = "";
  let pageMarkdown = "";
  let loading = false;
  let figletHeadings = false;
  const history: string[] = [];
  let historyIndex = -1;

  const setStatus = (text: string) => {
    statusBar.setContent(` ${text}`);
    screen.render();
  };

  const setUrl = (url: string) => {
    urlBox.setValue(url);
    screen.render();
  };

  const showResult = (result: BrowseResult) => {
    loading = false;
    if (!result.ok) {
      currentTitle = "Error";
      pageMarkdown = result.error ?? "Unknown error";
      content.setContent(pageMarkdown);
      setStatus(`Error: ${result.error}`);
      screen.render();
      return;
    }

    currentUrl = result.url;
    currentTitle = result.title || result.url;
    pageMarkdown = result.markdown;

    // Render markdown with figlet headings (same renderer as the smart editor)
    const contentWidth = Math.max(40, Number(content.width) || 80);
    const headingConfig = figletHeadings ? DEFAULT_FIGLET_HEADING_CONFIG : PLAIN_HEADING_CONFIG;
    const lines = renderMarkdown(result.markdown, contentWidth, { headingConfig });
    content.setContent(lines.join("\n"));
    content.scrollTo(0);
    setUrl(result.url);
    params.onStateChanged?.();
    setStatus(`${result.title || result.url}`);
    screen.render();
  };

  /** Re-render the current page markdown (e.g. after resize or figlet toggle). */
  const rerenderPage = () => {
    if (!pageMarkdown) return;
    const contentWidth = Math.max(40, Number(content.width) || 80);
    const headingConfig = figletHeadings ? DEFAULT_FIGLET_HEADING_CONFIG : PLAIN_HEADING_CONFIG;
    const lines = renderMarkdown(pageMarkdown, contentWidth, { headingConfig });
    content.setContent(lines.join("\n"));
    screen.render();
  };

  const navigateTo = async (url: string, pushHistory = true) => {
    // Normalise URL
    if (!/^https?:\/\//i.test(url)) {
      // If it looks like a search query, search Google
      if (url.includes(" ") || !url.includes(".")) {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      } else {
        url = `https://${url}`;
      }
    }

    loading = true;
    setStatus(`Loading ${url}...`);
    content.setContent(`\n  Loading ${url}...\n\n  Connecting to Chrome on :9222...`);
    screen.render();

    const result = await service.navigate(url);
    showResult(result);

    if (result.ok && pushHistory) {
      // Trim forward history when navigating from a back position
      if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
      }
      history.push(result.url);
      historyIndex = history.length - 1;
    }
  };

  const goBack = async () => {
    if (historyIndex <= 0) {
      setStatus("No previous page");
      return;
    }
    loading = true;
    setStatus("Going back...");
    historyIndex--;
    const url = history[historyIndex];
    const result = await service.navigate(url);
    showResult(result);
  };

  const goForward = async () => {
    if (historyIndex >= history.length - 1) {
      setStatus("No next page");
      return;
    }
    loading = true;
    setStatus("Going forward...");
    historyIndex++;
    const url = history[historyIndex];
    const result = await service.navigate(url);
    showResult(result);
  };

  const doReload = async () => {
    if (!currentUrl) return;
    loading = true;
    setStatus(`Reloading ${currentUrl}...`);
    const result = await service.navigate(currentUrl);
    showResult(result);
  };

  const submitUrl = () => {
    const value = urlBox.getValue().trim();
    if (!value) return;
    content.focus();
    void navigateTo(value);
  };

  // -- Toolbar event wiring --
  backBtn.on("click", () => {
    if (!loading) void goBack();
  });
  fwdBtn.on("click", () => {
    if (!loading) void goForward();
  });
  reloadBtn.on("click", () => {
    if (!loading) void doReload();
  });
  goBtn.on("click", () => {
    submitUrl();
  });

  urlBox.on("submit", () => {
    submitUrl();
  });

  // Keyboard shortcuts on content area
  content.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (loading) return;

    // Alt-Left = back, Alt-Right = forward
    if (key.meta && key.name === "left") {
      void goBack();
      return;
    }
    if (key.meta && key.name === "right") {
      void goForward();
      return;
    }
    // 'g' = focus URL bar, 'r' = reload, 'b' = back, 'f' = forward
    if (key.name === "g" && !key.ctrl && !key.meta) {
      urlBox.focus();
      urlBox.readInput();
      screen.render();
      return;
    }
    if (key.name === "r" && !key.ctrl && !key.meta) {
      void doReload();
      return;
    }
    if (key.name === "b" && !key.ctrl && !key.meta) {
      void goBack();
      return;
    }
    // 'h' = toggle figlet headings
    if (key.name === "h" && !key.ctrl && !key.meta) {
      figletHeadings = !figletHeadings;
      rerenderPage();
      return;
    }
  });

  // Escape in URL bar returns to content
  urlBox.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name === "escape") {
      content.focus();
      screen.render();
    }
  });

  // Click on content focuses it
  content.on("click", () => {
    windowManager.focusWindow(frame);
    content.focus();
  });

  // -- WindowRecord integration --
  frame.kind = "browser";
  frame.cleanup = () => {
    service.disconnect();
  };
  frame.captureText = () => pageMarkdown;
  frame.describeState = () => ({
    appType: "web-reader",
    summary: `Chrome browser viewing ${currentTitle || currentUrl || "(no page)"}`,
    currentUrl,
    currentTitle,
    historyLength: history.length,
    historyIndex,
    loading,
    figletHeadings,
    contentPreview: pageMarkdown.split("\n").slice(0, 12).join("\n"),
  });
  frame.setFocusTarget(content);
  // Allow agent tools to navigate by sending a URL string
  frame.writeInput = (input: string) => {
    const trimmed = input.trim();
    if (trimmed) void navigateTo(trimmed);
  };
  frame.onRestyle = createRestyleBundle([
    [toolbar, () => theme().footer],
    [backBtn, () => ({ ...theme().footer, hover: theme().header })],
    [fwdBtn, () => ({ ...theme().footer, hover: theme().header })],
    [reloadBtn, () => ({ ...theme().footer, hover: theme().header })],
    [goBtn, () => ({ ...theme().input, hover: theme().header })],
    [urlBox, () => theme().input],
    [statusBar, () => theme().header],
    [content, () => theme().body],
  ]).restyle;

  // Re-render figlet headings responsively on resize
  frame.frame.on("resize", () => rerenderPage());

  windowManager.registerWindow(frame);
  frame.focus();

  // -- Initial navigation --
  const startUrl = params.initialUrl || DEFAULT_HOME;
  setUrl(startUrl);
  setStatus("Ready. Press g to focus URL bar, Enter to navigate.");
  content.setContent(
    `\n  Chrome Browser\n  ==============\n\n` +
    `  Connects to Chrome via DevTools Protocol on :9222.\n` +
    `  Pages are rendered as readable markdown.\n\n` +
    `  Keyboard:\n` +
    `    g       Focus URL bar\n` +
    `    Enter   Navigate to URL\n` +
    `    b       Back\n` +
    `    r       Reload\n` +
    `    h       Toggle figlet headings\n` +
    `    j/k     Scroll\n\n` +
    `  Requires Chrome with --remote-debugging-port=9222\n` +
    `  Run: browser-start.js  (from badlogic/browser-tools)\n\n` +
    `  Loading home page...`
  );
  screen.render();

  void navigateTo(startUrl);
}
