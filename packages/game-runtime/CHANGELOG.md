# @adatechnology/game-runtime

## 0.3.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.3.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.3.0

### Minor Changes

- 6356f68: `game-runtime`: o orçamento do quadro ganha o modo de prazo, opcional por quadro. Com `targetMs` (opção do agendador ou `budget.targetMs`, mutável) e `FrameRunOptions.frameStartMs` (o `startLoop` passa o horário do `requestAnimationFrame`), as filas recebem o que sobra até o prazo menos a média móvel do render, entre o piso (`minBudgetMs`) e o teto (`budgetMs`), sem dívida. Quadro sem `frameStartMs` (headless, `advance`, testes) segue na cota de antes. `budget.stats()` ganha `mode`, `allowanceMs`, `renderEstimateMs`, `mustDrainSpentMs`, `overMs`, `forcedThisFrame` e `forcedMs`; `QueueStats` ganha `lastSpentMs` e `mustDrain`; `budget.skipRenderSample()` e `budget.recordRender()`. `game-contracts`: `DeferredQueueOptions.mustDrain` (fila que drena inteira fora do prazo).
- f7de1ec: `scheduler.systemProbe`: gancho opcional de medição, avisado antes e depois de cada sistema de cada fase (`enter(id)`/`leave(id)`); sem sonda não faz nada além de ler uma propriedade por sistema. `SystemProbe` é exportado. Na sala de teste, `frameParts.scheduler` entrega o agendador à ferramenta de medição (`tools/gpu/room-explosion.mjs`).

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0

## 0.2.13

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0

## 0.2.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.2.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.2.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.2.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.2.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.2.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.2.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.2.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.2.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.2.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.0

### Minor Changes

- 351d09e: New `@adatechnology/game-runtime` (L1): a phased scheduler (input, fixed simulation with an integer-microsecond accumulator, late simulation, present, render, idle) and one frame budget shared by deferred queues, with priority, reserve, starvation guard and carried debt. `game-contracts` gains `FRAME_PHASES`, `DeferredQueue`, `DeferredQueueOptions`, `DEFERRED_PRIORITY`, `checkDeferredQueue` and the compatible `ModuleHost.onFrame(fn, { phase, order })` and `ModuleHost.defer?`.
- b97f318: Graphics settings for the player. New `@adatechnology/game-graphics` (presets Automático, Baixa, Média, Alta, Ultra; resolution scale, horde detail, shadows, view distance, FPS cap and counter; the automatic mode that moves only what is left on `auto` by the frame time; a 3 s calibration on the first load, kept per GPU; the choice in `localStorage`; the settings screen at `/screen`) and `@adatechnology/game-graphics-three` (pixel ratio, sun shadow and far plane on three.js, GPU name, whole-frame GPU timer). `startLoop` takes `minFrameMs` (a frame cap). `ModuleHost.graphics` (`HostGraphics`) lends the horde detail to modules; the crowd test module fixes its level budgets at that share or keeps `budget.adapt` under auto, and reports its `detailScale`. The test room takes `graphics: true | RoomGraphicsOptions`: a Gráficos button in place of the quality select, the calibration on its loading indicator, `room.graphics` and `room.graphicsScreen`.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
