import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  generateTimeline,
  generateNotifications,
  getTrending,
  getUser,
  formatCount,
  type Tweet,
  type Notification,
  type TabId,
} from "./data.js";
import {
  renderComposePrompt,
  renderNotification,
  renderProfile,
  renderTabBar,
  renderTrending,
  renderTweet,
} from "./renderer.js";

const APP_TITLE = "Symbient Twitter";
const APP_SUMMARY = "Terminal-native social feed simulation";
const TABS: TabId[] = ["home", "explore", "notifications", "profile"];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Open Symbient Twitter — timeline, explore, notifications, profile.",
    menu: [{ category: "applications", order: 160, label: APP_TITLE }],
    palette: { order: 160, label: "Open Symbient Twitter" },
    action: () => {
      const sw = Math.max(80, Number(host.screen.width));
      const sh = Math.max(24, Number(host.screen.height));
      const win = host.createWindow({
        title: APP_TITLE,
        width: sw - 2,
        height: sh - 3,
        left: 0,
        top: 0,
      });

      const root = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        keys: true,
        mouse: true,
        style: host.theme().body,
      });

      const tabBar = blessed.box({
        parent: root,
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        tags: false,
        style: { ...host.theme().header, fg: "black", bg: "cyan" },
      });

      const divider = blessed.box({
        parent: root,
        top: 1,
        left: 0,
        right: 0,
        height: 1,
        content: "─",
        style: host.theme().muted,
      });

      const leftFrame = blessed.box({
        parent: root,
        top: 2,
        left: 0,
        width: "72%",
        bottom: 4,
        border: { type: "line" },
        label: " Feed ",
        style: {
          ...host.theme().body,
          fg: "white",
          bg: "black",
          border: { fg: "green" },
        },
      });

      const rightFrame = blessed.box({
        parent: root,
        top: 2,
        left: "72%",
        right: 0,
        bottom: 4,
        border: { type: "line" },
        label: " Pulse / Trends ",
        style: {
          ...host.theme().body,
          fg: "white",
          bg: "blue",
          border: { fg: "magenta" },
        },
      });

      const mainLeft = blessed.box({
        parent: leftFrame,
        top: 0,
        left: 1,
        right: 1,
        bottom: 0,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        vi: true,
        style: { ...host.theme().body, fg: "white", bg: "black" },
      });

      const mainRight = blessed.box({
        parent: rightFrame,
        top: 0,
        left: 1,
        right: 1,
        bottom: 0,
        style: { ...host.theme().body, fg: "yellow", bg: "blue" },
      });

      const compose = blessed.box({
        parent: root,
        left: 0,
        right: 0,
        bottom: 1,
        height: 3,
        border: { type: "line" },
        label: " Compose ",
        style: { ...host.theme().footer, fg: "white", bg: "magenta", border: { fg: "cyan" } },
      });

      const status = blessed.box({
        parent: root,
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        style: { ...host.theme().footer, fg: "black", bg: "white" },
      });

      let activeTab: TabId = "home";
      let timeline: Tweet[] = generateTimeline();
      let notifications: Notification[] = generateNotifications();
      const trending = getTrending();
      const profileUser = getUser("wib");
      let selectedIndex = 0;
      let lastAction = "ready";

      function currentCollectionSize(): number {
        if (activeTab === "notifications") return notifications.length;
        if (activeTab === "profile") return 1;
        return timeline.length;
      }

      function setTab(tab: TabId): void {
        activeTab = tab;
        selectedIndex = 0;
        lastAction = `tab:${tab}`;
      }

      function moveSelection(delta: number): void {
        const size = currentCollectionSize();
        if (size <= 0) return;
        selectedIndex = clamp(selectedIndex + delta, 0, size - 1);
      }

      function renderLeft(width: number, height: number): string {
        const lines: string[] = [];

        if (activeTab === "profile") {
          lines.push(...renderProfile(profileUser, width));
          return lines.slice(0, height).join("\n");
        }

        if (activeTab === "notifications") {
          const start = clamp(selectedIndex - 1, 0, Math.max(0, notifications.length - 1));
          for (let i = start; i < notifications.length && lines.length < height; i++) {
            lines.push(...renderNotification(notifications[i]!, width));
          }
          return lines.slice(0, height).join("\n");
        }

        const start = clamp(selectedIndex - 1, 0, Math.max(0, timeline.length - 1));
        for (let i = start; i < timeline.length && lines.length < height; i++) {
          lines.push(...renderTweet(timeline[i]!, width, i === selectedIndex));
        }
        return lines.slice(0, height).join("\n");
      }

      function renderRight(width: number, height: number): string {
        const lines: string[] = [];
        if (activeTab === "notifications") {
          lines.push(" Activity tips");
          lines.push("──────────────");
          lines.push(" j/k move focus");
          lines.push(" 1 Home");
          lines.push(" 2 Explore");
          lines.push(" 3 Notifications");
          lines.push(" 4 Profile");
          lines.push("");
          lines.push(` Total: ${notifications.length}`);
          return lines.slice(0, height).join("\n");
        }

        if (activeTab === "profile") {
          lines.push(" Profile stats");
          lines.push("──────────────");
          lines.push(` Followers: ${formatCount(profileUser.followers)}`);
          lines.push(` Following: ${formatCount(profileUser.following)}`);
          lines.push(` Verified: ${profileUser.verified ? "yes" : "no"}`);
          lines.push("");
          lines.push(" Current trends");
          lines.push(...renderTrending(trending.slice(0, 4), width).slice(1));
          return lines.slice(0, height).join("\n");
        }

        lines.push(...renderTrending(trending, width));
        return lines.slice(0, height).join("\n");
      }

      function renderCompose(width: number): string {
        if (activeTab !== "home") {
          return ["─".repeat(width), " Compose disabled outside Home", "─".repeat(width)].join("\n");
        }
        return renderComposePrompt(width).join("\n");
      }

      function renderStatus(width: number): string {
        const base = ` 1:Home 2:Explore 3:Notifs 4:Profile  j/k:move  enter:chirp  q:close  • ${lastAction}`;
        return base.length > width ? base.slice(0, Math.max(0, width - 1)) : base;
      }

      function redraw(): void {
        const leftW = Math.max(20, Number(mainLeft.width) || 20);
        const rightW = Math.max(16, Number(mainRight.width) || 16);
        const mainH = Math.max(6, Number(mainLeft.height) || 6);
        const composeW = Math.max(20, Number(compose.width) || 20);
        const statusW = Math.max(20, Number(status.width) || 20);

        leftFrame.setLabel(` Feed • ${activeTab.toUpperCase()} `);
        rightFrame.setLabel(" Sidebar • Trends ");
        tabBar.setContent(`◉ ${renderTabBar(activeTab, Math.max(10, Number(tabBar.width) || 10))}`);
        divider.setContent("─".repeat(Math.max(2, Number(divider.width) || 2)));
        mainLeft.setContent(renderLeft(leftW, mainH));
        mainRight.setContent(renderRight(rightW, mainH));
        compose.setContent(renderCompose(composeW));
        status.setContent(renderStatus(statusW));
        host.screen.render();
      }

      function postChirp(): void {
        const id = `local-${Date.now()}`;
        const text = `live from ${APP_TITLE.toLowerCase()}: ${new Date().toLocaleTimeString()}`;
        timeline = [
          {
            id,
            author: "wib",
            text,
            timestamp: "now",
            likes: 0,
            retweets: 0,
            replies: 0,
            bookmarks: 0,
            hashtags: ["live", "symbient"],
          },
          ...timeline,
        ];
        selectedIndex = 0;
        lastAction = "posted chirp";
      }

      const keySurfaces = [root, mainLeft, mainRight, compose, status, leftFrame, rightFrame];
      const bindKeys = (keys: string | string[], fn: () => void) => {
        for (const node of keySurfaces) {
          node.key(keys as any, fn);
        }
      };

      bindKeys(["1"], () => { setTab("home"); redraw(); });
      bindKeys(["2"], () => { setTab("explore"); redraw(); });
      bindKeys(["3"], () => { setTab("notifications"); redraw(); });
      bindKeys(["4"], () => { setTab("profile"); redraw(); });
      bindKeys(["j", "down"], () => { moveSelection(1); redraw(); });
      bindKeys(["k", "up"], () => { moveSelection(-1); redraw(); });
      bindKeys(["enter"], () => {
        if (activeTab === "home") {
          postChirp();
        } else {
          lastAction = `enter on ${activeTab}`;
        }
        redraw();
      });
      bindKeys(["q"], () => win.close());

      win.onInput((input) => {
        const text = input.trim();
        if (!text) return;
        timeline = [
          {
            id: `api-${Date.now()}`,
            author: "wob",
            text,
            timestamp: "now",
            likes: 0,
            retweets: 0,
            replies: 0,
            bookmarks: 0,
            hashtags: ["api"],
          },
          ...timeline,
        ];
        selectedIndex = 0;
        activeTab = "home";
        lastAction = "api chirp received";
        redraw();
      });

      win.describeState(() => ({
        summary: `${APP_SUMMARY} — ${activeTab} tab`,
        activeTab,
        selectedIndex,
        timelineCount: timeline.length,
        notificationsCount: notifications.length,
        topTweetAuthor: timeline[0]?.author,
        topTweetPreview: timeline[0]?.text?.slice(0, 72) ?? "",
        contentPreview: `${activeTab} :: ${lastAction}`,
      }));

      win.captureText(() => {
        return [
          tabBar.getContent(),
          mainLeft.getContent(),
          mainRight.getContent(),
          compose.getContent(),
          status.getContent(),
        ].join("\n");
      });

      win.onRestyle(() => {
        root.style = host.theme().body;
        tabBar.style = { ...host.theme().header, fg: "black", bg: "cyan" };
        divider.style = host.theme().muted;
        leftFrame.style = { ...host.theme().body, fg: "white", bg: "black", border: { fg: "green" } };
        rightFrame.style = { ...host.theme().body, fg: "white", bg: "blue", border: { fg: "magenta" } };
        mainLeft.style = { ...host.theme().body, fg: "white", bg: "black" };
        mainRight.style = { ...host.theme().body, fg: "yellow", bg: "blue" };
        compose.style = { ...host.theme().footer, fg: "white", bg: "magenta", border: { fg: "cyan" } };
        status.style = { ...host.theme().footer, fg: "black", bg: "white" };
        redraw();
      });

      win.onResize(() => redraw());
      win.onCleanup(() => {
        // no timers/resources to clear in this version
      });

      win.setFocusTarget(mainLeft);
      redraw();
      win.focus();
      mainLeft.focus();
    },
  });
}
