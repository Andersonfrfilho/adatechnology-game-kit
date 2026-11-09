---
'@adatechnology/game-vehicles': patch
---

`surfaceRay` of the vehicle reads the triangles through the triangle index (`raycastMeshesLikeThree`, the same early outs as `Mesh.raycast`
of three.js r160, then only the triangles whose box the ray crosses) and brings up to date only the drawn vehicle, not its effects. Every ray
hits what it hit before (same part, point, normal and distance); a ray at a damaged sedan costs about a tenth of before. New option
`bruteForceRays` keeps the three.js path for comparison.
