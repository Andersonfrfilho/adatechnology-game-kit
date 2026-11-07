# @adatechnology/game-weather

## 0.3.11

### Patch Changes

- Updated dependencies [baaa7d4]
  - @adatechnology/game-audio@0.10.0

## 0.3.10

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [5ce9f7b]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-audio@0.9.4

## 0.3.9

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-audio@0.9.3

## 0.3.8

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-audio@0.9.2

## 0.3.7

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-audio@0.9.1

## 0.3.6

### Patch Changes

- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0

## 0.3.5

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-audio@0.8.0

## 0.3.4

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.3.3

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-audio@0.6.1

## 0.3.2

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.3.1

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-contracts@0.23.0

## 0.3.0

### Minor Changes

- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [cbb20a2]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0

## 0.2.8

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-audio@0.3.6

## 0.2.7

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
  - @adatechnology/game-audio@0.3.5

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-audio@0.3.4

## 0.2.5

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-audio@0.3.2

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-audio@0.3.1

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0

## 0.2.1

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
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
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-audio@0.2.1

## 0.2.0

### Minor Changes

- 485acc7: The weather reaches the other packages (T6.2b). `game-weather` gets `createWeatherBridges(targets, options)`: every target is optional and a small interface of its own (so the weather imports none of them) - the fluids film (`setWeather({ rain, drying })`, with `wash()` every second while the rain is heavy or stronger), `interactables.water.setRain(mm/h)` and `setWind(x, z)`, the vegetation `setWind({ direction, strength: min(1, speed / 20), gust })`, the vfx `setWind`, the environment bus (`environmentOf(sample)`) and the sound. The rain, wind and thunder are recipes of `game-audio` (`WEATHER_BANK`: `rain_loop` and `wind_loop` from the art scene L1314-L1315, `rain_hiss_game` from the game L62116, `thunder` from the game's boom plus a rumble), played by `createWeatherSound` (rain 0.035 in a light rain to 0.06 in a heavy one, wind 0.05 at the breeze and in proportion, the thunder at its bearing when `thunder` arrives). `createWeatherTestModule` takes `targets` and `sound`. `game-fluids` films take `drying` (an extra scale on the drying; extreme heat is 2) and `wash(maxDryness = 0.5)`; `game-fluids-three` passes both on (`FilmBridge.setWeather({ rain, drying })`, `wash`, option `washable`, default blood and old blood); `VfxWorld` gets `setWind` and `wind`; the test room exposes `room.vfx`. `@adatechnology/game-weather` now depends on `@adatechnology/game-audio`.
- d15e990: The weather is drawn (T6.2c). New package `@adatechnology/game-weather-three`: `createWeatherRenderer(THREE, { scene, camera, weather, vfx })` draws the game's rain curtain (14 000 GPU points in a 70 m box falling 13 m/s, shader texts of `jogo.js` character for character, sized by `drops` and the profile), the near rain on the `game-vfx` pools (streaks, splashes, rings), mist and ash, linear or exponential-squared fog with zone fog, the sky (night to day by the sun, dimmed by the weather), the Workshop's double lightning flash, headlights in rain (two spot lights and cones on any object, lit drops in the beam) and a heat haze (SDK-made). `createWeatherVisual` gives the weather bench seven layers and a lamp rig. `game-weather`: `createWeatherTestModule` takes `visual` (`WeatherVisualFactory`). `game-vfx`: the Workshop's `chuva` (`rain_and_puddles`, three intensities), `neblina` (`fog_and_ash`) and `farol` (`headlights_in_rain`) become effects, with `RainField` (`engine.rain`: `init`, `update`, `drive`), the `rain` behavior and the car `point` query. `game-vfx-three` draws the rain field (`workshop-rain` lines).

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-contracts@0.13.0

## 0.1.2

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.1

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.0

### Minor Changes

- 9c615d7: Initial release (0.1.0): pure, seeded weather. Ten states with the numbers of the teams' pages and a `sources` list each (`clear`, `overcast`, `light_rain`, `heavy_rain`, `storm`, `fog`, `windy`, plus the physics presets `cyclone`, `typhoon` and `extreme_heat`), and two climates, `temperate` (default, no extremes) and `tropical`, that start `clear` (the normal world first). A seeded Markov scheduler in game time (2 to 6 hours per state, 10 game minutes of blend, fronts from the west), lightning on its own stream (2 to 4 s to the first strike, then 3.5 to 6 s, the Workshop's double flash, thunder at `distance / 343` s), ground wetness that is dry 180 s after the rain stops, gameplay effects (`visibility`, `sightScale`, `hearingScale`, `footstepScale`), the NOAA heat index with `heatStress`, and the game's day-night formula. A registry with add, patch and remove by id, a `timeline` that gives plain JSON for goldens, and `ESM` plus the `GameWeather` global.
- 0f9e616: `createWeatherTestModule` is the weather area of the test room, written against the generic contracts only: weather, transition (at once or 10 s), hour of the day, automatic schedule (600 times faster) and seed; it writes the weather to `host.environment` and to the scene fog (layer `fog`, off with `fog: false`) every frame, and shows rain, visibility, sight and hearing scale, wind, heat index, wet ground and strikes. Four scenarios: storm, blend, determinism, dry ground. `@adatechnology/game-contracts` is a dependency (types only).

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
