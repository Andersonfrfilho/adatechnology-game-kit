---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-vegetation-three': minor
'@adatechnology/game-urban-three': minor
'@adatechnology/game-kit-defaults': minor
---

`game-characters-three` no longer imports `game-characters-people` (spec 005, D1 and D7): `toRoomAvatar(avatar, options)` takes `strikeClips` (required) and `firstPersonClips` by option. Migration: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`, or pass `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`.

`game-floorplan-three` no longer imports `game-floorplan-residential`: `furnitureSpec` reads the default size from the `catalog` option (without it, give `w`, `d` and `h`). Migration: pass `defaultFurnitureCatalog()` of `@adatechnology/game-kit-defaults`.

`game-vehicles-three` no longer imports `game-vehicles-fleet`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` take the palettes, measured sizes and install by option (`VehicleFleetContent`). `game-vegetation-three`: the test area takes `GameVegetationSpecies` (required) and no longer imports `game-vegetation-species`. `game-urban-three`: `createPlantResolver` takes `toSpec` and the test area takes `plantSpec`. Migration for all three: use `defaultVehicleFleet()`, `defaultVegetationSpecies()` and `defaultPlantSpec` of `@adatechnology/game-kit-defaults`.

`game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.
