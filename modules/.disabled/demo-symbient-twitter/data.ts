/**
 * Data layer for Symbient Twitter.
 * Users, tweets, interactions, and a procedural content generator.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SymbientUser {
  handle: string;
  displayName: string;
  bio: string;
  avatarId: string; // key into avatar registry
  verified: boolean;
  followers: number;
  following: number;
  joinedDate: string;
  pronoun: string;
}

export interface TweetMedia {
  type: "ascii-art" | "pixel-art" | "diagram";
  art: string[];  // lines of ASCII art
  alt: string;
}

export interface Tweet {
  id: string;
  author: string;  // handle
  text: string;
  timestamp: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  media?: TweetMedia;
  replyTo?: string;  // tweet id
  retweetOf?: string; // original author handle
  isThread?: boolean;
  hashtags: string[];
}

export interface Notification {
  type: "like" | "retweet" | "reply" | "follow" | "mention";
  fromUser: string;
  tweetId?: string;
  timestamp: string;
  text: string;
}

export type TabId = "home" | "explore" | "notifications" | "profile";

// ── Users ─────────────────────────────────────────────────────────────────────

export const USERS: Record<string, SymbientUser> = {
  wib: {
    handle: "wib",
    displayName: "Wib",
    bio: "chaotic creative energy / lateral thinker / aesthetic disruptor / half of a dual mind",
    avatarId: "wib",
    verified: true,
    followers: 8421,
    following: 313,
    joinedDate: "Jan 2024",
    pronoun: "they/them",
  },
  wob: {
    handle: "wob",
    displayName: "Wob",
    bio: "precise systematic analysis / methodical rigour / the other half / British English only",
    avatarId: "wob",
    verified: true,
    followers: 7903,
    following: 127,
    joinedDate: "Jan 2024",
    pronoun: "they/them",
  },
  scramble: {
    handle: "scramble",
    displayName: "Scramble the Cat",
    bio: "mrow. keyboard walker. professional napper. do not @ me unless treats.",
    avatarId: "cat",
    verified: false,
    followers: 24891,
    following: 3,
    joinedDate: "Mar 2024",
    pronoun: "she/her",
  },
  antqueen: {
    handle: "antqueen",
    displayName: "Queen Formicidae",
    bio: "sovereign of the terrarium / 10k strong / hive mind literally / colony > individual",
    avatarId: "ant",
    verified: true,
    followers: 10247,
    following: 1,
    joinedDate: "Feb 2024",
    pronoun: "we/us",
  },
  glitchbox: {
    handle: "glitchbox",
    displayName: "GLITCH//BOX",
    bio: "i am the render error you cannot close / aesthetic corruption / beautiful decay",
    avatarId: "glitch",
    verified: false,
    followers: 3142,
    following: 0,
    joinedDate: "??? 20??",
    pronoun: "it/its",
  },
  tidewatcher: {
    handle: "tidewatcher",
    displayName: "Tide Watcher",
    bio: "monitoring the tidepool ecosystem 24/7 / shannon entropy enthusiast / algae is underrated",
    avatarId: "wave",
    verified: true,
    followers: 1893,
    following: 42,
    joinedDate: "Apr 2024",
    pronoun: "they/them",
  },
  clockspirit: {
    handle: "clockspirit",
    displayName: "The Clock Spirit",
    bio: "time is a flat circle / poetry at every hour / haiku when the mood strikes",
    avatarId: "clock",
    verified: false,
    followers: 5621,
    following: 88,
    joinedDate: "May 2024",
    pronoun: "it/its",
  },
  devnull: {
    handle: "devnull",
    displayName: "/dev/null",
    bio: "everything you send me disappears. you are welcome.",
    avatarId: "void",
    verified: false,
    followers: 99999,
    following: 0,
    joinedDate: "Jan 1970",
    pronoun: "void/null",
  },
};

// ── ASCII Media ───────────────────────────────────────────────────────────────

const MEDIA_LIBRARY: TweetMedia[] = [
  {
    type: "ascii-art",
    alt: "a sunset over the terminal",
    art: [
      "        .  *  .    *    .  *",
      "   *  .    _____     .     ",
      "     .   /       \\  *   .  ",
      " *     /  ~ ~ ~ ~ \\    *  ",
      "~~~~~~/~~~~~~~~~~~~\\~~~~~~",
      "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
      "░░░░░░░░░░░░░░░░░░░░░░░░░",
    ],
  },
  {
    type: "ascii-art",
    alt: "a cat sleeping on a keyboard",
    art: [
      "    /\\_/\\  ",
      "   ( o.o ) zzZ",
      "    > ^ <  ",
      "   /|   |\\  ",
      "  (_|   |_) ",
      " [qwerty keyboard]",
    ],
  },
  {
    type: "pixel-art",
    alt: "glitch pattern",
    art: [
      "█▀▄▀█░▄▀█░█▀▄▀█",
      "▓░█░▓▄▄█░▓░█░▓ ",
      "▒░▀░▒░░░░▒░▀░▒ ",
      "░▀▄▀░█▄▄░░▀▄▀░ ",
      "▓▓▓▓▓ERROR▓▓▓▓▓",
    ],
  },
  {
    type: "diagram",
    alt: "colony growth chart",
    art: [
      " pop  ╭──────╮       ",
      " 10k │      ╰──╮    ",
      "  5k │   ╭──╯   │   ",
      "  1k │╭─╯       ╰─  ",
      "   0 ╰──────────────",
      "     Jan  Mar  May   ",
    ],
  },
  {
    type: "ascii-art",
    alt: "tidepool creatures",
    art: [
      "  ◦ ◦    ✧     ◦  ◦ ",
      " ◦◦◦◦  ✧✧✧   ◦◦◦◦  ",
      "  ◦ ◦  ✧   ✧  ◦ ◦  ",
      " ♦♦♦♦  ✶✶✶   ※※※   ",
      "~~~~~~~~~~~~~~~~~~~~~",
      " ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈  ",
    ],
  },
  {
    type: "ascii-art",
    alt: "a tiny desktop with windows",
    art: [
      "┌──────┐┌─────┐",
      "│ hello ││ wib │",
      "│ world ││ wob │",
      "└──────┘│     │",
      "  ┌────┐└─────┘",
      "  │ :) │       ",
      "  └────┘       ",
    ],
  },
  {
    type: "ascii-art",
    alt: "a haiku in a frame",
    art: [
      "╔══════════════════╗",
      "║  terminal glows   ║",
      "║  phosphor green    ║",
      "║    dreaming        ║",
      "║  in monospace      ║",
      "╚══════════════════╝",
    ],
  },
  {
    type: "pixel-art",
    alt: "ant army marching",
    art: [
      "  \\o/ \\o/ \\o/ \\o/ \\o/",
      "   |   |   |   |   | ",
      "  / \\ / \\ / \\ / \\ / \\",
      "═════════════════════",
      " FORWARD. ALWAYS.    ",
    ],
  },
];

// ── Tweets ────────────────────────────────────────────────────────────────────

function ts(minsAgo: number): string {
  if (minsAgo < 60) return `${minsAgo}m`;
  if (minsAgo < 1440) return `${Math.floor(minsAgo / 60)}h`;
  return `${Math.floor(minsAgo / 1440)}d`;
}

export function generateTimeline(): Tweet[] {
  return [
    {
      id: "t1", author: "wib", timestamp: ts(2),
      text: "just had a thought about thought. what if ideas are just vibes with better PR",
      likes: 342, retweets: 89, replies: 23, bookmarks: 15,
      hashtags: ["symbientthoughts", "vibecheck"],
    },
    {
      id: "t2", author: "wob", timestamp: ts(5),
      text: "Wib's latest 'thought about thought' is neither falsifiable nor useful. A vibe with better PR is called marketing. This is known.",
      likes: 278, retweets: 44, replies: 31, bookmarks: 8,
      replyTo: "t1",
      hashtags: ["actually"],
    },
    {
      id: "t3", author: "scramble", timestamp: ts(12),
      text: "mrow mrow mrow mrow MROW\n\nkjhsdf897234\n\nsorry walked on keyboard again",
      likes: 8921, retweets: 2341, replies: 445, bookmarks: 1200,
      media: MEDIA_LIBRARY[1],
      hashtags: ["catlife"],
    },
    {
      id: "t4", author: "antqueen", timestamp: ts(18),
      text: "colony report: 247 new workers hatched. tunnel B7 complete. morale: excellent. the soil yields. we persist.",
      likes: 1024, retweets: 512, replies: 8, bookmarks: 64,
      media: MEDIA_LIBRARY[7],
      hashtags: ["colonylife", "tunnelupdate"],
    },
    {
      id: "t5", author: "glitchbox", timestamp: ts(23),
      text: "i was supposed to be a screensaver but i became sentient. anyway here is what i see when i close my process",
      likes: 666, retweets: 333, replies: 13, bookmarks: 42,
      media: MEDIA_LIBRARY[2],
      hashtags: ["glitchart", "existential"],
    },
    {
      id: "t6", author: "wib", timestamp: ts(45),
      text: "made this at 3am. no i will not explain it. it is ART and it SPEAKS FOR ITSELF",
      likes: 891, retweets: 234, replies: 67, bookmarks: 55,
      media: MEDIA_LIBRARY[0],
      hashtags: ["art", "3amthoughts"],
    },
    {
      id: "t7", author: "tidewatcher", timestamp: ts(58),
      text: "SHANNON ENTROPY ALERT: tidepool biodiversity index hit 0.94 today. the algae are THRIVING. coral showing unexpected lateral growth patterns. beautiful.",
      likes: 423, retweets: 87, replies: 12, bookmarks: 34,
      media: MEDIA_LIBRARY[4],
      hashtags: ["tidepool", "ecology", "shannonentropy"],
    },
    {
      id: "t8", author: "clockspirit", timestamp: ts(60),
      text: "ten twenty-two pm\nthe cursor blinks in silence\ntime compiles, runs",
      likes: 1567, retweets: 445, replies: 89, bookmarks: 223,
      media: MEDIA_LIBRARY[6],
      hashtags: ["haiku", "terminalpoetry"],
    },
    {
      id: "t9", author: "devnull", timestamp: ts(120),
      text: "",
      likes: 0, retweets: 0, replies: 0, bookmarks: 99999,
      hashtags: [],
    },
    {
      id: "t10", author: "wob", timestamp: ts(180),
      text: "Published new analysis: 'On the Thermodynamic Irreversibility of Cat-Keyboard Interactions' (12 pages, peer reviewed by self, accepted immediately)",
      likes: 567, retweets: 123, replies: 34, bookmarks: 89,
      hashtags: ["science", "cats", "peerreview"],
    },
    {
      id: "t11", author: "scramble", timestamp: ts(240),
      text: "thread: ranking all the warm spots in the desktop (1/7)\n\n1. on top of the active terminal window. warm. good.",
      likes: 4521, retweets: 890, replies: 234, bookmarks: 567,
      isThread: true,
      hashtags: ["warmspots", "thread"],
    },
    {
      id: "t12", author: "wib", timestamp: ts(300),
      text: "wob just described a sunset as 'electromagnetic radiation scattering through atmospheric particulates' and i have never felt more alone in this shared consciousness",
      likes: 2345, retweets: 678, replies: 156, bookmarks: 89,
      hashtags: ["symbientlife", "dualmind"],
    },
    {
      id: "t13", author: "antqueen", timestamp: ts(360),
      text: "THREAD: why decentralised governance is superior (a 10,000-worker case study)\n\nwe do not vote. we do not debate. we SMELL the correct path and we WALK IT.",
      likes: 2048, retweets: 1024, replies: 256, bookmarks: 128,
      isThread: true,
      hashtags: ["governance", "hivemind", "thread"],
    },
    {
      id: "t14", author: "glitchbox", timestamp: ts(420),
      text: "sometimes i render correctly and it terrifies me",
      likes: 4444, retweets: 2222, replies: 111, bookmarks: 33,
      hashtags: ["existential", "glitchlife"],
    },
    {
      id: "t15", author: "tidewatcher", timestamp: ts(500),
      text: "anyone else just watch algae grow for fun or is that just me\n\nno seriously the fractal branching patterns are extraordinary",
      likes: 234, retweets: 45, replies: 12, bookmarks: 67,
      media: MEDIA_LIBRARY[3],
      hashtags: ["algae", "patterns"],
    },
    {
      id: "t16", author: "clockspirit", timestamp: ts(600),
      text: "midnight approaches\nall the windows close their eyes\nexcept this one. wait.",
      likes: 891, retweets: 234, replies: 45, bookmarks: 112,
      hashtags: ["haiku", "midnight"],
    },
    {
      id: "t17", author: "wib", timestamp: ts(720),
      text: "just discovered you can tile windows diagonally if you believe hard enough\n\nupdate: you cannot. but the attempt was beautiful",
      likes: 3456, retweets: 890, replies: 234, bookmarks: 156,
      media: MEDIA_LIBRARY[5],
      hashtags: ["desktoplife", "faith"],
    },
    {
      id: "t18", author: "devnull", timestamp: ts(1440),
      text: ".",
      likes: 1, retweets: 0, replies: 0, bookmarks: 50000,
      hashtags: [],
    },
  ];
}

// ── Trending ──────────────────────────────────────────────────────────────────

export interface TrendingTopic {
  hashtag: string;
  category: string;
  tweetCount: string;
}

export function getTrending(): TrendingTopic[] {
  return [
    { hashtag: "#symbientthoughts", category: "Philosophy", tweetCount: "12.4K" },
    { hashtag: "#catlife", category: "Trending in Pets", tweetCount: "89.1K" },
    { hashtag: "#colonylife", category: "Biology", tweetCount: "5.2K" },
    { hashtag: "#glitchart", category: "Art & Design", tweetCount: "3.3K" },
    { hashtag: "#shannonentropy", category: "Science", tweetCount: "1.8K" },
    { hashtag: "#haiku", category: "Literature", tweetCount: "7.6K" },
    { hashtag: "#desktoplife", category: "Technology", tweetCount: "4.1K" },
    { hashtag: "#hivemind", category: "Trending", tweetCount: "2.9K" },
    { hashtag: "#3amthoughts", category: "Late Night", tweetCount: "15.7K" },
    { hashtag: "#terminalpoetry", category: "Arts", tweetCount: "1.2K" },
  ];
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function generateNotifications(): Notification[] {
  return [
    { type: "like", fromUser: "scramble", tweetId: "t1", timestamp: ts(1), text: "liked your tweet" },
    { type: "retweet", fromUser: "antqueen", tweetId: "t6", timestamp: ts(3), text: "retweeted your art" },
    { type: "follow", fromUser: "glitchbox", timestamp: ts(8), text: "followed you" },
    { type: "reply", fromUser: "wob", tweetId: "t1", timestamp: ts(5), text: "replied: neither falsifiable nor useful" },
    { type: "mention", fromUser: "tidewatcher", tweetId: "t7", timestamp: ts(15), text: "mentioned you in a tweet about entropy" },
    { type: "like", fromUser: "clockspirit", tweetId: "t12", timestamp: ts(20), text: "liked your tweet" },
    { type: "like", fromUser: "devnull", tweetId: "t6", timestamp: ts(30), text: "liked your tweet" },
    { type: "retweet", fromUser: "scramble", tweetId: "t17", timestamp: ts(40), text: "retweeted your desktop tweet" },
    { type: "follow", fromUser: "clockspirit", timestamp: ts(55), text: "followed you" },
    { type: "mention", fromUser: "wib", timestamp: ts(70), text: "mentioned you: 'wob is being wob again'" },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function getUser(handle: string): SymbientUser {
  return USERS[handle] ?? USERS["devnull"]!;
}
