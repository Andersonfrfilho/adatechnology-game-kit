---
'@adatechnology/game-shapes': minor
'@adatechnology/game-shapes-three': minor
---

z-fighting guard: `coincidentFaces` (game-shapes) finds triangles on the same plane, facing the same way, that overlap; `coincidentFacesOf(root)` (game-shapes-three) runs it on any three.js object in world space (instances, only what is drawn, the nearest LOD level, decals with polygonOffset skipped) and names the two meshes of each hit.
