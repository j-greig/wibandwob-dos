import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createListPanel,
  createSplitView,
  createScrollView,
  safeDestroyAll,
} from "../../src/services/microapp-sdk.js";
import { DEMOS } from "./demos.js";

/**
 * SDK Showcase — Live terminal design kit.
 *
 * UI shell lives here.
 * Component demo catalogue lives in `demos.ts` for smaller, clearer slices.
 */

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open SDK Showcase",
    description: "Interactive reference for core SDK authoring patterns.",
    action: () => {
      openShowcase(host);
      return { ok: true };
    },
  });
}

function openShowcase(host: MicroappHost) {
  const win = host.createWindow({
    title: "SDK Showcase — Terminal Design Kit",
    width: 90,
    height: 32,
  });
  let isClosing = false;

  const molecules = DEMOS.filter((d) => d.layer === "molecule");
  const organisms = DEMOS.filter((d) => d.layer === "organism");

  const split = createSplitView(win.body, {
    direction: "horizontal",
    ratio: 0.3,
    bottomOffset: 1,
  });

  const componentNames = DEMOS.map((d) => {
    const icon = d.layer === "organism" ? "◈" : "◆";
    return `${icon} ${d.name}`;
  });
  const list = createListPanel(split.first, { items: componentNames });

  const infoBar = createHeaderBar(split.second, {
    left: ` ${DEMOS[0]!.name}`,
    right: `${DEMOS[0]!.layer} `,
  });

  const demoArea = createScrollView(split.second, {
    topOffset: 1,
    content: `  ${DEMOS[0]!.description}`,
  });

  const status = createStatusBar(win.body, {
    left: ` ${DEMOS.length} components │ ${molecules.length} molecules │ ${organisms.length} organisms`,
    right: "↑/↓ browse  Enter preview  q/esc close ",
  });

  let activeDestroy: (() => void) | null = null;
  let activeIndex = 0;

  function normalizeDemoIndex(index: number): number {
    if (DEMOS.length === 0) return 0;
    if (index < 0) return 0;
    if (index >= DEMOS.length) return DEMOS.length - 1;
    return index;
  }

  function showDemo(index: number, opts?: { force?: boolean }) {
    if (isClosing) return;
    const nextIndex = normalizeDemoIndex(index);
    if (!opts?.force && nextIndex === activeIndex && activeDestroy) return;

    if (activeDestroy) {
      try {
        activeDestroy();
      } catch {
        // best-effort when previous demo teardown throws
      }
      activeDestroy = null;
    }

    activeIndex = nextIndex;
    const demo = DEMOS[activeIndex];
    if (!demo) return;

    infoBar.update({ left: ` ${demo.name}`, right: `${demo.layer} ` });
    demoArea.update({ content: `  ${demo.description}\n\n  ── Live Preview ──\n` });
    activeDestroy = demo.build(demoArea.element);
    host.screen.render();
  }

  list.onSelect((index) => {
    if (isClosing) return;
    showDemo(index);
  });
  showDemo(0, { force: true });

  const closeKeys = ["q", "escape"];
  const requestClose = () => {
    if (isClosing) return;
    win.close();
  };
  list.element.key(closeKeys, requestClose);
  demoArea.element.key(closeKeys, requestClose);

  win.setFocusTarget(list.element);

  win.describeState(() => ({
    appType: "wibwob.sdk-showcase",
    componentCount: DEMOS.length,
    activeComponent: DEMOS[activeIndex]?.name,
    activeLayer: DEMOS[activeIndex]?.layer,
    molecules: molecules.length,
    organisms: organisms.length,
  }));

  win.captureText(() =>
    [
      `SDK Showcase — ${DEMOS.length} components`,
      "",
      `Active: ${DEMOS[activeIndex]?.name ?? "none"} (${DEMOS[activeIndex]?.layer})`,
      DEMOS[activeIndex]?.description ?? "",
      "",
      "Components:",
      ...DEMOS.map((d, i) => `  ${i === activeIndex ? "▸" : " "} ${d.name} (${d.layer})`),
    ].join("\n"),
  );

  win.onRestyle(() => {
    if (isClosing) return;
    list.update({ items: componentNames });
    status.update({});
    infoBar.update({});
    showDemo(activeIndex, { force: true });
  });

  win.onCleanup(() => {
    isClosing = true;
    if (activeDestroy) {
      try {
        activeDestroy();
      } catch {
        // best-effort cleanup for demo teardown
      }
    }
    activeDestroy = null;
    safeDestroyAll(list, split, infoBar, demoArea, status);
  });
}
