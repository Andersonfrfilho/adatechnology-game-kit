import { describe, expect, it } from 'vitest'

import { createArsenal } from '../src'
import type { ExplosiveBody, Use, Vec3 } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60

const arsenal = createArsenal({ rules: { faults: false } })

/** Gurney's first speed of a case, `sqrt(2E) / sqrt(M/C + k)` (k 3/5 a sphere, 1/2 a cylinder). */
const gurney = (casing: { mass: number; chargeMass: number; gurneyVelocity: number; geometry?: 'sphere' | 'cylinder' }): number =>
  casing.gurneyVelocity / Math.sqrt(casing.mass / casing.chargeMass + (casing.geometry === 'cylinder' ? 0.5 : 0.6))

describe('the metal case of an explosive', () => {
  it('is given for the fragmentation munitions, with masses that throw their fragments at the speeds of the open literature', () => {
    const cased = [...arsenal.explosives.values()].filter((def) => def.casing)
    expect(cased.map((def) => def.id).sort()).toEqual(['m67', 'm79_40mm', 'pipe_bomb', 'vog_25'])
    for (const def of cased) {
      const casing = def.casing!
      expect(casing.mass).toBeGreaterThan(0)
      expect(casing.fragments).toBeGreaterThanOrEqual(1)
      // the explosive in the case is never more than its whole TNT equivalent says (Composition B is 1.35 TNT, TNT and black powder less)
      expect(casing.chargeMass).toBeLessThanOrEqual((def.tnt ?? 0) / 0.5)
      // a grenade body leaves at 1 to 2.2 km/s; a pipe of low explosive, slower
      expect(gurney(casing)).toBeGreaterThan(900)
      expect(gurney(casing)).toBeLessThan(2300)
    }
    // the M67: 190 g of steel round 180 g of Composition B, sqrt(2E) 2700 m/s: 2700 / sqrt(0.19/0.18 + 0.6) = 2100 m/s
    expect(gurney(arsenal.explosives.get('m67')!.casing!)).toBeCloseTo(2100, -1)
  })

  it('goes with the detonation, so the host can throw its fragments', () => {
    const weapon = arsenal.create('frag_grenade')
    let use: Use | undefined
    for (let frame = 0; frame < 30 && !use; frame++) {
      use = weapon.trigger(ORIGIN, AIM, FRAME, frame > 0).uses[0]
      weapon.update(FRAME)
    }
    use ??= weapon.release(ORIGIN, AIM)?.uses[0]
    expect(use?.kind).toBe('throw')
    if (use?.kind !== 'throw') return
    const body = arsenal.explosiveBody(use) as ExplosiveBody
    for (let elapsed = 0; elapsed < 20; elapsed += FRAME) {
      const event = body.step(FRAME).find((candidate) => candidate.type === 'detonate')
      if (event?.type !== 'detonate') continue
      expect(event.detonation.tnt).toBe(0.24)
      expect(event.detonation.casing).toEqual(arsenal.explosives.get('m67')!.casing)
      return
    }
    throw new Error('the grenade did not go off')
  })
})
