---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-vegetation-three': minor
'@adatechnology/game-kit-defaults': minor
---

New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

- `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
- `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
- `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
- `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

`game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.
