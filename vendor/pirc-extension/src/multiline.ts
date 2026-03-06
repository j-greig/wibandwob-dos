/**
 * IRCv3 draft/multiline message support.
 * https://ircv3.net/specs/extensions/multiline
 *
 * Handles both receiving (assembling batched lines) and sending
 * (splitting multiline text into BATCH-wrapped PRIVMSGs).
 */

// --- Capability parsing ---

export interface MultilineCaps {
  readonly maxBytes: number;
  readonly maxLines: number | undefined;
}

/**
 * Parse the `draft/multiline` capability value.
 * Format: `max-bytes=<n>[,max-lines=<n>]`
 */
export function parseMultilineCap(value: string): MultilineCaps {
  let maxBytes = 0;
  let maxLines: number | undefined;

  for (const token of value.split(",")) {
    const eq = token.indexOf("=");
    const key = eq === -1 ? token : token.slice(0, eq);
    const val = eq === -1 ? "" : token.slice(eq + 1);
    if (key === "max-bytes") maxBytes = parseInt(val, 10) || 0;
    if (key === "max-lines") maxLines = parseInt(val, 10) || undefined;
  }

  return { maxBytes, maxLines };
}

// --- Receiving ---

interface BatchLine {
  readonly text: string;
  readonly concat: boolean;
}

interface PendingBatch {
  readonly target: string;
  nick: string;
  tags: Record<string, string>;
  readonly lines: BatchLine[];
  readonly createdAt: number;
}

const pendingBatches = new Map<string, PendingBatch>();

/** Max age for orphaned batches (30 seconds). */
const BATCH_TIMEOUT_MS = 30_000;

/**
 * Purge any pending batches older than the timeout.
 * Called opportunistically on batch start to prevent leaks.
 */
function purgeOrphanedBatches(): void {
  const cutoff = Date.now() - BATCH_TIMEOUT_MS;
  for (const [id, batch] of pendingBatches) {
    if (batch.createdAt < cutoff) {
      pendingBatches.delete(id);
    }
  }
}

/**
 * Called on 'batch start draft/multiline'. Initialise collection.
 */
export function startMultilineBatch(batchId: string, target: string): void {
  purgeOrphanedBatches();
  pendingBatches.set(batchId, {
    target,
    nick: "",
    tags: {},
    lines: [],
    createdAt: Date.now(),
  });
}

/**
 * Called for each PRIVMSG inside a multiline batch.
 * Returns `true` if the message was consumed (caller should skip normal handling).
 */
export function collectMultilineLine(evt: {
  readonly batch?: { readonly id: string; readonly type: string } | undefined;
  readonly nick: string;
  readonly message: string;
  readonly tags: Record<string, string>;
}): boolean {
  if (evt.batch?.type !== "draft/multiline") return false;

  const pending = pendingBatches.get(evt.batch.id);
  if (!pending) return false;

  // Capture nick/tags from first line
  if (pending.lines.length === 0) {
    pending.nick = evt.nick;
    pending.tags = { ...evt.tags };
  }

  const hasConcat = "draft/multiline-concat" in evt.tags || "+draft/multiline-concat" in evt.tags;

  pending.lines.push({ text: evt.message, concat: hasConcat });
  return true;
}

export interface AssembledMultiline {
  readonly nick: string;
  readonly target: string;
  readonly text: string;
  readonly tags: Record<string, string>;
}

/**
 * Called on 'batch end draft/multiline'. Assembles the full message.
 */
export function endMultilineBatch(batchId: string): AssembledMultiline | undefined {
  const pending = pendingBatches.get(batchId);
  pendingBatches.delete(batchId);
  if (!pending || pending.lines.length === 0) return undefined;

  let text = "";
  for (let i = 0; i < pending.lines.length; i++) {
    const line = pending.lines[i]!;
    if (i === 0) {
      text = line.text;
    } else if (line.concat) {
      text += line.text;
    } else {
      text += "\n" + line.text;
    }
  }

  return { nick: pending.nick, target: pending.target, text, tags: pending.tags };
}

// --- Sending ---

/**
 * Generate a unique batch reference tag.
 */
let batchSeq = 0;
export function nextBatchRef(): string {
  return `ml${Date.now().toString(36)}${(batchSeq++).toString(36)}`;
}

export interface MultilineRawLine {
  readonly raw: string;
}

/**
 * Build the sequence of raw IRC lines to send a multiline message.
 * If the message is single-line and fits in normal length, returns undefined
 * (caller should use normal say()).
 *
 * @param target - Channel or nick target
 * @param message - Full message text (may contain newlines)
 * @param caps - Server's multiline capability values
 * @param maxLineBytes - Max bytes for a single PRIVMSG body (typically 350-400)
 * @param tags - Optional tags to attach to the BATCH open command
 */
export function buildMultilineBatch(
  target: string,
  message: string,
  caps: MultilineCaps,
  maxLineBytes: number = 350,
  tags?: Record<string, string>,
): MultilineRawLine[] | undefined {
  // Only use multiline for messages that actually need it
  const hasNewlines = message.includes("\n");
  const needsSplit = Buffer.byteLength(message, "utf8") > maxLineBytes;

  if (!hasNewlines && !needsSplit) return undefined;

  const ref = nextBatchRef();
  const lines: MultilineRawLine[] = [];

  // Open batch — with optional tags
  const tagStr = tags && Object.keys(tags).length > 0 ? formatTags(tags) + " " : "";
  lines.push({ raw: `${tagStr}BATCH +${ref} draft/multiline ${target}` });

  // Split message into logical lines (by newline), then split long lines
  const logicalLines = message.split("\n");
  let totalBytes = 0;
  let lineCount = 0;
  let truncated = false;

  outer: for (let i = 0; i < logicalLines.length; i++) {
    const logicalLine = logicalLines[i]!;
    const chunks = splitLine(logicalLine, maxLineBytes);

    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j]!;
      const isConcat = j > 0; // continuation of a split long line

      // Track limits — check before adding
      const chunkBytes = Buffer.byteLength(chunk, "utf8");
      const separatorBytes = lineCount > 0 && !isConcat ? 1 : 0;
      if (caps.maxBytes > 0 && totalBytes + separatorBytes + chunkBytes > caps.maxBytes) {
        truncated = true;
        break outer;
      }
      if (caps.maxLines !== undefined && lineCount >= caps.maxLines) {
        truncated = true;
        break outer;
      }

      totalBytes += separatorBytes + chunkBytes;
      lineCount++;

      const batchTag = `@batch=${ref}`;
      if (isConcat) {
        lines.push({
          raw: `${batchTag};draft/multiline-concat PRIVMSG ${target} :${chunk}`,
        });
      } else {
        lines.push({ raw: `${batchTag} PRIVMSG ${target} :${chunk}` });
      }
    }
  }

  // Don't send an empty batch (only open+close)
  if (lineCount === 0) return undefined;

  // If truncated, we still send what fits — the batch is valid
  void truncated;

  // Close batch
  lines.push({ raw: `BATCH -${ref}` });

  return lines;
}

/**
 * Split a single line into chunks that fit within maxBytes (UTF-8 aware).
 * Tries to break on spaces when possible.
 */
function splitLine(line: string, maxBytes: number): string[] {
  if (Buffer.byteLength(line, "utf8") <= maxBytes) return [line];

  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    if (Buffer.byteLength(remaining, "utf8") <= maxBytes) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point
    let splitAt = findSplitPoint(remaining, maxBytes);
    if (splitAt <= 0) splitAt = findCharBoundary(remaining, maxBytes);

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

/**
 * Try to find a space to break on within maxBytes.
 */
function findSplitPoint(text: string, maxBytes: number): number {
  // Walk forward to find the char boundary at maxBytes
  const boundary = findCharBoundary(text, maxBytes);

  // Search backwards for a space
  for (let i = boundary; i > 0; i--) {
    if (text[i - 1] === " ") return i; // keep space at end of chunk
  }

  return boundary;
}

/**
 * Find the last character index whose UTF-8 encoding fits within maxBytes.
 */
function findCharBoundary(text: string, maxBytes: number): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    const charBytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + charBytes > maxBytes) return i;
    bytes += charBytes;
    // Skip surrogate pair
    if (code > 0xffff) i++;
  }
  return text.length;
}

function formatTags(tags: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(tags)) {
    parts.push(v ? `${k}=${v}` : k);
  }
  return "@" + parts.join(";");
}
