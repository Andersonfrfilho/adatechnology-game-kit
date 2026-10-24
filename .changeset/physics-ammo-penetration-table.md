---
'@adatechnology/game-weapons': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': patch
---

Per-caliber penetration table in `game-weapons` (`AMMO`, 50 loads, `arsenal.loadOf`, `weapon.setAmmoKind`, `ArsenalOptions.ammo`): per calibre and kind of round
(fmj, hp, ap, buck, slug, birdshot, incendiary, tracer...) the core and jacket, the mass and speed when they differ, the energy and the millimetres of steel,
concrete, brick and wood it goes through. The shot carries `ammo`, `penetration`, `incendiary` and `tracer`. `game-contracts`: `Hit.penetration`, `Hit.incendiary`,
`Hit.tracer`, `Hit.ignition`, `shotExtras(shot, distance)` (the penetration scaled by the energy left) and `shotToHit` passes them. `game-destruction` reads
`Hit.penetration` by material class (`MaterialDef.penetrationClass` / `penetrationScale`), keeps `Hit.piercing` as the energy-rule fallback and reads no calibre
names: `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are removed (breaking). `shoot` takes `{ penetration, piercing, ... }` or a bare piercing factor.
`game-test-room` passes the round of the shot to the world.
