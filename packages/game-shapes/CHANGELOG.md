# @adatechnology/game-shapes

## 0.2.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.2.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.2.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.2.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.2.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.2.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.2.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.2.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.1

### Patch Changes

- 106c0f5: No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.0

### Minor Changes

- 24b4981: Shape generators by instance (spec 005, D5): `createShapes({ packs, patch, remove })` returns a set (`register`, `unregister`, `get`, `list`, `record`, `generate`) of its own; its `generate` looks custom nodes up only in the set (new `GenerateOptions.isolatedGenerators`). `defaultShapeGenerators()` is the set behind `registerGenerator`, `unregisterGenerator`, `getGenerator` and `listGenerators`, which stay exported and `@deprecated` with the same results. The package now depends on `@adatechnology/game-contracts` for the catalog helpers; the IIFE bundles it. The worker and the shape cache still read the global registry.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.1.0

### Minor Changes

- ea8b287: New package: the kit's single 3D generator. A JSON shape (primitives, extrusions, lathes, box-minus-holes, transforms, groups, named parts, materials by id, LOD rules, instancing hints) becomes typed-array buffers per material, pure and deterministic by seed, transferable and cacheable by key. The generators are line-by-line ports of three.js r160 and the output is bit-identical to three's. `createShapeCache` (LRU by key and bytes), `createShapePool` (workers through any `postMessage`/`onmessage` object, in-flight sharing, transferred arrays, in-thread fallback) and `installShapeWorker` (`@adatechnology/game-shapes/worker`).
