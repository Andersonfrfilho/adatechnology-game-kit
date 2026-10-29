---
"@adatechnology/game-destruction-three": patch
---

A skin mesh (`userData.destructionSkin`: a label, a coat) now moves with the surface of the shell under it when the part is dented (nearest shell triangle, barycentric weights, `applyPartDent`), instead of being dented on its own grid, so the two meshes never cross whatever their vertex grids are.

The dent of a part also uses one reach for all its meshes: `Visuals.dentReach` finds the radius that gives each mesh at least 10 vertices (and 1.5 times the distance to the nearest), the part takes the widest.
