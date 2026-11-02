import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** One round at a part of the sedan: through, lodged or stopped, and the hole it leaves. */
function fire(part: string, from: number[], round: { energy: number; caliber: number; steelMm: number; piercing: number }, armour: 'IIIA' | 'III' | null = null) {
  const kit: any = makeFleetKit('en')
  const item: any = buildVehicleItem(kit, 'midsize_sedan')
  const d: any = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root, armour })
  const t = d.partWorldCenter(part)
  const dir = [t[0] - from[0], t[1] - from[1], t[2] - from[2]]
  const n = Math.hypot(...dir)
  const u = dir.map((v) => v / n)
  const size = d.describe().parts.find((p: any) => p.id === part).shape.size
  const events = d.hit({ type: 'ballistic', point: [t[0] - u[0] * size[0] * 0.5, t[1] - u[1] * size[1] * 0.5, t[2] - u[2] * size[2] * 0.5], direction: u, energy: round.energy, caliber: round.caliber, penetration: { steel: round.steelMm }, piercing: round.piercing })
  return events.find((e: any) => e.type === 'hole' && e.part === part)?.hole as { through: boolean; diameter: number } | undefined
}

const SIDE = [-4, 0.7, 0]
const FRONT = [5, 0.7, 0]
const FMJ_9 = { energy: 527, caliber: 9, steelMm: 3, piercing: 1 }
const HP_9 = { energy: 527, caliber: 9, steelMm: 2, piercing: 0.6 }
const AP_556 = { energy: 1750, caliber: 5.7, steelMm: 10, piercing: 1.4 }
const AP_762 = { energy: 3500, caliber: 7.8, steelMm: 18, piercing: 1.4 }
const PELLET_00 = { energy: 200, caliber: 8.4, steelMm: 0.8, piercing: 0.5 }

describe('kinds of round against a car', () => {
  it('a pistol round goes through a door; a hollow point leaves a wider hole', () => {
    expect(fire('door_front_left', SIDE, FMJ_9)?.through).toBe(true)
    expect(fire('door_front_left', SIDE, HP_9)!.diameter).toBeGreaterThan(fire('door_front_left', SIDE, FMJ_9)!.diameter)
  })
  it('the engine block stops rifle rounds', () => {
    expect(fire('engine', FRONT, AP_762)?.through ?? false).toBe(false)
  })
  it('a buckshot pellet dents a door and stops', () => {
    expect(fire('door_front_left', SIDE, PELLET_00)?.through ?? false).toBe(false)
  })
  it('civilian armour stops a pistol, an AP rifle round goes through it; rifle armour stops a 5.56 AP, not a 7.62 AP', () => {
    expect(fire('door_front_left', SIDE, FMJ_9, 'IIIA')?.through ?? false).toBe(false)
    expect(fire('door_front_left', SIDE, AP_556, 'IIIA')?.through).toBe(true)
    expect(fire('door_front_left', SIDE, AP_556, 'III')?.through ?? false).toBe(false)
    expect(fire('door_front_left', SIDE, AP_762, 'III')?.through).toBe(true)
  })
})
