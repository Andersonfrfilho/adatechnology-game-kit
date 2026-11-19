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

### Frame deadline (opt-in per frame)

With `targetMs` (scheduler option or `budget.targetMs`, mutable) a frame that carries `frameStartMs` (`startLoop` passes the `requestAnimationFrame` timestamp) runs in the deadline mode: `budgetMs` becomes the ceiling and the queues get what is left until `frameStartMs + targetMs`, minus a moving average of the render phase, never under the floor (`minBudgetMs`, default 1 ms). There is no debt: the real clock charges the next frame. Reserves come out of the floor (their sum may not pass it). A frame without `frameStartMs` (headless, `advance`, tests) is the quota of today, with debt. A timestamp more than one `targetMs` behind the clock (another time base, or a callback a whole frame late) is read as "now". A system of the render phase calls `budget.skipRenderSample()` in a frame whose render was not a typical one. A queue registered with `mustDrain` runs to empty in the drain of its phase, outside the deadline, and is counted in `mustDrainSpentMs`. `budget.stats()` has `mode`, `allowanceMs`, `renderEstimateMs`, `overMs`, `forcedThisFrame` and `forcedMs`.

### Queues

- Every deferred work of the kit is a `DeferredQueue` registered by the host (`scheduler.budget.register`), with its id in `DEFERRED_QUEUE_ID` and its priority in `DEFERRED_PRIORITY` (`@adatechnology/game-contracts`). One queue per owner, not per instance (the batchers share one queue per owner).
- With no host (direct API, tests, goldens) the owner drains the queue itself by `drainDetached(queue, budgetMs)` from `game-contracts`: the single sanctioned place outside this package that times deferred work. The default stays synchronous where it always was.
- A queue carries presentation only. What changes physics or seeded state does not depend on a clock: it runs in units (`WorkBudget` of `game-physics`) or in the fixed step.
- `node tools/kit-audit/audit.mjs --check` fails on a new own frame clock (`*_BUDGET_MS`, `*_SLICE_MS`, `performance.now()` against a deadline outside this package); `--strict-clocks` is the gate that the pending list is empty.

## Fixed step and interpolation

- The scheduler's accumulator is the only one: nobody else keeps a second clock. A host passes `fixedDt`; the room's tick is 1/60, which runs 2 physics steps of 1/120 (`PhysicsLoop.stepFixed(2)` from a `fixedSimulate` system). `maxSubsteps` caps the ticks of one frame (the room uses 3, as many as the 0.05 s clamp allows); the rest goes to `stats().droppedSeconds`.
- Everything that moves by time and enters physics or seeded state runs in `fixedSimulate`, never with the frame `dt`. The frame `dt` is for camera, animation, sound and visual effects (`lateSimulate`).
- Drawing interpolates: in `present` a system reads `ctx.alpha` (accumulator / `fixedDt`, in [0, 1)) and blends the previous pose with the current one; the simulation never reads the drawn pose. `advance` and scripted frames have `alpha = 0`/`scripted = true` and draw the step pose.
- Not yet in the fixed step: what the `input` phase does to physics (pushing, held objects, doors, tools) still integrates with the frame `dt` (its own spec).

## Errors, bad times and teardown

- A system or a queue that throws is reported (`onError`, default: logged once per id; a queue's id is `queue:<id>`) and the frame goes on; a queue that threw counts 0 units. If a frame fails outside any system the scheduler is left usable: the next frame runs.
- A frame time that is NaN, infinite or negative counts as no time; a negative `timeScale` is 0 and a NaN one is 1; `advance` with a bad `dt` uses `fixedDt`.
- `budget.register` throws for a queue that is already registered. After `scheduler.dispose()`, `frame` and `advance` throw, `add` does nothing and the systems that were waiting to join are dropped.
- A host that runs the scheduler itself must call `frame` every frame: queues registered with the budget stop draining on their own.
