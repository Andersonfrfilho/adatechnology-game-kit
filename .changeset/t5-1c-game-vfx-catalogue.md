---
'@adatechnology/game-vfx': minor
---

The catalogue of the Lab (T5.1c). `EXPLOSIONS` has the 16 profiles of the Explosion Lab (`PROF`, L795-812) with English names, keyed by the id of the explosive in `game-weapons` (`m67`, `molotov`, `pipe_bomb`, `propane_p13`, `dynamite`, `c4`, `claymore`, `flashbang`, `m79_40mm`, `m72_66mm`, `at4_84mm`, `pg7v`, `fuel_barrel`, `car_fuel_tank`, `fuel_pump`, `fuel_station_tank`), each listing the Lab lines it comes from, and a `generic` one (the M67, for a part with no explosive id: scale it by `injury / 15`). `EXPLOSION_ALIASES` gives the Carl Gustaf the AT4 blast and the VOG-25 the M79 one. `patchExplosions(EXPLOSIONS, { m67: { lethal: 7 }, c4: null })` changes, adds or removes profiles; `createVfx` uses the catalogue by default. `estimateCost` gives the number of the Lab's effect sheet for each one.
