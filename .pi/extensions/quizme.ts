/**
 * quizme.ts — Interactive decision prompt with sections, checkboxes, radio items, and DO IT button
 *
 * Two item types:
 *   checkbox (default) — toggle on/off, runs command when checked + DO IT pressed
 *   radio              — pick one of N options + always has a final "Type a command…" custom option
 *
 * Controls:
 *   ↑↓              — move cursor between items
 *   Space/Enter     — toggle checkbox OR open radio picker
 *   ↑↓ in picker    — move between radio options (last = custom)
 *   Enter in picker — confirm option; if custom, opens inline editor
 *   Enter in editor — confirm typed command
 *   Esc in editor   — back to radio options
 *   Esc in picker   — close picker
 *   Tab             — move focus to/from DO IT button
 *   Enter on DO IT  — execute all actioned items
 *   Esc             — cancel
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { execSync } from "node:child_process";

// ── Schema ────────────────────────────────────────────────────────────────────

const RadioOptionSchema = Type.Object({
	label: Type.String({ description: "Display label for this radio option" }),
	command: Type.String({ description: "Shell command to run if this option is chosen" }),
});

const ItemSchema = Type.Object({
	label: Type.String({ description: "Display label for the item" }),
	command: Type.Optional(Type.String({ description: "Shell command (checkbox items). Omit when using options." })),
	checked: Type.Optional(Type.Boolean({ description: "Pre-check this item (default: false)" })),
	options: Type.Optional(Type.Array(RadioOptionSchema, {
		description: "Providing options makes this a radio item. A 'Type a command…' slot is always appended.",
	})),
});

const SectionSchema = Type.Object({
	heading: Type.String({ description: "Section heading shown above its items" }),
	items: Type.Array(ItemSchema),
});

const ChecklistParams = Type.Object({
	title: Type.String({ description: "Title shown at the top of the quiz" }),
	sections: Type.Array(SectionSchema, { description: "Sections grouping related items" }),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface RadioOption { label: string; command: string }

interface CheckboxItem {
	kind: "checkbox";
	label: string;
	command: string;
	checked: boolean;
}

interface RadioItem {
	kind: "radio";
	label: string;
	options: RadioOption[];       // provided options
	selected: number | null;      // index into options + 1 virtual "custom" slot
	customCommand: string | null; // set when user types their own
}

type Item = CheckboxItem | RadioItem;
interface Section { heading: string; items: Item[] }
interface Executed { label: string; command: string; output: string; ok: boolean }
interface ChecklistResult { cancelled: boolean; executed: Executed[] }

const CUSTOM_IDX = -1; // sentinel for the "Type a command…" slot

// ── Extension ─────────────────────────────────────────────────────────────────

export default function quizme(pi: ExtensionAPI) {
	pi.registerTool({
		name: "quizme",
		label: "Quiz Me",
		description:
			"Interactive decision prompt — present options, let the human choose, execute. " +
			"Checkboxes for batch actions, radio for pick-one decisions. " +
			"If 3+ sections, auto-appends a 'What else?' free-text section for things the agent missed. " +
			"Human presses DO IT to execute all chosen items. " +
			"AGENT RULE: after DO IT, execute ONLY what the human explicitly selected — nothing more. " +
			"Do not infer, extend, or act on unchecked items. " +
			"CONSTRUCTING THE QUIZ: read the specificity of the request. " +
			"If the request is explicit and detailed — transcribe it precisely, no additions. " +
			"If the request is exploratory or open-ended ('what next?', 'quiz me on X') — use your knowledge of the codebase philosophy, project momentum, and the user's working style (smallest slice that proves the direction, delta over noise, prove it works before extending it) to surface options the user didn't think to name. " +
			"The quiz is a decision surface, not a transcription.",
		parameters: ChecklistParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: UI not available" }],
					details: { cancelled: true, executed: [] } as ChecklistResult,
				};
			}

			const sections: Section[] = params.sections.map((s) => ({
				heading: s.heading,
				items: s.items.map((it): Item => {
					if ("options" in it && it.options && it.options.length > 0) {
						return {
							kind: "radio", label: it.label, options: it.options,
							selected: null, customCommand: null,
						};
					}
					return {
						kind: "checkbox", label: it.label,
						command: (it as { command?: string }).command ?? "",
						checked: (it as { checked?: boolean }).checked ?? false,
					};
				}),
			}));

			// Auto-append "What else?" when 3+ sections — catches things the agent missed
			if (sections.length >= 3) {
				sections.push({
					heading: "What else?",
					items: [{
						kind: "radio" as const,
						label: "Anything the agent missed?",
						options: [{ label: "Nothing — looks good", command: "echo 'no additions'" }],
						selected: null,
						customCommand: null,
					}],
				});
			}

			type NavEntry = { si: number; ii: number };
			const navList: NavEntry[] = [];
			for (let si = 0; si < sections.length; si++)
				for (let ii = 0; ii < sections[si].items.length; ii++)
					navList.push({ si, ii });

			const result = await ctx.ui.custom<ChecklistResult>((tui, theme, _kb, done) => {
				let cursor = 0;
				let buttonFocused = false;

				// Radio picker state
				let radioOpen = false;
				let radioCursor = 0; // index within options + 1 custom slot

				// Custom command editor state
				let editorOpen = false;
				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
					},
				};
				const editor = new Editor(tui, editorTheme);

				let cachedLines: string[] | undefined;
				function refresh() { cachedLines = undefined; tui.requestRender(); }

				function currentItem(): Item | undefined {
					if (!navList[cursor]) return undefined;
					return sections[navList[cursor].si].items[navList[cursor].ii];
				}

				function actionedCount() {
					return sections.reduce((n, s) => n + s.items.filter((it) =>
						it.kind === "checkbox" ? it.checked
							: it.selected !== null || it.customCommand !== null
					).length, 0);
				}

				// Editor submit — sets customCommand on the current radio item
				editor.onSubmit = (value) => {
					const cmd = value.trim();
					const item = currentItem();
					if (item?.kind === "radio" && cmd) {
						item.customCommand = cmd;
						item.selected = CUSTOM_IDX;
					}
					editorOpen = false;
					radioOpen = false;
					editor.setText("");
					refresh();
				};

				function handleInput(data: string) {
					// ── Editor open ──────────────────────────────────────────
					if (editorOpen) {
						if (matchesKey(data, Key.escape)) {
							editorOpen = false; editor.setText(""); refresh(); return;
						}
						editor.handleInput(data); refresh(); return;
					}

					if (matchesKey(data, Key.escape)) {
						if (radioOpen) { radioOpen = false; refresh(); return; }
						done({ cancelled: true, executed: [] }); return;
					}

					// ── Radio picker open ────────────────────────────────────
					if (radioOpen) {
						const item = currentItem();
						if (item?.kind !== "radio") { radioOpen = false; refresh(); return; }
						const totalOpts = item.options.length + 1; // +1 for custom
						if (matchesKey(data, Key.up)) {
							radioCursor = Math.max(0, radioCursor - 1); refresh(); return;
						}
						if (matchesKey(data, Key.down)) {
							radioCursor = Math.min(totalOpts - 1, radioCursor + 1); refresh(); return;
						}
						if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
							if (radioCursor === item.options.length) {
								// Custom slot — open editor
								editor.setText(item.customCommand ?? "");
								editorOpen = true;
							} else {
								item.selected = radioCursor;
								item.customCommand = null;
								radioOpen = false;
							}
							refresh(); return;
						}
						return;
					}

					// ── Button focused ───────────────────────────────────────
					if (buttonFocused) {
						if (matchesKey(data, Key.enter)) {
							const executed: Executed[] = [];
							for (const s of sections) {
								for (const it of s.items) {
									let cmd = ""; let label = it.label;
									if (it.kind === "checkbox") {
										if (!it.checked || !it.command) continue;
										cmd = it.command;
									} else {
										if (it.selected === null && !it.customCommand) continue;
										if (it.selected === CUSTOM_IDX && it.customCommand) {
											cmd = it.customCommand;
											label = `${it.label} → (custom)`;
										} else if (it.selected !== null) {
											const opt = it.options[it.selected];
											cmd = opt.command;
											label = `${it.label} → ${opt.label}`;
										}
									}
									if (!cmd) continue;
									try {
										const output = execSync(cmd, {
											encoding: "utf8", cwd: process.cwd(), timeout: 30000,
										}).trim();
										executed.push({ label, command: cmd, output, ok: true });
									} catch (e: unknown) {
										executed.push({ label, command: cmd, output: String(e), ok: false });
									}
								}
							}
							done({ cancelled: false, executed }); return;
						}
						if (matchesKey(data, Key.up) || matchesKey(data, Key.shift("tab"))) {
							buttonFocused = false; cursor = navList.length - 1; refresh(); return;
						}
						if (matchesKey(data, Key.tab)) {
							buttonFocused = false; cursor = 0; refresh(); return;
						}
						return;
					}

					// ── List navigation ──────────────────────────────────────
					if (matchesKey(data, Key.tab)) { buttonFocused = true; refresh(); return; }
					if (matchesKey(data, Key.up)) { cursor = Math.max(0, cursor - 1); refresh(); return; }
					if (matchesKey(data, Key.down)) {
						cursor < navList.length - 1 ? cursor++ : (buttonFocused = true);
						refresh(); return;
					}
					if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
						const item = currentItem();
						if (!item) return;
						if (item.kind === "checkbox") {
							item.checked = !item.checked;
						} else {
							radioCursor = item.selected === CUSTOM_IDX
								? item.options.length  // point cursor at custom slot
								: item.selected ?? 0;
							radioOpen = true;
						}
						refresh();
					}
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;
					const lines: string[] = [];
					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(theme.fg("accent", "─".repeat(width)));
					add(theme.fg("accent", theme.bold(` ${params.title}`)));
					lines.push("");

					for (let si = 0; si < sections.length; si++) {
						const section = sections[si];
						add(theme.fg("muted", ` ${section.heading}`));

						for (let ii = 0; ii < section.items.length; ii++) {
							const item = section.items[ii];
							const isCursor = !buttonFocused
								&& navList[cursor]?.si === si && navList[cursor]?.ii === ii;
							const prefix = isCursor ? theme.fg("accent", "> ") : "  ";

							if (item.kind === "checkbox") {
								const box = item.checked ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
								add(`${prefix}${box} ${theme.fg(item.checked ? "text" : "muted", item.label)}`);
							} else {
								const isCustom = item.selected === CUSTOM_IDX;
								const chosenLabel = isCustom
									? `(custom) ${item.customCommand}`
									: item.selected !== null ? item.options[item.selected].label : null;
								const letter = isCustom ? "?" :
									item.selected !== null ? String.fromCharCode(65 + item.selected) : null;
								const box = chosenLabel
									? theme.fg("success", `(${letter})`)
									: theme.fg("dim", "( )");
								const suffix = chosenLabel
									? theme.fg("dim", ` — ${chosenLabel}`)
									: theme.fg("dim", " — pick one ↵");
								add(`${prefix}${box} ${theme.fg(chosenLabel ? "text" : "muted", item.label)}${suffix}`);

								// Inline radio picker
								if (isCursor && radioOpen) {
									for (let oi = 0; oi < item.options.length; oi++) {
										const isRc = oi === radioCursor;
										const ltr = String.fromCharCode(65 + oi);
										const rp = isRc ? theme.fg("accent", "    > ") : "      ";
										add(`${rp}${theme.fg(isRc ? "accent" : "muted", `${ltr}) ${item.options[oi].label}`)}`);
									}
									// Custom slot
									const isCustomRc = radioCursor === item.options.length;
									const cp = isCustomRc ? theme.fg("accent", "    > ") : "      ";
									if (editorOpen) {
										add(`${cp}${theme.fg("accent", "✎ Type a command:")}`);
										for (const line of editor.render(width - 6)) add(`      ${line}`);
										add(theme.fg("dim", "      Enter to confirm • Esc to back"));
									} else {
										add(`${cp}${theme.fg(isCustomRc ? "accent" : "dim", "✎ Type a command…")}`);
									}
								}
							}
						}
						lines.push("");
					}

					// DO IT button
					const n = actionedCount();
					const btnLabel = n > 0 ? ` DO IT (${n} item${n !== 1 ? "s" : ""}) ` : " DO IT ";
					const btnStyled = buttonFocused
						? theme.bg("selectedBg", theme.fg("text", theme.bold(btnLabel)))
						: n > 0 ? theme.fg("success", theme.bold(btnLabel))
						: theme.fg("dim", btnLabel);
					add(` ${btnStyled}`);
					lines.push("");

					const help = editorOpen
						? " Enter to confirm command • Esc to go back"
						: radioOpen
						? " ↑↓ choose • Enter confirm • Esc back"
						: buttonFocused
						? " Enter to execute • Tab/↑ go back • Esc cancel"
						: " ↑↓ navigate • Space/Enter toggle • Tab → DO IT • Esc cancel";
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
				return { content: [{ type: "text", text: "Cancelled" }], details: result };
			}
			const lines = result.executed.map((e) => e.ok ? `✓ ${e.label}` : `✗ ${e.label}: ${e.output}`);
			return {
				content: [{ type: "text", text: lines.join("\n") || "Nothing was actioned." }],
				details: result,
			};
		},

		renderCall(args, theme) {
			const sections = (args.sections as Section[]) || [];
			const total = sections.reduce((n, s) => n + s.items.length, 0);
			let text = theme.fg("toolTitle", theme.bold("quizme "));
			text += theme.fg("muted", `${args.title} — `);
			text += theme.fg("dim", `${total} item${total !== 1 ? "s" : ""} in ${sections.length} section${sections.length !== 1 ? "s" : ""}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as ChecklistResult | undefined;
			if (!details || details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			if (details.executed.length === 0) return new Text(theme.fg("dim", "Nothing actioned — do not act on unchecked items"), 0, 0);
			const lines = [
				theme.fg("dim", `Human selected ${details.executed.length} item(s). Act on ONLY these:`),
				...details.executed.map((e) =>
					e.ok ? `${theme.fg("success", "✓")} ${e.label}` : `${theme.fg("error", "✗")} ${e.label}`
				),
			];
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
