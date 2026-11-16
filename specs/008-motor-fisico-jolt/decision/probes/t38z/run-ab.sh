#!/bin/bash
S=$SCRATCH
W=$REPO
cd $W/packages/game-floorplan-three
for i in 1 2 3 4 5 6 7 8 9; do
  for v in base new; do
    rm -rf $W/packages/game-destruction-three/dist && cp -r $S/dist-$v $W/packages/game-destruction-three/dist
    for k in blast hammer; do
      env PIECE_SOLVER=jolt RUNS=1 FRAMES=240 npx vitest run tests/probe-spikes.test.ts -t $k 2>&1 | grep -E "SPIKE|HEAD|PRE\]|DIGEST|KITWORST|^f[0-9]+ " | sed "s/\x1b\[[0-9;]*m//g" | sed "s/^/$v $k $i /" >> $S/ab-corte/out.txt
    done
  done
done
echo DONE >> $S/ab-corte/out.txt
