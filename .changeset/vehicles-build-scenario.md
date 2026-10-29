---
'@adatechnology/game-vehicles': minor
---

`kit.build(key, state, { scenario })` builds a vehicle with a registered damage scenario (id or name, e.g. the fleet's `burnt`) in one call: the scenario is computed on the vehicle being built, with no probe build, and an explicit `health` / `flags` given alongside override its result. An unknown scenario damages nothing, like `zoneScenario`. `buildVehicleItem(kit, key, { scenario })` passes it through. New type `BuildZoneState`.
