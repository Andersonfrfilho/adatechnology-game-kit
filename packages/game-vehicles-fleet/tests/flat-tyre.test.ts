import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

function sedan(armour: 'IIIA' | 'III' | null = null) {
  const kit: any = makeFleetKit('en')
  const item: any = buildVehicleItem(kit, 'midsize_sedan')
  return createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root, armour }) as any
}
/** Bursts the front left tyre with a rifle round. */
function burst(d: any): string {
  const tyre = d.describe().parts.find((p: any) => p.id.startsWith('tyre')).id
  d.hit({ type: 'ballistic', point: d.partWorldCenter(tyre), part: tyre, direction: [0, 0, 1], energy: 3500, caliber: 7.8, penetration: { steel: 18 } })
  return tyre
}
/** Metres driven at `speed` until the tyre tears off, up to `limit`. */
function metresUntilTorn(d: any, tyre: string, speed: number, limit = 100000) {
  for (let m = 0; m < limit; m += 50) {
    d.rollFlat(50, speed)
    if (d.state().parts.find((p: any) => p.id === tyre)?.status === 'broken') return m + 50
  }
  return Infinity
}
/** The grip the driving report gives the tyre (the report lists the tyres in the order of the parts). */
const grip = (d: any, tyre: string): number => {
  const tyres = d.describe().parts.filter((p: any) => p.id.startsWith('tyre')).map((p: any) => p.id)
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
    d.update(0.016)
    expect(d.rollFlat(10, 10)).toBe(1)
    const events = d.update(0.016)
    expect(events.some((e: any) => e.type === 'debris' && e.kind === 'sparks')).toBe(true)
    expect(grip(d, tyre)).toBeLessThan(0.1)
  })
  it('a run-flat insert on an armoured car carries it tens of kilometres and keeps most of the grip', () => {
    const d = sedan('IIIA')
    const tyre = burst(d)
    expect(grip(d, tyre)).toBeGreaterThan(0.5)
    expect(metresUntilTorn(d, tyre, 20, 40000)).toBe(Infinity)
  })
})
