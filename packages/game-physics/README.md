# @adatechnology/game-physics

The rigid-body contract of the kit: bodies, shapes, joints, ragdolls, vehicles, materials, contacts, sleep, raycasts and the fixed-step
loop, as types and tiny helpers. It does not simulate anything and knows no engine. An adapter implements it (today:
[`@adatechnology/game-physics-jolt`](../game-physics-jolt)), and the kit's own layers (materials and mass, damage, fracture, load path,
ballistics, blast) sit on top of it.

- **Contract, not adapter.** Only adapters depend on an engine. The domain packages (`game-destruction`, `game-destruction-three`, ...)
  depend on this package alone and receive a world; none of them imports an adapter.
- **Seams get a `SeamWorld`.** The world without `step`, `stepFixed`, `clearEvents`, `dispose` and the save calls: a seam can create and
  query bodies, but only the loop moves time.
- **One loop per world.** `createPhysicsLoop(world)` owns the fixed-step accumulator; a second loop for the same world throws.
- Units: metres, kilograms, seconds; y up.

## Install

```sh
pnpm add @adatechnology/game-physics
```

## Usage

A game boots the adapter once, makes its world from the kit's world description and gives the loop to its systems:

```ts
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

const engine = await createJoltEngine()
const world = engine.createWorld(KIT_WORLD)
const loop = createPhysicsLoop(world)

// one frame, from the game's own loop:
loop.step(deltaSeconds)
```

Systems register phases instead of stepping the world:

```ts
const removePhase = loop.add({
  beforeStep(h) { /* kinematic targets, controllers: use h, never the frame's dt */ },
  afterSteps(dt, frame) { /* once per frame: contact rows, sensor events, broken joints */ },
}, 'actors')
```

Phase orders: `crowd` and `actors` run before each fixed step; `contacts` and `rules` run once per frame after the steps. The call to
`add` returns the function that takes the phase out again.

## API

| Export | What it is |
|---|---|
| `PhysicsEngine`, `PhysicsWorld`, `SeamWorld` | The adapter's factory and the world it makes; `SeamWorld` is the world handed to seams |
| `BodyDesc`, `ShapeDesc`, `JointDesc`, `RagdollDesc`, `VehicleDesc`, `WorldDesc` | Descriptions the world is built from |
| `KIT_WORLD` | The kit's world: 120 Hz fixed step, 32/2 solver passes (`velocityIterations` is a world option), sleep and push-out limits |
| `WakeQueue`, `PhysicsCostMeter` | Wakes debris in batches sized by the aggregate step cost (`PhysicsFrame.stepMs`) against a target, nearest the player first, bounded; defaults `DEFAULT_WAKE_COST_TARGET_MS` (4), `DEFAULT_MAX_WAKE_DELAY` (0.08 s), `DEFAULT_MAX_QUEUED_WAKES` (2048), `DEFAULT_MIN_WAKES_PER_FRAME` (8), `DEFAULT_PHYSICS_COST_PER_BODY_MS` (0.0022), `DEFAULT_WAKE_COST_PER_BODY_MS` (0.02); every one is an option |
| `WorkBudget`, `WorkQueue`, `WORK_KINDS` | One frame's budget of deferred work in units (`budgetMs` × `unitsPerMs` / `tier`; defaults `DEFAULT_WORK_BUDGET_MS` 4, `DEFAULT_WORK_UNITS_PER_MS` 100, `DEFAULT_MAX_WAIT_FRAMES` 30) that every queue draws from in a fixed order (`event`, `split`, `fragment`, `prefit`, `ground`, `body`, `wake`); never reads a clock. `WorkQueue` holds work as data (priority, stable key, units), releases what fits, at least one a frame, and what waited `maxWaitFrames` whatever the cost; both save and restore. `WakeQueue.release` takes a `limit` (what the budget leaves) |
| `physicsPieceCount`, `chooseForPhysics` | How many pieces of a blast enter physics (cost target 5 ms at the wake cost per body, clamped 24 to 300) and which (big first, nearest the player first); `DEFAULT_MIN_PHYSICS_PIECES`, `DEFAULT_MAX_PHYSICS_PIECES`, `DEFAULT_PHYSICS_COST_TARGET_MS`, `DEFAULT_CHIP_SIZE` |
| `KIT_RAGDOLL_SOLVER` | Solver passes of a ragdoll's own bodies and joints |
| `DEFAULT_MATERIAL`, `Material`, `mixFriction` | Coulomb static and dynamic friction, restitution; geometric-mean mixing |
| `LAYERS`, `LAYER_PAIRS`, `Layer` | Collision layers and the default pair table |
| `createPhysicsLoop`, `isPhysicsLoop`, `PhysicsLoop`, `PhysicsPhase`, `PhysicsFrame`, `PhaseOrder` | The fixed-step loop and its phases |

The types are the whole contract; read `src/index.ts` for each field's meaning and units.

## Português

Contrato de corpos rígidos do kit: formas, juntas, ragdolls, veículos, materiais, contatos, sono, raycast e o laço de passo fixo.
Só tipos e pequenos auxiliares; nenhum motor. O adaptador é `@adatechnology/game-physics-jolt`. Os pacotes de domínio recebem um
`SeamWorld` e nunca importam o adaptador.
