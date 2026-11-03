---
'@adatechnology/game-runtime': minor
'@adatechnology/game-contracts': minor
---

New `@adatechnology/game-runtime` (L1): a phased scheduler (input, fixed simulation with an integer-microsecond accumulator, late simulation, present, render, idle) and one frame budget shared by deferred queues, with priority, reserve, starvation guard and carried debt. `game-contracts` gains `FRAME_PHASES`, `DeferredQueue`, `DeferredQueueOptions`, `DEFERRED_PRIORITY`, `checkDeferredQueue` and the compatible `ModuleHost.onFrame(fn, { phase, order })` and `ModuleHost.defer?`.
