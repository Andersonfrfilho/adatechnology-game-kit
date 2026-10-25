---
'@adatechnology/game-weapons-three': patch
'@adatechnology/game-animals-three': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-props3d': patch
'@adatechnology/game-interactables-three': patch
'@adatechnology/game-shapes-three': patch
---

The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
