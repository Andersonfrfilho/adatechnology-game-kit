import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

function sedan() {
  const kit: any = makeFleetKit('en')
  const item: any = buildVehicleItem(kit, 'midsize_sedan')
  return createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root }) as any
}
const shootAt = (d: any, part: string) => d.hit({ type: 'ballistic', point: d.partWorldCenter(part), part, direction: [0, 1, 0], energy: 3500, caliber: 7.8 })

describe('fluids leaking from a damaged car', () => {
  it('the gearbox, the brake system, the power steering and the battery hold their fluids', () => {
    const fluids = Object.fromEntries(sedan().describe().parts.filter((p: any) => p.contains).map((p: any) => [p.id, p.contains.fluid]))
    expect(Object.values(fluids)).toEqual(expect.arrayContaining(['transmission_fluid', 'brake_fluid', 'power_steering_fluid', 'battery_acid', 'coolant', 'oil']))
  })
  it('a holed brake system loses its fluid and the brakes weaken', () => {
    const d = sedan()
    const before = d.driveReport().brakes
    const evs = shootAt(d, 'brakes')
    expect(evs.some((e: any) => e.type === 'leak' && e.fluid === 'brake_fluid')).toBe(true)
    for (let i = 0; i < 120; i++) d.update(1)
    expect(d.driveReport().brakes).toBeLessThan(before * 0.6)
  })
  it('a holed gearbox leaks transmission fluid', () => {
    const d = sedan()
    expect(shootAt(d, 'gearbox').some((e: any) => e.type === 'leak' && e.fluid === 'transmission_fluid')).toBe(true)
  })
})
