---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': patch
'@adatechnology/game-contracts': minor
---

The effects of the weapon in the hands move onto `game-vfx`. `game-vfx` gets four recipes with the Arsenal gallery's numbers (`VIEWMODEL_EFFECTS`): `viewmodel_muzzle_flash` (a cone, four spikes and a core for 55 ms growing from 0.6 to 1.5 times their size, a light of 4 k at 2 k metres, six puffs of smoke), `weapon_smoke_puff` (one puff with the velocity, radius, life and opacity it is given), `launcher_backblast` (26 puffs and 14 bits of fire) and `flame_jet` (`floor(420 dt scale)` bits of fire a frame and, half the frames, a puff of smoke); the expression `exp`; and `PlayOptions.values`, named numbers a recipe reads with `variable(name)`. `game-contracts`: `EffectRequest.values`. `game-vfx-three` passes `values` on. `game-weapons-three`: `createWeaponFx({ effects })` and `createViewmodel({ effects })` play those recipes through the host's effect sink instead of building meshes; the test area passes `host.effects`; without a sink nothing is shown. Casings, magazines, the flying rocket and the burning droplets stay as they were.
