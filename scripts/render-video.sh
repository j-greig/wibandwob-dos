#!/bin/bash
# render-video.sh — stitch smoke-capture PNGs + audio into MP4
# Usage: ./scripts/render-video.sh <capdir> <timeline.json> [output.mp4]
set -e

CAPDIR="$1"
TIMELINE="$2"
OUTPUT="${3:-scratch/renders/$(basename $CAPDIR).mp4}"

if [[ -z "$CAPDIR" || -z "$TIMELINE" ]]; then
  echo "Usage: render-video.sh <capdir> <timeline.json> [output.mp4]"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# Extract cue times and total duration from timeline
python3 - "$TIMELINE" "$CAPDIR" "$OUTPUT" << 'EOF'
import sys, json, subprocess, os, tempfile
from pathlib import Path

timeline_path, capdir, output = sys.argv[1], sys.argv[2], sys.argv[3]
tl = json.loads(Path(timeline_path).read_text())
duration = tl["duration"]
audio = tl.get("audio")
cues = tl["cues"]

# Build list of (t, png) pairs — match PNGs to cues by index
pngs = sorted(Path(capdir).glob("[0-9][0-9]-cue_*.png"))
times = [c["at"]["t"] for c in cues]

if len(pngs) != len(times):
    print(f"⚠ PNG count ({len(pngs)}) != cue count ({len(times)}) — using available PNGs")

pairs = list(zip(times, pngs))

# Build ffmpeg concat file
lines = []
for i, (t, png) in enumerate(pairs):
    next_t = pairs[i+1][0] if i+1 < len(pairs) else duration
    d = round(next_t - t, 3)
    if d <= 0: d = 0.1
    lines.append(f"file '{png.resolve()}'")
    lines.append(f"duration {d}")
# ffmpeg needs last file repeated without duration
lines.append(f"file '{pairs[-1][1].resolve()}'")

with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
    f.write("\n".join(lines))
    concat_file = f.name

print(f"▶ Rendering {len(pairs)} frames → {output}")
print(f"  Audio: {audio}")
print(f"  Duration: {duration}s")

cmd = [
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0", "-i", concat_file,
]
if audio and os.path.exists(audio):
    cmd += ["-i", audio, "-c:a", "aac", "-shortest"]
cmd += [
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
    output
]

result = subprocess.run(cmd, capture_output=True, text=True)
os.unlink(concat_file)

if result.returncode == 0:
    size = os.path.getsize(output) // 1024 // 1024
    print(f"✅ {output}  ({size}MB)")
else:
    print("❌ ffmpeg failed:")
    print(result.stderr[-2000:])
    sys.exit(1)
EOF
