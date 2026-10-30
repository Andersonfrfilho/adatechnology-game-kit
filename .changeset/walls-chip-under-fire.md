---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.
