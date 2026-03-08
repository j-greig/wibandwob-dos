# Screenshot Workflows

## Piping patterns

```bash
# Clipboard
scripts/screenshot.sh | pbcopy

# Diff two captures
scripts/screenshot.sh > before.txt
scripts/screenshot.sh | diff before.txt -

# ANSI to PNG
scripts/screenshot.sh -f ansi | ansilove -o screen.png

# Feed into LLM
scripts/screenshot.sh | cat - prompt.txt | llm

# Grep for content
scripts/screenshot.sh | grep -i "hello"

# Archive with timestamp
scripts/screenshot.sh -o "archive/screenshots/$(date +%s).txt"
```

## Formats

- `text` (default) — plain text, box-drawing chars, menu/status bars
- `ansi` — ANSI escape codes with color, convertible to PNG

## Full workflow: open windows → capture

```bash
docker compose exec substrate bash -c '
  WIN=$(curl -sf -X POST $WIBWOBDOS_URL/windows \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"text_editor\",\"title\":\"my window\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)[\"id\"])")

  curl -sf -X POST $WIBWOBDOS_URL/windows/$WIN/send_text \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"hello from outside\"}"

  curl -sf -X POST $WIBWOBDOS_URL/windows/cascade \
    -H "Content-Type: application/json" -d "{}"
'
sleep 0.5
scripts/screenshot.sh -o /tmp/screen.txt
```
