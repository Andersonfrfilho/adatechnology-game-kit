---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-destruction': patch
'@adatechnology/game-items-three': minor
'@adatechnology/game-test-room': patch
---

A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A round gives each part it crosses only the momentum it lost in it (a 9 mm through a cardboard box keeps almost all of it; before it threw the box 2.8 m and its neighbours with it). A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity.
