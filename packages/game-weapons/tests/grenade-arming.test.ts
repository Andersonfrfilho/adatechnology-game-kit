import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import type { ExplosiveEvent, SurfaceProbe, Use, Vec3 } from '../src'

const FRAME = 1 / 60
const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]

/** A wall on the plane z = `z` (facing +z). */
const wallAt =
  (z: number): SurfaceProbe =>
  (from, to) => {
    if (from[2] <= z || to[2] > z) return null
    const k = (from[2] - z) / (from[2] - to[2])
    return { point: [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, z], normal: [0, 0, 1], ground: false }
  }

const arsenal = createArsenal({ rules: { faults: false, startSafe: false } })

/** The arming distances of `count` shots of one launcher, each reloaded. */
const armDistances = (weaponId: string, count: number): number[] => {
  const weapon = arsenal.create(weaponId)
  const distances: number[] = []
  for (let shot = 0; shot < count; shot++) {
    weapon.reload()
    weapon.update(10)
    const use: Use | undefined = weapon.trigger(ORIGIN, AIM, shot * 20, false).uses[0]
    if (use?.kind === 'throw' && use.armDistance !== undefined) distances.push(use.armDistance)
    weapon.update(10)
  }
  return distances
}

const flyAt = (use: Use, wallZ: number): ExplosiveEvent[] => {
  const body = arsenal.explosiveBody(use)
  if (!body) throw new Error('no explosive body')
  const events: ExplosiveEvent[] = []
  for (let t = 0; t < 5 && !body.done; t += FRAME) events.push(...body.step(FRAME, wallAt(wallZ)))
  return events
}

describe('40 mm grenade fuze (M406: arms 14 to 27 m from the muzzle, by the spin)', () => {
  it('samples the arming distance of each shot between 14 and 27 m, spread over the range', () => {
    for (const id of ['m79', 'm203', 'ag36', 'm32_mgl']) {
      const distances = armDistances(id, 40)
      expect(distances.length, id).toBeGreaterThan(0)
      for (const distance of distances) {
        expect(distance, id).toBeGreaterThanOrEqual(14)
        expect(distance, id).toBeLessThanOrEqual(27)
      }
    }
    const spread = armDistances('m79', 40)
    expect(Math.max(...spread) - Math.min(...spread)).toBeGreaterThan(6)
  })

  it('is a dud on a wall 12 m away, whatever the shot sampled', () => {
    for (const armDistance of [14, 20, 27]) {
      const use = { ...arsenal.create('m79').trigger(ORIGIN, AIM, 0, false).uses[0], armDistance } as Use
      expect(flyAt(use, -12).map((event) => event.type)).toEqual(['impact', 'dud'])
    }
  })

  it('explodes on a wall 30 m away, past the far end of the range', () => {
    for (const armDistance of [14, 27]) {
      const use = { ...arsenal.create('m79').trigger(ORIGIN, AIM, 0, false).uses[0], armDistance } as Use
      expect(flyAt(use, -30).map((event) => event.type)).toEqual(['armed', 'impact', 'detonate'])
    }
  })

  it('between 14 and 27 m it depends on the shot: armed past its own distance, a dud short of it', () => {
    const use = arsenal.create('m79').trigger(ORIGIN, AIM, 0, false).uses[0] as Use
    expect(flyAt({ ...use, armDistance: 16 } as Use, -20).at(-1)?.type).toBe('detonate')
    expect(flyAt({ ...use, armDistance: 25 } as Use, -20).at(-1)?.type).toBe('dud')
  })

  it('leaves the rockets at their launcher distance (10 m)', () => {
    expect(armDistances('rpg_7', 3)).toEqual([10, 10, 10])
  })
})
