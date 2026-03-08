import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { renderChronicles, measureChroniclesHeight, type ChroniclesState } from "./renderer.js";

export default function setup(host: MicroappHost) {
  function openChronicles(args?: Record<string, unknown>) {
    const win = host.createWindow({
      title: "§y² Chronicles",
      width: Math.max(80, host.geometry.width - 2),
      height: Math.max(24, host.geometry.height - 3),
      left: 0,
      top: 0,
    });

    const state: ChroniclesState = {
      scrollY: typeof args?._scrollY === "number" ? Math.max(0, Math.floor(args._scrollY)) : 0,
    };

    const display = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });
    const root = host.ui.createStack(win.body, [{ key: "display", basis: "1fr", part: display }]);

    function maxScroll(innerW: number, innerH: number): number {
      return Math.max(0, measureChroniclesHeight(innerW) - innerH);
    }

    function render() {
      const innerW = Math.max(20, Number(win.body.width) || 80);
      const innerH = Math.max(3, Number(win.body.height) || 24);
      state.scrollY = Math.min(state.scrollY, maxScroll(innerW, innerH));
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });
      display.update({ text: renderChronicles(state, innerW, innerH) });
      host.screen.render();
    }

    function scrollBy(delta: number) {
      const innerW = Math.max(20, Number(win.body.width) || 80);
      const innerH = Math.max(3, Number(win.body.height) || 24);
      state.scrollY = Math.max(0, Math.min(maxScroll(innerW, innerH), state.scrollY + delta));
      render();
    }

    win.onInput((ch, key) => {
      if (ch === "q" || ch === "Q" || key?.name === "escape") {
        win.close();
        return;
      }
      if (key?.name === "up" || key?.name === "left") {
        scrollBy(-1);
        return;
      }
      if (key?.name === "down" || key?.name === "right") {
        scrollBy(1);
        return;
      }
      if (key?.name === "pageup") {
        scrollBy(-8);
        return;
      }
      if (key?.name === "pagedown") {
        scrollBy(8);
      }
    });

    win.describeState(() => ({
      summary: `§y² Chronicles (scroll:${state.scrollY})`,
      scrollY: state.scrollY,
      panelCount: 25,
    }));

    win.captureText(() => {
      const innerW = Math.max(20, Number(win.body.width) || 80);
      const innerH = Math.max(3, Number(win.body.height) || 24);
      return renderChronicles(state, innerW, innerH);
    });

    win.onRestyle(() => render());
    win.onResize(() => render());

    host.registerSnapshot({
      canRestore: (snap) => snap.appType === "wibwob.sy2chronicles",
      restore: (snap) => {
        openChronicles({ _scrollY: snap._scrollY });
      },
    });

    render();
    win.focus();

    return {
      snapshot: () => ({
        appType: "wibwob.sy2chronicles",
        _scrollY: state.scrollY,
      }),
    };
  }

  host.registerCommand({
    id: "open",
    label: "Open §y² Chronicles",
    description: "Open a dense multi-panel chronicle of §y²'s first week.",
    menu: [{ category: "applications", order: 39, label: "§y² Chronicles" }],
    palette: { order: 59, label: "Open §y² Chronicles" },
    action: (args) => {
      openChronicles(args as Record<string, unknown> | undefined);
    },
  });
}
