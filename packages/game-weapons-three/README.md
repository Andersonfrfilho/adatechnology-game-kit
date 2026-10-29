# @adatechnology/game-weapons-three

three.js presentation for `@adatechnology/game-weapons`: the real models of the arsenal, the weapon in the hands, ejected casings, sounds (recipes on `@adatechnology/game-audio`; `createWeaponAudio(volume, { engine })` plays on a shared engine) and the weapons test area.

The muzzle flash, the smoke, the backblast of a launched rocket and the flame jet of the weapon in the hands are not built here: they are recipes of `@adatechnology/game-vfx` (`viewmodel_muzzle_flash`, `weapon_smoke_puff`, `launcher_backblast`, `flame_jet`) that draw them as the gallery does, as solids (an open cone, four small cones and a core for 55 ms growing from 0.6 to 1.5 times their size, a light of `4 k` that holds, spheres of smoke that rise and grow, icosahedra of fire), with the gallery's numbers and the barrel's whole turn (`orientation`, pitch and roll included). `createWeaponFx({ effects })` plays them through the host's effect sink (the test area passes `host.effects`); with no sink the viewer makes a world of effects of its own, stepped and drawn with the weapon. Casings, magazines, the rocket itself and the burning droplets stay meshes of this package.

**Hands.** The weapon in the hands tells the host where the hands go (`host.setHandTargets`, `HandTargets` of `game-contracts`): the right on the pistol grip (the `grip` pivot of the model, else under the receiver), the left on the handguard, on the pump of a pump gun (it moves with the pump), under the right on a handgun, and to the magazine while it is changed; the generic props take the right hand on the `handle` and the left under the `head` of a long gun. Sizes come from the model, the hands shrink with a model drawn small.

## Geometry

The models' geometry comes from [`game-shapes`](../game-shapes): the model kit's `THREE` is `shapeGeometries(host)` (box, cylinder, cone, sphere,
torus with the same bytes and classes as three's, from a template cache; icosahedron and tube are still three's). `tests/exact-golden.test.ts`
holds every bit of the models, accessories, cartridges and props as the old path made them (`UPDATE_EXACT=1` rewrites it).

## Licenses

The code is MIT. The `assets/weapon-svg/` thumbnails are not code and have their own licenses, which is why the `license` field is an expression:

- `assets/weapon-svg/generated/`: MIT, projected from the 3D models of this kit.
- `assets/weapon-svg/commons/`: outlines traced from drawings of Wikimedia Commons, each under the license of the original (CC BY-SA 4.0 and 3.0, CC BY 3.0, CC0, public domain). CC BY-SA stays CC BY-SA and CC BY needs the author's credit.

Read `assets/weapon-svg/LICENSE-NOTE.md` before redistributing the folder and keep `assets/weapon-svg/CREDITS.md` (author, license, link and modifications of every file) and `manifest.json` with it. The kit's demo site shows the same credits at `weapon-svg/credits.html`.

Unused generated fallbacks: every weapon keeps its `generated/` file even when it has a `commons/` one; the manifest does not reference those, they are what the weapon returns to if the Commons file is removed.

## Models of thrown and fired explosives

`projectileModel(THREE, { weapon, explosive, kind })` gives a host the model of the round a launcher fires (the RPG-7's PG-7V, the Carl Gustaf's 84 mm round, the rocket of the disposable tubes; the same code the weapon in the hands uses to fly it), long axis +x, or `null`. It is the hook the test room's `projectileModel` option takes. The gallery has no model yet for the throwables (M67, molotov, pipe bomb, dynamite, C4, Claymore, flashbang) nor for the grenade launchers (M203, GP-25, AG36: their rounds), so those answer `null`.

`createWeaponsTestModule({ flyRocket: false })` (and `createWeaponFx`) keeps the viewmodel from flying a rocket of its own out of the launcher, for a host that draws the projectile itself (the test room does, with `projectileModel`): one round flies, not two. The backblast stays.
