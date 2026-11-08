# @adatechnology/game-interactables-three

## 0.2.12

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-interactables@0.2.25
  - @adatechnology/game-shapes@0.2.11

## 0.2.11

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-interactables@0.2.24
  - @adatechnology/game-shapes@0.2.10

## 0.2.10

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-interactables@0.2.23
  - @adatechnology/game-shapes@0.2.9

## 0.2.9

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-interactables@0.2.22
  - @adatechnology/game-shapes@0.2.8

## 0.2.8

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-interactables@0.2.21
  - @adatechnology/game-shapes@0.2.7

## 0.2.7

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-interactables@0.2.20
  - @adatechnology/game-shapes@0.2.6

## 0.2.6

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-interactables@0.2.19
  - @adatechnology/game-shapes@0.2.5

## 0.2.5

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-interactables@0.2.18
  - @adatechnology/game-shapes@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-interactables@0.2.17
  - @adatechnology/game-shapes@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.2.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-interactables@0.2.16
  - @adatechnology/game-shapes@0.2.2

## 0.2.1

### Patch Changes

- fd68284: No `any` in the three.js adapters of interactables, vegetation and urban: they take three's own types (`typeof THREE`, `Object3D`, `IUniform`, `HTMLCanvasElement`). New exported types: `SwayMaterial` and `UrbanLight`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-shapes@0.2.1
  - @adatechnology/game-shapes-three@0.3.1
  - @adatechnology/game-interactables@0.2.15

## 0.2.0

### Minor Changes

- 455522d: `createCord` and `catenary` move to `@adatechnology/game-shapes-three` (spec 005, D1), so the weapons no longer reach into `game-interactables-three` for them. `game-interactables-three` keeps both exports, `@deprecated`, delegating to the new ones; they are removed in the next major.
- 35474f0: `EffectsOptions.effects` (spec 005, A9): a function returning the host's effects world. With one, smoke, steam, fire and spark particles are played through it (`particle_puff`, `particle_glow`, `particle_streak`) with the colour, opacity, life and sizes the local pool would have given them, and `maxParticles` no longer caps them. Water stays in the local pool. Without one the pools are used as before, with a one-time warning (deprecated).
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [24b4981]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-shapes@0.2.0
  - @adatechnology/game-interactables@0.2.14
  - @adatechnology/game-props3d@0.3.3

## 0.1.15

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-interactables@0.2.13

## 0.1.14

### Patch Changes

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
  - @adatechnology/game-interactables@0.2.12

## 0.1.13

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-interactables@0.2.11

## 0.1.12

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-interactables@0.2.10

## 0.1.11

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-interactables@0.2.9

## 0.1.10

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-interactables@0.2.8

## 0.1.9

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-interactables@0.2.7

## 0.1.8

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [fcd0be6]
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-interactables@0.2.6

## 0.1.7

### Patch Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).
- Updated dependencies [ea8b287]
- Updated dependencies [e29f38d]
  - @adatechnology/game-shapes@0.1.0
  - @adatechnology/game-props3d@0.3.0

## 0.1.6

### Patch Changes

- @adatechnology/game-interactables@0.2.5

## 0.1.5

### Patch Changes

- @adatechnology/game-interactables@0.2.4

## 0.1.4

### Patch Changes

- @adatechnology/game-interactables@0.2.3

## 0.1.3

### Patch Changes

- @adatechnology/game-interactables@0.2.2

## 0.1.2

### Patch Changes

- @adatechnology/game-interactables@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [50eee43]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables@0.2.0

## 0.1.0

### Minor Changes

- fdc56f8: Initial release (0.1.0): three.js adapter for `@adatechnology/game-interactables` with a merged-by-material mesh api (animated parts), pose sync, cloth sway with matching shadow materials, pooled smoke/fire/steam/water/spark effects, procedural screens, real-time mirrors and cords.

### Patch Changes

- Updated dependencies [5ad2b1a]
  - @adatechnology/game-interactables@0.1.0
