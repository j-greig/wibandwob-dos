#!/usr/bin/env bash
# @desc  Find a Ghostty terminal by cwd, clear the line, type a command, press enter.
#
# Usage: bash send-to-terminal.sh <cwd-needle> <command>
#   bash send-to-terminal.sh wibandwob-dos "bun run dev"
#   bash send-to-terminal.sh myproject "npm test"
set -euo pipefail

NEEDLE="${1:?usage: send-to-terminal.sh <cwd-needle> <command>}"
CMD="${2:?usage: send-to-terminal.sh <cwd-needle> <command>}"

osascript <<EOF
set needle to "${NEEDLE}"

tell application "Ghostty"
  set matches to every terminal whose working directory contains needle
  if (count of matches) = 0 then
    set matches to every terminal whose name contains needle
  end if

  if (count of matches) = 0 then
    error "No terminal matched: " & needle
  end if

  set t to item 1 of matches
  focus t
  -- Clear any stray input
  send key "c" modifiers "control" to t
  delay 0.3
  send key "u" modifiers "control" to t
  delay 0.2
  -- Type command and press enter
  input text "${CMD}" to t
  delay 0.1
  send key "enter" to t
end tell
EOF
