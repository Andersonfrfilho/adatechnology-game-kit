# @adatechnology/game-physics-jolt

The adapter of [`@adatechnology/game-physics`](../game-physics) over [Jolt Physics](https://github.com/jrouwe/JoltPhysics.js)
(`jolt-physics` 1.1.1, the single-threaded `wasm-compat` build by default; the multithreaded one on request, see Threads). The wasm is inlined in the JavaScript, so Node, vitest and a plain
page load it with no loader configuration and no `SharedArrayBuffer`.

- **The only package that depends on `jolt-physics`.** Everything else in the kit talks to the contract.
- **The kit's only physics engine** (spec 008). It replaces the kit's former own debris solver; the `own` option and `PIECE_SOLVER` / `?solver=own` go away with T8.1.
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

## Threads (multithreaded build)

`createJoltEngine(options)` picks the build: `{ build: 'single' }` (the default, `wasm-compat`) or `{ build: 'multithread' }`
(`wasm-compat-multithread`, SIMD on), and `workerThreads` (Jolt's `mMaxWorkerThreads`, job threads besides the caller's). The multithreaded build
needs `SharedArrayBuffer`: a cross-origin isolated page (COOP `same-origin` + COEP `require-corp` or `credentialless`: `pnpm serve:room --isolate`,
or the desktop app in `apps/desktop`). Its pthreads load `jolt-physics.multithread.wasm-compat.js` by URL, so a bundled page serves that file next
to itself and passes `moduleUrl` (the test room does: it picks `multithread` on its own when the page is `crossOriginIsolated` and `single` elsewhere, `?joltBuild=single|multithread` forces one, `?joltThreads=N|auto`).

**Worker threads and the kit's contact rules do not run together.** Jolt calls the contact listener from the job that finds the contact; with
`workerThreads > 0` that job runs on a worker, where the JS listener (`ContactListenerJS`: contact rows, sensors, friction partners, restitution mix,
ignored pairs) does not exist, and the step dies (`Cannot read properties of undefined (reading 'hasOwnProperty')`). `resolveJoltThreading` refuses
the pair with `JoltThreadingError` (`JOLT_WORKERS_WITH_JS_CALLBACKS`); `contactCallbacks: 'none'` drops the listener and exists only to measure the
step. The numbers and what would remove the limit are in [`docs/medicoes/jolt-multithread.md`](../../docs/medicoes/jolt-multithread.md).

## What the adapter fixes

- **Small inertia (Jolt issue [#2220](https://github.com/jrouwe/JoltPhysics/issues/2220)).** Jolt falls back to a 1 m sphere's inertia
  for a small body whose inertia it is asked to compute, so the small body turns as if it were a 1 m ball. A dynamic body with a given
  mass gets its inertia computed at `INERTIA_SCALE` (1e6) times and put back to the true values right after it is made. The same guard
  applies on `setShape`.
- **Per-body friction.** Jolt mixes friction by geometric mean, as the kit does, but each body holds its own coefficient: static until it
  slides, dynamic while it does. A sensor is never touched.
- **Rolling resistance and damping.** Engines have none, so a round body (`BodyDesc.rolling`) gets a moment opposing its spin while it touches
  something, plus its rolling damping (`Rolling.damping` + the surface's `Material.rollingDamping`, a share of the spin per second): a can rolls to
  a stop, sooner on grass than on tile, and the spin never reverses.
- **The kit's mass on `setShape`.** A dynamic body keeps its kit mass (given to `createBody` or to `setShape`) and its inertia is scaled
  to that mass from the new shape; Jolt would otherwise take the shape's volume times 1000 kg/m^3.
- **Turn cap by size.** Jolt turns no body faster than 47 rad/s, the same for a 3 cm can and a 45 m wire. A dynamic body's cap is `MAX_EDGE_SPEED` (6 m/s,
  the speed of the farthest point of its bounds) over its radius, never under 47 rad/s and never over a quarter turn per fixed step (94 rad/s at the kit's 120 Hz;
  a 60 Hz world keeps 47). A can rolling at 2 m/s (60 rad/s) keeps its spin; a large piece turns as before.
- **Ghost contact at the seam of two ground slabs.** A flat static slab (an upright box with `convexRadius: 0`, what the ground's level tiles are) has its lip contacts
  dropped when the penetration axis leans (under 90% vertical) and the point is within 1 cm of the top: the neighbour slab's contact is the real one. A can rolling over
  the seam keeps its speed. Jolt's own `EnhancedInternalEdgeRemoval` only works inside a mesh or height field, not between boxes of different bodies.

## Notes

- `saveState()` and `restoreState()` write and read the world's exact state (bodies, velocities, sleep, contact cache, per-body friction,
  rolling, ignored pairs, step count). They are valid only on a world made with the same bodies, joints and vehicles in the same order.
- Joints whose `breakImpulse` is passed are removed by the adapter in the step they break; `brokenJoints` reports them once.

## Character, hold, and loose pieces (spec 008, phase 4)

- The character controller is Jolt's `CharacterVirtual` behind `createCharacter`: no internal body, so debris passes through it; `pushCharacter` adds `impulse / mass` to the wanted
  velocity and decays it with a 0.25 s constant; the vertical part is a launch that gravity takes back. With `CharacterDesc.shadow` Jolt makes the inner body of the `CharacterVirtual` in that layer (it
  is known to the adapter as a body that leaves with its walker) and the walker sweeps only against the fixed world and what that layer meets. A walker carries the velocity of what it stands on. `world.dispose()` frees the characters left.
- `setContinuous(id, true)` is Jolt's `LinearCast` motion quality (swept); `grabBody` of `game-physics` turns it on at release.
- Rolling resistance alone (C_rr 0.015, no extra damping) is what makes a thrown grenade (a compound of body, fuze and spoon) rest within 7 s and 8 m (95% of 100 seeded throws, none past 8 s or 10.5 m; no turn cap), and 200 casings sleep, on the kit's floor; the numbers and
  the margins are in `specs/008-motor-fisico-jolt/evidence.md`, T4.3.
## Português

Adaptador de `@adatechnology/game-physics` sobre o Jolt Physics (`jolt-physics` 1.1.1, build `wasm-compat`, single-thread). É o único
pacote que depende do `jolt-physics`. Todo objeto do Jolt criado pelo pacote é destruído por ele; `world.dispose()` libera o que sobrar.
A licença MIT do Jolt está no `LICENSE`, na seção "Third-party".

## Vehicles and loose parts (spec 008, phase 6)

The adapter shares the compound of a car between cars (a copy on the first damage), gives children a handle (`setChildShape`, also after `setMassProperties` moved the centre of mass: the compound is found inside the offset wrapper), and offers `watchContacts`, `vehicleWheels`, `rebuildVehicle`, `applyBuoyancy` and the `motorcycle` and `tracked` controllers. A car made, crashed, stripped of parts and removed hands the wasm heap back but for 8 bytes for each `SetShape` of the centre of mass (`tests/heap.test.ts`, `crash-parts.test.ts`).
