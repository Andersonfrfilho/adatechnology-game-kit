# @adatechnology/game-runtime

The owner of the frame: a phased scheduler (input, fixed simulation, late simulation, present, render, idle) with a fixed step, and one time budget shared by every deferred queue. No three.js, no DOM required.

API, uso e exemplos: `packages/game-runtime/README.md`; testes em `packages/game-runtime/tests/`.

## Frame deadline, queues, fixed step (spec 010)

- **Deadline (opt-in per frame):** `targetMs` plus `frameStartMs` (from `startLoop`). The queues get what is left until `frameStartMs + targetMs` minus the render estimate (`skipRenderSample()` for an atypical render), with a floor (`minBudgetMs`) and the old `budgetMs` as ceiling; no debt. A frame without `frameStartMs` (headless, `advance`, tests) keeps the old quota. `mustDrain` queues (`destruction.events`, `floorplan.breach-cut`) drain to empty outside the deadline (`mustDrainSpentMs`). `budget.stats()`: `mode`, `allowanceMs`, `renderEstimateMs`, `overMs`, `forcedThisFrame`, `forcedMs`.
- **Queues:** deferred work is a `DeferredQueue` (`game-contracts`, ids in `DEFERRED_QUEUE_ID`) registered with `scheduler.budget.register`; one queue per owner. No host: `drainDetached(queue, budgetMs)`, the only sanctioned own clock. No `*_BUDGET_MS`/`*_SLICE_MS`/`performance.now()` deadline outside this package (`kit-audit`, rule `own-frame-clock`; `--strict-clocks` is the gate).
- **Fixed step:** one accumulator, the scheduler's. The room's tick is 1/60 = 2 physics steps of 1/120 (`PhysicsLoop.stepFixed(2)`), `maxSubsteps` 3. Physics and seeded state go in `fixedSimulate`; camera, animation, sound and effects use the frame `dt`.
- **Interpolation:** `ctx.alpha` in `present` blends the previous and current pose (`game-destruction-three`, option `interpolate`); the simulation never reads the drawn pose. Physics in the `input` phase is not in the fixed step yet.

