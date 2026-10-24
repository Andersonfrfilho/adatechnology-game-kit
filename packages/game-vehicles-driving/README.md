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

## Semi-simulation

`createSemiSimDriver(spec)` is the driving the Frota document asks for: a single rigid body with a low centre of mass, a spring and damper on each wheel measured against the ground under it (`world.ground(x, z)`), longitudinal and lateral tyre forces apart inside a friction circle, an automatic gearbox with a simulated RPM, a handbrake that locks the rear wheels, surfaces (`dry_asphalt` 1.0, `wet_asphalt` 0.75 with aquaplaning above 90 km/h, `dirt` 0.65, `grass` 0.55, `mud` 0.4 that bogs a vehicle without four-wheel drive, `blood` 0.5) and damage that changes how it drives (`driver.condition`: a flat tyre pulls to its side, a damaged suspension rolls more, an engine under 30% fails at full throttle and can die uphill). Fuel use follows the RPM, the cargo and the engine (up to +40% when wrecked). `semiSpecFromStats` builds a spec from the design ratings; `impactEnergy`, `bodyDamage`, `vehicleDamageFromImpact` and `speedLoss` are the run-over formulas of section 08. There is no team code for it: the document's numbers are the tests, and no golden is claimed.
