import fs from "node:fs";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createSplitView,
  createTextViewer,
  createStatusBar,
  createHeaderBar,
  renderMarkdown,
  PLAIN_HEADING_CONFIG,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Markdown Preview";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Preview markdown files. o: open file, Tab: switch pane.",
    menu: [{ category: "applications", order: 203, label: APP_TITLE }],
    palette: { order: 203, label: `Open ${APP_TITLE}` },
    action: (args) => {
      let currentFile = (args?.filePath as string) ?? "";
      let rawContent = "";

      const win = host.createWindow({ title: APP_TITLE, width: 90, height: 30 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: "no file loaded",
      });

      const split = createSplitView(win.body, {
        direction: "horizontal",
        ratio: 0.45,
        bottomOffset: 1,
      });

      // Hack: splitView sets top:0 but we need top:1 for header
      split.element.top = 1;

      const source = createTextViewer(split.first, {
        content: "Press 'o' to open a markdown file",
        wrap: true,
      });

      const preview = createTextViewer(split.second, {
        content: "",
        wrap: true,
      });

      const status = createStatusBar(win.body, {
        left: "o: open  Tab: switch pane",
        right: "",
      });

      const loadFile = (filePath: string) => {
        try {
          rawContent = fs.readFileSync(filePath, "utf8");
          currentFile = filePath;
          const basename = filePath.split("/").pop() ?? filePath;

          source.update({ content: rawContent });

          const width = Math.max(20, Number(split.second.width) || 40);
          const rendered = renderMarkdown(rawContent, width, {
            headingConfig: PLAIN_HEADING_CONFIG,
          });
          preview.update({ content: rendered.join("\n") });

          header.update({ right: basename });
          status.update({ right: `${rawContent.split("\n").length} lines` });
          win.setTitle(`${APP_TITLE} — ${basename}`);
          host.screen.render();
        } catch (err) {
          source.update({ content: `Error loading file: ${err}` });
          host.screen.render();
        }
      };

      // Key bindings on the source viewer
      source.element.key(["o"], () => {
        host.pickFile("Open Markdown", host.repoRoot, loadFile, {
          fileFilter: (p) => p.endsWith(".md") || p.endsWith("/") || !p.includes("."),
        });
      });

      source.element.key(["tab"], () => {
        preview.element.focus();
      });

      preview.element.key(["o"], () => {
        host.pickFile("Open Markdown", host.repoRoot, loadFile, {
          fileFilter: (p) => p.endsWith(".md") || p.endsWith("/") || !p.includes("."),
        });
      });

      preview.element.key(["tab"], () => {
        source.element.focus();
      });

      // Load file from args if provided
      if (currentFile) loadFile(currentFile);

      win.describeState(() => ({
        summary: `Markdown Preview — ${currentFile || "no file"}`,
        filePath: currentFile,
        lineCount: rawContent.split("\n").length,
      }));

      win.captureText(() => rawContent || "No file loaded");

      win.onRestyle(() => {
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onResize(() => {
        if (rawContent) {
          const width = Math.max(20, Number(split.second.width) || 40);
          const rendered = renderMarkdown(rawContent, width, {
            headingConfig: PLAIN_HEADING_CONFIG,
          });
          preview.update({ content: rendered.join("\n") });
          host.screen.render();
        }
      });

      win.onCleanup(() => {
        header.destroy();
        split.destroy();
        status.destroy();
      });

      win.setFocusTarget(source.element);
      win.focus();

      return { ok: true, windowId: win.id };
    },
  });
}
