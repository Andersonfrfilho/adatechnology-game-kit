#!/bin/bash
cd /home/miyazaki/Documents/personal/adatechnology-game-kit-wt/chao-um-corpo/packages/game-floorplan-three
S=/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit-wt-engine-jolt/60a09640-8a5b-46e0-a5a4-b15e0bc862bb/scratchpad
for tiles in off on; do
 for i in 1 2 3; do
  for side in old new; do
   cp $S/electrical.$side.ts src/utilities/electrical.ts
   if [ $tiles = on ]; then export TILES=1; else unset TILES; fi
   echo "### tiles=$tiles pair=$i side=$side"
   PIECE_SOLVER=jolt RUNS=3 timeout 900 npx vitest run tests/zz-spikes.test.ts 2>&1 | rg "SPIKE|HEAD|WORST|^f[0-9]+ " | cut -c1-260
  done
 done
done
cp $S/electrical.new.ts src/utilities/electrical.ts
echo ALLDONE
