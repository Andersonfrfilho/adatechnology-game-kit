---
'@adatechnology/game-destruction-three': patch
---

`userData.destructionPart` may be a string or an object `{ id, material?, parent?, kind? }` in `specFromObject3D` and `bind`; `parent` + `kind` add an explicit joint.
