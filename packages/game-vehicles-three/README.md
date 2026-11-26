# @adatechnology/game-vehicles-three

A vehicle of `@adatechnology/game-vehicles` in a game frame, at full detail or fused into six meshes. A literal port of the team's Frota Leve (`FrotaLeve.criar(...).construir`).

```ts
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '@adatechnology/game-vehicles-three'

const kit = createVehicleKit({ THREE })
installFleet(kit)
const vehicles = createVehiclesThree(THREE, { kit })
const car = vehicles.build('midsize_sedan', { quality: 'lite', seed: 42 })
scene.add(car.group) // front on +z, right on -x, centred, wheels on y = 0
car.triangles // 19286 · car.drawCalls // 6 · car.damageables // metal, glass, rubber, fuel boxes in the game frame
```

- `quality: 'high'` is the kit's vehicle (the context stays in `car.context` for damage), `'lite'` fuses it into `paint`, `trim`, `metal`, `glass`, `light` and `plate`, dropping interiors and pieces under 3 cm.
- The colour comes from `color` or from `seed` through the palette of the vehicle's group (`colorFromSeed`).
- Tested against the team's page on three r160 (triangles, draw calls, size, per-class vertices, damageable boxes) and against `DIMS` for the 69 vehicles.

## Collision hulls

`createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls })` gives the engine the convex hulls of a vehicle (`hulls()`) next to the boxes of `pieces()`. The division of a car into hulls is the same for every car of a model, so it is made once per model:

- `planCache: createHullPlanCache()` shares the hulls of the intact cars of a model (key: the vehicle key, its seed key and its build state, or `planKey`); the second car of a model is given the same hull objects in under 2 ms. A dented car neither gives nor takes. `cache.dispose()` lets everything go.
- `workers` (a `WorkerCoordinator` of `@adatechnology/game-workers`) sends the division of the first car of a model to the `vehicles.hull-plan` kind (`@adatechnology/game-vehicles-three/worker-kinds`, three-free; list `hullPlanKind` in the worker file's `installWorkerHost` and `warm([hullPlanKind])` at load). Until it is back `hulls()` answers an empty list and `isHullPending()` is true: the car keeps the boxes of `pieces()`. The call after the answer installs the plan, so call `hulls()` in the fixed step. Without `workers` the division is made in the call, with the same bytes.

## Test area

`createVehiclesTestModule({ locale, document?, three?, vehicles?, effects? })` is a `TestableModule` for the shared test room (`room.loadModule`, or `loadVehiclesTestModule(room)`, which learns the room's three.js to compute the door, hood and trunk clips). It lays the eight vehicles of the Frota test, each with its own `DestructibleImpl`, and brings 13 scenarios: the eleven of the team's test page, literal (`vehicles_9mm_windshield`, `vehicles_shotgun_door`, `vehicles_ram_front`, `vehicles_engine_fire`, `vehicles_fuel_tank`, `vehicles_unbolt_wheel`, `vehicles_tear_bumper`, `vehicles_break_mirror`, `vehicles_kill_battery`, `vehicles_rollover`, `vehicles_melt`; the page ids are in `PAGE_SCENARIO_ALIASES`), plus `vehicles_drive_arcade` and `vehicles_drive_semi` for `@adatechnology/game-vehicles-driving`.

The bench sets the quality (full or light mode), the paint by seed and palette, the driving mode and the surface, and drives a car down a lane; its layers show the damageable boxes by material, the zones by type and the axes of the output frame; its metrics read triangles, draw calls, the size against `DIMS` and the boxes by material. The module draws no particles: fire, explosion, glass, sparks, leaks and exhaust are requested by id through `host.effects` when the host has one (`defaultEffectIds`, replaceable by option). A pierced tank asks for `leak` (`vehicle_leak`: the pool and the drips only); when the leak catches fire (a spark, an incendiary round, a fire near, a blast) the `ignite` event of the tank asks for `leakIgnited` (`vehicle_leak_ignited`: the Garagem's whole sequence, the fire along the pool and then the blast). `examples/vehicles-test-area` loads it.

## Rain under the roof

`createVehicleRainCovers()` keeps the host's rain (`ModuleHost.rainCover`) told what each vehicle in the scene roofs over: `track(id, destructible, frame)`, then `sync(host.rainCover, dt)` every frame and `clear()` when the module leaves (the vehicles test area does it). The cover comes from `createVehicleRainCover` of `game-vehicles`: the cabin box and roof of a car, the body of a bus or truck; an open pickup bed, bikes, boats, planes, helicopters and the tractor roof nothing. A torn-off roof, a broken windshield or pane and a through-hole of 30 cm or more are openings; a moving car only turns its rectangle (the damage state is read every 0.4 s) and the version the far curtain caches grows every metre or so.

## Crash parts on the physics engine (`createCrashParts`, spec 008 T6.9)

`createCrashParts({ THREE, world, vehicle, frame, colliders, mass, onPartLost? })` builds a mutable compound of the car's hulls (`colliders.hulls()`, each child tagged with the id of its part) and keeps it in step with the drawing. `shape()` gives the chassis shape; `bind(chassis)` sets the kit's mass, inertia and centre of mass and listens to the contacts; call `step()` after every physics step.

- A part that comes off (`vehicle.disassemble`, or a blow) leaves the compound and becomes a body with its own hulls, mass (`PartDef.mass`), box inertia and the velocity of its point on the chassis; the chassis gives up that mass (`massOf(chassis) + parts = the kit's mass`). Nothing is flung (`flying` stays empty), and the part is not born inside anything (pushed out of fixed geometry, at most 3 times).
- Level-2 damage: each step the strongest contact row of every hull tag becomes a `crashVehicle` (point, direction, approach speed, both masses, width of the part's box, `source` = part id).
- At rest (chassis under 0.05 m/s for 30 steps) the hulls of what was dented are made again and the changed ones go to the engine with `setChildShape`. A hull that touches something may only move inward, and outward by 2 mm at most (`holdWithin`), until the contact ends.
- `stats()` reports `released`, `pushedOut`, `settles`, `remade`, `held`, `unplaced`, `blows`, `events`, `hitParts` and `children`; `dispose()` removes every part body. Wheels and lamps without a hull use the drawn box; the interior is spec 009.
- The hull cache by model (`createHullPlanCache`) and the worker kind `vehicles.hull-plan` are described above; a dented car leaves the cache.
