---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-characters-three': minor
---

The first-person viewmodel, as shooters draw the weapon in the hands. `FIRST_PERSON_LAYER` and `ModuleHost.setViewmodelFov` (game-contracts) give a host a layer it draws over the world with the depth cleared and the lens of the tool. The test room draws it (its world camera leaves the layer out), takes first-person arms of its own (`firstPersonArms`: `createFirstPersonArms` of game-characters-three fits it) whose hands go to the tool's grips, and hides the body's arms from the eye (`setView(mode, camera, { arms: true })`). The weapons module puts the gun in the hands on the layer: held at the hip by kind (`VIEW_HOLD`: long gun, handgun, launcher, a tool in one hand carried point up), drawn through a lens per kind, brought to the eye by the right button (the sights on the line of the eye), with the sway behind the turn of the view and the bob of the step (`VIEW_MOTION`); the flash, the smoke, the casings and the tracer leave the muzzle as drawn (`toWorldLens`). The kick of a shot now comes back: 70 % of each kick returns within about a quarter of a second (`recoilReturn` of the room's player). Third person is unchanged: the body shoulders the gun.
