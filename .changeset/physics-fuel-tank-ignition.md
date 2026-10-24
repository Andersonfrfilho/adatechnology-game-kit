---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-vehicles-three': minor
---

A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
`game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
`defaultEffectIds.leakIgnited`, asked when the tank catches fire.
