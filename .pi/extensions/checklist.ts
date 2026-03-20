/**
 * checklist.ts — Interactive checklist with sections, checkboxes, and DO IT button
 *
 * Registers a `checklist` tool. The LLM passes a title, sections with headings,
 * and items each with a label + shell command to run when actioned.
 *
 * Controls:
 *   ↑↓        — move cursor
 *   Space/Enter — toggle checkbox (when on an item)
 *   Tab        — move focus to/from DO IT button
 *   Enter      — execute checked commands (when DO IT is focused)
 *   Esc        — cancel
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { execSync } from "node:child_process";

const ItemSchema = Type.Object({
	label: Type.String({ description: "Display label for the item" }),
	command: Type.String({ description: "Shell command to run when this item is actioned" }),
	checked: Type.Optional(Type.Boolean({ description: "Pre-check this item (default: false)" })),
});

const SectionSchema = Type.Object({
	heading: Type.String({ description: "Section heading shown above its items" }),
	items: Type.Array(ItemSchema),
});

const ChecklistParams = Type.Object({
	title: Type.String({ description: "Title shown at the top of the checklist" }),
	sections: Type.Array(SectionSchema, { description: "Sections grouping related items" }),
});

interface Item {
	label: string;
	command: string;
	checked: boolean;
}

interface Section {
	heading: string;
	items: Item[];
}

interface ChecklistResult {
	cancelled: boolean;
	executed: { label: string; command: string; output: string; ok: boolean }[];
}

export default function checklist(pi: ExtensionAPI) {
	pi.registerTool({
		name: "checklist",
		label: "Checklist",
		description:
			"Show an interactive checklist with sections and checkboxes. " +
			"User checks items then presses DO IT to execute the commands for all checked items. " +
			"Use for presenting a batch of actions (file deletions, script runs, fixes) and letting " +
			"the user choose which to execute.",
		parameters: ChecklistParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: UI not available" }],
					details: { cancelled: true, executed: [] } as ChecklistResult,
				};
			}

			// Build flat list of (sectionIdx, itemIdx) for cursor navigation
			// alongside the sections data
			const sections: Section[] = params.sections.map((s) => ({
				heading: s.heading,
				items: s.items.map((it) => ({
					label: it.label,
					command: it.command,
					checked: it.checked ?? false,
				})),
			}));

			// Build flat navigation index: array of {sectionIdx, itemIdx}
			type NavEntry = { sectionIdx: number; itemIdx: number };
			const navList: NavEntry[] = [];
			for (let si = 0; si < sections.length; si++) {
				for (let ii = 0; ii < sections[si].items.length; ii++) {
					navList.push({ sectionIdx: si, itemIdx: ii });
				}
			}

			const result = await ctx.ui.custom<ChecklistResult>((tui, theme, _kb, done) => {
				let cursor = 0; // index into navList
				let buttonFocused = false;
				let cachedLines: string[] | undefined;

				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function checkedCount() {
					return sections.reduce((n, s) => n + s.items.filter((it) => it.checked).length, 0);
				}

				function handleInput(data: string) {
					// Esc always cancels
					if (matchesKey(data, Key.escape)) {
						done({ cancelled: true, executed: [] });
						return;
					}

					// Tab toggles between list and button
					if (matchesKey(data, Key.tab)) {
						buttonFocused = !buttonFocused;
						refresh();
						return;
					}

					if (buttonFocused) {
						// Enter on DO IT executes
						if (matchesKey(data, Key.enter)) {
							const executed: ChecklistResult["executed"] = [];
							for (const s of sections) {
								for (const it of s.items) {
									if (!it.checked) continue;
									try {
										const output = execSync(it.command, {
											encoding: "utf8",
											cwd: process.cwd(),
											timeout: 30000,
										}).trim();
										executed.push({ label: it.label, command: it.command, output, ok: true });
									} catch (e: unknown) {
										const msg = e instanceof Error ? e.message : String(e);
										executed.push({ label: it.label, command: it.command, output: msg, ok: false });
									}
								}
							}
							done({ cancelled: false, executed });
						}
						// ↑ moves back to list
						if (matchesKey(data, Key.up)) {
							buttonFocused = false;
							cursor = navList.length - 1;
							refresh();
						}
						return;
					}

					// List navigation
					if (matchesKey(data, Key.up)) {
						cursor = Math.max(0, cursor - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.down)) {
						if (cursor < navList.length - 1) {
							cursor++;
						} else {
							buttonFocused = true;
						}
						refresh();
						return;
					}

					// Toggle checkbox
					if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
						if (navList.length > 0) {
							const { sectionIdx, itemIdx } = navList[cursor];
							sections[sectionIdx].items[itemIdx].checked =
								!sections[sectionIdx].items[itemIdx].checked;
							refresh();
						}
						return;
					}
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;
					const lines: string[] = [];
					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(theme.fg("accent", "─".repeat(width)));
					add(theme.fg("accent", theme.bold(` ${params.title}`)));
					lines.push("");

					let navIdx = 0;
					for (const section of sections) {
						// Section heading
						add(theme.fg("muted", ` ${section.heading}`));

						for (const item of section.items) {
							const isCursor = !buttonFocused && navList[cursor]?.sectionIdx === sections.indexOf(section)
								&& navList[cursor]?.itemIdx === section.items.indexOf(item);
							const box = item.checked
								? theme.fg("success", "[x]")
								: theme.fg("dim", "[ ]");
							const prefix = isCursor ? theme.fg("accent", "> ") : "  ";
							const labelColor = item.checked ? "text" : "muted";
							add(`${prefix}${box} ${theme.fg(labelColor, item.label)}`);
							navIdx++;
						}
						lines.push("");
					}

					// DO IT button
					const n = checkedCount();
					const btnLabel = n > 0 ? ` DO IT (${n} item${n !== 1 ? "s" : ""}) ` : " DO IT ";
					const btnStyled = buttonFocused
						? theme.bg("selectedBg", theme.fg("text", theme.bold(btnLabel)))
						: n > 0
						? theme.fg("success", theme.bold(btnLabel))
						: theme.fg("dim", btnLabel);
					add(` ${btnStyled}`);
					lines.push("");

					const help = buttonFocused
						? " Enter to execute • Tab to go back • Esc to cancel"
						: " ↑↓ navigate • Space toggle • Tab → DO IT • Esc cancel";
					add(theme.fg("dim", help));
					add(theme.fg("accent", "─".repeat(width)));

					cachedLines = lines;
					return lines;
				}

				return {
					render,
					invalidate: () => { cachedLines = undefined; },
					handleInput,
				};
			});

			if (result.cancelled) {
				return {
					content: [{ type: "text", text: "Cancelled" }],
					details: result,
				};
			}

			const lines = result.executed.map((e) =>
				e.ok ? `✓ ${e.label}` : `✗ ${e.label}: ${e.output}`
			);
			return {
				content: [{ type: "text", text: lines.join("\n") || "Nothing was checked." }],
				details: result,
			};
		},

		renderCall(args, theme) {
			const sections = (args.sections as Section[]) || [];
			const total = sections.reduce((n, s) => n + s.items.length, 0);
			let text = theme.fg("toolTitle", theme.bold("checklist "));
			text += theme.fg("muted", `${args.title} — `);
			text += theme.fg("dim", `${total} item${total !== 1 ? "s" : ""} across ${sections.length} section${sections.length !== 1 ? "s" : ""}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as ChecklistResult | undefined;
			if (!details || details.cancelled) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}
			if (details.executed.length === 0) {
				return new Text(theme.fg("dim", "Nothing executed"), 0, 0);
			}
			const lines = details.executed.map((e) =>
				e.ok
					? `${theme.fg("success", "✓")} ${e.label}`
					: `${theme.fg("error", "✗")} ${e.label}`
			);
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
