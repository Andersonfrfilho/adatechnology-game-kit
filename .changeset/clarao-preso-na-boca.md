---
'@adatechnology/game-contracts': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-weapons-three': patch
'@adatechnology/game-test-room': patch
---

The muzzle flash stays on the muzzle while it burns. It was played into the world at the muzzle and stayed there, while the gun follows the view: turning the view at 2 rad/s, in the three frames the flash lives it slid 50 to 95 px back over the gun (onto the receiver and the trigger of a rifle, off the side of a pistol), more with a faster turn or the kick of a heavy round.

- `EffectRequest.track` (`game-contracts`, with `EffectPose`): the live pose of the thing an effect belongs to, asked every frame while the effect lives.
- `game-vfx`: an effect played with `track` rides on it. Its grouped pieces (the flash's cones and core) and its light keep their place on the thing; the smoke it throws leaves from the thing and stays in the air. `VfxWorld.follow()` moves them to where the thing is now, and `PlayOptions.track` carries the pose.
- `game-vfx-three`: `VfxRenderer.present()` puts what rides on a thing where it is after the frame moved it, before drawing; a host that does not call it draws those effects one frame late.
- `game-weapons-three`: the flash of the gun in the hands (and of its grenade launcher) tracks the muzzle mark, seen through the first-person lens.
- `game-test-room`: calls `vfx.present()` once the modules have posed the gun.

`muzzle-mark.test.ts` checks that every firearm with a model has its `muzzle` mark at the front of its barrel. `muzzle-screen.test.ts` now also measures the smoke and a shot while the view sweeps, in both views, and fails when a firearm has no muzzle mark.
