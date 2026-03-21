#!/usr/bin/env bash
# install-hooks.sh — symlink repo hooks into .git/hooks
# Run once after cloning: bash scripts/install-hooks.sh

ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$ROOT/scripts/hooks"
HOOKS_DEST="$ROOT/.git/hooks"

for hook in "$HOOKS_SRC"/*; do
  name=$(basename "$hook")
  chmod +x "$hook"
  ln -sf "$hook" "$HOOKS_DEST/$name"
  echo "✓ installed: .git/hooks/$name → scripts/hooks/$name"
done
