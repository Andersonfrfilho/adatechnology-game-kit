---
'@adatechnology/game-player': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-crowd-three': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
---

Pushing furniture with what rests on it, and being shoved by a horde. The push now speeds up as a person does (`accel` in `FurniturePushRules`: the force left over the friction over the mass, at most 1.5 m/s², braking at 3 m/s²), so a cup on a pushed table rides along, and a sudden stop (the piece hits something, or the player lets go) throws what rests on it forward with the speed it had (`slipsOnTop`, `frictionFor`, `pushAccelerationFor`; each step reports `velocity`, `acceleration` and `stoppedFrom`). The agents of a crowd stop at the faces of the host's movable furniture (`crowd.setMovables`), lean their force on it with the arms out and the body forward (`numbers.shoveForce`, the look's `shoveLean`), and their forces add up (`crowd.shoves`); the host moves the piece at the speed that force gives it (`ModuleHost.movables` and `ModuleHost.shove`). The test room's table is pushable, carries what rests on its top and adds its mass to the push; a module's bodies shove what the player can push, a piece too heavy for one of them moves for three, and a shoved piece stops at the player. The crowd bench has a `furniture_shove` scene.
