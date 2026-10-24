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
- Tested against the team's page on three r160 (triangles, draw calls, size, per-class vertices, damageable boxes) and against `DIMS` for the 69 vehicles on r128.
