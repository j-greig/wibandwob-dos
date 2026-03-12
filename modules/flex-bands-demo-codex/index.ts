import blessed from "blessed";
import type { MicroappHost, UiPart } from "../../src/services/microapp-sdk.js";
import { applyRect, createNodePart } from "../../src/services/microapp-sdk.js";

function fillPattern(width: number, height: number, seed: string): string {
  const chars = `${seed} .:-=+*`;
  const lines: string[] = [];
  for (let y = 0; y < Math.max(0, height); y++) {
    let line = "";
    for (let x = 0; x < Math.max(0, width); x++) {
      line += chars[(x + y) % chars.length] ?? ".";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function createRegion(parent: blessed.Widgets.Node, label: string, seed: string): UiPart<Record<string, never>> & { render(): void } {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    border: { type: "line" },
    label: ` ${label} `,
    tags: false,
  });

  const part = createNodePart(node);
  return {
    ...part,
    render() {
      const width = Math.max(0, (Number(node.width) || 0) - 2);
      const height = Math.max(0, (Number(node.height) || 0) - 2);
      const header = `${label} ${(Number(node.width) || 0)}x${(Number(node.height) || 0)}`;
      const body = fillPattern(width, Math.max(0, height - 1), seed);
      node.setContent([header.slice(0, width), body].filter(Boolean).join("\n"));
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Bands (Codex)",
    description: "Pure flex composition: header, nav, main, aside, footer.",
    menu: [{ category: "demos", order: 146, label: "Flex Bands (Codex)" }],
    palette: { order: 246, label: "Flex Bands (Codex)" },
    action: () => {
      const win = host.createWindow({ title: "Flex Bands", width: 80, height: 24 });
      const HEADER_H = 3;
      const FOOTER_H = 1;
      const NARROW_W = 56;
      const header = createRegion(win.body, "HEADER", "H");
      const nav = createRegion(win.body, "NAV", "N");
      const main = createRegion(win.body, "MAIN", "M");
      const aside = createRegion(win.body, "ASIDE", "A");
      const footer = createRegion(win.body, "FOOTER", "F");
      const viewport = blessed.box({
        parent: win.body,
        top: HEADER_H,
        left: 0,
        right: 0,
        bottom: FOOTER_H,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        vi: true,
        scrollbar: {
          ch: " ",
          inverse: true,
          style: { bg: "cyan" },
          track: { bg: "gray" },
        },
        style: host.theme().body,
      });
      const content = blessed.box({
        parent: viewport,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        style: host.theme().body,
      });
      content.append(nav.node);
      content.append(main.node);
      content.append(aside.node);

      function render() {
        const w = Math.max(1, Number(win.body.width) || 80);
        const h = Math.max(1, Number(win.body.height) || 24);
        const bodyH = Math.max(1, h - HEADER_H - FOOTER_H);
        header.layout({ top: 0, left: 0, width: w, height: HEADER_H });
        footer.layout({ top: h - FOOTER_H, left: 0, width: w, height: FOOTER_H });
        applyRect(viewport, { top: HEADER_H, left: 0, width: w, height: bodyH });
        applyRect(content, { top: 0, left: 0, width: w, height: bodyH });

        if (w < NARROW_W) {
          const panelH = Math.max(6, Math.floor(bodyH / 2));
          nav.layout({ top: 0, left: 0, width: w, height: panelH });
          main.layout({ top: panelH + 1, left: 0, width: w, height: Math.max(panelH + 2, bodyH) });
          aside.layout({ top: panelH + 1 + Math.max(panelH + 2, bodyH) + 1, left: 0, width: w, height: panelH });
          content.height = panelH + 1 + Math.max(panelH + 2, bodyH) + 1 + panelH;
        } else {
          const navW = 20;
          const asideW = 20;
          nav.layout({ top: 0, left: 0, width: navW, height: bodyH });
          main.layout({ top: 0, left: navW, width: Math.max(1, w - navW - asideW), height: bodyH });
          aside.layout({ top: 0, left: w - asideW, width: asideW, height: bodyH });
          content.height = bodyH;
        }
        header.render();
        nav.render();
        main.render();
        aside.render();
        footer.render();
        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => {
        header.destroy();
        nav.destroy();
        main.destroy();
        aside.destroy();
        footer.destroy();
        content.destroy();
        viewport.destroy();
      });
      win.onRestyle(() => {
        viewport.style = host.theme().body;
        content.style = host.theme().body;
        header.restyle();
        nav.restyle();
        main.restyle();
        aside.restyle();
        footer.restyle();
        host.screen.render();
      });
      win.describeState(() => ({
        summary: `Flex Bands — ${((Number(win.body.width) || 0) < NARROW_W) ? "stacked" : "row"} main ${(Number(main.node.width) || 0)} cols`,
        windowWidth: Number(win.body.width) || 0,
        windowHeight: Number(win.body.height) || 0,
        stacked: (Number(win.body.width) || 0) < NARROW_W,
        headerHeight: Number(header.node.height) || 0,
        navWidth: Number(nav.node.width) || 0,
        mainWidth: Number(main.node.width) || 0,
        asideWidth: Number(aside.node.width) || 0,
        footerHeight: Number(footer.node.height) || 0,
      }));
      win.captureText(() =>
        `Flex Bands\nheader=${Number(header.node.height) || 0}\nnav=${Number(nav.node.width) || 0}\nmain=${Number(main.node.width) || 0}\naside=${Number(aside.node.width) || 0}`
      );
      win.focus();
    },
  });
}
