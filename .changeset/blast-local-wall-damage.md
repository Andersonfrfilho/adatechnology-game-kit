---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-three': patch
'@adatechnology/game-terrain': minor
---

A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
