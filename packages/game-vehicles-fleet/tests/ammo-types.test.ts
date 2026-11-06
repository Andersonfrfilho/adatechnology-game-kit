import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** One round at a part of the sedan: through, lodged or stopped, and the hole it leaves. */
function fire(part: string, from: number[], round: { energy: number; caliber: number; steelMm: number; piercing: number }, armour: 'IIIA' | 'III' | null = null) {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, 'midsize_sedan')
  const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root, armour })
  const t = d.partWorldCenter(part)
  const dir = [t[0] - from[0], t[1] - from[1], t[2] - from[2]]
  const n = Math.hypot(...dir)
  const u = dir.map((v) => v / n) as [number, number, number]
  const size = (d.describe().parts.find((p) => p.id === part)!.shape as { size: readonly number[] }).size
  const events = d.hit({ type: 'ballistic', point: [t[0] - u[0] * size[0] * 0.5, t[1] - u[1] * size[1] * 0.5, t[2] - u[2] * size[2] * 0.5], direction: u, energy: round.energy, caliber: round.caliber, penetration: { steel: round.steelMm }, piercing: round.piercing })
  const e = events.find((e) => e.type === 'hole' && e.part === part) as { hole: { through: boolean; diameter: number }; energyLeft?: number } | undefined
  return e && ({ ...e.hole, energyLeft: e.energyLeft }) as { through: boolean; diameter: number; energyLeft?: number } | undefined
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
  it('a round loses energy in each panel: a pistol keeps less than a rifle after the door', () => {
    const pistol = fire('door_front_left', SIDE, FMJ_9)!
    const rifle = fire('door_front_left', SIDE, AP_762)!
    expect(pistol.energyLeft).toBeLessThan(FMJ_9.energy)
    expect(pistol.energyLeft).toBeGreaterThan(0)
    expect(rifle.energyLeft! / AP_762.energy).toBeGreaterThan(pistol.energyLeft! / FMJ_9.energy)
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

describe('a round at the door mirror', () => {
  const shootMirror = (round: { energy: number; caliber: number; steelMm: number; piercing: number }) => {
    const kit = makeFleetKit('en')
    const item = buildVehicleItem(kit, 'midsize_sedan')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
    const glassLeft = (): number => {
      let n = 0
      item.root.traverse((m) => { if (m.userData.mirrorGlass && m.visible) n++ })
      return n
    }
    const before = glassLeft()
    const t = d.partWorldCenter('mirror_left')
    const events = d.hit({ type: 'ballistic', point: [t[0], t[1], t[2] - 0.05], direction: [0, 0, 1], energy: round.energy, caliber: round.caliber, penetration: { steel: round.steelMm }, piercing: round.piercing })
    return { shattered: before - glassLeft(), torn: events.some((e) => e.type === 'detach') }
  }
  it('a pistol round shatters the glass and leaves the housing on', () => {
    expect(shootMirror(FMJ_9)).toEqual({ shattered: 1, torn: false })
  })
  it('a rifle round tears the mirror off', () => {
    expect(shootMirror(AP_762).torn).toBe(true)
  })
})

describe('a shot aimed at a mirror', () => {
  it('lands on the mirror, not on the body behind it', () => {
    const kit = makeFleetKit('en')
    const item = buildVehicleItem(kit, 'midsize_sedan')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
    d.partWorldCenter('roof')
    item.root.updateMatrixWorld(true)
    const glasses: THREE.Vector3[] = []
    item.root.traverse((m) => { if (m.userData.mirrorGlass) glasses.push(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())) })
    expect(glasses.length).toBeGreaterThan(0)
    const parts = glasses.map((at) => {
      const hits = ([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as [number, number, number][]).map((dir) => d.surfaceRay!({ origin: [at.x - dir[0]! * 3, at.y, at.z - dir[2]! * 3], direction: dir, maxDistance: 3.2 }))
      return hits.find((h) => h && Math.abs(h.distance - 3) < 0.08)?.part
    })
    for (const part of parts) expect(part).toMatch(/^mirror_/)
  })
})
