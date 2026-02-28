import stringWidth from "string-width";

export interface ContentMeasurement {
  lineCount: number;
  columnWidth: number;
  frameCount: number;
  hasFrames: boolean;
  animated: boolean;
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
  let skippedCommentLines = 0;
  let frameCount = 1;
  let sawFrameDelimiter = false;

  for (const line of lines) {
    if (config.skipHashComments && line.startsWith("#")) {
      skippedCommentLines += 1;
      continue;
    }
    const isFrameDelimiter = config.detectFrames && /^\s*(---|===)\s*$/.test(line);
    if (isFrameDelimiter) {
      sawFrameDelimiter = true;
      frameCount += 1;
      continue;
    }
    visibleLines.push(line);
    if (!sawFrameDelimiter) {
      primaryFrameLines.push(line);
    }
  }

  const measuredLines = sawFrameDelimiter ? primaryFrameLines : visibleLines;
  const columnWidth = measuredLines.reduce((max, line) => Math.max(max, stringWidth(line)), 0);

  return {
    raw: normalized,
    visibleText: visibleLines.join("\n"),
    primaryFrameText: measuredLines.join("\n"),
    lines,
    visibleLines,
    primaryFrameLines: measuredLines,
    measurement: {
      lineCount: measuredLines.length,
      columnWidth,
      frameCount,
      hasFrames: sawFrameDelimiter,
      animated: sawFrameDelimiter && frameCount > 1,
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
