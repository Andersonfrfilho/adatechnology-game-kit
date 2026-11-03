---
'@adatechnology/game-terrain': minor
'@adatechnology/game-terrain-three': minor
'@adatechnology/game-test-room': minor
---

The inspector says what the floor under the aim is: the ground profile (Dirt, Concrete slab), the material exposed there and how deep it was dug (`terrainProfileName`, `InspectInfo.ground`).
A floor laid anew (opening an area, a reset) is drawn whole in the same frame instead of showing holes to the sky until every chunk had its turn (`Terrain.dirtyChunkCount`).
