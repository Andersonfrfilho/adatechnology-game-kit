# @adatechnology/game-terrain

## 0.3.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.3.1

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.3.0

### Minor Changes

- fb985db: A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
- 78e76b0: More grounds to stand on, each with its own answer to a blow: mud, gravel, dry clay, snow, cobblestones, concrete pavers and shallow water. The room's default page lays a lot of every ground with its sign. Fixes the player standing twice as deep in a hole and twice as high on a heap.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.3

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.2

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.1

### Patch Changes

- 7b77aa7: Cost contract of `DestructibleImpl` (spec 005, D8): `describe()` and `state()` are O(1), allocation-free and cached between changes. `checkDestructible(impl, { cost: true })` measures 10 000 reads of each (new object per read, time and heap ceilings, all configurable). The character and the terrain now cache what they return; the values are the same.
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.2.0

### Minor Changes

- e413341: Rigid ground cracks: concrete, asphalt, tile and stone open a star of lines around a bullet, a hammer or a blast, reaching with the cube root of the energy (about a metre from a grenade on a slab, half that on asphalt), kept in snapshots and drawn as one mesh (`TerrainMaterial.crack`, `Terrain.cracks`, `crackLines`).
  A contact charge breaks a rigid layer right through once it has enough for its thickness cubed (about 1 kg of TNT for a 12 cm reinforced slab), baring the bars, which take the same blow and let a slab over a void drop (`TerrainMaterial.breach`, `TerrainBlowResult.breached`).
- e413341: The inspector says what the floor under the aim is: the ground profile (Dirt, Concrete slab), the material exposed there and how deep it was dug (`terrainProfileName`, `InspectInfo.ground`).
  A floor laid anew (opening an area, a reset) is drawn whole in the same frame instead of showing holes to the sky until every chunk had its turn (`Terrain.dirtyChunkCount`).

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.1.2

### Patch Changes

- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

- 32529a1: A reset ground digs the same crater and throws the same clods as a new one: `reset` (and `setLayout`) start the ground's random stream over, and the clods count their ids from one again. Before, every reset went on from where the last blow left the stream, so the test room's scenarios that dig the floor came out different from one run to the next (`house_two_pillars` failed now and then).
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.1.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0

## 0.1.0

### Minor Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.
- 6d15aad: Bare rebar bends under blows and gives way; a slab over a void (`suspended_slab`) then opens onto the floor below.

### Patch Changes

- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
