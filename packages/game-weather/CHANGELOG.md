# @adatechnology/game-weather

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
