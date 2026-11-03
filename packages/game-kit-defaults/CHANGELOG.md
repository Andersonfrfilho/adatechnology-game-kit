# @adatechnology/game-kit-defaults

## 0.2.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- ba6dd38: `game-stories` has new optional options (spec 005, D1 and D7): `names` and `ruleset` on `createStoryWorld`, `simulateStories`, `createSheet`, `drawSheet` and `createStoriesTestModule`, and `professionName` on `createStoriesTestModule`. Without them nothing changes: the name pools come from `getNamePools(locale)`, the ruleset from `SHEET_RULESET` and the profession names from `getProfession`, all of `game-characters-people`. The default is deprecated and will be removed in the next major. The schema types (`NamePools`, `SheetRuleset` and friends) are exported by `game-stories`. Recommended path: spread `defaultStoryContent(locale)` of `@adatechnology/game-kit-defaults`.
- 7abe6b1: `game-urban` has two new optional options (spec 005, D1 and D7): `createVehicleProvider({ ids })` and `createPlantProvider({ pickSpecies })` take the fleet and the species by option. Without them nothing changes: `ids` still defaults to `PARKED_VEHICLE_IDS` and the species still come from the `region` table of `game-vegetation-species`. The default is deprecated and will be removed in the next major; `PARKED_VEHICLE_IDS` and `region` are `@deprecated` too. Recommended path: `defaultUrbanProviders()` of `@adatechnology/game-kit-defaults`, or your own `ids` and `pickSpecies`.

  `game-urban-three`: `createPlantResolver({ toSpec })` and the `providers` and `plantSpec` options of `createUrbanTestModule` are new and optional; the defaults (`toSpec` of `game-vegetation-species`, the providers of `game-urban`) are deprecated and will be removed in the next major.

### Patch Changes

- Updated dependencies [f48b676]
- Updated dependencies [7abe6b1]
  - @adatechnology/game-urban@0.3.0
  - @adatechnology/game-vehicles-fleet@6.0.0
  - @adatechnology/game-floorplan-residential@6.0.0
