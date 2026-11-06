import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

function sedan() {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, 'midsize_sedan')
  return createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
}
/** Drains a fluid: holes the part until it is empty. */
function drain(d: VehicleDestructible, role: string) {
  const part = d.describe().parts.find((p) => p.tags?.includes(role) || p.id.startsWith(role))
  d.hit({ type: 'ballistic', point: d.partWorldCenter(part!.id), part: part!.id, direction: [0, 1, 0], energy: 3500, caliber: 12.7 })
  for (let i = 0; i < 600; i++) d.update!(1)
}
/** Seconds of driving at `load` until the engine will not start, up to `limit`. */
function runUntilDead(d: VehicleDestructible, load: number, limit = 900) {
  for (let t = 0; t < limit; t++) {
    d.runEngine(1, load)
    if (!d.status().canStart) return t
  }
  return Infinity
}

describe('an engine without its fluids', () => {
  it('a whole engine runs on at its working temperature', () => {
    const d = sedan()
    expect(runUntilDead(d, 1, 600)).toBe(Infinity)
  })
  it('without coolant it overheats and seizes in two to five minutes', () => {
    const d = sedan()
    drain(d, 'radiator')
    const t = runUntilDead(d, 1)
    expect(t).toBeGreaterThan(90)
    expect(t).toBeLessThan(330)
  })
  it('without oil it wears through and seizes', () => {
    const d = sedan()
    drain(d, 'oil_pan')
    expect(runUntilDead(d, 1)).toBeLessThan(400)
  })
})
