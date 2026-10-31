---
'@adatechnology/game-urban': minor
'@adatechnology/game-kit-defaults': minor
'@adatechnology/game-urban-three': minor
---

`game-urban` no longer imports `game-vehicles-fleet` and `game-vegetation-species` (spec 005, D1 and D7). `createVehicleProvider` takes `ids` and `createPlantProvider` takes `pickSpecies` by option, and `PARKED_VEHICLE_IDS` and the `region` option are gone from the core. Migration: import `createVehicleProvider`, `createPlantProvider`, `PARKED_VEHICLE_IDS` or `defaultUrbanProviders()` from `@adatechnology/game-kit-defaults`, which keep the old signatures and defaults. `createUrbanTestModule` takes the providers of its bench by `providers`.
