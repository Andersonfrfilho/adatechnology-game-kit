---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-items-goods': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-test-room': patch
---

A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.
