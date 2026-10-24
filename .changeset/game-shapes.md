---
'@adatechnology/game-shapes': minor
---

New package: the kit's single 3D generator. A JSON shape (primitives, extrusions, lathes, box-minus-holes, transforms, groups, named parts, materials by id, LOD rules, instancing hints) becomes typed-array buffers per material, pure and deterministic by seed, transferable and cacheable by key. The generators are line-by-line ports of three.js r160 and the output is bit-identical to three's. `createShapeCache` (LRU by key and bytes), `createShapePool` (workers through any `postMessage`/`onmessage` object, in-flight sharing, transferred arrays, in-thread fallback) and `installShapeWorker` (`@adatechnology/game-shapes/worker`).
