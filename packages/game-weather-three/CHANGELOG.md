# @adatechnology/game-weather-three

## 0.5.17

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-weather@0.3.19

## 0.5.16

### Patch Changes

- Updated dependencies [9dc3676]
  - @adatechnology/game-vfx@0.14.0

## 0.5.15

### Patch Changes

- Updated dependencies [91bbed8]
  - @adatechnology/game-vfx@0.13.0

## 0.5.14

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-weather@0.3.18

## 0.5.13

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-vfx@0.12.0
  - @adatechnology/game-weather@0.3.17

## 0.5.12

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-weather@0.3.16

## 0.5.11

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [99183cb]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-vfx@0.11.0
  - @adatechnology/game-weather@0.3.15

## 0.5.10

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-weather@0.3.10

## 0.5.9

### Patch Changes

- Updated dependencies [8976efa]
- Updated dependencies [b1f747f]
  - @adatechnology/game-vfx@0.10.1
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-weather@0.3.9

## 0.5.8

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
- Updated dependencies [5170e39]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vfx@0.10.0
  - @adatechnology/game-weather@0.3.8

## 0.5.7

### Patch Changes

- Updated dependencies [45fd34d]
  - @adatechnology/game-vfx@0.9.0

## 0.5.6

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-weather@0.3.7

## 0.5.5

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-weather@0.3.6

## 0.5.4

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [6c3877d]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-vfx@0.8.0
  - @adatechnology/game-weather@0.3.5

## 0.5.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.5.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-weather@0.3.3

## 0.5.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-weather@0.3.1

## 0.5.0

### Minor Changes

- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
- Updated dependencies [65ccb0c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-weather@0.3.0
  - @adatechnology/game-vfx@0.7.0

## 0.4.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vfx@0.6.0
  - @adatechnology/game-weather@0.2.8

## 0.4.2

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
  - @adatechnology/game-weather@0.2.7

## 0.4.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-vfx@0.5.0
  - @adatechnology/game-vfx-three@0.3.5
  - @adatechnology/game-weather@0.2.6

## 0.4.0

### Minor Changes

- 3aec7f3: `ModuleHost.addObject` (game-contracts, implemented by game-test-room): a module puts an item of the host's catalogue in the world as scenery; it stays through clears and area openings, takes shots, blows, blasts and fire like any item, and the scenarios run without it. The weather visual's `rigItem` uses it: in the test room the headlights car is the fleet's real sedan (holes, glass, sparks, tyres, doors), no longer a drawing the shots went through.

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-vfx-three@0.3.4
  - @adatechnology/game-weather@0.2.5
  - @adatechnology/game-vfx@0.4.4

## 0.3.3

### Patch Changes

- 50d8074: `footprintBlocker` (game-contracts): the `ModuleHost.addBlocker` function of a solid object on the floor, a rectangle in the object's own space that turns and moves with it. The weather visual's lamp rig car now blocks the walking player with it (it stands in every area of the test room, and the player walked through it), and the vehicles test area uses it for its vehicles and the lane car.
- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3
  - @adatechnology/game-weather@0.2.4

## 0.3.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2
  - @adatechnology/game-weather@0.2.3

## 0.3.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-weather@0.2.2
  - @adatechnology/game-vfx@0.4.1

## 0.3.0

### Minor Changes

- dd403c4: The bench's lamp rig no longer draws its own car (a dark box with two lamp plates). `createWeatherVisual({ vehicles })` takes the vehicles SDK (`createVehiclesThree` of game-vehicles-three with the fleet installed) and mounts the headlights on a fleet car (`rigVehicle`, default `midsize_sedan`), so the rig follows the fleet; without it the rig has only the lamps and their beams. New exported type `RigVehicles`.

## 0.2.2

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [5679830]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
- Updated dependencies [011e17a]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-vfx@0.4.0
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-weather@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-vfx-three@0.2.1

## 0.2.0

### Minor Changes

- d15e990: The weather is drawn (T6.2c). New package `@adatechnology/game-weather-three`: `createWeatherRenderer(THREE, { scene, camera, weather, vfx })` draws the game's rain curtain (14 000 GPU points in a 70 m box falling 13 m/s, shader texts of `jogo.js` character for character, sized by `drops` and the profile), the near rain on the `game-vfx` pools (streaks, splashes, rings), mist and ash, linear or exponential-squared fog with zone fog, the sky (night to day by the sun, dimmed by the weather), the Workshop's double lightning flash, headlights in rain (two spot lights and cones on any object, lit drops in the beam) and a heat haze (SDK-made). `createWeatherVisual` gives the weather bench seven layers and a lamp rig. `game-weather`: `createWeatherTestModule` takes `visual` (`WeatherVisualFactory`). `game-vfx`: the Workshop's `chuva` (`rain_and_puddles`, three intensities), `neblina` (`fog_and_ash`) and `farol` (`headlights_in_rain`) become effects, with `RainField` (`engine.rain`: `init`, `update`, `drive`), the `rain` behavior and the car `point` query. `game-vfx-three` draws the rain field (`workshop-rain` lines).

### Patch Changes

- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-weather@0.2.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
