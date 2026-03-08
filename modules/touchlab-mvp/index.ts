import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

type NodeId = "gen" | "text" | "avatar" | "mix";

type NestedNode = {
  id: NodeId;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  frame: blessed.Widgets.BoxElement;
  titleBar: blessed.Widgets.BoxElement;
  content: blessed.Widgets.BoxElement;
};

const SOURCE_TEXT = [
  "signal patch",
  "terminal garden",
  "world chat drift",
  "modular moon",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function blankGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
}

function gridToText(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("\n");
}

function waveSource(width: number, height: number, phase: number): string {
  const grid = blankGrid(width, height);
  for (let x = 0; x < width; x += 1) {
    const y = Math.floor((Math.sin((x + phase) / 2.8) + 1) * 0.5 * Math.max(0, height - 1));
    grid[y]![x] = x % 2 === 0 ? "~" : "^";
  }
  return gridToText(grid);
}

function textSource(width: number, height: number, phase: number): string {
  const word = SOURCE_TEXT[phase % SOURCE_TEXT.length] ?? "signal";
  const lines = blankGrid(width, height).map((row) => row.join(""));
  const centered = word.slice(0, width);
  const top = Math.floor(height / 2);
  lines[top] = centered.padEnd(width, " ");
  if (top + 1 < height) {
    lines[top + 1] = `${phase}`.padEnd(width, " ");
  }
  return lines.join("\n");
}

function avatarSource(width: number, height: number, phase: number): string {
  const grid = blankGrid(width, height);
  const x = clamp((phase * 2) % Math.max(1, width - 2), 0, Math.max(0, width - 2));
  const y = clamp(Math.floor(height / 2), 0, Math.max(0, height - 1));
  const face = [":", ")", " "];
  for (let i = 0; i < face.length && x + i < width; i += 1) {
    grid[y]![x + i] = face[i]!;
  }
  return gridToText(grid);
}

function composite(width: number, height: number, layers: string[]): string {
  const grid = blankGrid(width, height);
  for (const layer of layers) {
    const rows = layer.split("\n");
    for (let y = 0; y < Math.min(height, rows.length); y += 1) {
      const row = rows[y] ?? "";
      for (let x = 0; x < Math.min(width, row.length); x += 1) {
        const ch = row[x];
        if (ch && ch !== " ") {
          grid[y]![x] = ch;
        }
      }
    }
  }
  return gridToText(grid);
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open TouchLab MVP",
    description: "Open the minimal nested-window composition proof.",
    menu: [{ category: "applications", order: 48, label: "TouchLab MVP" }],
    palette: { order: 218, label: "TouchLab MVP" },
    action: () => {
      const win = host.createWindow({
        title: "TouchLab MVP",
        width: 96,
        height: 34,
        left: 6,
        top: 2,
      });

      const theme = () => ({
        body: {
          ...host.theme().body,
          fg: "white",
          bg: "black",
        },
        accent: {
          ...host.theme().selected,
          fg: "black",
          bg: "cyan",
        },
        borderFg: "magenta",
      });

      const canvas = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: false,
        style: theme().body,
      });

      const nodes = new Map<NodeId, NestedNode>();
      let phase = 0;
      let selectedNode: NodeId = "gen";
      let dragging:
        | { id: NodeId; offsetX: number; offsetY: number }
        | undefined;

      const config: Array<Pick<NestedNode, "id" | "title" | "x" | "y" | "w" | "h" | "z">> = [
        { id: "gen", title: "GEN A", x: 2, y: 1, w: 26, h: 9, z: 0 },
        { id: "text", title: "TEXT B", x: 34, y: 2, w: 24, h: 8, z: 1 },
        { id: "avatar", title: "AVATAR C", x: 12, y: 12, w: 18, h: 7, z: 2 },
        { id: "mix", title: "MIX D", x: 40, y: 12, w: 34, h: 12, z: 3 },
      ];

      for (const item of config) {
        const frame = blessed.box({
          parent: canvas,
          border: "line",
          style: {
            ...theme().body,
            border: { fg: theme().borderFg },
          },
        });
        const titleBar = blessed.box({
          parent: frame,
          top: 0,
          left: 1,
          right: 1,
          height: 1,
          tags: false,
          style: theme().accent,
          content: ` ${item.title} `,
        });
        const content = blessed.box({
          parent: frame,
          top: 1,
          left: 1,
          right: 1,
          bottom: 1,
          tags: false,
          style: theme().body,
        });
        nodes.set(item.id, { ...item, frame, titleBar, content });
      }

      const orderNodes = () => {
        [...nodes.values()]
          .sort((a, b) => a.z - b.z)
          .forEach((node) => node.frame.setFront());
      };

      const renderNodes = () => {
        const bodyWidth = Math.max(1, Number(canvas.width) || 0);
        const bodyHeight = Math.max(1, Number(canvas.height) || 0);
        const gen = waveSource(24, 6, phase);
        const text = textSource(22, 5, phase);
        const avatar = avatarSource(14, 4, phase);
        const mix = composite(30, 8, [gen, text, avatar]);

        for (const node of nodes.values()) {
          node.frame.left = clamp(node.x, 0, Math.max(0, bodyWidth - node.w));
          node.frame.top = clamp(node.y, 0, Math.max(0, bodyHeight - node.h));
          node.frame.width = node.w;
          node.frame.height = node.h;
          node.titleBar.setContent(`${selectedNode === node.id ? "●" : " "} ${node.title} `);
          node.titleBar.style = selectedNode === node.id
            ? { ...theme().accent, fg: "black", bg: "yellow" }
            : theme().accent;
        }

        nodes.get("gen")?.content.setContent(gen);
        nodes.get("text")?.content.setContent(text);
        nodes.get("avatar")?.content.setContent(avatar);
        nodes.get("mix")?.content.setContent(mix);
        orderNodes();
      };

      const bringToFront = (id: NodeId) => {
        const topZ = Math.max(...[...nodes.values()].map((node) => node.z));
        const node = nodes.get(id);
        if (!node) return;
        selectedNode = id;
        node.z = topZ + 1;
        orderNodes();
      };

      const moveSelected = (dx: number, dy: number) => {
        const node = nodes.get(selectedNode);
        if (!node || node.id === "mix") return;
        node.x += dx;
        node.y += dy;
        renderNodes();
        host.screen.render();
      };

      const pointerToCanvas = (data: blessed.Widgets.Events.IMouseEventArg) => {
        const lpos = canvas.lpos;
        if (!lpos) return undefined;
        return {
          x: data.x - lpos.xi,
          y: data.y - lpos.yi,
        };
      };

      for (const node of nodes.values()) {
        node.titleBar.on("mousedown", (data) => {
          const point = pointerToCanvas(data);
          if (!point) return;
          dragging = {
            id: node.id,
            offsetX: point.x - node.x,
            offsetY: point.y - node.y,
          };
          bringToFront(node.id);
        });
      }

      const onMouseMove = (data: blessed.Widgets.Events.IMouseEventArg) => {
        if (!dragging) return;
        const node = nodes.get(dragging.id);
        const point = pointerToCanvas(data);
        if (!node || !point) return;
        node.x = point.x - dragging.offsetX;
        node.y = point.y - dragging.offsetY;
        renderNodes();
        host.screen.render();
      };

      const stopDragging = () => {
        dragging = undefined;
      };

      host.screen.on("mousemove", onMouseMove);
      host.screen.on("mouseup", stopDragging);

      win.onInput((input) => {
        if (input === "1") selectedNode = "gen";
        if (input === "2") selectedNode = "text";
        if (input === "3") selectedNode = "avatar";
        if (input === "4") selectedNode = "mix";
        if (input === "h") moveSelected(-1, 0);
        if (input === "j") moveSelected(0, 1);
        if (input === "k") moveSelected(0, -1);
        if (input === "l") moveSelected(1, 0);
        renderNodes();
        host.screen.render();
      });

      const timer = setInterval(() => {
        phase = (phase + 1) % 9999;
        renderNodes();
        host.screen.render();
      }, 500);

      win.describeState(() => ({
        summary: "TouchLab MVP — 3 sources feeding one composite.",
        contentPreview: "nested drag + composite ascii pipeline",
        selectedNode,
        pipeline: ["gen", "text", "avatar", "mix"],
        nodes: [...nodes.values()].map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
        })),
      }));

      win.captureText(() => {
        const mix = nodes.get("mix")?.content.getContent() ?? "";
        return `TouchLab MVP\n\n${mix}`;
      });

      win.onRestyle(() => {
        const next = theme();
        canvas.style = next.body;
        for (const node of nodes.values()) {
          node.frame.style = {
            ...next.body,
            border: { fg: next.borderFg },
          };
          node.titleBar.style = next.accent;
          node.content.style = next.body;
        }
      });

      win.onResize(() => {
        renderNodes();
      });

      win.onCleanup(() => {
        clearInterval(timer);
        host.screen.off("mousemove", onMouseMove);
        host.screen.off("mouseup", stopDragging);
      });

      renderNodes();
      win.focus();
    },
  });
}
