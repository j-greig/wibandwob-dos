#!/bin/bash
# Create a full backup repo on GitHub before destructive operations
set -euo pipefail

REPO_NAME="$(basename "$(git remote get-url origin)" .git)-backup"
USER=$(gh api user -q .login)
DATE=$(date +%Y-%m-%d)

echo "Creating $USER/$REPO_NAME (private)..."
gh repo create "$USER/$REPO_NAME" --private \
  --description "Backup before branch jubilee ($DATE)" --clone=false

git remote add backup "https://github.com/$USER/$REPO_NAME.git"
echo "Pushing all branches..."
git push backup --all
echo "Pushing all tags..."
git push backup --tags
git remote remove backup

echo "✅ Backup complete: https://github.com/$USER/$REPO_NAME"
