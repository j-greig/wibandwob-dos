---
name: youtube-transcript
description: >
  Fetch the transcript of any YouTube video as plain text. Use when user
  shares a YouTube URL and wants it summarised, analysed, quoted from, or
  processed in any way. Triggers on: "transcribe this", "get the transcript",
  "summarise this video", "what does this video say", any YouTube URL shared
  without further context.
---

# youtube-transcript

Fetch YouTube transcripts as plain text via `youtube-transcript-api` (no install needed — uv handles it).

## Usage

```bash
uv run --with youtube-transcript-api python3 -c "
from youtube_transcript_api import YouTubeTranscriptApi
api = YouTubeTranscriptApi()
transcript = api.fetch('VIDEO_ID')
text = ' '.join([t.text for t in transcript])
print(text)
"
```

Extract video ID from URL: `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`.

## With timestamps

```bash
uv run --with youtube-transcript-api python3 -c "
from youtube_transcript_api import YouTubeTranscriptApi
api = YouTubeTranscriptApi()
transcript = api.fetch('VIDEO_ID')
for t in transcript:
    print(f'[{int(t.start//60)}:{int(t.start%60):02d}] {t.text}')
"
```

## Notes

- Works on any video with auto-generated or manual captions
- Raises `TranscriptsDisabled` if the video has no captions
- Raises `IpBlocked` or `PoTokenRequired` if YouTube rate-limits — rare
- No API key needed
