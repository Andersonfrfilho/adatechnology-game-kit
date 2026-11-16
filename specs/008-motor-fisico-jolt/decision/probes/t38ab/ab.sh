#!/bin/bash
MINE=/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/passo-jolt-pecas
BASE=/tmp/claude-1000/pj/base
while ! grep -q BOWLDONE /tmp/claude-1000/pj/bowl.log; do sleep 5; done
echo "START $(date +%H:%M:%S) freq $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq)"
probe() { # label tree env...
  local label="$1" tree="$2"; shift 2
  echo "=== $label $(date +%H:%M:%S)"
  (cd $tree/packages/game-floorplan-three && env PIECE_SOLVER=jolt "$@" npx vitest run tests/zz-probe.test.ts -t ${KIND:-blast} 2>&1 | sed "s/\\x1b\\[[0-9;]*m//g" | grep -E "STEPALL|SPIKE|STEADY" | cut -c1-230)
}
for i in 1 2 3 4 5 6; do
  probe base-$i $BASE RUNS=3 D4=1
  probe mine-$i $MINE RUNS=3 D4=1
done
for i in 1 2 3 4 5 6; do
  KIND=hammer probe baseh-$i $BASE RUNS=3 D4=1
done
echo "LEVERS $(date +%H:%M:%S)"
for combo in "60 64" "60 32" "120 32" "120 16" "120 8" "180 21" "240 16" "240 8" "240 4" "240 32"; do set -- $combo; probe "hz$1-it$2" $MINE RUNS=5 D4=1 JOLT_STEP=$1 JOLT_ITERATIONS=$2; done
for m in 50 30 20; do probe "cap-$m" $MINE RUNS=5 D4=1 MLP=$m; done
probe optbp-every $MINE RUNS=5 D4=1 OPTBP=every
probe optbp-changed $MINE RUNS=5 D4=1 OPTBP=changed
for m in "ccd130 130 ccdoff" "ccd165 165 ccdoff" "cat130 130 cat" "cat165 165 cat" "census130 130 census"; do set -- $m; echo "=== $1"; (cd $MINE/packages/game-floorplan-three && env PIECE_SOLVER=jolt RUNS=1 D4=1 SF=$2 STEPTEST=$3 npx vitest run tests/zz-probe.test.ts -t blast 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "CENSUS|CCDOFF|CAT\]" | cut -c1-300); done
echo "GATES $(date +%H:%M:%S)"
for i in 1 2; do
  for t in base mine; do
    tree=$MINE; [ $t = base ] && tree=$BASE
    echo "=== gate-$t-$i $(date +%H:%M:%S)"
    (cd $tree && ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_ROUNDS=5 ROOM_EXPLOSION_OUT=/tmp/claude-1000/pj/gate-$t-$i.json node tools/gpu/perf-gate.mjs room-explosion 2>&1 | tail -25)
  done
done
echo ALLDONE2
