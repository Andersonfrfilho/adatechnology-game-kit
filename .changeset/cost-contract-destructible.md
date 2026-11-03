---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-characters': patch
'@adatechnology/game-terrain': patch
---

Cost contract of `DestructibleImpl` (spec 005, D8): `describe()` and `state()` are O(1), allocation-free and cached between changes. `checkDestructible(impl, { cost: true })` measures 10 000 reads of each (new object per read, time and heap ceilings, all configurable). The character and the terrain now cache what they return; the values are the same.
