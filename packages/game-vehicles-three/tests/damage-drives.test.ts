import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import { conditionFromDamage, createSemiSimDriver, createSurfaces } from '@adatechnology/game-vehicles-driving'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { fakeDocument } from './fake-dom'

/** The damage of a car reaches its driving: what the destruction model reports becomes the driver's condition. */
function sedan() {
  const kit: any = createVehicleKit({ THREE, document: fakeDocument })
  installFleet(kit)
  const item: any = buildVehicleItem(kit, 'midsize_sedan')
  return createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root }) as any
}

/** From 100 km/h on dry asphalt to a stop: metres travelled and how far it drifted to the side. */
function stop(condition: any) {
  const driver: any = createSemiSimDriver({}, { surfaces: createSurfaces() })
  driver.place(0, 0, 0)
  const world = { ground: () => ({ surface: 'dry_asphalt' }) }
  for (let t = 0; t < 40 && Math.abs(driver.state.u) * 3.6 < 100; t += 1 / 60) driver.step({ throttle: 1, brake: 0, steer: 0, handbrake: false }, 1 / 60, world)
  driver.condition = conditionFromDamage(driver.spec, condition)
  const x0 = driver.state.x
  const z0 = driver.state.z
  for (let t = 0; t < 30 && Math.abs(driver.state.u) > 0.1; t += 1 / 60) driver.step({ throttle: 0, brake: 1, steer: 0, handbrake: false }, 1 / 60, world)
  return { distance: Math.hypot(driver.state.x - x0, driver.state.z - z0), drift: Math.abs(driver.state.z - z0) }
}

describe('damage that changes the driving', () => {
  it('a whole car stops from 100 km/h in about 37 m', () => {
    const d = stop(sedan().driveReport())
    expect(d.distance).toBeGreaterThan(30)
    expect(d.distance).toBeLessThan(45)
  })
  it('broken brakes take much longer to stop', () => {
    const car = sedan()
    const brakes = car.describe().parts.find((p: any) => p.id === 'brakes')
    car.hit({ type: 'blunt', point: car.partWorldCenter('brakes'), energy: brakes ? 1e6 : 0, radius: 0.3 })
    const report = car.driveReport()
    expect(report.brakes).toBeLessThan(0.6)
    expect(stop(report).distance).toBeGreaterThan(stop(sedan().driveReport()).distance * 1.4)
  })
  it('a flat tyre reaches the driver as a flat wheel on its side', () => {
    const car = sedan()
    const t = car.partWorldCenter('tyre_front_left')
    car.hit({ type: 'ballistic', point: t, part: 'tyre_front_left', direction: [0, 0, 1], energy: 527, caliber: 9 })
    const report = car.driveReport()
    const driver: any = createSemiSimDriver({}, { surfaces: createSurfaces() })
    const condition = conditionFromDamage(driver.spec, report)
    expect(condition.tyres!.filter((h) => h < 0.2)).toHaveLength(1)
  })
})
