# @adatechnology/game-terrain-three

## 0.6.0

### Minor Changes

- 91bbed8: Water splashes by weapon and by charge: `createWaterEffects` (game-vfx) with a profile per class of round (pistol, rifle, battle rifle, sniper, buckshot, slug...) and per explosive (TNT and kind), ricochet off grazing shots, trails of bubbles, columns, domes, shock rings, waves that push what floats, rain of drops, mist and foam, all with lives and pool limits; `createWaterEffectsLayer` (game-vfx-three) draws them instanced. A `pond` ground 1.4 m deep (game-terrain) in the ground area; impact-fuzed rounds go off on the water and thrown charges sink (`ExplosiveBody.isTriggeredBy`); the test room splashes every shot where it crosses water, skips grazing ones off it, draws blasts under or over water (no fireball under it) and adds `blastAt(explosive, point)`.

### Patch Changes

- Updated dependencies [91bbed8]
  - @adatechnology/game-terrain@0.8.0

## 0.5.8

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-terrain@0.7.4

## 0.5.7

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-terrain@0.7.3

## 0.5.6

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-terrain@0.7.1

## 0.5.5

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-terrain@0.7.0

## 0.5.4

### Patch Changes

- fa57abb: The ground far off shows the average of its pattern instead of its grain and joints sparkling as black dots.
- Updated dependencies [3d53e28]
- Updated dependencies [c4b8218]
  - @adatechnology/game-terrain@0.6.0
  - @adatechnology/game-contracts@0.30.0

## 0.5.3

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-terrain@0.5.2

## 0.5.2

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-terrain@0.5.1

## 0.5.1

### Patch Changes

- Updated dependencies [018c556]
  - @adatechnology/game-terrain@0.5.0

## 0.5.0

### Minor Changes

- 45fd34d: Bare rock (`bedrock`) as a ground of its own, with a lot in the test room; the HUD names every ground profile. `cratersAt` of the effects: on rock, asphalt or a slab a blast leaves only soot, not a dirt crater.

### Patch Changes

- Updated dependencies [45fd34d]
  - @adatechnology/game-terrain@0.4.0

## 0.4.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-terrain@0.3.2

## 0.4.1

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-terrain@0.3.1

## 0.4.0

### Minor Changes

- 78e76b0: More grounds to stand on, each with its own answer to a blow: mud, gravel, dry clay, snow, cobblestones, concrete pavers and shallow water. The room's default page lays a lot of every ground with its sign. Fixes the player standing twice as deep in a hole and twice as high on a heap.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-terrain@0.3.0

## 0.3.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-terrain@0.2.3

## 0.3.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-terrain@0.2.2

## 0.3.0

### Minor Changes

- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- 6247fbe: The room shows its memory and warns on screen when it leaks. The counters line adds geometries, textures and the JS heap (`geometries`, `textures`, `heap_mb` in `metrics()`). After each clear the room compares the GPU counts with the earlier clears of the same area: when they grew on each of the last four clears past the budget (40 geometries or 4 textures), a red banner stays under the tool, the log gets a `memory_leak` event and the counters line marks it, until a clear finds the memory back down. New `createMemoryWatch` and `RoomUi.alert`.

  The terrain area frees its strip labels (plane, material and canvas texture) when it closes, and a new lint rule (`kit/no-bare-remove`) fails a `removeFromParent()` in a function that frees nothing.
  The horde bench frees the walls of its scenes when a scene closes.

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-terrain@0.2.1

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
