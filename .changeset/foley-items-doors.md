---
'@adatechnology/game-audio': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-interactables-household': minor
'@adatechnology/game-vehicles-three': minor
---

Foley of the hand. `game-audio` ships `FOLEY_BANK`: doors (wooden, metal, locked rattle, slam), fridge, microwave, drawers, car doors and lids, item pickup by material, throw, can and bottle opening, gulps, chewing and first aid, under the ids of the sound list so a recorded take under the same id replaces the synthesised one. Each recipe draws pitch, timing and level from ranges (no two plays alike) and uses `FOLEY_FALLOFF`, which falls off faster and loses its highs with distance. `LEAF_FOLEY_SETS` groups the leaf sounds by kind (`car_door`, `fridge`, `microwave`, `drawer`, `wood_door`, `metal_door`).

`TestableItem.sounds` (`ItemSounds`) lets an item name its leaf sound set per part, its pickup class, its opening sound and the sound of each use. The household fridges and microwave and the vehicles of the vehicles test area declare theirs.

`createDestructionSound` registers the foley bank and plays a key without a rule that is the id of a registered sound. The test room plays a leaf's set (the item's, else a drawer for a slide, else a metal or wooden door by material; a heavy leaf slams), and now sounds when an item is picked up, thrown, opened (can tab or screw cap) and while it is drunk or eaten. The doors keys `leaf_latch`, `leaf_creak_*`, `leaf_shut_*` and `leaf_rattle` are no longer sent by the room's doors.
