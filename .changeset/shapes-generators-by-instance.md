---
'@adatechnology/game-shapes': minor
---

Shape generators by instance (spec 005, D5): `createShapes({ packs, patch, remove })` returns a set (`register`, `unregister`, `get`, `list`, `record`, `generate`) of its own; its `generate` looks custom nodes up only in the set (new `GenerateOptions.isolatedGenerators`). `defaultShapeGenerators()` is the set behind `registerGenerator`, `unregisterGenerator`, `getGenerator` and `listGenerators`, which stay exported and `@deprecated` with the same results. The package now depends on `@adatechnology/game-contracts` for the catalog helpers; the IIFE bundles it. The worker and the shape cache still read the global registry.
