import blessed from "blessed";
import {
  createMicroappTheme,
  type MicroappHost,
} from "../../src/services/microapp-sdk.js";

const CANARY_TITLE = "Runtime Reload Canary";
const CANARY_VARIANT = "greenfield";
const CANARY_PREVIEW = "runtime reload canary";
const CANARY_SUMMARY = "Runtime reload canary — greenfield reload proof.";
const CANARY_BODY_LINE = "greenfield microapp";
const CANARY_COLOR = "white";
const CANARY_BACKGROUND = "black";
const CANARY_ACCENT_COLOR = "black";
const CANARY_ACCENT_BACKGROUND = "yellow";

const CANARY_BANNER = [
  "runtime reload canary",
  "",
  CANARY_BODY_LINE,
  "one window, one command, one state path",
].join("\n");

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open Runtime Reload Canary",
    description: "Open the greenfield runtime reload canary microapp.",
    menu: [{ category: "applications", order: 46, label: "Runtime Reload Canary" }],
    palette: { order: 216, label: "Runtime Reload Canary" },
    action: () => {
      const appTheme = createMicroappTheme(host, {
        color: CANARY_COLOR,
        background: CANARY_BACKGROUND,
        accentColor: CANARY_ACCENT_COLOR,
        accentBackground: CANARY_ACCENT_BACKGROUND,
      });

      const win = host.createWindow({
        title: CANARY_TITLE,
        width: 42,
        height: 11,
        left: 10,
        top: 4,
      });

      const content = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: false,
        content: CANARY_BANNER,
        style: appTheme.body,
      });

      const badge = blessed.box({
        parent: win.body,
        top: 0,
        right: 1,
        height: 1,
        width: 12,
        content: ` ${CANARY_VARIANT} `,
        style: appTheme.accent,
      });

      win.describeState(() => ({
        summary: CANARY_SUMMARY,
        contentPreview: CANARY_PREVIEW,
        variant: CANARY_VARIANT,
        color: CANARY_COLOR,
        background: CANARY_BACKGROUND,
      }));

      win.captureText(() => CANARY_BANNER);

      win.onRestyle(() => {
        const nextTheme = createMicroappTheme(host, {
          color: CANARY_COLOR,
          background: CANARY_BACKGROUND,
          accentColor: CANARY_ACCENT_COLOR,
          accentBackground: CANARY_ACCENT_BACKGROUND,
        });
        content.style = nextTheme.body;
        badge.style = nextTheme.accent;
      });

      win.focus();
    },
  });
}
