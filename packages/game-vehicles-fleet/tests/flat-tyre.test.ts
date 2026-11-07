import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

function sedan(armour: 'IIIA' | 'III' | null = null) {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, 'midsize_sedan')
  return createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root, armour })
}
/** Bursts the front left tyre with a rifle round. */
function burst(d: VehicleDestructible): string {
  const tyre = d.describe().parts.find((p) => p.id.startsWith('tyre'))!.id
  d.hit({ type: 'ballistic', point: d.partWorldCenter(tyre), part: tyre, direction: [0, 0, 1], energy: 3500, caliber: 7.8, penetration: { steel: 18 } })
  return tyre
}
/** Metres driven at `speed` until the tyre tears off, up to `limit`. */
function metresUntilTorn(d: VehicleDestructible, tyre: string, speed: number, limit = 100000) {
  for (let m = 0; m < limit; m += 50) {
    d.rollFlat(50, speed)
    if (d.state().parts.find((p) => p.id === tyre)?.status === 'broken') return m + 50
  }
  return Infinity
}
/** The grip the driving report gives the tyre (the report lists the tyres in the order of the parts). */
const grip = (d: VehicleDestructible, tyre: string): number => {
  const tyres = d.describe().parts.filter((p) => p.id.startsWith('tyre')).map((p) => p.id)
  return d.driveReport().tyres[tyres.indexOf(tyre)].health
}

describe('a flat tyre driven on', () => {
  it('tears off within a couple of kilometres in town, sooner on the highway', () => {
    const town = sedan()
    const fast = sedan()
    const a = metresUntilTorn(town, burst(town), 8)
    const b = metresUntilTorn(fast, burst(fast), 30)
    expect(a).toBeGreaterThan(800)
    expect(a).toBeLessThan(3000)
    expect(b).toBeLessThan(a)
  })
  it('then the bare rim grinds on the road, throwing sparks, with almost no grip', () => {
    const d = sedan()
    const tyre = burst(d)
    metresUntilTorn(d, tyre, 10)
    d.update!(0.016)
    expect(d.rollFlat(10, 10)).toBe(1)
    const events = d.update!(0.016)
    expect(events.some((e) => e.type === 'debris' && e.kind === 'sparks')).toBe(true)
    expect(grip(d, tyre)).toBeLessThan(0.1)
  })
  it('a run-flat insert on an armoured car carries it tens of kilometres and keeps most of the grip', () => {
    const d = sedan('IIIA')
    const tyre = burst(d)
    expect(grip(d, tyre)).toBeGreaterThan(0.5)
    expect(metresUntilTorn(d, tyre, 20, 40000)).toBe(Infinity)
  })
})

describe('a rifle round in a tyre', () => {
  const AK = { type: 'ballistic', energy: 2100, caliber: 7.62 } as const
  const BURST = 40
  const TYRE_KEYS = ['midsize_sedan', 'compact_hatch', 'box_truck', 'city_bus', 'cruiser', 'tractor']

  for (const key of TYRE_KEYS) {
    it(`${key}: punctures it and lets it down, however many rounds, and never tears it off the rim`, () => {
      const kit = makeFleetKit('en')
      const item = buildVehicleItem(kit, key)
      const d = createVehicleDestructible(kit, item.vehicle, { id: key, frame: item.root })
      const tyre = d.describe().parts.find((p) => p.id.startsWith('tyre'))!.id
      for (let round = 0; round < BURST; round++) d.hit({ ...AK, point: d.partWorldCenter(tyre), part: tyre, direction: [0, 0, 1] })
      expect(d.status().flatTyres).toContain(tyre)
      expect(d.state().parts.find((p) => p.id === tyre)?.status).not.toBe('broken')
      expect(d.detachedParts()).not.toContain(tyre)
    })
  }
})

