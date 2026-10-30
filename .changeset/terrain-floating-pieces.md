---
'@adatechnology/game-terrain': minor
'@adatechnology/game-terrain-three': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.
