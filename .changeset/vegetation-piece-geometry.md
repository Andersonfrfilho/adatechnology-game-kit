---
'@adatechnology/game-vegetation': patch
---

Wood pieces (trunk, branch, stem, arm, pad) now carry optional `radius`, `length`, `axis` and `base`, also in the lot `pieceTable` and `userData.destructionPart`, so destruction can size them by their real thickness instead of the AABB.
