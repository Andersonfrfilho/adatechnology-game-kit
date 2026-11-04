---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-floorplan-three': patch
---

Friction by material and round things that roll. A piece takes the Coulomb friction of the material it stands on (its lowest part): wood 0.4/0.3, steel 0.6/0.4,
glass 0.4/0.35, ceramic 0.5/0.4, rubber 1.0/0.8, concrete 0.7/0.6, plastic and paper 0.4/0.3, fabric and foam 0.6/0.5 (`friction.ts`, with the sources), mixed between
two surfaces by geometric mean: on a 25 degree wooden top a wooden box slides and a steel one holds. A piece whose drawing is round about one axis (a can, a bottle, a plate on
its edge) or all three (a ball) is `round`: lying, it touches by the lowest point of each rim across the surface under it, rolls (v = w r) and is held back by rolling
resistance (0.015) instead of the grip that stops a box from turning; standing, its rims hold it. What lands on a piece of several parts lands on the parts (a shelf's
boards), not on the box around them, and a piece that loses parts to a split touches the ground by what is left. The test room's tests change where the old grip hid
the physics: the bucket thrown by a blast rolls low, under a steel sheet's 60 cm of clearance, so it is stopped by a brick column; a walk shoves the 28 kg sofa a few cm.
