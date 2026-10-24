# @adatechnology/game-vehicles-driving

Driving for vehicles, without three.js and without a game. The arcade driver is the car of the game, extracted: a pure step over a state, with every number an option.

```ts
import { createArcadeDriver, vehicleCorners } from '@adatechnology/game-vehicles-driving'

const driver = createArcadeDriver({ maxForward: 20 })
driver.place(0, 0, 0)
const world = {
  blocked: (x, z, yaw) => vehicleCorners(driver.spec, x, z, yaw).some(([a, b]) => isSolid(a, b)),
  bodies: () => zombies.map((z) => (z.alive ? z : undefined)),
}
const { state, events } = driver.step({ throttle: 1, brake: 0, steer: 0, handbrake: false }, dt, world)
// events: crash, noise (crash, engine, horn), run_over (kill, knock, push), horn
```

The driver never touches a game: the host applies damage, shakes the camera, kills the bodies and plays the sounds from the events. Tested against the game's own `carUpdate` cut from `jogo.js` (positions and events frame by frame).
