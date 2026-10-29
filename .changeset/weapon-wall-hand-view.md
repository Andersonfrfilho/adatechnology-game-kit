---
'@adatechnology/game-weapons-three': minor
---

The weapon in the hands stays out of walls and its hand stays in view. `createWeaponFx({ contact })` (the test area gives it a raycast on the simulation clock) makes the weapon come back from a surface it would go through (`WALL_PULL`: a few centimetres of margin, at most 0.7 m, smoothed); the shooting hand raises the weapon when it would sit below the bottom of the view (`HAND_IN_VIEW`). A flamethrower pulls the trigger finger while the fuel burns.
