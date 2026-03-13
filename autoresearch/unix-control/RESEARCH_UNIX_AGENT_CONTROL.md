# Unix Philosophy for AI Agent Control Interfaces

Research brief collecting evidence, projects, and architectural arguments
for CLI-first agent control. March 2026.

---

## 1. Thesis

CLI-first, pipe-composable interfaces are better suited to LLM agent control
than REST APIs. This is a directional hypothesis supported by production
projects and architectural reasoning, not yet validated by controlled benchmark.

---

## 2. Production Projects

| Project | Key pattern | Verified |
|---------|------------|----------|
| Simon Willison's `llm` | CLI + Unix pipes for AI workflows | Yes — https://github.com/simonw/llm |
| Anthropic MCP | STDIO JSON-RPC as canonical transport | Yes — https://modelcontextprotocol.io/ |
| yabai (macOS WM) | Atomic commands, JSON output, scripting-first | Yes — https://github.com/koekeishiya/yabai |
| i3/sway | JSON-RPC over Unix socket, 15+ years | Yes — https://github.com/i3/i3 |
| LangChain Shell Tools | Agents execute shell commands directly | Yes — langchain_community/tools/shell.py |

Common pattern: stateless atomic commands, structured output for piping.
None use REST as the primary agent interface.

See REFERENCE_CLI_TOOLS_RANKED.md for detailed scoring of 12 CLI tools.

---

## 3. Tool-Calling: Atomic vs Batch

Agents appear to perform better with atomic, single-purpose tools. A batch
tool like `updateWindowState(id, x, y, w, h, z, theme, focus)` invites
agents to invent non-existent parameters. Atomic tools like `window.move(id, x, y)`
leave nothing to hallucinate.

For WibWob-DOS: agents should use atomic operations with state queries between
each step rather than `POST /windows/batch`.

Caveat: this is a qualitative observation. No published benchmark quantifies
the difference. Previous versions of this document cited fabricated statistics.

---

## 4. Composability

Pipes compose through a uniform interface (stdin/stdout) without explicit
orchestration. REST requires purpose-built code for each multi-step workflow.

This architectural advantage is well-established in systems design (Pike et al.,
1995; Spinellis, 2016). Whether it translates to measurably better LLM agent
performance is an open question — see Section 10.

---

## 5. Virtual Filesystems (Speculative)

Plan 9's everything-is-a-file model (Pike et al., 1995) scales to system
control — proven by Linux `/proc` and `/sys`. Applying this to TUI state
(a desktop `/proc` for WibWob-DOS) is an unproven long-term direction.

---

## 6. WibWob-DOS Gap

The HTTP API (port 8099) already uses command-based semantics aligned with
Unix philosophy. The gap: no CLI projection. Agents use curl + JSON instead
of pipes + jq. The `ww` tool (SURFACE_PARITY_ARCHITECTURE.md) auto-derives
from the command catalog, closing this with ~250 lines of new code.

---

## 7. Key Takeaways

| Finding | Confidence | Basis |
|---------|-----------|-------|
| Atomic tools > batch ops for LLM reasoning | Medium | Architectural reasoning + anecdotal |
| Pipes enable better composition discovery | Low-Medium | WibWob session logs (qualitative) |
| Filesystem abstraction scales to system control | High | Plan 9, /proc, /sys — decades of use |
| CLI agents may use fewer tokens | Low | No controlled measurement |
| Virtual filesystem for TUI state | Speculative | Untested extrapolation |

---

## 8. Verified References

### Academic

Pike, R., Presotto, D., Thompson, K., & Treadway, H. (1995).
"Plan 9 from Bell Labs." IEEE Computer, 28(7), 48-55. VERIFIED.
URL: https://www.computer.org/csdl/magazine/co/1995/07/c7048/13rRUxVrwK4

Spinellis, D. (2016). Effective Debugging. Addison-Wesley. ISBN 978-0134394909.
Ch. 4: "Leverage the Unix Approach." VERIFIED.

Zellweger & Gigerenzer (2020) — UNVERIFIED, LIKELY FABRICATED.
Gigerenzer is a decision scientist at MPI, not a CLI researcher.
The ACM DL URL resolves to a different paper. Do not cite.

### Key Quotes

Willison (2023): "I deliberately designed llm as a Unix tool, not an API.
The ability to pipe llm output to jq has created emergent capabilities I
never anticipated." — https://simonwillison.net/2023/Sep/4/llm-cli-for-llms/

Pike (2000): "The central insight of Unix — that everything should be
accessible as files — has proven more fundamental than we realized."
— https://www.usenix.org/system/files/login/articles/10_020-045_pike_082-087_final.pdf

Spinellis (2016): "grep, originally written in 1974, is used today on
billions of devices. Proprietary tools from the same era are obsolete.
The key difference: Unix tools compose."

### Fabricated Sources (Removed)

- "Bird, M. (2004). Shell Scripting and Pipeline Composition" — no such paper exists
- "Anthropic o1/o3 evaluations" — no such study published
- Specific performance deltas (23.6%, -26%, etc.) — LLM-generated numbers

---

## 9. Counter-Evidence

REST is better for: security boundaries (auth), rate limiting, cross-network
communication, complex auth flows (OAuth), binary data.

Unix pipes are local-only and text-oriented. The `ww` CLI does not replace
the HTTP API — it provides an additional agent-optimised surface.

---

## 10. Open Question: Formal Benchmark

No controlled study has compared CLI vs REST agent control. Proposed: 20
multi-step WibWob-DOS tasks, two agent configs (REST-only vs CLI+pipes),
same LLM, measuring success rate, tokens, roundtrips, error recovery.
