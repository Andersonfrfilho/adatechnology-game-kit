---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-fluids-three': patch
'@adatechnology/game-weapons-three': patch
---

Silent fallbacks now say so (spec 005, review item 12). `warnOnce(key, message)` in `game-contracts` warns once per key on the console, outside production. `createDestructionRenderer` and `createFluidRenderer` without `vfx`, `createViewmodel` (and `createWeaponFx`) without `effects` and `createWeaponAudio` without `engine` keep working with a world or engine of their own and warn once. The weapons test module makes its own audio only when it is first needed, so a room that lends the engine never triggers the warning.
