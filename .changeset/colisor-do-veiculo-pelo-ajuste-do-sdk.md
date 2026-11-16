---
'@adatechnology/game-vehicles-three': patch
---

A box collider of a vehicle piece is kept only where `fitOrientedBoxes` (game-shapes) holds the drawing in one box, not only where each box corner has a vertex: a frame or a cage touches all eight corners and is mostly air, and is now held by its triangles.
