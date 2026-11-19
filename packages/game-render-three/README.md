# @adatechnology/game-render-three

Owner of the GPU-facing state of a three.js game (spec 005, D4). In three, the program key of every lit material carries the number of
lights, the fog type, the tone mapping and more: change one in the middle of play and the whole scene recompiles. This package keeps those
numbers fixed after boot.

- `ThreeLib`: the one name of the three namespace (`typeof import('three')`); narrow it with `Pick<ThreeLib, ...>`.
- `createLightBudget(THREE, scene, sizes)`: creates every `PointLight`/`SpotLight`/`HemisphereLight` at boot and never adds, hides or
  removes one. Clients ask for slots: `acquire` (short-lived: blast, rocket, flare), `addSource` (long-lived and competing by priority and
  distance, `follow` an object), `lease` (fixed slots, the room lights of a house) and `leaseHemisphere` (the weather lightning).
  Priority preemption with fades, shadow slots first, `seal()` / `check()` for the light counts, fog presence and type,
  `scene.environment`, `toneMapping`, `outputColorSpace`, `shadowMap.type` and camera `far` against the neutral fog.
- `createProgramWarmup()`: `register(probe)`, `registerEffect`, `registerTexture`, `warmUp(renderer, scene, camera, { lights, fogStates, target })`
  links every program once, uploads buffers, seals the budget; probe materials go to `anchors` and are never disposed (a program is freed
  when its last material is disposed). `linkedSince(renderer)` counts `linkProgram` calls after the warmup: it must stay 0. The first draw puts
  every shadow caster of the scene in the shadow maps, culling off (`shadowCasters: 'visible'` keeps the culling): three links a depth or distance
  program only in the shadow pass, never in `compile`. `shadowCasterProbes(THREE)` adds lit casters with and without a map on each side, for the
  casters that appear only in play.
- `createFog(THREE, scene, { stable: true })`: `clear()` leaves a neutral linear fog (near 6.0e4, far 6.4e4) instead of `null`.
- `createGeometryPool()` / `createMaterialPool()`: keys, use counts, `retain`/`register`, `own` for per-frame materials, `trim` at load
  points, and a development warning when a pooled resource is disposed directly.
- `createStaticBatcher(THREE, root, options)`: draws the still meshes of an object as one batch per material. The merge copies typed arrays
  (positions and normals through the mesh matrix, the rest as stored) and allocates nothing per mesh frame.
- `createStaticBatchQueue({ id })` (spec 010): one `DeferredQueue` per **owner**, not per batcher, rotating between the batchers that join it with
  `createStaticBatcher(THREE, root, { queue })`. One unit is one chunk (`maxVertices`); no chunk is cut by vertex. The owner registers
  `queue.deferredQueue()` with the frame budget using its id from `DEFERRED_QUEUE_ID` and the options from `DEFERRED_PRIORITY`
  (`budget.register(queue.deferredQueue(), DEFERRED_PRIORITY[id])`). Not registered, each batcher drains the queue in its own `update` with
  `budgetMs` (default all at once, through `drainDetached`). Only the merge waits: `update()` still releases a changed mesh every frame. A batcher
  leaves the queue in `dispose()`. A batcher given `queue` merges its first chunks in `update()`, not in the call.

```ts
import * as THREE from 'three'
import { createLightBudget, createProgramWarmup, LIGHT_PRIORITY } from '@adatechnology/game-render-three'

const budget = createLightBudget(THREE, scene, { point: 16, pointShadows: 2, spot: 4 })
const warmup = createProgramWarmup(THREE)
warmup.warmUp(renderer, scene, camera, { lights: budget, fogStates: ['linear', 'exp2'] }) // behind the loading screen

const flash = budget.acquire({ owner: 'weapons.muzzle', priority: LIGHT_PRIORITY.muzzle, urgent: true, color: 0xffcc88, intensity: 4, distance: 12, position: [0, 1.5, 0] })
budget.present([camera.position.x, camera.position.y, camera.position.z], dtSeconds) // once per frame
flash?.release()
```

`three` is a peer dependency (`^0.160.0`) and is never imported as a value: pass your `THREE`. The pools read three's internal
`renderer.properties.get(material).programs` (r160); `programKeysOf` isolates that read, a test checks it against the installed three, and
when it is missing the pools keep every material (more memory, no recompilation).
