# @adatechnology/game-vehicles-fleet

## 1.0.0

### Minor Changes

- 82add98: Initial release (0.1.0): 69 procedural vehicles in ten groups, fuels, group names, generic crash texts and five damage scenarios for `@adatechnology/game-vehicles`, with English ids and an `en` / `pt-BR` locale table that reproduces the original strings.

### Patch Changes

- b82a6c0: `@adatechnology/game-vehicles` gains `createVehicleDestructible(kit, vehicleCtx, options)`, which makes any built vehicle follow the `DestructibleImpl` of `@adatechnology/game-contracts` (new dependency, types only): every damage zone is a part with a material (steel, aluminium, glass, plastic, rubber), joints (hinge, bolt, weld, glue, clip), new mechanical parts (battery, alternator, gearbox, brakes, steering, shock absorbers, oil pan, tyres, mirrors, pillars, optional tow hitch) with locale names (`mechanics.*`), hits mapped to dent, hole, crack, ricochet, detach, leak, ignite, melt and explode events, parts that really come off and fall, hidden mechanics that change `status()`, and open/close clips for doors, hood and trunk. `buildVehicleItem` builds a vehicle for a viewer that expects the front on +z. The fleet package adds contract tests on real vehicles.
- Updated dependencies [b82a6c0]
- Updated dependencies [7e4a80e]
  - @adatechnology/game-vehicles@0.1.0
