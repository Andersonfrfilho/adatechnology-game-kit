import { describe, expect, it } from 'vitest'

import { createArsenal, tripwireSegment } from '../src'
import type { Use, Vec3 } from '../src'

const ORIGIN: Vec3 = [2, 0.03, 3]
const AIM: Vec3 = [0, 0, -1]

const placeOf = (weaponId: string, arsenal = createArsenal({ rules: { faults: false } }), direction: Vec3 = AIM): Extract<Use, { kind: 'place' }> => {
  const use = arsenal.create(weaponId).trigger(ORIGIN, direction, 0, false).uses[0]
  if (use?.kind !== 'place') throw new Error(`${weaponId} did not place a charge`)
  return use
}

describe('trip wire of a placed charge', () => {
  it('the Claymore stretches a 10 m wire straight ahead, 0.15 m above where it sits', () => {
    const use = placeOf('claymore')
    expect(use.tripwire).toEqual({ length: 10, angleDeg: 0, height: 0.15 })
    const segment = tripwireSegment(use)
    expect(segment?.from).toEqual([2, 0.18, 3])
    expect(segment?.to[0]).toBeCloseTo(2, 9)
    expect(segment?.to[1]).toBeCloseTo(0.18, 9)
    expect(segment?.to[2]).toBeCloseTo(-7, 9)
  })

  it('the angle turns the wire counter-clockwise seen from above, and a tilted aim does not tilt the wire', () => {
    const turned = tripwireSegment({ ...placeOf('claymore'), tripwire: { length: 4, angleDeg: 90, height: 0.1 } })
    expect(turned?.to[0]).toBeCloseTo(2 - 4, 9)
    expect(turned?.to[2]).toBeCloseTo(3, 9)
    expect(turned?.to[1]).toBeCloseTo(0.13, 9)
    const tilted = tripwireSegment(placeOf('claymore', undefined, [0, -0.5, -1]))
    expect(tilted?.to[1]).toBeCloseTo(0.18, 9)
    expect(tilted?.to[2]).toBeCloseTo(-7, 9)
  })

  it('length, angle and height come from the explosive, so a game changes them with a patch', () => {
    const arsenal = createArsenal({ rules: { faults: false }, patch: { explosives: { claymore: { tripwire: { length: 25, angleDeg: 30, height: 0.3 } } } } })
    expect(placeOf('claymore', arsenal).tripwire).toEqual({ length: 25, angleDeg: 30, height: 0.3 })
  })

  it('an explosive with the wire trigger and no wire of its own gets the one of the rules', () => {
    const arsenal = createArsenal({
      rules: { faults: false, explosives: { tripwire: { length: 6 } } },
      explosives: [{ id: 'bounding_mine', kind: 'fragmentation', lethalRadius: 5, injuryRadius: 20, energy: 1e5, destructionLevel: 1, noise: 400, triggers: ['wire'] }],
      weapons: [{ id: 'bounding_mine', category: 'throwable', mass: 3, action: { kind: 'throwable', explosive: 'bounding_mine', energy: 0, radius: 0, fuse: 0, throwSpeed: 1, noise: 0 } }],
    })
    expect(placeOf('bounding_mine', arsenal).tripwire).toEqual({ length: 6, angleDeg: 0, height: 0.15 })
  })

  it('a charge for the remote detonator has no wire', () => {
    const use = placeOf('c4')
    expect(use.tripwire).toBeUndefined()
    expect(tripwireSegment(use)).toBeNull()
  })

  it('the arsenal refuses a wire with no length', () => {
    expect(() => createArsenal({ patch: { explosives: { claymore: { tripwire: { length: 0 } } } } })).toThrow(/trip wire of 0 m/)
  })
})
