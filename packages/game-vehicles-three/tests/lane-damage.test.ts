import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleKit } from '@adatechnology/game-vehicles'
import { createSemiSimDriver, createSurfaces } from '@adatechnology/game-vehicles-driving'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createLaneDamage } from '../src/test-area/lane-damage'
import type { LaneDamage } from '../src/test-area/lane-damage'
import { fakeDocument } from './fake-dom'

/** One step of the lane car with `damage`: the rims on the road and the driver's condition it leaves. */
function drive(damage: Exclude<LaneDamage, 'none'>) {
  const kit: any = createVehicleKit({ THREE, document: fakeDocument })
  installFleet(kit)
  const item: any = buildVehicleItem(kit, 'compact_hatch')
  const model = createLaneDamage({ kit, context: item.vehicle, frame: item.root, damage })
  const driver: any = createSemiSimDriver({}, { surfaces: createSurfaces() })
  const rims = model.step({ dt: 1 / 60, speed: 10, throttle: 1, driver }).length
  return { rims, condition: driver.condition }
}

describe('the drive lane with damage', () => {
  it('a flat tyre leaves one wheel with almost no grip, no rim on the road yet', () => {
    const { rims, condition } = drive('flat_tyre')
    expect(rims).toBe(0)
    expect(Math.min(...condition.tyres)).toBeLessThan(0.2)
  })
  it('a torn tyre puts its rim on the road', () => {
    expect(drive('torn_tyre').rims).toBeGreaterThan(0)
  })
  it('a run-flat keeps most of the grip', () => {
    expect(Math.min(...drive('run_flat').condition.tyres)).toBeGreaterThan(0.5)
  })
  it('drained brake lines leave weak brakes', () => {
    expect(drive('no_brake_fluid').condition.brakes).toBeLessThan(0.5)
  })
})

describe('the drive lane car hitting the wall', () => {
  it('crumples its front in place: the hood takes the blow and stays on, the plastic bumper breaks', () => {
    const kit: any = createVehicleKit({ THREE, document: fakeDocument })
    installFleet(kit)
    const item: any = buildVehicleItem(kit, 'compact_hatch')
    const model = createLaneDamage({ kit, context: item.vehicle, frame: item.root, damage: 'into_wall' })
    const events: any[] = model.crash({ speed: 14, direction: [1, 0, 0] })
    expect(events.some((e) => e.type === 'damage' && e.part === 'hood')).toBe(true)
    expect(events.some((e) => e.type === 'fracture' && e.part === 'bumper_front')).toBe(true)
    expect(events.some((e) => (e.type === 'fracture' && e.part === 'hood') || (e.type === 'detach' && e.parts.includes('hood')))).toBe(false)
  })
})
