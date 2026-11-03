---
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-test-room': minor
---

The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
