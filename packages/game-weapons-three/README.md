# @adatechnology/game-weapons-three

three.js presentation for `@adatechnology/game-weapons`: the real models of the arsenal, the weapon in the hands, ejected casings, sounds (recipes on `@adatechnology/game-audio`; `createWeaponAudio(volume, { engine })` plays on a shared engine) and the weapons test area.

The muzzle flash, the smoke, the backblast of a launched rocket and the flame jet of the weapon in the hands are not drawn here: `createWeaponFx({ effects })` (the test area passes `host.effects`) asks the host's effect sink for the recipes `viewmodel_muzzle_flash`, `weapon_smoke_puff`, `launcher_backblast` and `flame_jet` of `@adatechnology/game-vfx`, with the gallery's numbers (a 55 ms flash growing from 0.6 to 1.5 times its size, six puffs of 1.3 to 1.9 s at 0.45 opacity, 26 puffs and 14 bits of fire behind a rocket, `floor(420 dt scale)` bits a frame from a flame jet). A host without a sink shows none of them. Casings, magazines, the rocket itself and the burning droplets stay meshes of this package.

## Licenses

The code is MIT. The `assets/weapon-svg/` thumbnails are not code and have their own licenses, which is why the `license` field is an expression:

- `assets/weapon-svg/generated/`: MIT, projected from the 3D models of this kit.
- `assets/weapon-svg/commons/`: outlines traced from drawings of Wikimedia Commons, each under the license of the original (CC BY-SA 4.0 and 3.0, CC BY 3.0, CC0, public domain). CC BY-SA stays CC BY-SA and CC BY needs the author's credit.

Read `assets/weapon-svg/LICENSE-NOTE.md` before redistributing the folder and keep `assets/weapon-svg/CREDITS.md` (author, license, link and modifications of every file) and `manifest.json` with it. The kit's demo site shows the same credits at `weapon-svg/credits.html`.

Unused generated fallbacks: every weapon keeps its `generated/` file even when it has a `commons/` one; the manifest does not reference those, they are what the weapon returns to if the Commons file is removed.
