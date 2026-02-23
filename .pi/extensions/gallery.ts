/**
 * WibWob Primer Gallery — browse ASCII art primers from modules-private/wibwobworld/primers
 *
 * Commands:
 *   /gallery          open the gallery
 *   /gallery <name>   open at a specific primer (partial match)
 *
 * Keys:
 *   ←/→ or h/l       previous / next
 *   r                 random primer
 *   ESC or q          close
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";

const PRIMERS_DIR = path.join(process.cwd(), "modules-private/wibwobworld/primers");

/** Read the first frame of a primer (stops at ---- delimiter). */
function readPrimer(filePath: string): string[] {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const lines = content.split("\n");
		const frameEnd = lines.findIndex((l) => l.trimEnd() === "----");
		const frame = frameEnd >= 0 ? lines.slice(0, frameEnd) : lines;
		// trim trailing blank lines
		let end = frame.length;
		while (end > 0 && frame[end - 1].trim() === "") end--;
		return frame.slice(0, end).map((l) => l.trimEnd());
	} catch {
		return ["[error reading file]"];
	}
}

class GalleryBrowser {
	private primers: string[] = [];
	private index = 0;
	private artLines: string[] = [];
	private cachedRenderWidth = -1;
	private cachedRenderLines: string[] = [];

	constructor(
		private tui: { requestRender(): void },
		startName?: string,
	) {
		try {
			this.primers = fs
				.readdirSync(PRIMERS_DIR)
				.filter((f) => f.endsWith(".txt"))
				.sort();
		} catch {
			this.primers = [];
		}

		if (startName && this.primers.length > 0) {
			const lower = startName.toLowerCase();
			const match = this.primers.findIndex((f) => f.toLowerCase().includes(lower));
			if (match >= 0) this.index = match;
		}

		this.load();
	}

	private load(): void {
		if (this.primers.length === 0) {
			this.artLines = ["no primers found in", PRIMERS_DIR];
		} else {
			this.artLines = readPrimer(path.join(PRIMERS_DIR, this.primers[this.index]));
		}
		this.cachedRenderWidth = -1;
	}

	/** Returns false to signal the overlay should close. */
	handleInput(data: string): boolean {
		if (matchesKey(data, "escape") || data === "q" || data === "Q") {
			return false;
		}
		if (matchesKey(data, "right") || data === "l" || data === "L" || data === "n" || data === "N") {
			this.index = (this.index + 1) % this.primers.length;
			this.load();
			this.tui.requestRender();
		} else if (matchesKey(data, "left") || data === "h" || data === "H" || data === "p" || data === "P") {
			this.index = (this.index - 1 + this.primers.length) % this.primers.length;
			this.load();
			this.tui.requestRender();
		} else if (data === "r" || data === "R") {
			this.index = Math.floor(Math.random() * this.primers.length);
			this.load();
			this.tui.requestRender();
		}
		return true;
	}

	invalidate(): void {
		this.cachedRenderWidth = -1;
	}

	render(width: number): string[] {
		if (this.cachedRenderWidth === width) return this.cachedRenderLines;

		const termHeight = (process.stdout.rows ?? 40) - 1; // -1 for footer bar
		const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
		const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
		const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
		const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

		const lines: string[] = [];

		// ── Header ──────────────────────────────────────────────────────────
		const name = this.primers[this.index] ?? "—";
		const counter = `${this.index + 1}/${this.primers.length}`;
		const artW = Math.max(...this.artLines.map((l) => visibleWidth(l)));
		const artH = this.artLines.length;
		const sizeBadge = dim(`${artW}×${artH}`);
		const header = ` ${bold(cyan(name))}  ${dim(counter)}  ${sizeBadge}`;
		lines.push(truncateToWidth(header, width));
		lines.push(dim("─".repeat(width)));

		// ── Art ─────────────────────────────────────────────────────────────
		const HEADER_LINES = 2;
		const FOOTER_LINES = 2;
		const contentHeight = Math.max(1, termHeight - HEADER_LINES - FOOTER_LINES);

		const visible = this.artLines.slice(0, contentHeight);
		for (const line of visible) {
			lines.push(truncateToWidth(line, width));
		}
		// pad so footer is always at the same position
		for (let i = visible.length; i < contentHeight; i++) {
			lines.push("");
		}

		// ── Footer ───────────────────────────────────────────────────────────
		lines.push(dim("─".repeat(width)));
		const hint = `${yellow("←/→")} prev/next  ${yellow("r")} random  ${yellow("q")} close`;
		lines.push(dim(` ${hint}`));

		this.cachedRenderLines = lines;
		this.cachedRenderWidth = width;
		return lines;
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("gallery", {
		description: "Browse WibWob ASCII art primers  (←/→ navigate, r random, q close)",

		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Gallery requires interactive mode", "error");
				return;
			}

			const startName = args?.trim() || undefined;

			await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
				const browser = new GalleryBrowser(tui, startName);
				return {
					render: (w) => browser.render(w),
					invalidate: () => browser.invalidate(),
					handleInput: (data) => {
						if (!browser.handleInput(data)) done(undefined);
					},
				};
			});
		},
	});
}
