# @adatechnology/game-runtime

The owner of the frame. A phased scheduler with a fixed simulation step, and one time budget shared by every deferred queue of the kit. Layer L1: no three.js, no DOM unless `startLoop` runs on a page.

```ts
import { createScheduler, startLoop } from '@adatechnology/game-runtime'

const scheduler = createScheduler({ fixedDt: 1 / 60, maxFrameSeconds: 0.05 })
scheduler.add((ctx) => stepWorld(ctx.dt), { phase: 'fixedSimulate' })
scheduler.add((ctx) => drawWorld(ctx.alpha), { phase: 'present' })
scheduler.add(() => renderer.render(scene, camera), { phase: 'render' })
const stop = startLoop(scheduler)
```

## Phases

`input` (real time) → `fixedSimulate` (0 to `maxSubsteps` steps of `fixedDt`, seeded work) → `lateSimulate` (scaled time, what `ModuleHost.onFrame` has always been) → `present` (state to the scene, queues of `present`) → `render` → `idle` (queues of `idle`).

- Pause stops `fixedSimulate` and `lateSimulate`; `timeScale` scales the accumulator and the dt of `lateSimulate` and `present`.
- The accumulator counts whole microseconds, so 60 frames of 1/60 give exactly 60 steps. A frame within `snapMs` (0.25) of a whole number of steps is snapped to it.
- `frame(seconds, { exact: true })` uses the time as given (no clamp, no snap, no cap): for tests and hosts without a loop.
- `advance(seconds, { dt })` steps the world synchronously with the budget unbounded and `ctx.scripted = true`: scenarios and tests.
- What input does to the simulation goes through `scheduler.commands` and is consumed at the next fixed tick.

## Budget

`scheduler.budget.register(queue, { priority, phase, reserveMs, minEveryFrames })` takes a `DeferredQueue` (a contract of `@adatechnology/game-contracts`) and calls its `attach()`: from then on the owner stops draining on its own. Queues of one phase run by priority inside a shared time budget (4 ms by default); a unit that goes over becomes debt for the next frame; a queue with work never waits more than `minEveryFrames`; `reserveMs` keeps time for a queue the others must not starve. A queue that was never registered keeps its own draining.

## Errors, bad times and teardown

- A system or a queue that throws is reported (`onError`, default: logged once per id; a queue's id is `queue:<id>`) and the frame goes on; a queue that threw counts 0 units. If a frame fails outside any system the scheduler is left usable: the next frame runs.
- A frame time that is NaN, infinite or negative counts as no time; a negative `timeScale` is 0 and a NaN one is 1; `advance` with a bad `dt` uses `fixedDt`.
- `budget.register` throws for a queue that is already registered. After `scheduler.dispose()`, `frame` and `advance` throw, `add` does nothing and the systems that were waiting to join are dropped.
- A host that runs the scheduler itself must call `frame` every frame: queues registered with the budget stop draining on their own.
