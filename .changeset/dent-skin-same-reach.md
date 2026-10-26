---
"@adatechnology/game-destruction-three": patch
---

A dent on a part with several meshes (a can shell and its label) uses the same reach on all of them: `Visuals.dentReach` finds the radius that gives each mesh at least 6 vertices (and 1.5 times the nearest one), the part takes the widest, and `applyDent` takes it as its last argument. The label follows the same smooth surface as the shell and no longer lets the shell show through.
