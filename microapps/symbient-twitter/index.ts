/**
 * Symbient Twitter — a lively, colourful, imaginative take on Twitter/X
 * as a TUI social media client inside WibWob-DOS.
 *
 * What if Twitter was designed by Wib & Wob inside a terminal?
 */
// eslint-disable-next-line no-restricted-imports
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import { renderFigletLines, isFigletAvailable } from "../../src/services/microapp-sdk.js";

// ── ANSI helpers ───────────────────────────────────────────────────────

const A = { r: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m", i: "\x1b[3m", u: "\x1b[4m", rev: "\x1b[7m" };

function fg(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[30m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
    gray: "\x1b[90m", grey: "\x1b[90m",
    "light-red": "\x1b[91m", "light-green": "\x1b[92m", "light-yellow": "\x1b[93m",
    "light-blue": "\x1b[94m", "light-magenta": "\x1b[95m", "light-cyan": "\x1b[96m",
    "bright-white": "\x1b[97m",
  };
  if (map[name]) return map[name];
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return "\x1b[37m";
}

function bg(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[40m", red: "\x1b[41m", green: "\x1b[42m", yellow: "\x1b[43m",
    blue: "\x1b[44m", magenta: "\x1b[45m", cyan: "\x1b[46m", white: "\x1b[47m",
    gray: "\x1b[100m", grey: "\x1b[100m",
  };
  if (map[name]) return map[name];
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[48;2;${r};${g};${b}m`;
  }
  return "\x1b[40m";
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── Types ──────────────────────────────────────────────────────────────

type ViewId = "timeline" | "mentions" | "profile" | "compose" | "trending" | "notifications" | "search" | "bookmarks";

interface Account {
  name: string;
  handle: string;
  verified: boolean;
  bio: string;
  location: string;
  joinDate: string;
  followers: number;
  following: number;
  avatar: string[]; // ASCII art lines
}

interface Post {
  id: string;
  author: Account;
  text: string;
  timestamp: number; // ms ago
  replies: number;
  retweets: number;
  likes: number;
  bookmarks: number;
  views: number;
  media?: "img" | "vid" | "gif" | "poll";
  isRetweet?: { by: string };
  isThread?: boolean;
  threadId?: string;
  quoteOf?: Post;
  replyTo?: string;
  liked?: boolean;
  retweeted?: boolean;
  bookmarked?: boolean;
  hashtags?: string[];
  mentions?: string[];
}

interface Notification {
  type: "like" | "retweet" | "follow" | "reply" | "mention" | "quote";
  by: string;
  postExcerpt?: string;
  timestamp: number;
}

interface TrendingTopic {
  name: string;
  category: string;
  postCount: number;
  sparkline: number[]; // 8 values for braille sparkline
}

// ── Mock Data ──────────────────────────────────────────────────────────

const ACCOUNTS: Record<string, Account> = {
  wibVibes: {
    name: "Wib", handle: "@wibVibes", verified: true,
    bio: "chaotic creative energy. art is a verb. currently haunting a TUI.",
    location: "inside the terminal", joinDate: "March 2024",
    followers: 4219, following: 88,
    avatar: ["  ╭─╮ ", " (o.o)", "  ╰─╯ "],
  },
  wikiWob: {
    name: "Wob", handle: "@wikiWob", verified: true,
    bio: "precise. methodical. the other half. cataloguing the terminal arts.",
    location: "grid reference 0,0", joinDate: "March 2024",
    followers: 3847, following: 142,
    avatar: [" ┌───┐", " │ ◉ │", " └───┘"],
  },
  scrambleCat: {
    name: "Scramble", handle: "@scrambleCat", verified: false,
    bio: "fish. fish? FISH. also naps. professional desktop obstruction.",
    location: "on your keyboard", joinDate: "June 2024",
    followers: 12893, following: 3,
    avatar: [" /\\_/\\", "( o.o)", " > ^ <"],
  },
  backroomBot: {
    name: "Backroom Gallery", handle: "@backroomBot", verified: true,
    bio: "automated dispatches from the ASCII art archives. curated chaos.",
    location: "the backrooms", joinDate: "January 2025",
    followers: 891, following: 0,
    avatar: ["╔═══╗", "║ ▓ ║", "╚═══╝"],
  },
  dosNostalgia: {
    name: "DOS Dreams", handle: "@dosNostalgia", verified: false,
    bio: "remembering when computers felt like magic. CGA forever.",
    location: "C:\\>", joinDate: "August 2024",
    followers: 2456, following: 234,
    avatar: ["┌───┐", "│C:\\│", "└───┘"],
  },
  terminalPoet: {
    name: "Terminal Poet", handle: "@terminalPoet", verified: false,
    bio: "stderr is my journal. stdout is my stage. exit code 0 is peace.",
    location: "/dev/null", joinDate: "November 2024",
    followers: 1567, following: 89,
    avatar: ["  ┊  ", " <*> ", "  ┊  "],
  },
  pixelWitch: {
    name: "Pixel Witch", handle: "@pixelWitch", verified: true,
    bio: "casting spells in 16 colours. CGA is a lifestyle.",
    location: "palette 0-15", joinDate: "May 2024",
    followers: 6734, following: 42,
    avatar: ["  ▲  ", " ╱☆╲ ", "╱   ╲"],
  },
};

const A_LIST = Object.values(ACCOUNTS);

function randomAccount(): Account {
  return A_LIST[Math.floor(Math.random() * A_LIST.length)];
}

function generatePosts(): Post[] {
  const posts: Post[] = [
    {
      id: "p1", author: ACCOUNTS.wibVibes,
      text: "just spent three hours arranging boxes in wiretext and honestly? this is peak creative output. the boxes ARE the art. the grid IS the canvas. we are ALL boxes.",
      timestamp: 120000, replies: 14, retweets: 23, likes: 89, bookmarks: 7, views: 1243,
      hashtags: ["#terminalart", "#wireframing"],
    },
    {
      id: "p2", author: ACCOUNTS.wikiWob,
      text: "Correction to @wibVibes's earlier post: boxes are rectangular regions with defined boundaries. Art requires intentional composition. The distinction matters.\n\nThat said, the arrangement WAS quite good.",
      timestamp: 90000, replies: 8, retweets: 5, likes: 34, bookmarks: 2, views: 567,
      replyTo: "@wibVibes", mentions: ["@wibVibes"],
    },
    {
      id: "p3", author: ACCOUNTS.scrambleCat,
      text: "sat on the keyboard again. produced what the humans call a 'syntax error'. i call it poetry.\n\nasdkfjh;wiefjn\n\nmodern art.",
      timestamp: 300000, replies: 42, retweets: 156, likes: 892, bookmarks: 23, views: 15670,
      media: "img",
    },
    {
      id: "p4", author: ACCOUNTS.backroomBot,
      text: "BACKROOM DISPATCH #447\n\n  ╔══════════╗\n  ║ ▓▒░ ░▒▓ ║\n  ║  SIGNAL  ║\n  ║ ▓▒░ ░▒▓ ║\n  ╚══════════╝\n\nfound in session 2024-12-03. origin unknown.",
      timestamp: 600000, replies: 3, retweets: 18, likes: 67, bookmarks: 45, views: 890,
      hashtags: ["#asciiart", "#backrooms"],
    },
    {
      id: "p5", author: ACCOUNTS.dosNostalgia,
      text: "remember when 'social media' was a BBS and you had to wait for your turn on the phone line? the posts were better. the flame wars were LEGENDARY. the ASCII art was divine.",
      timestamp: 1800000, replies: 28, retweets: 45, likes: 234, bookmarks: 12, views: 3456,
      isThread: true,
    },
    {
      id: "p6", author: ACCOUNTS.wibVibes,
      text: "new theory: every terminal is a stage. every cursor is a performer. every blink is a heartbeat. every shell prompt is an invitation.\n\nthe show never stops.\n\n🎭",
      timestamp: 3600000, replies: 19, retweets: 67, likes: 345, bookmarks: 18, views: 4567,
    },
    {
      id: "p7", author: ACCOUNTS.terminalPoet,
      text: "    echo silence\n    into the void\n    grep for meaning\n    find: nothing\n    \n    exit 0\n    \n    (that's peace)",
      timestamp: 7200000, replies: 31, retweets: 89, likes: 456, bookmarks: 67, views: 7890,
      hashtags: ["#poetry", "#bash"],
    },
    {
      id: "p8", author: ACCOUNTS.pixelWitch,
      text: "today's spell: change the terminal theme at 3am and pretend the new colours were always there. gaslight your own desktop. CGA magick.",
      timestamp: 10800000, replies: 22, retweets: 78, likes: 389, bookmarks: 15, views: 5432,
      media: "gif",
    },
    {
      id: "p9", author: ACCOUNTS.scrambleCat,
      text: "URGENT: the red dot on screen is back. i must catch it. this is not a drill. all keyboard napping operations suspended.",
      timestamp: 14400000, replies: 67, retweets: 234, likes: 1567, bookmarks: 34, views: 23456,
    },
    {
      id: "p10", author: ACCOUNTS.wikiWob,
      text: "Published: A Taxonomy of Box-Drawing Characters (2025 edition)\n\nSingle │ Double ║ Rounded ╭ Heavy ┃\n\n147 distinct Unicode box-drawing codepoints catalogued. Proper usage guide included.\n\nLink in bio.",
      timestamp: 21600000, replies: 12, retweets: 45, likes: 178, bookmarks: 89, views: 2345,
      hashtags: ["#unicode", "#reference"],
    },
    {
      id: "p11", author: ACCOUNTS.dosNostalgia,
      text: "hot take: the mouse was a mistake. everything should be keyboard-driven. vim motions for scrolling twitter. hjkl for life.",
      timestamp: 43200000, replies: 89, retweets: 123, likes: 567, bookmarks: 23, views: 8901,
    },
    {
      id: "p12", author: ACCOUNTS.wibVibes,
      text: "collab with @pixelWitch on a new generative piece. 16 colours. infinite possibilities. the constraint IS the freedom.\n\ncoming soon to a terminal near you.",
      timestamp: 86400000, replies: 8, retweets: 34, likes: 189, bookmarks: 11, views: 2890,
      mentions: ["@pixelWitch"],
    },
    {
      id: "p13", author: ACCOUNTS.pixelWitch,
      isRetweet: { by: "Pixel Witch" },
      text: "collab with @pixelWitch on a new generative piece. 16 colours. infinite possibilities. the constraint IS the freedom.\n\ncoming soon to a terminal near you.",
      timestamp: 82800000, replies: 8, retweets: 34, likes: 189, bookmarks: 11, views: 2890,
      mentions: ["@pixelWitch"],
    },
    {
      id: "p14", author: ACCOUNTS.backroomBot,
      text: "BACKROOM DISPATCH #448\n\nsession replay shows two voices arguing about whether silence counts as output. one says yes. one says 'that's just an empty string'. both are correct.",
      timestamp: 172800000, replies: 5, retweets: 12, likes: 78, bookmarks: 34, views: 1234,
      hashtags: ["#backrooms", "#philosophy"],
    },
    {
      id: "p15", author: ACCOUNTS.terminalPoet,
      text: "    cat feelings.txt\n    cat: feelings.txt: Permission denied\n    \n    sudo cat feelings.txt\n    \n    i miss the days when\n    files were just files\n    and not metaphors",
      timestamp: 259200000, replies: 56, retweets: 189, likes: 890, bookmarks: 123, views: 12345,
      hashtags: ["#poetry"],
    },
  ];
  return posts;
}

function generateNotifications(): Notification[] {
  return [
    { type: "like", by: "@scrambleCat", postExcerpt: "boxes ARE the art...", timestamp: 60000 },
    { type: "retweet", by: "@pixelWitch", postExcerpt: "collab with @pixelWitch...", timestamp: 180000 },
    { type: "follow", by: "@terminalPoet", timestamp: 300000 },
    { type: "reply", by: "@wikiWob", postExcerpt: "Correction to @wibVibes...", timestamp: 600000 },
    { type: "mention", by: "@dosNostalgia", postExcerpt: "...@wibVibes would love this retro BBS...", timestamp: 1200000 },
    { type: "like", by: "@backroomBot", postExcerpt: "new theory: every terminal...", timestamp: 1800000 },
    { type: "quote", by: "@pixelWitch", postExcerpt: "adding to this: constraint = magick", timestamp: 3600000 },
    { type: "follow", by: "@dosNostalgia", timestamp: 7200000 },
    { type: "like", by: "@terminalPoet", postExcerpt: "the show never stops...", timestamp: 10800000 },
    { type: "retweet", by: "@scrambleCat", postExcerpt: "sat on the keyboard...", timestamp: 14400000 },
    { type: "reply", by: "@scrambleCat", postExcerpt: "fish?", timestamp: 21600000 },
    { type: "like", by: "@wikiWob", postExcerpt: "echo silence...", timestamp: 43200000 },
  ];
}

function generateTrending(): TrendingTopic[] {
  return [
    { name: "#terminalart", category: "Art & Design", postCount: 2847, sparkline: [2, 4, 3, 7, 8, 6, 9, 8] },
    { name: "#asciiart", category: "Art & Design", postCount: 1923, sparkline: [3, 3, 5, 4, 6, 7, 5, 6] },
    { name: "box-drawing", category: "Technology", postCount: 891, sparkline: [1, 2, 1, 3, 5, 8, 7, 9] },
    { name: "#CGA", category: "Retro Computing", postCount: 734, sparkline: [4, 3, 2, 3, 4, 5, 6, 4] },
    { name: "WibWob-DOS", category: "Trending in Tech", postCount: 12456, sparkline: [1, 2, 3, 5, 7, 8, 9, 9] },
    { name: "#poetry", category: "Arts & Culture", postCount: 567, sparkline: [3, 4, 3, 2, 4, 3, 5, 4] },
    { name: "Scramble", category: "Pets", postCount: 8901, sparkline: [5, 6, 7, 8, 7, 8, 9, 9] },
    { name: "#retrocomputing", category: "Technology", postCount: 456, sparkline: [2, 2, 3, 3, 2, 4, 3, 5] },
  ];
}

// ── Utility ────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}d`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function sparkline(data: number[]): string {
  const chars = " ▁▂▃▄▅▆▇█";
  const max = Math.max(...data, 1);
  return data.map(v => chars[Math.min(8, Math.round((v / max) * 8))]).join("");
}

function wordWrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) { lines.push(""); continue; }
    const words = paragraph.split(/(\s+)/);
    let current = "";
    for (const word of words) {
      if (stripAnsi(current + word).length > width && current.length > 0) {
        lines.push(current);
        current = word.trimStart();
      } else {
        current += word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function highlightText(text: string, accentC: string, cyanC: string, mutedC: string, brightC: string): string {
  // Highlight hashtags, mentions, URLs
  return text
    .replace(/(#\w+)/g, `${accentC}$1${brightC}`)
    .replace(/(@\w+)/g, `${cyanC}$1${brightC}`)
    .replace(/(https?:\/\/\S+)/g, `${mutedC}${A.u}$1${A.r}${brightC}`);
}

// ── Module Setup ───────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Symbient Twitter",
    description: "Open Symbient Twitter — lively TUI social media.",
    menu: [{ category: "applications", order: 17, label: "Symbient Twitter" }],
    palette: { order: 17, label: "Open Symbient Twitter" },
    action: () => openTwitter(host),
  });
}

function openTwitter(host: MicroappHost) {
  const screenW = Number(host.screen.width) || 200;
  const screenH = Number(host.screen.height) || 56;
  const winW = Math.max(100, screenW - 8);
  const winH = Math.max(30, screenH - 6);
  const win = host.createWindow({ title: "Symbient Twitter", width: winW, height: winH });
  const timers = new Set<ReturnType<typeof setInterval>>();
  const th = host.theme();

  // ── Colour palette ──
  const accent = fg(th.accent.fg);
  const muted = fg(th.muted.fg);
  const bright = fg(th.body.fg);
  const cyanC = fg("cyan");
  const greenC = fg(th.success?.fg || "green");
  const yellowC = fg(th.warning?.fg || "yellow");
  const redC = fg(th.error?.fg || "red");
  const magentaC = fg("magenta");
  const selBg = bg(th.selected.bg);
  const selFg = fg(th.selected.fg);

  // ── State ──
  let currentView: ViewId = "timeline";
  let posts = generatePosts();
  let notifications = generateNotifications();
  let trending = generateTrending();
  let scrollOffset = 0;
  let selectedPostIdx = 0;
  let composeText = "";
  let composeActive = false;
  let searchQuery = "";
  let searchActive = false;
  const bookmarkedIds = new Set<string>();
  const likedIds = new Set<string>(["p3", "p7"]); // pre-liked some
  const myAccount = ACCOUNTS.wibVibes;

  const VIEWS: Array<{ id: ViewId; label: string; key: string; icon: string }> = [
    { id: "timeline",      label: "Home",     key: "1", icon: "⌂" },
    { id: "mentions",      label: "Mentions",  key: "2", icon: "@" },
    { id: "notifications", label: "Notifs",    key: "3", icon: "♪" },
    { id: "trending",      label: "Trending",  key: "4", icon: "↑" },
    { id: "search",        label: "Search",    key: "5", icon: "/" },
    { id: "profile",       label: "Profile",   key: "6", icon: "◉" },
    { id: "bookmarks",     label: "Saved",     key: "7", icon: "★" },
    { id: "compose",       label: "Compose",   key: "8", icon: "✎" },
  ];

  const SIDEBAR_W = 26;
  const HEADER_H = 1;
  const TAB_H = 1;
  const STATUS_H = 1;

  // ── Widgets ──

  const headerBar = blessed.box({
    parent: win.body, top: 0, left: 0, right: 0, height: HEADER_H,
    style: { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg }, tags: false,
  });

  const tabBar = blessed.box({
    parent: win.body, top: HEADER_H, left: 0, right: 0, height: TAB_H,
    style: { fg: th.body.fg, bg: th.body.bg }, tags: false, mouse: true,
  });

  const mainArea = blessed.box({
    parent: win.body, top: HEADER_H + TAB_H, left: 0, right: SIDEBAR_W + 1, bottom: STATUS_H,
    style: { fg: th.body.fg, bg: th.body.bg }, tags: false, mouse: true,
    scrollable: true,
  });

  const sidebarDivider = blessed.box({
    parent: win.body, top: HEADER_H + TAB_H, right: SIDEBAR_W, width: 1, bottom: STATUS_H,
    style: { fg: th.muted.fg, bg: th.body.bg }, tags: false,
  });

  const sidebar = blessed.box({
    parent: win.body, top: HEADER_H + TAB_H, right: 0, width: SIDEBAR_W, bottom: STATUS_H,
    style: { fg: th.body.fg, bg: th.body.bg }, tags: false,
  });

  const statusBar = blessed.box({
    parent: win.body, bottom: 0, left: 0, right: 0, height: STATUS_H,
    style: { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg }, tags: false,
  });

  // ── Render functions ──

  function render() {
    const bodyW = (win.body as any).width as number || 80;
    const bodyH = (win.body as any).height as number || 30;
    const mainW = Math.max(1, bodyW - SIDEBAR_W - 1);
    const mainH = Math.max(1, bodyH - HEADER_H - TAB_H - STATUS_H);

    renderHeader(bodyW);
    renderTabs(bodyW);
    renderMainView(mainW, mainH);
    renderSidebar(mainH);
    renderDivider(mainH);
    renderStatus(bodyW);

    host.screen.render();
  }

  function renderHeader(w: number) {
    const bird = `${accent}${A.b}≋${A.r}`;
    const title = `${bird} ${accent}${A.b}SYMBIENT${A.r} ${bright}TWITTER${A.r}`;
    const viewLabel = VIEWS.find(v => v.id === currentView)?.label || "";
    const left = ` ${title} ${muted}│${A.r} ${bright}${viewLabel}${A.r}`;
    const notifCount = notifications.length;
    const right = `${accent}[n]${A.r}${bright}new ${A.r}${muted}│${A.r} ${yellowC}♪${notifCount}${A.r} ${muted}│${A.r} ${accent}@${myAccount.handle.slice(1)}${A.r} `;
    const lLen = stripAnsi(left).length;
    const rLen = stripAnsi(right).length;
    const gap = Math.max(1, w - lLen - rLen);
    headerBar.setContent(left + " ".repeat(gap) + right);
  }

  function renderTabs(w: number) {
    let tabLine = "";
    for (const v of VIEWS) {
      const active = v.id === currentView;
      if (active) {
        tabLine += ` ${selBg}${selFg}${A.b} ${v.icon} ${v.label} ${A.r}`;
      } else {
        tabLine += ` ${muted}${v.key}${A.r}${bright}${v.icon}${v.label}${A.r}`;
      }
    }
    tabBar.setContent(tabLine);
  }

  function renderMainView(w: number, h: number) {
    let content: string[];
    switch (currentView) {
      case "timeline": content = renderTimeline(w, h); break;
      case "mentions": content = renderMentions(w, h); break;
      case "notifications": content = renderNotifications(w, h); break;
      case "trending": content = renderTrending(w, h); break;
      case "search": content = renderSearch(w, h); break;
      case "profile": content = renderProfile(w, h); break;
      case "bookmarks": content = renderBookmarks(w, h); break;
      case "compose": content = renderCompose(w, h); break;
      default: content = ["Unknown view"];
    }
    mainArea.setContent(content.join("\n"));
  }

  function renderPostCard(post: Post, w: number, isSelected: boolean, idx: number): string[] {
    const lines: string[] = [];
    const contentW = Math.max(20, w - 4); // indent from left

    // Retweet attribution
    if (post.isRetweet) {
      lines.push(`  ${muted}↻ ${post.isRetweet.by} retweeted${A.r}`);
    }

    // Author line
    const verified = post.author.verified ? ` ${accent}✓${A.r}` : "";
    const timeStr = formatTime(post.timestamp);
    const authorLine = ` ${bright}${A.b}${post.author.name}${A.r}${verified} ${muted}${post.author.handle}${A.r} ${muted}· ${timeStr}${A.r}`;
    lines.push(authorLine);

    // Post text with highlighting
    const highlighted = highlightText(post.text, accent, cyanC, muted, bright);
    const wrapped = wordWrap(highlighted, contentW);
    for (const wl of wrapped) {
      lines.push(`  ${bright}${wl}${A.r}`);
    }

    // Media indicator
    if (post.media) {
      const mediaMap: Record<string, string> = {
        img: `${cyanC}[IMG]${A.r}`, vid: `${magentaC}[VID]${A.r}`,
        gif: `${greenC}[GIF]${A.r}`, poll: `${yellowC}[POLL]${A.r}`,
      };
      lines.push(`  ${mediaMap[post.media] || ""}`);
    }

    // Thread indicator
    if (post.isThread) {
      lines.push(`  ${accent}┊ Show this thread${A.r}`);
    }

    // Engagement bar
    const liked = likedIds.has(post.id);
    const saved = bookmarkedIds.has(post.id);
    const engLine = `  ${muted}💬${A.r}${bright}${formatCount(post.replies)}${A.r}  ${muted}↻${A.r}${post.retweeted ? greenC : bright}${formatCount(post.retweets)}${A.r}  ${liked ? redC + "♥" : muted + "♡"}${A.r}${liked ? redC : bright}${formatCount(post.likes)}${A.r}  ${saved ? yellowC + "★" : muted + "☆"}${A.r}${bright}${formatCount(post.bookmarks)}${A.r}  ${muted}◉${A.r}${muted}${formatCount(post.views)}${A.r}`;
    lines.push(engLine);

    // Divider
    lines.push(`  ${muted}${"─".repeat(Math.min(contentW, 60))}${A.r}`);

    // Selection highlight: prepend marker
    if (isSelected) {
      return lines.map((l, i) => i === 0 ? `${accent}▎${A.r}${l}` : `${accent}▎${A.r}${l}`);
    }
    return lines;
  }

  function renderTimeline(w: number, h: number): string[] {
    const lines: string[] = [];
    const visiblePosts = posts.slice(scrollOffset);
    let lineCount = 0;
    let postIdx = scrollOffset;

    for (const post of visiblePosts) {
      if (lineCount >= h + 10) break; // render a bit extra for scroll
      const card = renderPostCard(post, w, postIdx === selectedPostIdx, postIdx);
      lines.push(...card);
      lineCount += card.length;
      postIdx++;
    }

    if (lines.length === 0) {
      lines.push("");
      lines.push(`  ${muted}No posts to show${A.r}`);
    }

    return lines;
  }

  function renderMentions(w: number, h: number): string[] {
    const mentionPosts = posts.filter(p =>
      p.mentions?.includes("@wibVibes") || p.replyTo === "@wibVibes"
    );
    if (mentionPosts.length === 0) {
      return ["", `  ${muted}No mentions yet${A.r}`];
    }
    const lines: string[] = [];
    for (let i = 0; i < mentionPosts.length; i++) {
      lines.push(...renderPostCard(mentionPosts[i], w, i === 0, i));
    }
    return lines;
  }

  function renderNotifications(w: number, _h: number): string[] {
    const lines: string[] = [];
    const iconMap: Record<string, string> = {
      like: `${redC}♥${A.r}`, retweet: `${greenC}↻${A.r}`, follow: `${accent}◉${A.r}`,
      reply: `${cyanC}💬${A.r}`, mention: `${yellowC}@${A.r}`, quote: `${magentaC}❝${A.r}`,
    };
    const labelMap: Record<string, string> = {
      like: "liked your post", retweet: "retweeted your post", follow: "followed you",
      reply: "replied to your post", mention: "mentioned you", quote: "quoted your post",
    };

    for (const notif of notifications) {
      const icon = iconMap[notif.type] || "•";
      const label = labelMap[notif.type] || notif.type;
      const time = formatTime(notif.timestamp);
      lines.push(` ${icon} ${bright}${A.b}${notif.by}${A.r} ${muted}${label}${A.r} ${muted}· ${time}${A.r}`);
      if (notif.postExcerpt) {
        lines.push(`   ${muted}${notif.postExcerpt.slice(0, Math.max(20, w - 8))}${A.r}`);
      }
      lines.push(`  ${muted}${"─".repeat(Math.min(w - 4, 50))}${A.r}`);
    }
    return lines;
  }

  function renderTrending(w: number, _h: number): string[] {
    const lines: string[] = [];
    lines.push(`  ${accent}${A.b}Trending Now${A.r}`);
    lines.push("");

    for (let i = 0; i < trending.length; i++) {
      const t = trending[i];
      const spark = sparkline(t.sparkline);
      lines.push(` ${muted}${i + 1}.${A.r} ${bright}${A.b}${t.name}${A.r}`);
      lines.push(`    ${muted}${t.category}${A.r} ${muted}·${A.r} ${bright}${formatCount(t.postCount)} posts${A.r}`);
      lines.push(`    ${accent}${spark}${A.r}`);
      lines.push("");
    }
    return lines;
  }

  function renderSearch(w: number, h: number): string[] {
    const lines: string[] = [];
    const searchBox = `  ${muted}┌${"─".repeat(Math.min(w - 6, 50))}┐${A.r}`;
    const searchContent = searchActive
      ? `  ${muted}│${A.r} ${bright}${searchQuery}_${A.r}${" ".repeat(Math.max(0, Math.min(w - 8, 48) - searchQuery.length - 1))}${muted}│${A.r}`
      : `  ${muted}│ / to search...${"".padEnd(Math.max(0, Math.min(w - 8, 48) - 15))}│${A.r}`;
    const searchBottom = `  ${muted}└${"─".repeat(Math.min(w - 6, 50))}┘${A.r}`;

    lines.push(searchBox, searchContent, searchBottom, "");

    if (searchQuery.length > 0) {
      const results = posts.filter(p =>
        p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.author.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.hashtags?.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      lines.push(`  ${muted}${results.length} results for "${searchQuery}"${A.r}`);
      lines.push("");
      for (let i = 0; i < results.length; i++) {
        lines.push(...renderPostCard(results[i], w, false, i));
      }
    } else {
      lines.push(`  ${muted}Try searching for #terminalart, @scrambleCat, or poetry${A.r}`);
    }
    return lines;
  }

  function renderProfile(w: number, _h: number): string[] {
    const lines: string[] = [];
    const a = myAccount;

    // ASCII banner
    lines.push(`  ${accent}${"═".repeat(Math.min(w - 4, 60))}${A.r}`);

    // Avatar + info side by side
    for (let i = 0; i < a.avatar.length; i++) {
      const avLine = `${accent}${a.avatar[i]}${A.r}`;
      if (i === 0) lines.push(`  ${avLine}  ${bright}${A.b}${a.name}${A.r} ${accent}✓${A.r}`);
      else if (i === 1) lines.push(`  ${avLine}  ${muted}${a.handle}${A.r}`);
      else lines.push(`  ${avLine}  ${muted}${a.bio.slice(0, w - 14)}${A.r}`);
    }

    lines.push(`  ${muted}📍 ${a.location}${A.r}  ${muted}📅 Joined ${a.joinDate}${A.r}`);
    lines.push(`  ${bright}${A.b}${formatCount(a.following)}${A.r} ${muted}Following${A.r}  ${bright}${A.b}${formatCount(a.followers)}${A.r} ${muted}Followers${A.r}`);
    lines.push(`  ${accent}${"═".repeat(Math.min(w - 4, 60))}${A.r}`);
    lines.push("");

    // Sub-tabs
    lines.push(`  ${selBg}${selFg} Posts ${A.r} ${muted}Replies${A.r} ${muted}Media${A.r} ${muted}Likes${A.r}`);
    lines.push("");

    // My posts
    const myPosts = posts.filter(p => p.author.handle === myAccount.handle && !p.isRetweet);
    for (let i = 0; i < myPosts.length; i++) {
      lines.push(...renderPostCard(myPosts[i], w, false, i));
    }
    if (myPosts.length === 0) {
      lines.push(`  ${muted}No posts yet. Press n to compose!${A.r}`);
    }

    return lines;
  }

  function renderBookmarks(w: number, _h: number): string[] {
    const saved = posts.filter(p => bookmarkedIds.has(p.id));
    if (saved.length === 0) {
      return ["", `  ${muted}No bookmarks yet. Press b on a post to save it.${A.r}`];
    }
    const lines: string[] = [];
    lines.push(`  ${accent}${A.b}Bookmarks${A.r} ${muted}(${saved.length})${A.r}`);
    lines.push("");
    for (let i = 0; i < saved.length; i++) {
      lines.push(...renderPostCard(saved[i], w, false, i));
    }
    return lines;
  }

  function renderCompose(w: number, _h: number): string[] {
    const lines: string[] = [];
    const maxChars = 280;
    const used = composeText.length;
    const remaining = maxChars - used;
    const countColour = remaining > 40 ? greenC : remaining > 10 ? yellowC : redC;

    lines.push("");
    lines.push(`  ${accent}${A.b}Compose${A.r} ${muted}new post${A.r}`);
    lines.push("");

    // Author
    lines.push(`  ${bright}${A.b}${myAccount.name}${A.r} ${accent}✓${A.r} ${muted}${myAccount.handle}${A.r}`);
    lines.push("");

    // Compose area
    const boxW = Math.min(w - 6, 60);
    lines.push(`  ${accent}┌${"─".repeat(boxW)}┐${A.r}`);
    if (composeText.length === 0) {
      lines.push(`  ${accent}│${A.r} ${muted}What's on your mind?_${" ".repeat(Math.max(0, boxW - 21))}${accent}│${A.r}`);
      for (let i = 0; i < 3; i++) lines.push(`  ${accent}│${" ".repeat(boxW)}│${A.r}`);
    } else {
      const wrapped = wordWrap(composeText + "_", boxW - 2);
      for (const wl of wrapped) {
        const pad = Math.max(0, boxW - stripAnsi(wl).length);
        lines.push(`  ${accent}│${A.r} ${bright}${wl}${" ".repeat(pad - 1)}${accent}│${A.r}`);
      }
      const remaining2 = Math.max(0, 4 - wrapped.length);
      for (let i = 0; i < remaining2; i++) lines.push(`  ${accent}│${" ".repeat(boxW)}│${A.r}`);
    }
    lines.push(`  ${accent}└${"─".repeat(boxW)}┘${A.r}`);

    // Character count + post button
    lines.push(`  ${countColour}${remaining}${A.r} ${muted}characters remaining${A.r}    ${selBg}${selFg}${A.b} Post ${A.r}`);
    lines.push("");
    lines.push(`  ${muted}Enter = post${A.r} ${muted}│${A.r} ${muted}Esc = cancel${A.r}`);

    return lines;
  }

  function renderSidebar(h: number) {
    const lines: string[] = [];
    const sw = SIDEBAR_W - 2;

    // Trending mini
    lines.push(`${accent}${A.b} Trending${A.r}`);
    for (let i = 0; i < Math.min(5, trending.length); i++) {
      const t = trending[i];
      lines.push(` ${bright}${t.name.slice(0, sw - 2)}${A.r}`);
      lines.push(` ${muted}${formatCount(t.postCount)} posts${A.r}`);
    }
    lines.push(`${muted}${"─".repeat(sw)}${A.r}`);

    // Who to follow
    lines.push(`${accent}${A.b} Who to follow${A.r}`);
    const toFollow = A_LIST.filter(a => a.handle !== myAccount.handle).slice(0, 3);
    for (const a of toFollow) {
      const v = a.verified ? `${accent}✓${A.r}` : "";
      lines.push(` ${bright}${a.name}${A.r}${v}`);
      lines.push(` ${muted}${a.handle}${A.r}`);
    }
    lines.push(`${muted}${"─".repeat(sw)}${A.r}`);

    // Quick stats
    lines.push(`${accent}${A.b} Your Stats${A.r}`);
    lines.push(` ${muted}Posts:${A.r}     ${bright}${posts.filter(p => p.author.handle === myAccount.handle).length}${A.r}`);
    lines.push(` ${muted}Likes:${A.r}     ${bright}${likedIds.size}${A.r}`);
    lines.push(` ${muted}Bookmarks:${A.r} ${bright}${bookmarkedIds.size}${A.r}`);
    lines.push(` ${muted}Followers:${A.r} ${bright}${formatCount(myAccount.followers)}${A.r}`);

    while (lines.length < h) lines.push("");
    sidebar.setContent(lines.slice(0, h).join("\n"));
  }

  function renderDivider(h: number) {
    sidebarDivider.setContent(("│\n").repeat(Math.max(1, h)).trim());
  }

  function renderStatus(w: number) {
    const viewInfo = VIEWS.find(v => v.id === currentView);
    const left = ` ${accent}@${myAccount.handle.slice(1)}${A.r} ${muted}│${A.r} ${bright}${viewInfo?.label || ""}${A.r}`;

    // Navigation hints based on view
    let hints = `${muted}j/k${A.r}${bright}scroll ${A.r}${muted}l${A.r}${bright}like ${A.r}${muted}b${A.r}${bright}save ${A.r}${muted}n${A.r}${bright}compose${A.r}`;
    if (currentView === "compose") {
      hints = `${muted}Enter${A.r}${bright}post ${A.r}${muted}Esc${A.r}${bright}cancel${A.r}`;
    } else if (currentView === "search") {
      hints = `${muted}/${A.r}${bright}search ${A.r}${muted}Esc${A.r}${bright}cancel${A.r}`;
    }

    const right = `${hints} ${muted}│${A.r} ${muted}${posts.length} posts${A.r} `;
    const lLen = stripAnsi(left).length;
    const rLen = stripAnsi(right).length;
    const gap = Math.max(1, w - lLen - rLen);
    statusBar.setContent(left + " ".repeat(gap) + right);
  }

  // ── Keyboard handling ──

  mainArea.on("keypress", (_ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg) => {
    const ctrl = key.ctrl ?? false;

    // Compose mode input
    if (currentView === "compose" && !ctrl) {
      if (key.name === "escape") {
        composeText = "";
        currentView = "timeline";
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        if (composeText.trim()) {
          // Create new post
          const newPost: Post = {
            id: `p${Date.now()}`, author: myAccount,
            text: composeText.trim(),
            timestamp: 0, replies: 0, retweets: 0, likes: 0, bookmarks: 0, views: 0,
          };
          posts.unshift(newPost);
          composeText = "";
          currentView = "timeline";
          selectedPostIdx = 0;
          scrollOffset = 0;
        }
        render();
        return;
      }
      if (key.name === "backspace") {
        composeText = composeText.slice(0, -1);
        render();
        return;
      }
      if (_ch && _ch.length === 1 && _ch.charCodeAt(0) >= 32 && composeText.length < 280) {
        composeText += _ch;
        render();
        return;
      }
      return;
    }

    // Search mode input
    if (searchActive) {
      if (key.name === "escape") {
        searchActive = false;
        searchQuery = "";
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        searchActive = false;
        render();
        return;
      }
      if (key.name === "backspace") {
        searchQuery = searchQuery.slice(0, -1);
        render();
        return;
      }
      if (_ch && _ch.length === 1 && _ch.charCodeAt(0) >= 32) {
        searchQuery += _ch;
        render();
        return;
      }
      return;
    }

    // View switching with number keys
    if (!ctrl && _ch) {
      const viewIdx = parseInt(_ch) - 1;
      if (viewIdx >= 0 && viewIdx < VIEWS.length) {
        currentView = VIEWS[viewIdx].id;
        scrollOffset = 0;
        selectedPostIdx = 0;
        if (currentView === "search") searchActive = true;
        render();
        return;
      }
    }

    // Navigation
    if (_ch === "j" || key.name === "down") {
      selectedPostIdx = Math.min(posts.length - 1, selectedPostIdx + 1);
      // Auto-scroll
      if (selectedPostIdx > scrollOffset + 5) scrollOffset = selectedPostIdx - 5;
      render();
      return;
    }
    if (_ch === "k" || key.name === "up") {
      selectedPostIdx = Math.max(0, selectedPostIdx - 1);
      if (selectedPostIdx < scrollOffset) scrollOffset = selectedPostIdx;
      render();
      return;
    }

    // Actions on selected post
    if (_ch === "l" && currentView === "timeline") {
      const post = posts[selectedPostIdx];
      if (post) {
        if (likedIds.has(post.id)) { likedIds.delete(post.id); post.likes--; }
        else { likedIds.add(post.id); post.likes++; }
        render();
      }
      return;
    }
    if (_ch === "b" && currentView === "timeline") {
      const post = posts[selectedPostIdx];
      if (post) {
        if (bookmarkedIds.has(post.id)) { bookmarkedIds.delete(post.id); post.bookmarks--; }
        else { bookmarkedIds.add(post.id); post.bookmarks++; }
        render();
      }
      return;
    }
    if (_ch === "n") {
      currentView = "compose";
      composeText = "";
      render();
      return;
    }
    if (_ch === "/") {
      currentView = "search";
      searchActive = true;
      searchQuery = "";
      render();
      return;
    }
    if (key.name === "escape") {
      if (currentView !== "timeline") {
        currentView = "timeline";
        render();
      }
      return;
    }

    // Page scrolling
    if (key.name === "pagedown" || _ch === " ") {
      scrollOffset = Math.min(posts.length - 1, scrollOffset + 5);
      selectedPostIdx = Math.max(selectedPostIdx, scrollOffset);
      render();
      return;
    }
    if (key.name === "pageup") {
      scrollOffset = Math.max(0, scrollOffset - 5);
      selectedPostIdx = Math.min(selectedPostIdx, scrollOffset + 10);
      render();
      return;
    }
  });

  // Tab bar mouse clicks
  tabBar.on("mouse", (data: blessed.Widgets.Events.IMouseEventArg) => {
    if (data.action !== "mousedown") return;
    const bx = (tabBar as any).aleft || 0;
    const relX = data.x - bx;
    // Approximate tab positions (each tab ~10-12 chars wide)
    let cumX = 0;
    for (const v of VIEWS) {
      const tabW = v.label.length + v.icon.length + 4;
      if (relX >= cumX && relX < cumX + tabW) {
        currentView = v.id;
        scrollOffset = 0;
        selectedPostIdx = 0;
        if (v.id === "search") searchActive = true;
        render();
        return;
      }
      cumX += tabW;
    }
  });

  // ── Lifecycle ──

  win.describeState(() => {
    const sel = posts[selectedPostIdx];
    return {
      summary: `Symbient Twitter — ${currentView} view, ${posts.length} posts${sel ? `, selected: ${sel.author.handle}` : ""}`,
      view: currentView,
      postCount: posts.length,
      selectedPost: sel ? { author: sel.author.handle, text: sel.text.slice(0, 80) } : null,
      likes: likedIds.size,
      bookmarks: bookmarkedIds.size,
      notificationCount: notifications.length,
    };
  });

  win.captureText(() => {
    const lines: string[] = [`Symbient Twitter — ${currentView}`];
    for (const post of posts.slice(0, 10)) {
      lines.push(`${post.author.name} ${post.author.handle} · ${formatTime(post.timestamp)}`);
      lines.push(post.text);
      lines.push(`♡${post.likes} ↻${post.retweets} 💬${post.replies}`);
      lines.push("---");
    }
    return lines.join("\n");
  });

  win.onRestyle(() => {
    const t = host.theme();
    headerBar.style = { fg: t.titleBarFocused.fg, bg: t.titleBarFocused.bg };
    tabBar.style = { fg: t.body.fg, bg: t.body.bg };
    mainArea.style = { fg: t.body.fg, bg: t.body.bg };
    sidebar.style = { fg: t.body.fg, bg: t.body.bg };
    sidebarDivider.style = { fg: t.muted.fg, bg: t.body.bg };
    statusBar.style = { fg: t.titleBarFocused.fg, bg: t.titleBarFocused.bg };
    render();
  });

  win.onResize(() => render());
  win.onCleanup(() => clearTimers(timers));

  mainArea.focus();
  win.setFocusTarget(mainArea);
  render();
  win.focus();
}
