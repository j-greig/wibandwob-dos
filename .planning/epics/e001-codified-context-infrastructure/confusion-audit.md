# E001 Confusion Audit: Top Subsystems by Agent Trouble

Source: 645 Claude Code sessions from ~/.claude/projects/-Users-james-Repos-wibandwob-dos/
Method: Regex extraction of confusion signals (agent self-corrections,
retries, error messages) and human corrections (NEVER, WRONG, "I already
told you", etc.) from JSONL session logs.
Scoring: confusion_signals + 3x human_corrections (corrections weighted
higher because they indicate the agent failed to self-correct).

## Top 7 Subsystems Needing Specs

### 1. Terminal / PTY (score 99, 63 confused, 12 corrected)

The single worst subsystem. Problems include: forkpty lifecycle, terminal
buffer rendering, PTY read/write coordination, crash recovery, and agents
repeatedly failing to interact with terminal windows correctly.

Specific failure modes observed:
- Terminal "crashed" or "exited" without agent understanding why
- Self-prompt messages routing to wrong terminal instance
- PTY stream goes stale or breaks mid-session
- Agents unable to distinguish terminal state from terminal chrome
- forkpty child process cleanup (setsid, signal handling, EIO/ENXIO)

NOTE: Terminal code was deleted in the TS migration (29f75d2). But PTY
management will return — Backrooms TV uses forkpty, and any future terminal
window will need the same patterns. The confusion history makes this a
strong candidate for a spec documenting WHAT WENT WRONG and WHY.

### 2. Window System (score 86, 77 confused, 3 corrected)

Window manager, facade, records, lifecycle. High confusion volume with
relatively few human corrections — meaning agents were confused but humans
were also confused about what was wrong.

Specific failure modes:
- Window ID mismatches (trying to control wrong window)
- 400 errors from validation when creating/resizing windows
- findWindowById returning stale pointers (C++ era segfault)
- Window type not reported correctly in state
- close_window not actually closing, state out of sync
- Window records: bag of optionals, hard to reason about

This is the CORE abstraction and it still causes confusion in the TS
version (WindowFacade phases 1-5 were needed to fix it).

### 3. State / API / IPC (score 77, 35 confused, 14 corrected)

Desktop state service, control API, IPC socket. HIGH correction rate (14)
means humans had to repeatedly tell agents the right approach.

Specific failure modes:
- api_get_state emitting wrong field names (width/height vs w/h)
- Window type field missing from state entirely
- IPC socket discovery failing, connection refused
- Stale state after window close (state not updated)
- Key name mismatches between create_window and get_state
- Event subscription fragmentation (auth read loop)

This is the subsystem where the paper's "if you explained it twice, write
it down" applies most strongly. The correction count of 14 means the human
re-explained API contracts at least 14 times.

### 4. Multiplayer / PartyKit (score 44, 35 confused, 3 corrected)

Room sync, durable objects, websockets. Less relevant to TS MVP but still
a source of confusion when agents touch shared state.

Specific failure modes:
- Stale PartyKit canonical state from previous sessions
- Infinite window loop from broken sync
- Room name collisions between instances
- WebSocket state machines misunderstood

### 5. Scramble (score 40, 25 confused, 5 corrected)

The cat! Agents struggle with Scramble's command interface, layout
positioning, and how it interacts with close_all preservation.

Specific failure modes:
- Negative-height guard in layout crashes in tiny terminals
- toggleScramble layout math confusion
- exec_command forwarding args to C++ registry incorrectly
- Agents not understanding Scramble's special protection status

### 6. Agent / LLM System (score 30, 9 confused, 7 corrected)

Agent tools, session management, LLM config, SDK bridge. LOW confusion
but HIGH correction rate — this is where humans most often had to say
"NEVER do that" or "WRONG approach."

Specific failure modes:
- SDK bridge MCP tool wiring confusion
- Model provider selection (haiku vs sonnet)
- Auth system complexity before simplification
- Tool parameter type coercion (numbers as strings)
- Agent window vs chat window confusion (before collapse)

### 7. Workspace (score 29, 5 confused, 8 corrected)

Workspace save/restore. LOW confusion but HIGHEST correction-to-confusion
ratio of any subsystem. Agents get it wrong, humans correct them, but the
agent keeps getting it wrong in the next session.

Specific failure modes:
- Workspace restore race condition (async window creation)
- Config file path resolution from build/ directory
- Validator repo root detection
- Snapshot schema misunderstandings
- default.json location and fallback behaviour

## Tier 2 Specialist Candidates

Based on the confusion data, these subsystems should get specs FIRST:

1. Window System spec — covers WindowFacade, WindowManager, WindowRecord,
   lifecycle, ID management, state reporting
2. State & API spec — covers get_state contract, IPC protocol, socket
   discovery, field naming conventions, event subscription
3. Workspace spec — covers save/restore flow, snapshot schema, boot
   restore, race conditions, default.json
4. Agent Tools spec — covers tool parameter contracts, type coercion,
   desktop state injection, permission model
5. Terminal/PTY spec — covers forkpty patterns, child process lifecycle,
   stream handling (even though current terminal is removed, patterns
   recur in Backrooms TV and future terminal)

## Methodology Notes

- qmd collection "wwdos-sessions" created from extracted session logs
  (99 substantive sessions with 3+ messages, extracted from 645 total)
- BM25 search works for targeted queries but sparse for confusion signals
  (confusion is scattered, not topically clustered)
- Regex extraction over raw JSONL was more effective for quantitative
  ranking than qmd search
- qmd search is better for finding SPECIFIC incidents and reading context
  around them: `qmd search "stale" -c wwdos-sessions`
- Embeddings not yet generated (589 hashes pending `qmd embed`)

## Session Hotspots

Sessions with highest total confusion (for manual review):
- 4edfa7b0 (75 conf, 3 corr) — massive session, API/state/multiplayer
- 62851dd8 (71 conf) — multi-instance WibWob coordination
- 1e0f3dc4 (19 conf, 1 corr) — terminal self-prompting
- bbc31c39 (9 conf, 4 corr) — SDK bridge, LLM config, Codex delegation
- 2238d811 (10 conf) — terminal, scramble, layout
