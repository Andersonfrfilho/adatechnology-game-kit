---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-items-three': minor
---

`game-weapons-three` takes the item models by option (spec 005, D1 and D2): `items` on `createWeaponFx`, `createWeaponsTestModule`, `createExplosivesTestModule`, `buildWeaponModel`, `buildItemWeaponModel`, `itemModelOfWeapon` and `worldExplosiveItem`. Without `items` the weapons still draw with `itemModels` of `game-items-three`, as before; that default is deprecated and will be removed in the next major, and `game-items-three` stays a dependency until then. `game-items-three` exports `itemModels`, the value to pass.
