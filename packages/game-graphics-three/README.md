# @adatechnology/game-graphics-three

Puts the settings of `@adatechnology/game-graphics` on three.js:

- `createGraphicsView({ renderer, camera, sun })`: `apply(effective)` sets the pixel ratio (the resolution scale of the device's ratio, at most 2), the
  shadows (`off`: no caster and no shadow pass; `near`: a 9 m half box at 1024 that follows the point given to `follow(x, z)` every frame, snapped to its
  texels; `all`: the box the host gave the sun, at 2048) and the far plane (60, 140 and 300 m, or `viewDistances`). `hold()` each frame keeps the far plane on the player's choice when a module moves it.
- `gpuName(renderer)`: the GPU's name, so a calibration is redone on another one.
- `createGpuFrameTimer(renderer)`: the GPU time of whole frames with `EXT_disjoint_timer_query_webgl2` (null where there is none), never waited on.
