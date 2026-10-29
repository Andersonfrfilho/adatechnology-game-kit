# @adatechnology/game-weather

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
