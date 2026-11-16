#!/bin/bash
# T3.8aa: CPU profile of frames 0 and 1 of the blast and the hammer, budget off and on (4 ms), 3 runs a side (run 0 is the cold one), under the shared lock.
# Uses the T3.8v probe (decision/probes/t38v/probe-spikes.test.ts.txt) copied to packages/game-floorplan-three/tests/zz-spikes.test.ts, with its createTestRoom options taking
#   ...(process.env.SPREAD ? { debris: { workBudget: { budgetMs: Number(process.env.SPREAD) } } } : {})
cd "$(dirname "$0")/../../../../../packages/game-floorplan-three"
for side in off ${BUDGET:-4}; do for kind in blast hammer; do
  if [ "$side" = off ]; then unset SPREAD; else export SPREAD=$side; fi
  echo "### $side $kind"
  flock ~/.cache/adatechnology-game-kit/perf-measure.lock env PIECE_SOLVER=jolt RUNS=3 FRAMES=4 PF=0,1 timeout 900 npx vitest run tests/zz-spikes.test.ts -t $kind 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^\[PF\]|^INCL" | grep -vE "chunk-hooks|zz-spikes|task_queues"
done; done
