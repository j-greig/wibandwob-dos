/**
 * Flex Bands Demo (Pi/Claude version)
 *
 * Holy grail layout: createStack nesting a createRow.
 * No wrap, no breakpoints — pure fixed + fluid composition.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createNodePart } from "../../src/services/microapp-sdk.js";

function makeRegion(parent: blessed.Widgets.Node, label: string) {
  const node = blessed.box({
    parent, top: 0, left: 0, width: 0, height: 0,
    border: { type: "line" }, label: ` ${label} `, tags: false,
  });
  const part = createNodePart(node);
  return {
    ...part,
    paint() {
      const w = Number(node.width) || 0;
      const h = Number(node.height) || 0;
      node.setContent(`${label} ${w}x${h}`);
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Bands (Pi)",
    description: "Holy grail flex layout: header, nav, main, aside, footer",
    action: () => {
      const win = host.createWindow({ title: "Flex Bands (Pi)", width: 80, height: 24 });

      const header = makeRegion(win.body, "HEADER");
      const nav = makeRegion(win.body, "NAV");
      const main = makeRegion(win.body, "MAIN");
      const aside = makeRegion(win.body, "ASIDE");
      const footer = makeRegion(win.body, "FOOTER");

      const middle = host.ui.createRow(win.body, [
        { key: "nav",   basis: 20,    part: nav },
        { key: "main",  basis: "1fr", part: main },
        { key: "aside", basis: 20,    part: aside },
      ]);

      const root = host.ui.createStack(win.body, [
        { key: "header", basis: 3,     part: header },
        { key: "middle", basis: "1fr", part: middle },
        { key: "footer", basis: 1,     part: footer },
      ]);

      function render() {
        const w = Math.max(1, Number(win.body.width) || 80);
        const h = Math.max(1, Number(win.body.height) || 24);
        root.layout({ top: 0, left: 0, width: w, height: h });
        header.paint(); nav.paint(); main.paint(); aside.paint(); footer.paint();
        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => { root.destroy(); });
      win.onRestyle(() => { root.restyle(); host.screen.render(); });

      win.describeState(() => ({
        summary: `Flex Bands: nav=${Number(nav.node.width)||0} main=${Number(main.node.width)||0} aside=${Number(aside.node.width)||0} ${Number(win.body.width)||0}x${Number(win.body.height)||0}`,
        headerHeight: Number(header.node.height) || 0,
        navWidth: Number(nav.node.width) || 0,
        mainWidth: Number(main.node.width) || 0,
        asideWidth: Number(aside.node.width) || 0,
        footerHeight: Number(footer.node.height) || 0,
        windowWidth: Number(win.body.width) || 0,
        windowHeight: Number(win.body.height) || 0,
      }));

      win.captureText(() =>
        `Flex Bands — nav:${Number(nav.node.width)||0} main:${Number(main.node.width)||0} aside:${Number(aside.node.width)||0}`
      );

      win.focus();
    },
    menu: [{ category: "demos", order: 93, label: "Flex Bands (Pi)" }],
    palette: { order: 293, label: "Flex Bands (Pi)" },
  });
}
