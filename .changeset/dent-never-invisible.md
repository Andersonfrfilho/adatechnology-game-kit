---
"@adatechnology/game-destruction-three": patch
---

A dent is never silently invisible: when fewer than 3 vertices of a mesh fall inside the dent radius (a mesh coarser than the dent), `applyDent` widens the radius to 1.5 times the distance to the nearest vertex, so the nearest vertices are pushed in.
