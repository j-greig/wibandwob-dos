---
name: pi-session-log-explorer
description: >
  Search and extract content from pi agent session logs (~/.pi/agent/sessions/).
  Use to recover lost work (files written by agents), find what was discussed,
  replay commands the agent ran, or audit what a wibwob-agent session did.
  Triggers on: "what did the agent write", "recover lost module", "find that
  thing the agent made", "search session logs", "what happened in that session",
  "did the agent commit that", "recover from session".
---

# Pi Session Log Explorer

Search pi agent JSONL session logs to find content, recover lost work, and
audit what agents did.

## Session log location

```
~/.pi/agent/sessions/<project-dir>/
```

Project dirs are named by slugifying the repo path, e.g.:
  --Users-james-Repos-wibandwob-dos--
  --Users-james-Repos-wibandwob-dos-e019--

## Find the right project dir

```bash
ls ~/.pi/agent/sessions/ | grep -i wibwob
# or
ls ~/.pi/agent/sessions/ | grep -i <keyword>
```

## List recent sessions for a project

```bash
PROJ="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
ls -t "$PROJ"/*.jsonl | head -10
```

## Show first user message from each recent session (quick scan)

```bash
PROJ="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
for f in $(ls -t "$PROJ"/*.jsonl | head -15); do
  echo "=== $(basename $f) ==="
  python3 -c "
import json, sys
with open('$f') as fh:
    for line in fh:
        try:
            obj = json.loads(line)
            if obj.get('type') == 'message':
                msg = obj['message']
                if msg.get('role') == 'user':
                    content = msg.get('content','')
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c,dict) and c.get('type')=='text' and c['text'].strip():
                                print(c['text'][:150])
                                sys.exit(0)
                    elif isinstance(content,str) and content.strip():
                        print(content[:150])
                        sys.exit(0)
        except: pass
  " 2>/dev/null
done
```

## Show full conversation (user + assistant text) from one session

```bash
python3 -c "
import json
with open('PATH_TO_SESSION.jsonl') as f:
    for line in f:
        try:
            obj = json.loads(line)
            if obj.get('type') == 'message':
                msg = obj['message']
                role = msg.get('role','')
                content = msg.get('content','')
                if isinstance(content, list):
                    for c in content:
                        if isinstance(c,dict) and c.get('type')=='text' and c['text'].strip():
                            print(f'{role.upper()}: {c[\"text\"][:400]}')
                            print()
                elif isinstance(content,str) and content.strip():
                    print(f'{role.upper()}: {content[:400]}')
                    print()
        except: pass
"
```

## Find sessions that mention a keyword (across all sessions for a project)

```bash
PROJ="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
grep -l "heartbeat\|module\|keyword" "$PROJ"/*.jsonl
```

## Recover files written by the agent in a session

Extracts all `write` tool calls and their content:

```bash
python3 - <<'EOF'
import json

SESSION = "PATH_TO_SESSION.jsonl"

with open(SESSION) as f:
    for line in f:
        try:
            obj = json.loads(line)
            if obj.get('type') == 'message':
                msg = obj['message']
                if msg.get('role') == 'assistant':
                    for c in msg.get('content', []):
                        if isinstance(c, dict) and c.get('type') == 'toolCall' and c.get('name') == 'write':
                            args = c.get('arguments', {})
                            print(f"FILE: {args.get('path','?')}")
                            print(args.get('content',''))
                            print('===END===')
        except:
            pass
EOF
```

## List all files written in a session (paths only)

```bash
python3 -c "
import json
with open('PATH_TO_SESSION.jsonl') as f:
    for line in f:
        try:
            obj = json.loads(line)
            if obj.get('type')=='message' and obj['message'].get('role')=='assistant':
                for c in obj['message'].get('content',[]):
                    if isinstance(c,dict) and c.get('type')=='toolCall' and c.get('name')=='write':
                        print(c['arguments'].get('path','?'))
        except: pass
"
```

## List all bash commands run in a session

```bash
python3 -c "
import json
with open('PATH_TO_SESSION.jsonl') as f:
    for line in f:
        try:
            obj = json.loads(line)
            if obj.get('type')=='message' and obj['message'].get('role')=='assistant':
                for c in obj['message'].get('content',[]):
                    if isinstance(c,dict) and c.get('type')=='toolCall' and c.get('name')=='bash':
                        print(c['arguments'].get('command','?')[:200])
                        print()
        except: pass
"
```

## Search across ALL wibwob-dos sessions for a keyword

```bash
PROJ="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
for f in "$PROJ"/*.jsonl; do
  if grep -q "heartbeat\|KEYWORD" "$f" 2>/dev/null; then
    echo "FOUND: $(basename $f)"
    grep -o '"text":"[^"]*heartbeat[^"]*"' "$f" | head -3
  fi
done
```

## Sessions from last N minutes

```bash
find ~/.pi/agent/sessions/ -name "*.jsonl" -mmin -60 \
  | sed 's|.*/sessions/||' | sed 's|/.*||' | sort -u
```

## JSONL structure reference

Each line is one of:

```json
{"type": "session", "version": 3, "id": "...", "timestamp": "..."}
{"type": "message", "id": "...", "parentId": "...", "timestamp": "...",
  "message": {
    "role": "user" | "assistant" | "toolResult",
    "content": "string" | [array of content blocks]
  }
}
```

Content block types:
- `{"type": "text", "text": "..."}` — text message
- `{"type": "toolCall", "name": "write"|"bash"|"edit"|..., "arguments": {...}}` — tool call
- `{"type": "tool_result", "content": [...]}` — tool result (user role)

## Typical recovery workflow

1. Find the project sessions dir: `ls ~/.pi/agent/sessions/ | grep wibwob`
2. List recent sessions with first messages to identify the right one
3. Search for keyword: `grep -l "keyword" PROJ/*.jsonl`
4. Extract written files from that session using the write-tool extractor
5. Re-write the files to disk
6. Run `bun run typecheck` to verify
7. Commit
