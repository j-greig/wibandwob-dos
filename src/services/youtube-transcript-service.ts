/**
 * YouTube Transcript Service
 *
 * Fetches timestamped transcripts from YouTube videos.
 * No API key or browser required.
 */

// @ts-ignore — no types for youtube-transcript-plus
import { YoutubeTranscript } from "youtube-transcript-plus";

export interface TranscriptEntry {
  timestamp: string;
  text: string;
}

export interface TranscriptResult {
  ok: boolean;
  videoId: string;
  entries: TranscriptEntry[];
  fullText: string;
  error?: string;
}

/**
 * Extract a YouTube video ID from a URL or bare ID string.
 */
function extractVideoId(input: string): string {
  const trimmed = input.trim();
  // Full URL: youtube.com/watch?v=XXX or youtu.be/XXX
  const match = trimmed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function fetchYoutubeTranscript(
  videoIdOrUrl: string
): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoIdOrUrl);

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const entries: TranscriptEntry[] = transcript.map(
      (entry: { offset: number; text: string }) => ({
        timestamp: formatTimestamp(entry.offset / 1000),
        text: entry.text,
      })
    );

    const fullText = entries
      .map((e) => `[${e.timestamp}] ${e.text}`)
      .join("\n");

    return { ok: true, videoId, entries, fullText };
  } catch (err) {
    return {
      ok: false,
      videoId,
      entries: [],
      fullText: "",
      error: `Transcript fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
