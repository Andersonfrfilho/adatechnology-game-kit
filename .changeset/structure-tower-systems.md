---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-floorplan-structure': minor
---

Building systems of tall buildings (T10 §9). `game-contracts`: `PartSpec.contains.outflow` (the direction a fluid leaves a hole: roof water runs
down). `game-destruction`: `buildFrame({ continuousColumns, columnCage, roofThickness })` (a 20-storey frame stands on continuous columns).
`game-floorplan-structure`: `buildTower` and `addCore` (reinforced concrete shear-wall tube with stairs and elevator shafts, the strongest part in a
blast), `addCurtainWall` (glass hung from the slab edges, shatters in large shards), `addFlatRoof` (screed sloped to the drains, EPDM membrane that
leaks when punctured), `addMechanicalFloor` (elevator machines, water tank, chillers in the load), with `*_DEFAULTS`, `coreSize` and `towerWater`.
