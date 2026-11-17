#!/bin/bash
# copy probe-step.test.ts.txt to packages/game-floorplan-three/tests/zz-probe-step.test.ts first; FACTOR toggles one thing, WARM=1 heats the engine as the room does
cd "$(git rev-parse --show-toplevel)"/packages/game-floorplan-three
for f in none opt nocast nonet notrimesh nohf hf2 hf4; do
  vals=""
  for r in 1 2 3; do
    line=$(FACTOR=$f WARM=1 PIECE_SOLVER=jolt timeout 170 npx vitest run tests/zz-probe-step.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^f1 " | head -1)
    s=$(echo "$line" | sed -E 's/.*steps ([0-9.]+)\+([0-9.]+).*/\1 \2/' | awk '{printf "%.2f", $1+$2}')
    vals="$vals $s"
  done
  echo "$f:$vals | $(echo "$line" | sed -E 's/.*(active [0-9]+).*(contacts .*)/\1 \2/')"
done
