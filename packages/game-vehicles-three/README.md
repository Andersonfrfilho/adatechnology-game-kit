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

## Test area

`createVehiclesTestModule({ locale, document?, three?, vehicles?, effects? })` is a `TestableModule` for the shared test room (`room.loadModule`, or `loadVehiclesTestModule(room)`, which learns the room's three.js to compute the door, hood and trunk clips). It lays the eight vehicles of the Frota test, each with its own `DestructibleImpl`, and brings 13 scenarios: the eleven of the team's test page, literal (`vehicles_9mm_windshield`, `vehicles_shotgun_door`, `vehicles_ram_front`, `vehicles_engine_fire`, `vehicles_fuel_tank`, `vehicles_unbolt_wheel`, `vehicles_tear_bumper`, `vehicles_break_mirror`, `vehicles_kill_battery`, `vehicles_rollover`, `vehicles_melt`; the page ids are in `PAGE_SCENARIO_ALIASES`), plus `vehicles_drive_arcade` and `vehicles_drive_semi` for `@adatechnology/game-vehicles-driving`.

The bench sets the quality (full or light mode), the paint by seed and palette, the driving mode and the surface, and drives a car down a lane; its layers show the damageable boxes by material, the zones by type and the axes of the output frame; its metrics read triangles, draw calls, the size against `DIMS` and the boxes by material. The module draws no particles: fire, explosion, glass, sparks, leaks and exhaust are requested by id through `host.effects` when the host has one (`defaultEffectIds`, replaceable by option). A pierced tank asks for `leak` (`vehicle_leak`: the pool and the drips only); when the leak catches fire (a spark, an incendiary round, a fire near, a blast) the `ignite` event of the tank asks for `leakIgnited` (`vehicle_leak_ignited`: the Garagem's whole sequence, the fire along the pool and then the blast). `examples/vehicles-test-area` loads it.
