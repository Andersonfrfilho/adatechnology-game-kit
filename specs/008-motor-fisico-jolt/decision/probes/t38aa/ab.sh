#!/bin/bash
# T3.8aa A/B: the probe (copied to packages/game-floorplan-three/tests/zz-spread.test.ts) with the budget off and on, interleaved, 3 pairs x 3 runs a side, under the shared lock.
cd "$(dirname "$0")/../../../../../packages/game-floorplan-three"
for kind in blast hammer; do
  for pair in 1 2 3; do
    for side in off ${BUDGET:-4}; do
      echo "### kind=$kind pair=$pair side=$side"
      if [ "$side" = off ]; then unset SPREAD; else export SPREAD=$side; fi
      flock ~/.cache/adatechnology-game-kit/perf-measure.lock env PIECE_SOLVER=jolt RUNS=3 KIND=$kind timeout 1200 npx vitest run tests/zz-spread.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "SPREAD\]|HEAD|DIGEST|Error"
    done
  done
done
echo ALLDONE
