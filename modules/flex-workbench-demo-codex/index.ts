import blessed from "blessed";
import type { MicroappHost, Rect, UiPart } from "../../src/services/microapp-sdk.js";
import { applyRect, createColumns, createNodePart, createStack } from "../../src/services/microapp-sdk.js";
import { createScrollbar, scrollableStyle } from "../../src/core/ui-primitives.js";

type Mode = "lg" | "md" | "sm";
type TagMetrics = { rowsUsed: number };
type TagChild = { key: string; basis: number; height: number; part: UiPart<any> };

function pickMode(width: number): Mode {
  if (width >= 90) return "lg";
  if (width >= 60) return "md";
  return "sm";
}

function createTagWrap(parent: blessed.Widgets.Node, children: TagChild[], gap = 1): UiPart<void> & { metrics(): TagMetrics } {
  const node = blessed.box({ parent, top: 0, left: 0, width: 0, height: 0 });
  for (const child of children) node.append(child.part.node);
  let rowsUsed = 0;
  return {
    node,
    layout(rect: Rect) {
      applyRect(node, rect);
      let x = 0;
      let y = 0;
      let rowHeight = 0;
      let rowCount = 0;
      let rowItems = 0;
      const width = Math.max(1, rect.width);
      for (const child of children) {
        const childWidth = Math.min(child.basis, width);
        if (rowItems > 0 && x + gap + childWidth > width) {
          y += rowHeight + gap;
          x = 0;
          rowHeight = 0;
          rowItems = 0;
          rowCount += 1;
        }
        const left = rowItems > 0 ? x + gap : x;
        child.part.layout({ top: y, left, width: childWidth, height: child.height });
        x = left + childWidth;
        rowHeight = Math.max(rowHeight, child.height);
        rowItems += 1;
      }
      rowsUsed = children.length === 0 ? 0 : rowCount + 1;
      node.height = rowsUsed === 0 ? 0 : y + rowHeight;
    },
    update() {},
    restyle() { for (const child of children) child.part.restyle(); },
    destroy() { for (const child of children) child.part.destroy(); node.destroy(); },
    metrics() { return { rowsUsed }; },
  };
}

function createPanel(parent: blessed.Widgets.Node, label: string): UiPart<Record<string, never>> & { render(lines?: string[]): void } {
  const isDoc = label === "DOC";
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    border: { type: "line" },
    label: ` ${label} `,
    scrollable: isDoc ? true : undefined,
    alwaysScroll: isDoc ? true : undefined,
    mouse: isDoc ? true : undefined,
    keys: isDoc ? true : undefined,
    vi: isDoc ? true : undefined,
    scrollbar: isDoc ? createScrollbar() : undefined,
    style: isDoc ? scrollableStyle({}) : undefined,
  });
  const part = createNodePart(node);
  return {
    ...part,
    render(lines: string[] = []) {
      const width = Math.max(0, (Number(node.width) || 0) - 2);
      const height = Math.max(0, (Number(node.height) || 0) - 2);
      const content = [...lines];
      while (content.length < height) {
        content.push(`${label.toLowerCase()} `.repeat(Math.ceil(width / (label.length + 1))).slice(0, width));
      }
      node.setContent(content.join("\n"));
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Workbench (Codex)",
    description: "App-scale nested flex demo with wrapped tags.",
    menu: [{ category: "demos", order: 148, label: "Flex Workbench (Codex)" }],
    palette: { order: 248, label: "Flex Workbench (Codex)" },
    action: () => {
      const win = host.createWindow({ title: "Flex Workbench", width: 100, height: 30 });
      let mode: Mode = "lg";

      const toolbarLabel = createPanel(win.body, "APP");
      const btnA = createPanel(win.body, "RUN");
      const btnB = createPanel(win.body, "SAVE");
      const toolbarStatus = createPanel(win.body, "MODE");

      const nav = createPanel(win.body, "NAV");
      const dividerA = createNodePart(blessed.box({ parent: win.body, content: "│" }));
      const docHeader = createPanel(win.body, "DOC H");
      const docContent = createPanel(win.body, "DOC");
      const docFooter = createPanel(win.body, "DOC F");
      const dividerB = createNodePart(blessed.box({ parent: win.body, content: "│" }));
      const inspectorHeader = createPanel(win.body, "INSP H");
      const inspectorBody = createPanel(win.body, "INSP");

      const tagParts: TagChild[] = ["ai", "ux", "sim", "map", "tool", "mem", "irc", "viz"].map((tag, index) => ({
        key: `tag-${index}`,
        basis: Math.max(4, tag.length + 2),
        height: 1,
        part: createNodePart(blessed.box({
          parent: win.body,
          content: ` ${tag} `,
          border: { type: "line" },
        })),
      }));
      const tagWrap = createTagWrap(win.body, tagParts, 1);

      const inspector = createStack(win.body, [
        { key: "ih", basis: 1, part: inspectorHeader },
        { key: "ib", basis: "1fr", part: inspectorBody },
        { key: "tags", basis: 5, part: tagWrap },
      ]);

      const document = createStack(win.body, [
        { key: "dh", basis: 1, part: docHeader },
        { key: "dc", basis: "1fr", part: docContent },
        { key: "df", basis: 1, part: docFooter },
      ]);

      const toolbar = createColumns(win.body, [
        { key: "label", basis: 8, part: toolbarLabel },
        { key: "btnA", basis: 8, part: btnA },
        { key: "btnB", basis: 8, part: btnB },
        { key: "spacer", basis: "1fr", part: createNodePart(blessed.box({ parent: win.body })) },
        { key: "status", basis: 20, part: toolbarStatus },
      ]);

      const body = createColumns(win.body, [
        { key: "nav", basis: 16, part: nav, visible: () => mode !== "sm" },
        { key: "divA", basis: 1, part: dividerA, visible: () => mode !== "sm" },
        { key: "document", basis: "1fr", part: document },
        { key: "divB", basis: 1, part: dividerB, visible: () => mode === "lg" },
        { key: "inspector", basis: 24, part: inspector, visible: () => mode === "lg" },
      ]);

      const status = createPanel(win.body, "STATUS");
      const root = createStack(win.body, [
        { key: "toolbar", basis: 1, part: toolbar },
        { key: "body", basis: "1fr", part: body },
        { key: "status", basis: 1, part: status },
      ]);

      function renderDocScroll() {
        host.screen.render();
      }

      docContent.node.key(["j", "down"], () => {
        docContent.node.scroll(1);
        renderDocScroll();
      });
      docContent.node.key(["k", "up"], () => {
        docContent.node.scroll(-1);
        renderDocScroll();
      });
      docContent.node.key(["pageup"], () => {
        docContent.node.scroll(-(Math.max(1, (Number(docContent.node.height) || 0) - 2)));
        renderDocScroll();
      });
      docContent.node.key(["pagedown"], () => {
        docContent.node.scroll(Math.max(1, (Number(docContent.node.height) || 0) - 2));
        renderDocScroll();
      });
      docContent.node.key(["g"], () => {
        docContent.node.setScroll(0);
        renderDocScroll();
      });
      docContent.node.key(["G"], () => {
        docContent.node.setScrollPerc(100);
        renderDocScroll();
      });
      docContent.node.on("wheelup", () => {
        docContent.node.scroll(-3);
        renderDocScroll();
      });
      docContent.node.on("wheeldown", () => {
        docContent.node.scroll(3);
        renderDocScroll();
      });

      function render() {
        const w = Math.max(1, Number(win.body.width) || 100);
        const h = Math.max(1, Number(win.body.height) || 30);
        mode = pickMode(w);
        root.layout({ top: 0, left: 0, width: w, height: h });
        toolbarLabel.render(["app"]);
        btnA.render(["run"]);
        btnB.render(["save"]);
        toolbarStatus.render([`mode=${mode}`]);
        nav.render(["1 inbox", "2 notes", "3 world", "4 tools", "5 ops"]);
        docHeader.render([`document ${Number(document.node.width) || 0}x${Number(document.node.height) || 0}`]);
        docContent.render(Array.from({ length: 80 }, (_, i) =>
          `line ${String(i + 1).padStart(2, "0")}  terminal workspace notes, layout diagnostics, and long-form copy for real scrolling`
        ));
        docFooter.render(["ctrl-s save"]);
        inspectorHeader.render(["inspector"]);
        inspectorBody.render(["selection", "status: ready", "context: module", "focus: doc"]);
        status.render([`nav=${mode !== "sm"} inspector=${mode === "lg"} tags=${tagWrap.metrics().rowsUsed}`]);
        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => root.destroy());
      win.onRestyle(() => {
        root.restyle();
        docContent.node.style = scrollableStyle(host.theme().body) as any;
        host.screen.render();
      });
      win.describeState(() => ({
        summary: `Flex Workbench — ${mode.toUpperCase()} tags:${tagWrap.metrics().rowsUsed}`,
        mode,
        navVisible: mode !== "sm",
        inspectorVisible: mode === "lg",
        toolbarWidth: Number(toolbar.node.width) || 0,
        navWidth: mode !== "sm" ? Number(nav.node.width) || 0 : 0,
        inspectorWidth: mode === "lg" ? Number(inspector.node.width) || 0 : 0,
        documentWidth: Number(document.node.width) || 0,
        documentHeight: Number(document.node.height) || 0,
        tagChipRows: tagWrap.metrics().rowsUsed,
        contentOverflowY: true,
      }));
      win.captureText(() => `Flex Workbench\nmode=${mode}\ndocument=${Number(document.node.width) || 0}x${Number(document.node.height) || 0}`);
      win.focus();
      docContent.node.focus();
    },
  });
}
