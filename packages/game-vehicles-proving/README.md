# @adatechnology/game-vehicles-proving

Vehicle proving ground without three.js: measured tests run on the semi-simulation driver, ranges by class and design card, visual checks signed off by a person, a certificate per vehicle.

## Clock (spec 010, rule 15 "um acumulador só")

A `ProvingRun` owns no accumulator. The physics step is `fixedStep` (default 1/120 s) and one scheduler tick (1/60 s) is `STEPS_PER_TICK` = 2 steps.

- **Hosted by a scheduler** (the room): register `run.stepFixed(STEPS_PER_TICK)` in `fixedSimulate` (`host.onFrame(fn, { phase: 'fixedSimulate' })`). The tick, the cap of ticks per frame and the room's `timeScale` (slow motion) are the scheduler's. The run does not interpolate: the drawn pose is the last tick's.
- **Standalone** (tests, CLI): call `run.stepFixed(steps)` yourself, or `run.advance(seconds)`, which feeds a private `game-runtime` scheduler (exact, no render); a remainder shorter than a tick waits for the next call. `runTest` steps to the end with `stepFixed`.
- **`time_scale`** (the proving area's control, 1 to 20) is not a clock: it is the number of ticks' worth of steps run in each tick (`stepFixed(STEPS_PER_TICK * timeScale)`), a fast-forward of the test alone. The scheduler's `timeScale` stays the room's slow motion, and the scheduler's cap of ticks per frame would cut a 20x run, so the fast-forward cannot live there.

Trajectories at 60 Hz are the same as with the old private accumulator (test `the scheduler tick and the old private accumulator...`).

## The proving ground on the physics engine (spec 008 T6.2b)

`startPhysicsRun` and `runTestOnPhysics` run the same procedures on the Jolt vehicle (`vehicleDescFromSemi`), model by model, against the same bands as the semi-simulation. State of the fleet on Jolt (T6.2d, open): 17 land models are outside the bands (acceleration of five cars and SUVs, heavy and military models too fast, the bicycle, the tank's turn, the tractor and four motorcycles braking on a wet track); the reasons and the owner's decisions are in `specs/008-motor-fisico-jolt/evidence.md`.
