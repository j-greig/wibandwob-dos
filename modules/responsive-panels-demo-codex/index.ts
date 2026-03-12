import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { applyRect, createNodePart } from "../../src/services/microapp-sdk.js";
// Internal imports for theme-consistent scrollbar (not yet SDK-exported)
import { createScrollbar, scrollableStyle } from "../../src/core/ui-primitives.js";

type Mode = "lg" | "md" | "sm";

function pickMode(width: number): Mode {
  if (width >= 80) return "lg";
  if (width >= 50) return "md";
  return "sm";
}

function createPanel(parent: blessed.Widgets.Node, label: string, fill: string) {
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
    node,
    part,
    render(lines: string[] = []) {
      const width = Math.max(0, (Number(node.width) || 0) - 2);
      const height = Math.max(0, (Number(node.height) || 0) - 2);
      const out = [...lines];
      while (out.length < height) {
        out.push(fill.repeat(Math.ceil(width / fill.length)).slice(0, width));
      }
      node.setContent(out.map(line => line.slice(0, width)).join("\n"));
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Responsive Panels (Codex)",
    description: "Breakpoint-driven responsive demo with stacked narrow layout and visible scrolling.",
    menu: [{ category: "demos", order: 147, label: "Responsive Panels (Codex)" }],
    palette: { order: 247, label: "Responsive Panels (Codex)" },
    action: () => {
      const win = host.createWindow({ title: "Responsive Panels", width: 90, height: 28 });
      const HEADER_H = 3;
      const FOOTER_H = 1;
      const GAP = 1;
      let mode: Mode = "lg";

      const header = createPanel(win.body, "HEADER", "=");
      const footer = createPanel(win.body, "STATUS", "-");
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
        scrollbar: createScrollbar(),
        style: scrollableStyle(host.theme().body),
      });
      const content = blessed.box({
        parent: viewport,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        style: host.theme().body,
      });

      const sidebarLg = createPanel(content, "SIDEBAR", "[]");
      const sidebarMd = createPanel(content, "SIDEBAR", "[]");
      const main = createPanel(content, "MAIN", "..");
      const inspector = createPanel(content, "INSPECTOR", "{}");

      function render() {
        const w = Math.max(1, Number(win.body.width) || 90);
        const h = Math.max(1, Number(win.body.height) || 28);
        const bodyH = Math.max(1, h - HEADER_H - FOOTER_H);
        mode = pickMode(w);

        header.part.layout({ top: 0, left: 0, width: w, height: HEADER_H });
        footer.part.layout({ top: h - FOOTER_H, left: 0, width: w, height: FOOTER_H });
        applyRect(viewport, { top: HEADER_H, left: 0, width: w, height: bodyH });
        applyRect(content, { top: 0, left: 0, width: w, height: bodyH });

        sidebarLg.node.hide();
        sidebarMd.node.hide();
        inspector.node.hide();

        if (mode === "lg") {
          const sidebarW = 24;
          const inspectorW = 24;
          const mainW = Math.max(1, w - sidebarW - inspectorW - GAP * 2);
          sidebarLg.node.show();
          inspector.node.show();
          sidebarLg.part.layout({ top: 0, left: 0, width: sidebarW, height: bodyH });
          main.part.layout({ top: 0, left: sidebarW + GAP, width: mainW, height: bodyH });
          inspector.part.layout({ top: 0, left: sidebarW + GAP + mainW + GAP, width: inspectorW, height: bodyH });
          content.height = bodyH;
        } else if (mode === "md") {
          const sidebarW = 20;
          const mainW = Math.max(1, w - sidebarW - GAP);
          sidebarMd.node.show();
          sidebarMd.part.layout({ top: 0, left: 0, width: sidebarW, height: bodyH });
          main.part.layout({ top: 0, left: sidebarW + GAP, width: mainW, height: bodyH });
          content.height = bodyH;
        } else {
          const sidebarH = 8;
          const mainH = Math.max(12, bodyH);
          const inspectorH = 10;
          sidebarMd.node.show();
          inspector.node.show();
          sidebarMd.part.layout({ top: 0, left: 0, width: w, height: sidebarH });
          main.part.layout({ top: sidebarH + GAP, left: 0, width: w, height: mainH });
          inspector.part.layout({ top: sidebarH + GAP + mainH + GAP, left: 0, width: w, height: inspectorH });
          content.height = sidebarH + GAP + mainH + GAP + inspectorH;
        }

        // Show scrollbar only when content overflows viewport
        const overflows = Number(content.height) > bodyH;
        const bodyStyle = host.theme().body;
        if (overflows) {
          viewport.style = scrollableStyle(bodyStyle) as any;
        } else {
          viewport.style = { ...bodyStyle, scrollbar: { bg: bodyStyle.bg }, track: { bg: bodyStyle.bg } } as any;
        }

        header.render([`mode=${mode}`, `${w}x${h}`]);
        if (mode === "lg") {
          sidebarLg.render(["project nav", "search", "notes", "assets", "timeline"]);
        }
        if (mode !== "lg") {
          sidebarMd.render(["compact nav", "queue", "pins", "files"]);
        }
        main.render([
          `mode=${mode}`,
          "This panel is deliberately long in narrow mode.",
          "On small widths the layout stacks instead of crushing panels.",
          "That means the window should scroll vertically.",
          "",
          "The point is mobile-style responsiveness:",
          "keep things legible, accept longer pages, and scroll.",
          "",
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
          "Vestibulum in sem ut tortor dictum interdum.",
          "Suspendisse potenti. Curabitur non sapien a est efficitur dapibus.",
          "Praesent laoreet, eros non volutpat aliquet, nibh velit posuere lorem,",
          "sed mattis eros velit in urna.",
        ]);
        if (mode === "lg" || mode === "sm") {
          inspector.render([
            "inspector",
            "selection: main panel",
            "status: ready",
            "density: readable",
            "",
            "This panel remains visible in `sm` specifically",
            "to force a real stacked scroll case.",
          ]);
        }
        footer.render([
          `${mode.toUpperCase()}  sidebar=${mode !== "lg" ? "compact" : "full"}  inspector=${mode === "md" ? "hidden" : "visible"}  scroll=${content.height > bodyH ? "yes" : "no"}`,
        ]);

        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => {
        header.part.destroy();
        footer.part.destroy();
        sidebarLg.part.destroy();
        sidebarMd.part.destroy();
        main.part.destroy();
        inspector.part.destroy();
        content.destroy();
        viewport.destroy();
      });
      win.onRestyle(() => {
        // Re-render handles scrollbar visibility per mode
        content.style = host.theme().body;
        header.part.restyle();
        footer.part.restyle();
        sidebarLg.part.restyle();
        sidebarMd.part.restyle();
        main.part.restyle();
        inspector.part.restyle();
        host.screen.render();
      });
      win.describeState(() => {
        const bodyH = Math.max(1, (Number(win.body.height) || 28) - HEADER_H - FOOTER_H);
        return {
          summary: `Responsive Panels — ${mode.toUpperCase()} ${content.height > bodyH ? "scroll" : "fit"}`,
          mode,
          sidebarVisible: true,
          inspectorVisible: mode !== "md",
          sidebarDividerVisible: false,
          inspectorDividerVisible: false,
          sidebarWidth: mode === "lg" ? Number(sidebarLg.node.width) || 0 : Number(sidebarMd.node.width) || 0,
          mainWidth: Number(main.node.width) || 0,
          inspectorWidth: mode !== "md" ? Number(inspector.node.width) || 0 : 0,
          contentHeight: Number(content.height) || 0,
          viewportHeight: bodyH,
          overflowY: (Number(content.height) || 0) > bodyH,
        };
      });
      win.captureText(() => `Responsive Panels\nmode=${mode}\noverflow=${(Number(content.height) || 0) > (Math.max(1, (Number(win.body.height) || 28) - HEADER_H - FOOTER_H))}`);
      win.focus();
    },
  });
}
