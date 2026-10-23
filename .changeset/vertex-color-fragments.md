---
'@adatechnology/game-destruction-three': patch
---

Fragments and debris of vertex-coloured meshes use the average vertex colour (cached per mesh) times `material.color` instead of coming out white.
