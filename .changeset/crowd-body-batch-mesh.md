---
'@adatechnology/game-characters-three': minor
---

The body batch is a plain `Mesh` over an `InstancedBufferGeometry` instead of an `InstancedMesh`: the unused `instanceMatrix` is gone, so the body program takes 11 vertex attribute slots instead of 15 and has room for the identity attributes. `BodyBatch.mesh` is a `BodyBatchMesh` (`Mesh & { count }`); `count` mirrors the geometry's `instanceCount`. The pose, the colours and the golden attributes do not change; the program key does (no `USE_INSTANCING`), so a warm-up must register the batch's own material after this change.
