# @adatechnology/game-vehicles

## 0.1.0

### Minor Changes

- b82a6c0: `@adatechnology/game-vehicles` gains `createVehicleDestructible(kit, vehicleCtx, options)`, which makes any built vehicle follow the `DestructibleImpl` of `@adatechnology/game-contracts` (new dependency, types only): every damage zone is a part with a material (steel, aluminium, glass, plastic, rubber), joints (hinge, bolt, weld, glue, clip), new mechanical parts (battery, alternator, gearbox, brakes, steering, shock absorbers, oil pan, tyres, mirrors, pillars, optional tow hitch) with locale names (`mechanics.*`), hits mapped to dent, hole, crack, ricochet, detach, leak, ignite, melt and explode events, parts that really come off and fall, hidden mechanics that change `status()`, and open/close clips for doors, hood and trunk. `buildVehicleItem` builds a vehicle for a viewer that expects the front on +z. The fleet package adds contract tests on real vehicles.
- 7e4a80e: Add `@adatechnology/game-vehicles`: a generic procedural vehicle engine for three.js (cars, trucks, buses, bikes, tanks, boats, planes and helicopters) with zone-based damage in five bands, cracking glass, particles, fluids, rollover, explosions and a damage-map UI. `createVehicleKit({ THREE, locale })` returns a per-instance kit; fleets, fuels, scenarios and texts come from plugins. Strings live in `locales/en.json` and `locales/pt-BR.json`. See MIGRATION.md for the old-to-new name table.
