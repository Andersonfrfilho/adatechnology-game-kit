---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

The shot leaves the muzzle of the weapon drawn in the hands. `ModuleHost.setMuzzleSource` (with `MuzzlePose` and `MuzzleSource`) lends the host the muzzle of the tool the module draws: the weapons module gives the `muzzle` mark of the gallery model (or the front end of the generic prop, where a flame or an extinguisher's foam also leaves), and the test room starts the tracers there and, when the module draws its own muzzle flash, draws none of its own. Before, the room flashed and drew its tracers from a fixed point ahead of the eye, away from the weapon, while the module flashed at the real muzzle.
