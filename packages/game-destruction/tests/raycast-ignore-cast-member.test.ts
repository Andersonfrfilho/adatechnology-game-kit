import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { PartSpec, RayHit, RaycastPartRef, Vec3 } from '../src'

const REBAR = { material: 'steel', spacing: 0.15, diameter: 0.01, residualCapacity: 0.15 } as const
const wall: PartSpec = {
  id: 'wall', material: 'brick', shape: { kind: 'box', size: [3, 2.4, 0.13] }, position: [0, 1.2, 0], thickness: 0.13, mass: 1400,
  units: { size: [0.23, 0.075, 0.11], bond: 'running', mortar: 'plaster' }, breach: { area: 0.25 },
}
// the same wall plastered over its faces and the pillar: its box stands 2 cm proud of the pillar on each side
const coated: PartSpec = { ...wall, shape: { kind: 'box', size: [3, 2.4, 0.17] }, thickness: 0.17, layers: [{ material: 'plaster', thickness: 0.02, faces: 'both' }] }
// the pillar at the wall's right end, inside its box: the wall keeps it as a cast member (`castIn`)
const pillar: PartSpec = { id: 'pillar', material: 'concrete', shape: { kind: 'box', size: [0.3, 2.4, 0.13] }, position: [1.35, 1.2, 0], structure: { role: 'column' }, reinforcement: REBAR, breach: { area: 0.25 } }
const behind: PartSpec = { id: 'slab', material: 'brick', shape: { kind: 'box', size: [4, 3, 0.1] }, position: [0, 0, 0] }

const DOWN_Z: Vec3 = [0, 0, -1]
/** On the pillar, and on the bricks beside it. */
const AT_PILLAR: Vec3 = [1.35, 1.2, 5]
const AT_BRICKS: Vec3 = [0.5, 1.2, 5]
const WALL: RaycastPartRef = { object: 'w', part: 'wall' }
const PILLAR: RaycastPartRef = { object: 'w', part: 'pillar' }

const setup = (parts: PartSpec[]) => {
  const world = createDestruction({ seed: 1 })
  world.add({ parts }, { id: 'w' })
  world.add({ parts: [behind] }, { id: 'far', position: [0, 1.2, -3] })
  const ray = (origin: Vec3, ignoreParts?: readonly RaycastPartRef[]): RayHit | null => world.raycast(origin, DOWN_Z, 10, ignoreParts ? { ignoreParts } : undefined)
  return { world, ray }
}

describe('world.raycast ignoreParts where a member is cast in a wall', () => {
  it('names the member where the ray lands on it, and the wall beside it', () => {
    const { ray } = setup([wall, pillar])
    expect(ray(AT_PILLAR)).toMatchObject({ object: 'w', part: 'pillar' })
    expect(ray(AT_PILLAR)?.distance).toBeCloseTo(4.935, 6)
    expect(ray(AT_BRICKS)).toMatchObject({ object: 'w', part: 'wall' })
  })

  // Current behaviour, not the contract one would expect: the ray answers `pillar`, and ignoring exactly what it answered changes nothing. The list is compared
  // with the part the ray tests (the wall), and the wall then hands the hit to the member cast in it.
  it('ignoring the member the ray named does not let the ray through: the wall still answers with that member', () => {
    const { ray } = setup([wall, pillar])
    const plain = ray(AT_PILLAR)
    expect(ray(AT_PILLAR, [PILLAR])).toEqual(plain)
    expect(ray(AT_PILLAR, [PILLAR])?.object).not.toBe('far')
  })

  it('ignoring the wall leaves the member standing: it is a part of its own and still answers', () => {
    const { ray } = setup([wall, pillar])
    expect(ray(AT_PILLAR, [WALL])).toEqual(ray(AT_PILLAR))
    // beside the pillar there is only the wall: the ray goes on to what is behind
    expect(ray(AT_BRICKS, [WALL])).toMatchObject({ object: 'far', part: 'slab' })
  })

  it('only ignoring both the wall and the member lets the ray through where the member is', () => {
    const { ray } = setup([wall, pillar])
    const through = ray(AT_PILLAR, [WALL, PILLAR])
    expect(through).toMatchObject({ object: 'far', part: 'slab' })
    expect(through?.distance).toBeCloseTo(7.95, 6)
  })

  it('under a coat the wall answers at the coat with the point on the member; with the wall ignored the member answers at its own face', () => {
    const { ray } = setup([coated, pillar])
    const plain = ray(AT_PILLAR)
    expect(plain).toMatchObject({ object: 'w', part: 'pillar' })
    // the distance is to the wall's box (the plaster), the point is where the ray enters the member 2 cm behind it
    expect(plain?.distance).toBeCloseTo(4.915, 6)
    expect(plain?.point[2]).toBeCloseTo(0.065, 6)
    expect(ray(AT_PILLAR, [PILLAR])).toEqual(plain)
    const bare = ray(AT_PILLAR, [WALL])
    expect(bare).toMatchObject({ object: 'w', part: 'pillar' })
    expect(bare?.distance).toBeCloseTo(4.935, 6)
    expect(bare?.point[2]).toBeCloseTo(0.065, 6)
    expect(ray(AT_PILLAR, [WALL, PILLAR])).toMatchObject({ object: 'far' })
  })

  it('from inside the wall, past the face of the member, neither answers and the ray reaches what is behind', () => {
    const { ray } = setup([wall, pillar])
    // one millimetre inside both boxes: an ordinary part answers only at its entry
    expect(ray([1.35, 1.2, 0.064])).toMatchObject({ object: 'far', part: 'slab' })
    expect(ray([1.35, 1.2, 0.064], [PILLAR])).toMatchObject({ object: 'far', part: 'slab' })
  })
})
