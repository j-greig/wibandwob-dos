# GitHub Markdown Posting

Use `tools/github/gh-markdown.sh` for issue/PR updates so multiline markdown is preserved.

## Commands

- `tools/github/gh-markdown.sh issue-comment <issue> <file>`
- `tools/github/gh-markdown.sh pr-comment <pr> <file>`
- `tools/github/gh-markdown.sh pr-body <pr> <file>`

You can also pipe from stdin using `-`.

## Examples

```bash
cat <<'EOF' | tools/github/gh-markdown.sh pr-comment 23 -
Summary:
- Formatting fix landed.

Tests:
- uv run --with pytest --with jsonschema --with fastapi pytest tests/contract tools/api_server/test_registry_dispatch.py -q
EOF
```

```bash
tools/github/gh-markdown.sh pr-body 23 /tmp/pr23-body.md
```

## Verification

Read back content after posting:

```bash
gh pr view 23 --json body
gh api repos/j-greig/wibandwob-dos/issues/comments/<comment_id> --jq .body
```
