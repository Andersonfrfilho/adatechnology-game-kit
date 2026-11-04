---
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

Masonry walls stand on concrete pillars along their length, as in confined masonry: besides the corner pillars, every exterior masonry wall gets a 0.2 x 0.2 m reinforced concrete pillar at its free ends and door jambs, beside each window, where another wall meets it and at most every `WALL_PILLAR_SPACING` (4 m), from the floor to the bond beam, which rests on them (`StructureOptions.wallPillars`, `false` for the corner pillars alone; the free-standing `wallPiece` has four). The house renderer draws them under the wall's plaster: a shot or a blow that takes out the plaster and bricks next to one shows its concrete (and its bars when the concrete goes), the bricks stop at its faces, and a brick wall that falls leaves the pillars and the bond beam standing.
