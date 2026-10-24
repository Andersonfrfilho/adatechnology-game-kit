---
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-vfx': minor
---

New package `game-vfx-three` (T5.1d): the three.js renderer of the Explosion Lab. `createVfxRenderer(THREE, { scene, camera, vfx, overlay })` draws a `VfxWorld` with the Lab's shaders (puffs with the heat ramp and dissolve, streaked shrapnel, halos, shock shell and ground ring; verbatim, with the r160 `colorspace_fragment` chunk), debris with embers, blast and fire lights, scorch, dirt, rim rock and blood marks that conform to the ground as it was when they were made, and the screen overlay (flash, white, red edge, sides, gas). It implements `EffectSink` (`play`, `stop`, `configure`, `stats`, `catalog`) and `applyCamera()` shakes the camera around the render. `createGroundPatch` is the Lab's 60 m deformable patch. `game-vfx` gains `onMarks`, `fires()`, `randomState()`, a `trace` option that hears every spawn in order, and `colorOfChunk`.
