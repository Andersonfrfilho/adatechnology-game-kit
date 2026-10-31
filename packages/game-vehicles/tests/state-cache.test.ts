import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

const kit = makeKit()
const make = () => {
  const built = buildVehicleItem(kit, 'proto')
  return createVehicleDestructible(kit, built.vehicle, { id: 'cached', frame: built.root, headless: true, seed: 1 })
}

describe('state() of a vehicle', () => {
  it('is not rebuilt while nothing changes, and is rebuilt after a hit', () => {
    const d = make()
    const first = d.state()
    d.update!(0.016)
    expect(d.state()).toBe(first)
    const tank = d.partWorldCenter('fuel_tank')
    d.hit({ type: 'ballistic', point: [tank[0], tank[1], tank[2]], direction: [0, 0, -1], energy: 3000, caliber: 8 })
    const after = d.state()
    expect(after).not.toBe(first)
    expect(d.state()).toBe(after)
  })

  it('follows a fire that is burning', () => {
    const d = make()
    const first = d.state()
    const part = d.describe().parts[0]!.id
    d.hit({ type: 'fire', point: d.partWorldCenter(part), direction: [0, 1, 0], energy: 50000 })
    d.update!(0.5)
    const hot = d.state()
    expect(hot).not.toBe(first)
    d.update!(0.5)
    expect(d.state()).not.toBe(hot)
  })
})
