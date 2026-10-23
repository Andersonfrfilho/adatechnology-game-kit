---
'@adatechnology/game-destruction-three': minor
---

Loose pieces and debris can be picked. Every mesh of a part now carries `userData.destructionPart` (part id) and `userData.destructionObject` (id of the world object it belongs to), including the meshes of a piece made by a collapse or detach and the mesh a vertex-range part gets when it leaves a merged mesh (they used to lose it). Fracture fragments, decals and ground stains carry `userData.destructionDebris = true` so a host can skip them in a raycast.
