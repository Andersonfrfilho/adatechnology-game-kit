---
'@adatechnology/game-vehicles-three': patch
---

A box collider of a vehicle piece is kept only where `fitOrientedBoxes` (game-shapes) holds the drawing in one box, not only where each box corner has a vertex: a piece made of separate solids (a ladder frame of loose rails, a block with a loose detail) can touch all eight corners and be mostly air, and is now held by its triangles.
