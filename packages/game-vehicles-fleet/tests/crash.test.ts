import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible, crashDeltaV, crashVehicle } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

const SEDAN_KG = 1380

function crash(otherMassKg: number, contactWidth: number, kmh: number) {
  const kit: any = makeFleetKit('en')
  const item: any = buildVehicleItem(kit, 'midsize_sedan')
  const d: any = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
  item.root.updateMatrixWorld(true)
  const front = d.partWorldCenter('bumper_front')
  crashVehicle(d, { point: [front[0] + 0.15, 0.55, front[2]], direction: [1, 0, 0], speed: kmh / 3.6, massKg: SEDAN_KG, otherMassKg, contactWidth })
  const parts = d.state().parts as Array<{ id: string; hp: number; maxHp: number; status: string }>
  const loss = (id: string): number => {
    const p = parts.find((q) => q.id === id)!
    return 1 - p.hp / p.maxHp
  }
  return { status: d.status(), loss, broken: parts.filter((p) => p.status === 'broken').map((p) => p.id) }
}

describe('a vehicle crashing', () => {
  it('the lighter body takes the larger change of speed', () => {
    expect(crashDeltaV(20, SEDAN_KG, Infinity)).toBe(20)
    expect(crashDeltaV(20, SEDAN_KG, SEDAN_KG)).toBeCloseTo(10)
    expect(crashDeltaV(20, SEDAN_KG, 15)).toBeLessThan(0.3)
  })

  it('hurts more the faster it goes, into a wall', () => {
    const slow = crash(Infinity, 1.7, 20)
    const fast = crash(Infinity, 1.7, 80)
    expect(fast.loss('bumper_front')).toBeGreaterThan(slow.loss('bumper_front'))
    expect(slow.status.canDrive).toBe(true)
    expect(fast.status.canDrive).toBe(false)
  })

  it('a pillar goes deeper than a wall at the same speed', () => {
    expect(crash(Infinity, 0.25, 50).loss('hood')).toBeGreaterThan(crash(Infinity, 1.7, 50).loss('hood'))
  })

  it('a light object barely marks the car, a parked car of its weight hurts it', () => {
    expect(crash(15, 0.5, 80).loss('bumper_front')).toBeLessThan(0.05)
    expect(crash(SEDAN_KG, 1.7, 80).loss('bumper_front')).toBeGreaterThan(0.2)
  })
})
