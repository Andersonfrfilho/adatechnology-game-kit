---
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan': patch
---

New package: the structure of every plan from `@adatechnology/game-floorplan` (spec 001, T2.2c). Construction systems (masonry, wood frame, log, improvised, canvas),
`result.structure` with every part that carries load and what it rests on (foundation, floors, walls, bond beams and plates, pillars, porch posts, trusses or
rafters, roof, stairs, water tank), `toDestructibleSpec` sized from the loads at rest so a house holds the loss of one pillar and falls with two, and the "Structure"
layer of the 2D viewer. With `wallDetail: 'coarse'` the structure and the spec are equal to the Visor de casas 3D in 900 recorded plans.
