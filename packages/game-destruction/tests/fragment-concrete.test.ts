import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import { MATERIALS } from '../src/materials'
import { casingFlight, concretePerforation, fragmentCaliberMm, mottMass } from '../src/blast-wave'
import type { BlastCharge, DestructibleImpl, Hit, Vec3 } from '../src'

const arsenal = createArsenal()
const chargeOf = (id: string): BlastCharge => {
  const explosive = arsenal.explosives.get(id)!
  return { tnt: 1e-9, casing: explosive.casing! }
}
const M67 = chargeOf('m67')
const PIPE_BOMB = chargeOf('pipe_bomb')
const C25 = 25

/** cyrb53: a 53-bit hash of a string, to pin a result. */
const hashOf = (text: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

const piece = (grams: number, speed: number) => concretePerforation({ mass: grams / 1000, caliber: fragmentCaliberMm(grams / 1000) / 1000, speed, compressiveMPa: C25 })

describe('a steel piece against concrete (modified NDRC)', () => {
  // the design's figures for C25, in mm: penetration depth / perforation thickness
  const CASES: readonly [string, number, number, number, number][] = [
    ['M67, 0.19 g', 0.19, 2073, 32, 45],
    ['M67, 2.45 g', 2.45, 2073, 85, 117],
    ['M67, 4.5 g', 4.5, 2073, 113, 154],
    ['pipe bomb, 5.8 g', 5.8, 1184, 52, 79],
    ['pipe bomb, 49 g', 49, 1184, 119, 178],
  ]
  for (const [name, grams, speed, depth, perforation] of CASES) {
    it(`${name} at ${speed} m/s goes ${depth} mm in and through ${perforation} mm (within 5%)`, () => {
      const result = piece(grams, speed)
      expect(Math.abs(result.depth * 1000 - depth) / depth).toBeLessThan(0.05)
      expect(Math.abs(result.perforation * 1000 - perforation) / perforation).toBeLessThan(0.05)
    })
  }

  it('a 7.62x51 ball round (9.5 g, 853 m/s, round nose N = 1) goes about 97 mm into C25, against the 120 mm of the ammunition table', () => {
    const result = concretePerforation({ mass: 0.0095, caliber: 0.00762, speed: 853, compressiveMPa: C25, nose: 1 })
    expect(Math.abs(result.depth * 1000 - 97) / 97).toBeLessThan(0.05)
  })

  it('goes deeper the faster and the heavier the piece', () => {
    for (const grams of [0.05, 0.5, 5, 50]) {
      let last = 0
      for (const speed of [100, 300, 600, 1200, 2400]) {
        const { depth, perforation } = piece(grams, speed)
        expect(depth).toBeGreaterThan(last)
        expect(perforation).toBeGreaterThan(depth)
        last = depth
      }
    }
    for (const speed of [300, 2000]) {
      let last = 0
      for (const grams of [0.05, 0.5, 5, 50]) {
        const { depth } = piece(grams, speed)
        expect(depth).toBeGreaterThan(last)
        last = depth
      }
    }
  })

  it('the heaviest piece of an M67 and of a pipe bomb, at its first speed, does not go through 300 mm of C25', () => {
    for (const charge of [M67, PIPE_BOMB]) {
      const casing = charge.casing!
      const { mottScale, speed } = casingFlight(casing)
      const heaviest = mottMass(0, mottScale, casing.fragments)
      expect(piece(heaviest * 1000, speed).perforation).toBeLessThan(0.3)
    }
  })
})

/** A hosted body that keeps every hit it takes. */
const witness = (id: string, at: Vec3) => {
  const hits: Hit[] = []
  const impl: DestructibleImpl = {
    id,
    describe: () => ({ parts: [{ id: 'p', material: 'leather', shape: { kind: 'box', size: [1.2, 0.2, 1.2] }, position: [0, 0, 0] }] }),
    hit(h) {
      hits.push(h)
      return []
    },
    state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never,
  }
  return { impl, at, hits }
}

describe('the pieces of a case against a concrete slab', () => {
  const underSlab = (charge: BlastCharge, seed: number, thickness: number) => {
    const world = createDestruction({ seed })
    world.add({ parts: [{ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4, thickness, 4] }, position: [0, 0, 0], thickness, anchored: true }] }, { id: 'slab', position: [0, 0.4, 0] })
    const below = witness('below', [0, 0.4 - thickness / 2 - 0.3, 0])
    world.register(below.impl, { position: below.at })
    const results = world.explode([0, 0.4 + thickness / 2 + 0.25, 0], 1, 15, 'test', { charge })
    const through = results.flatMap((result) => result.events).filter((event) => event.type === 'hole' && event.object === 'slab' && (event as { hole: { through: boolean } }).hole.through).length
    return { through, below: below.hits.filter((hit) => hit.type === 'ballistic').length }
  }

  it('no piece of an M67 or a pipe bomb goes through 300 mm of C25 25 cm under it', () => {
    for (const charge of [M67, PIPE_BOMB]) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) expect({ seed, ...underSlab(charge, seed, 0.3) }).toEqual({ seed, through: 0, below: 0 })
    }
  })

  it('the heavy pieces still go through a 50 mm concrete element', () => {
    for (const charge of [M67, PIPE_BOMB]) {
      let through = 0
      for (const seed of [1, 2, 3, 4]) through += underSlab(charge, seed, 0.05).through
      expect(through).toBeGreaterThan(0)
    }
  })
})

describe('the pieces of a case against brick', () => {
  // NDRC is fitted on concrete; a masonry wall's 2.35 MPa would make brick stronger against heavy fast pieces than the linear rule says. Only materials flagged
  // `strength.ndrc` (concrete) take it: brick keeps the linear rule, as before
  const brick = MATERIALS.find((material) => material.id === 'brick')!
  const throughBrick = (material: string, seed: number) => {
    const world = createDestruction({ seed, materials: [{ ...brick, id: 'brick_ndrc', strength: { ...brick.strength!, ndrc: true } }] })
    world.add({ parts: [{ id: 'wall', material, shape: { kind: 'box', size: [4, 0.2, 4] }, position: [0, 0, 0], thickness: 0.2, anchored: true }] }, { id: 'wall', position: [0, 0.4, 0] })
    return world.explode([0, 0.75, 0], 1, 15, 'test', { charge: PIPE_BOMB }).flatMap((result) => result.events).filter((event) => event.type === 'hole' && (event as { hole: { through: boolean } }).hole.through).length
  }

  it('brick is not flagged for NDRC; concrete is', () => {
    expect(brick.strength?.ndrc).toBeUndefined()
    expect(MATERIALS.find((material) => material.id === 'concrete')!.strength?.ndrc).toBe(true)
  })

  it('a 200 mm brick wall lets through the heavy pieces of a pipe bomb that the linear rule lets through, more than NDRC would', () => {
    let linear = 0
    let ndrc = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      linear += throughBrick('brick', seed)
      ndrc += throughBrick('brick_ndrc', seed)
    }
    expect(linear).toBeGreaterThan(ndrc)
  })
})

describe('a gun round against concrete and brick is what it was', () => {
  it('a rifle round into a 30 cm C25 slab and into a 10 cm brick wall: the same results as before the fragments got the concrete rule', () => {
    // the M80 ball of `ammo.json`: its penetration table, mm by material class
    const ball = { penetration: { steel: 5.0, concrete: 120, brick: 250, wood: 330 } }
    const shots = [
      { material: 'concrete', thickness: 0.3 },
      { material: 'brick', thickness: 0.1 },
    ].flatMap(({ material, thickness }) => [{ penetration: ball.penetration }, {}].map((round) => {
      const world = createDestruction({ seed: 1 })
      world.add({ parts: [{ id: 'wall', material, shape: { kind: 'box', size: [3, 3, thickness] }, position: [0, 0, 0], thickness, anchored: true }] }, { id: 'wall', position: [0, 1.5, 2] })
      return world.shoot([0, 1.4, 0], [0, 0, 1], 3500, 7.62, 'rifle', round)
    }))
    // changes only if a gun round's path changes (shootRay without a flight, ballistic without a piece): it is origin/main's
    expect(hashOf(JSON.stringify(shots))).toBe('fe7623f3dbe3f')
  })
})
