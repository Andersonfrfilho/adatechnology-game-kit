# @adatechnology/game-weather-three

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
