---
"@adatechnology/game-destruction-three": patch
---

`specFromObject3D` (and the renderer's part matching and piece measuring) now work in metres for a scaled root: the root's world scale is kept, only its position and rotation are removed. A model drawn in other units and shrunk with `root.scale` no longer gets an oversized destruction body.
