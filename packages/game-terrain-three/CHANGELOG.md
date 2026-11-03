# @adatechnology/game-terrain-three

## 0.2.0

### Minor Changes

- e413341: Rigid ground cracks: concrete, asphalt, tile and stone open a star of lines around a bullet, a hammer or a blast, reaching with the cube root of the energy (about a metre from a grenade on a slab, half that on asphalt), kept in snapshots and drawn as one mesh (`TerrainMaterial.crack`, `Terrain.cracks`, `crackLines`).
  A contact charge breaks a rigid layer right through once it has enough for its thickness cubed (about 1 kg of TNT for a 12 cm reinforced slab), baring the bars, which take the same blow and let a slab over a void drop (`TerrainMaterial.breach`, `TerrainBlowResult.breached`).
- e413341: The inspector says what the floor under the aim is: the ground profile (Dirt, Concrete slab), the material exposed there and how deep it was dug (`terrainProfileName`, `InspectInfo.ground`).
  A floor laid anew (opening an area, a reset) is drawn whole in the same frame instead of showing holes to the sky until every chunk had its turn (`Terrain.dirtyChunkCount`).

### Patch Changes

- Updated dependencies [e413341]
- Updated dependencies [e413341]
- Updated dependencies [379e44f]
  - @adatechnology/game-terrain@0.2.0
  - @adatechnology/game-contracts@0.21.0

## 0.1.2

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [32529a1]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-terrain@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-terrain@0.1.1

## 0.1.0

### Minor Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.
- 6d15aad: Bare rebar bends under blows and gives way; a slab over a void (`suspended_slab`) then opens onto the floor below.

### Patch Changes

- ffe17e5: The concrete block of the terrain area reads as concrete, not nearly black.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
- Updated dependencies [1821647]
- Updated dependencies [6d15aad]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-terrain@0.1.0
