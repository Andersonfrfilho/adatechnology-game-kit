# @adatechnology/game-physics-jolt

The adapter of [`@adatechnology/game-physics`](../game-physics) over [Jolt Physics](https://github.com/jrouwe/JoltPhysics.js)
(`jolt-physics` 1.1.1, the single-threaded `wasm-compat` build). The wasm is inlined in the JavaScript, so Node, vitest and a plain
page load it with no loader configuration and no `SharedArrayBuffer`.

- **The only package that depends on `jolt-physics`.** Everything else in the kit talks to the contract.
- **One world per game.** `engine.createWorld` makes a `PhysicsWorld`; the game keeps one and gives it to one loop.
- **Every Jolt object is destroyed by the package**: bodies (`RemoveBody`, `DestroyBody`), joints, ragdolls, vehicles, shapes
  (`Release`) and the world's own allocations (`Jolt.destroy`). `world.dispose()` frees what remains; `memoryInUse()` reports the heap.

## Install

```sh
pnpm add @adatechnology/game-physics-jolt @adatechnology/game-physics
```

Browser without a bundler (the global is `GamePhysicsJolt`; the file carries Jolt and `game-physics` inside it, about 4 MB):

```html
<script src="https://unpkg.com/@adatechnology/game-physics-jolt/dist/index.global.js"></script>
<script>
  GamePhysicsJolt.createJoltEngine().then((engine) => { /* engine.createWorld(...) */ })
</script>
```

## Usage

```ts
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

const engine = await createJoltEngine() // loads the wasm once; async
const world = engine.createWorld(KIT_WORLD) // synchronous from here on
const loop = createPhysicsLoop(world)

// ... frames: loop.step(deltaSeconds); at exit: world.dispose()
```

`createJoltEngine()` returns `{ name: 'jolt', jolt, createWorld }`; `loadJolt()` is the wasm load on its own.

## What the adapter fixes

- **Small inertia (Jolt issue [#2220](https://github.com/jrouwe/JoltPhysics/issues/2220)).** Jolt falls back to a 1 m sphere's inertia
  for a small body whose inertia it is asked to compute, so the small body turns as if it were a 1 m ball. A dynamic body with a given
  mass gets its inertia computed at `INERTIA_SCALE` (1e6) times and put back to the true values right after it is made. The same guard
  applies on `setShape`.
- **Per-body friction.** Jolt mixes friction by geometric mean, as the kit does, but each body holds its own coefficient: static until it
  slides, dynamic while it does. A sensor is never touched.
- **Rolling resistance.** Engines have none, so a round body (`BodyDesc.rolling`) gets a moment opposing its spin while it touches
  something: a can rolls to a stop, and the spin never reverses.
- **The kit's mass on `setShape`.** A dynamic body keeps its kit mass (given to `createBody` or to `setShape`) and its inertia is scaled
  to that mass from the new shape; Jolt would otherwise take the shape's volume times 1000 kg/m^3.

## Notes

- `saveState()` and `restoreState()` write and read the world's exact state (bodies, velocities, sleep, contact cache, per-body friction,
  rolling, ignored pairs, step count). They are valid only on a world made with the same bodies, joints and vehicles in the same order.
- Joints whose `breakImpulse` is passed are removed by the adapter in the step they break; `brokenJoints` reports them once.

## Português

Adaptador de `@adatechnology/game-physics` sobre o Jolt Physics (`jolt-physics` 1.1.1, build `wasm-compat`, single-thread). É o único
pacote que depende do `jolt-physics`. Todo objeto do Jolt criado pelo pacote é destruído por ele; `world.dispose()` libera o que sobrar.
A licença MIT do Jolt está no `LICENSE`, na seção "Third-party".
