---
"@adatechnology/game-contracts": minor
"@adatechnology/game-destruction-three": minor
"@adatechnology/game-vfx-three": minor
"@adatechnology/game-fluids-three": minor
"@adatechnology/game-test-room": minor
---

The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.
