/**
 * Tweet renderer for Symbient Twitter.
 * Renders individual tweets as multi-line text blocks with
 * avatar, header, body, media, and engagement stats.
 */

import { getAvatar, getAvatarColour } from "./avatars.js";
import { getUser, formatCount, type Tweet, type Notification, type TrendingTopic, type SymbientUser } from "./data.js";

// ── Tweet rendering ───────────────────────────────────────────────────────────

function pad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + " ".repeat(w - s.length);
}

function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) { result.push(""); continue; }
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      if (line.length + word.length + 1 > width && line.length > 0) {
        result.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

/**
 * Render a single tweet as an array of plain-text lines.
 * Each line is exactly `width` chars.
 */
export function renderTweet(tweet: Tweet, width: number, selected: boolean): string[] {
  const user = getUser(tweet.author);
  const avatar = getAvatar(user.avatarId);
  const avatarW = 9; // 7 art + 2 padding
  const contentW = Math.max(20, width - avatarW - 1);
  const lines: string[] = [];

  // Card border
  const top = selected ? `╔${"═".repeat(Math.max(1, width - 2))}╗` : `╭${"─".repeat(Math.max(1, width - 2))}╮`;
  lines.push(top);

  // Header: displayName @handle · timestamp
  const verified = user.verified ? " ✓" : "";
  const rt = tweet.retweetOf ? `  ↻ ${tweet.retweetOf} retweeted` : "";
  let header = `${user.displayName}${verified} @${user.handle} · ${tweet.timestamp}${rt}`;
  if (header.length > contentW) header = header.slice(0, contentW - 1) + "~";

  // Build content lines first
  const bodyLines = wrapText(tweet.text || "(empty)", contentW);

  // Hashtags
  let hashLine = "";
  if (tweet.hashtags.length > 0) {
    hashLine = tweet.hashtags.map(h => `#${h}`).join(" ");
    if (hashLine.length > contentW) hashLine = hashLine.slice(0, contentW - 1) + "~";
  }

  // Thread indicator
  const threadLine = tweet.isThread ? "🧵 Show thread" : "";

  // Reply indicator
  const replyLine = tweet.replyTo ? `  ↳ replying to thread` : "";

  // Engagement stats
  const stats = [
    `↩ ${formatCount(tweet.replies)}`,
    `↻ ${formatCount(tweet.retweets)}`,
    `♥ ${formatCount(tweet.likes)}`,
    `⊞ ${formatCount(tweet.bookmarks)}`,
  ].join("  ");

  // Assemble content column
  const contentLines: string[] = [];
  if (replyLine) contentLines.push(replyLine);
  contentLines.push(header);
  contentLines.push(""); // spacer
  for (const bl of bodyLines) contentLines.push(bl);
  if (hashLine) {
    contentLines.push("");
    contentLines.push(hashLine);
  }

  // Media
  if (tweet.media) {
    contentLines.push("");
    contentLines.push(`┌${"─".repeat(Math.min(tweet.media.art[0]?.length ?? 20, contentW - 2))}┐`);
    for (const ml of tweet.media.art) {
      const trimmed = ml.length > contentW - 2 ? ml.slice(0, contentW - 3) + "~" : ml;
      contentLines.push(`│${pad(trimmed, Math.min(tweet.media.art[0]?.length ?? 20, contentW - 2))}│`);
    }
    contentLines.push(`└${"─".repeat(Math.min(tweet.media.art[0]?.length ?? 20, contentW - 2))}┘`);
    contentLines.push(` [${tweet.media.type}] ${tweet.media.alt}`);
  }

  if (threadLine) contentLines.push(threadLine);
  contentLines.push("");
  contentLines.push(stats);

  // Merge avatar column with content column
  const totalLines = Math.max(avatar.art.length, contentLines.length);
  for (let i = 0; i < totalLines; i++) {
    const avatarLine = i < avatar.art.length ? avatar.art[i]! : "       ";
    const content = i < contentLines.length ? contentLines[i]! : "";
    const padded = pad(` ${avatarLine} `, avatarW) + pad(content, contentW);
    lines.push(padded.length > width ? padded.slice(0, width) : pad(padded, width));
  }

  // Bottom border
  const bottom = selected ? `╚${"═".repeat(Math.max(1, width - 2))}╝` : `╰${"─".repeat(Math.max(1, width - 2))}╯`;
  lines.push(bottom);

  return lines;
}

// ── Trending sidebar ──────────────────────────────────────────────────────────

export function renderTrending(topics: TrendingTopic[], width: number): string[] {
  const lines: string[] = [];
  lines.push(pad(" ✦ TRENDING NOW", width));
  lines.push("═".repeat(width));
  for (let i = 0; i < topics.length && i < 6; i++) {
    const t = topics[i]!;
    lines.push(pad(` ${i + 1}. ${t.hashtag}`, width));
    let meta = `   ${t.category}  •  ${t.tweetCount} chirps`;
    if (meta.length > width) meta = meta.slice(0, width - 1) + "~";
    lines.push(pad(meta, width));
    lines.push(pad("   ─────────────────", width));
  }
  return lines;
}

// ── Notifications ─────────────────────────────────────────────────────────────

const NOTIF_ICONS: Record<string, string> = {
  like: "♥",
  retweet: "↻",
  reply: "↩",
  follow: "+",
  mention: "@",
};

export function renderNotification(n: Notification, width: number): string[] {
  const icon = NOTIF_ICONS[n.type] ?? "?";
  const user = getUser(n.fromUser);
  const line1 = ` ${icon}  ${user.displayName} (@${n.fromUser}) · ${n.timestamp}`;
  const line2 = `    ${n.text}`;
  return [
    pad(line1.length > width ? line1.slice(0, width) : line1, width),
    pad(line2.length > width ? line2.slice(0, width) : line2, width),
    "─".repeat(width),
  ];
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function renderProfile(user: SymbientUser, width: number): string[] {
  const avatar = getAvatar(user.avatarId);
  const lines: string[] = [];

  // Banner
  lines.push("▓".repeat(width));
  lines.push("▒".repeat(width));
  lines.push("░".repeat(width));
  lines.push("");

  // Avatar + name block
  for (const al of avatar.art) {
    lines.push(pad(`  ${al}`, width));
  }
  lines.push("");

  const verified = user.verified ? " ✓" : "";
  lines.push(pad(` ${user.displayName}${verified}`, width));
  lines.push(pad(` @${user.handle}  ${user.pronoun}`, width));
  lines.push("");
  
  // Bio
  const bioLines = wrapText(user.bio, width - 2);
  for (const bl of bioLines) {
    lines.push(pad(` ${bl}`, width));
  }
  lines.push("");
  lines.push(pad(` Joined ${user.joinedDate}`, width));
  lines.push("");
  lines.push(pad(` ${formatCount(user.following)} Following   ${formatCount(user.followers)} Followers`, width));
  lines.push("");
  lines.push("─".repeat(width));
  lines.push(pad(" Chirps   Replies   Likes", width));
  lines.push("─".repeat(width));

  return lines;
}

// ── Compose ───────────────────────────────────────────────────────────────────

export function renderComposePrompt(width: number): string[] {
  return [
    "═".repeat(width),
    pad(" ✎  What's happening in your symbient mind?", width),
    pad(" [Enter] post  •  [/windows/input] also posts", width),
  ];
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

export function renderTabBar(activeTab: string, width: number): string {
  const tabs = [
    { id: "home", label: "Home", key: "1" },
    { id: "explore", label: "Explore", key: "2" },
    { id: "notifications", label: "Notifs", key: "3" },
    { id: "profile", label: "Profile", key: "4" },
  ];
  const parts = tabs.map(t => {
    const active = t.id === activeTab;
    return active ? ` [${t.key}:${t.label}] ` : `  ${t.key}:${t.label}  `;
  });
  const bar = ` SYMBIENT •${parts.join("|")}`;
  return pad(bar, width);
}
