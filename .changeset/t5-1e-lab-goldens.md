---
'@adatechnology/game-vfx-three': patch
---

`createVfxRenderer` follows the camera also in `play`, so an effect played before the first `update` gets the right LOD. The Lab's 16 scenes are checked against a recording of the page (`game-vfx` pure, `game-vfx-three` scene hash).
