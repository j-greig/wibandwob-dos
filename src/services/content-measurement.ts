import stringWidth from "string-width";

export interface ContentMeasurement {
  lineCount: number;
  columnWidth: number;
  frameCount: number;
  hasFrames: boolean;
  animated: boolean;
  fps: number;
  skippedCommentLines: number;
  recommendedWidth: number;
  recommendedHeight: number;
}

export interface MeasuredContent {
  raw: string;
  visibleText: string;
  primaryFrameText: string;
  lines: string[];
  visibleLines: string[];
  primaryFrameLines: string[];
  /** All frames as separate line arrays. Empty if not animated. */
  frames: string[][];
  measurement: ContentMeasurement;
}

interface MeasureOptions {
  skipHashComments?: boolean;
  detectFrames?: boolean;
  chromeWidth?: number;
  chromeHeight?: number;
}

const DEFAULT_OPTIONS: Required<MeasureOptions> = {
  skipHashComments: false,
  detectFrames: false,
  chromeWidth: 2,
  chromeHeight: 2
};

export function measureContent(rawContent: string, options: MeasureOptions = {}): MeasuredContent {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const normalized = rawContent.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const visibleLines: string[] = [];
  const primaryFrameLines: string[] = [];
  const frames: string[][] = [];
  let currentFrame: string[] = [];
  let skippedCommentLines = 0;
  let frameCount = 1;
  let sawFrameDelimiter = false;
  let fps = 4; // default playback rate

  for (const line of lines) {
    if (config.skipHashComments && line.startsWith("#")) {
      skippedCommentLines += 1;
      continue;
    }
    // Parse FPS=N directive (appears before first frame delimiter)
    if (config.detectFrames && !sawFrameDelimiter && /^\s*FPS\s*=\s*\d+/i.test(line)) {
      const match = line.match(/FPS\s*=\s*(\d+)/i);
      if (match) fps = Math.max(1, Math.min(60, parseInt(match[1], 10)));
      continue;
    }
    const isFrameDelimiter = config.detectFrames && /^\s*(---|===)\s*$/.test(line);
    if (isFrameDelimiter) {
      if (!sawFrameDelimiter && currentFrame.length > 0) {
        // First delimiter — commit the first frame
        frames.push([...currentFrame]);
      } else if (sawFrameDelimiter && currentFrame.length > 0) {
        frames.push([...currentFrame]);
      }
      currentFrame = [];
      sawFrameDelimiter = true;
      frameCount += 1;
      continue;
    }
    visibleLines.push(line);
    currentFrame.push(line);
    if (!sawFrameDelimiter) {
      primaryFrameLines.push(line);
    }
  }
  // Commit trailing frame (content after last delimiter)
  if (sawFrameDelimiter && currentFrame.length > 0) {
    frames.push([...currentFrame]);
  }

  // If delimiter came before any content (leading-delimiter format like "FPS=3\n---\n..."),
  // primaryFrameLines is empty. Fall back to the first parsed frame for sizing.
  const effectivePrimary = primaryFrameLines.length > 0
    ? primaryFrameLines
    : (frames.length > 0 ? frames[0] : visibleLines);
  const measuredLines = sawFrameDelimiter ? effectivePrimary : visibleLines;
  const columnWidth = measuredLines.reduce((max, line) => Math.max(max, stringWidth(line)), 0);

  return {
    raw: normalized,
    visibleText: visibleLines.join("\n"),
    primaryFrameText: measuredLines.join("\n"),
    lines,
    visibleLines,
    primaryFrameLines: measuredLines,
    frames,
    measurement: {
      lineCount: measuredLines.length,
      columnWidth,
      frameCount: sawFrameDelimiter ? frames.length : 1,
      hasFrames: sawFrameDelimiter,
      animated: sawFrameDelimiter && frames.length > 1,
      fps,
      skippedCommentLines,
      recommendedWidth: columnWidth + config.chromeWidth,
      recommendedHeight: measuredLines.length + config.chromeHeight
    }
  };
}

export function measurePrimerContent(rawContent: string): MeasuredContent {
  return measureContent(rawContent, {
    skipHashComments: true,
    detectFrames: true,
    chromeWidth: 2,
    chromeHeight: 2
  });
}

export function measurePlainTextContent(rawContent: string): MeasuredContent {
  return measureContent(rawContent, {
    chromeWidth: 2,
    chromeHeight: 2
  });
}
