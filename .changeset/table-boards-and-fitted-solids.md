---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

`DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.
