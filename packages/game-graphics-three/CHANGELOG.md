# @adatechnology/game-graphics-three

## 0.1.0

### Minor Changes

- b97f318: Graphics settings for the player. New `@adatechnology/game-graphics` (presets Automático, Baixa, Média, Alta, Ultra; resolution scale, horde detail, shadows, view distance, FPS cap and counter; the automatic mode that moves only what is left on `auto` by the frame time; a 3 s calibration on the first load, kept per GPU; the choice in `localStorage`; the settings screen at `/screen`) and `@adatechnology/game-graphics-three` (pixel ratio, sun shadow and far plane on three.js, GPU name, whole-frame GPU timer). `startLoop` takes `minFrameMs` (a frame cap). `ModuleHost.graphics` (`HostGraphics`) lends the horde detail to modules; the crowd test module fixes its level budgets at that share or keeps `budget.adapt` under auto, and reports its `detailScale`. The test room takes `graphics: true | RoomGraphicsOptions`: a Gráficos button in place of the quality select, the calibration on its loading indicator, `room.graphics` and `room.graphicsScreen`.

### Patch Changes

- Updated dependencies [b97f318]
  - @adatechnology/game-graphics@0.1.0
