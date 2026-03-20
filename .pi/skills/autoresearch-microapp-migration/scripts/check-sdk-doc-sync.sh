#!/usr/bin/env bash
set -euo pipefail

# If SDK surface changed in working tree, docs must change too.
changed_files=$(git status --porcelain | awk '{print $2}')

sdk_changed=0
echo "$changed_files" | grep -Eq '^src/sdk/|^src/services/microapp-sdk\.ts$' && sdk_changed=1 || true

if [[ "$sdk_changed" -eq 0 ]]; then
  echo "PASS: SDK surface unchanged (no doc sync required)"
  exit 0
fi

doc1='.agents/guides/microapp/sdk-reference.md'
doc2='.agents/guides/microapp.md'

doc1_changed=0
doc2_changed=0
echo "$changed_files" | grep -Eq "^${doc1}$" && doc1_changed=1 || true
echo "$changed_files" | grep -Eq "^${doc2}$" && doc2_changed=1 || true

if [[ "$doc1_changed" -eq 1 && "$doc2_changed" -eq 1 ]]; then
  echo "PASS: SDK docs synced"
  exit 0
fi

echo "FAIL: SDK changed but docs not fully updated" >&2
echo "Required when SDK changes:" >&2
echo "- ${doc1}" >&2
echo "- ${doc2}" >&2
exit 1
