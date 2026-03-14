#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")"

# Primary metric: typecheck wall-clock time
# We run typecheck 3 times and take the median to reduce noise
times=()
for i in 1 2 3; do
  t=$( { time bun run typecheck 2>&1; } 2>&1 | grep '^real' | awk '{print $2}' | sed 's/m/*60+/;s/s//' | bc )
  times+=("$t")
done

# Sort and take median
sorted=($(printf '%s\n' "${times[@]}" | sort -n))
median="${sorted[1]}"

echo "typecheck_s=${median}"

# Secondary metrics
max_file_lines=$(wc -l src/core/*.ts src/services/*.ts src/windows/*.ts 2>/dev/null | sort -rn | head -2 | tail -1 | awk '{print $1}')
any_count=$(grep -rn "as any" src/core/ 2>/dev/null | wc -l | tr -d ' ')
sdk_gaps=$(grep -rn "from.*\.\./\.\./src/" modules/ 2>/dev/null | grep -v microapp-sdk | wc -l | tr -d ' ')
file_count=$(find src -name "*.ts" | wc -l | tr -d ' ')

echo "max_file_lines=${max_file_lines}"
echo "any_count=${any_count}"
echo "sdk_gaps=${sdk_gaps}"
echo "file_count=${file_count}"
