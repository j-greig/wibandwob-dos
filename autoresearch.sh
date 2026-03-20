#!/bin/bash
# autoresearch.sh — generate docs/skills.md then score it
set -euo pipefail
python3 scripts/gen-skills-doc.py
python3 autoresearch-score.py
