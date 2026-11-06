---
'@adatechnology/game-terrain': minor
---

A round's crater in the ground follows its calibre: `applyHit` passes the `caliber` of a ballistic hit on, and `strike` takes it (`TerrainStrike.caliber`). The energy is still the volume taken; the calibre shapes it, so for the same energy a 5.56 mm round goes deeper and opens less than a 12.7 mm one, and a crater is at least two and a half calibres across. On a tiled floor a pistol round cracks the tile and a rifle round goes on into the mortar of the subfloor.
