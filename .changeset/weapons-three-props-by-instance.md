---
'@adatechnology/game-weapons-three': minor
---

Weapon props by instance (spec 005, D5): `createWeaponProps({ packs, patch, remove })` returns a set (`register`, `get`, `itemModelOf`, `buildItemModel`, `buildModel`) with the item model overrides of the weapons, shared with no other set. `defaultWeaponProps()` is the set behind `registerWeaponItemModel`, `itemModelOfWeapon`, `buildItemWeaponModel` and `buildWeaponModel`, which stay exported and `@deprecated` with the same results. The test area and `buildModeledProp` still read the default set.
