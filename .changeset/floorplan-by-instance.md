---
'@adatechnology/game-floorplan': minor
---

Engine by instance (spec 005, D5): `createFloorplan({ packs, patch, remove })` makes an engine with registries, zones and locales of its own (two engines on one page share nothing); packs are `(engine) => void` or `{ register }`. `defaultFloorplan()` is the engine behind the global `engine`, which stays exported and `@deprecated`. The package now depends on `@adatechnology/game-contracts` for `applyPatches` and `removeIds`; the IIFE bundles it.
