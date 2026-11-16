import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import { buriedTransmission, tntKilogramsOf } from '../src/buried-charge'
import type { DestructibleImpl, DestructibleSpec, Hit } from '../src'

const CHARGE_JOULES = 8e6
const BLAST_RADIUS = 12
const TARGET_DISTANCE = 3
const BURIAL_DEPTH = 0.8
const TNT = tntKilogramsOf(CHARGE_JOULES)

/** A body for the world to host that records the explosive energy that reaches it. */
const witness = (id: string) => {
  const hits: Hit[] = []
  const spec: DestructibleSpec = { parts: [{ id: 'torso', material: 'leather', shape: { kind: 'box', size: [0.4, 1.7, 0.3] }, position: [TARGET_DISTANCE, 0.85, 0] }] }
  const impl: DestructibleImpl = {
    id,
    describe: () => spec,
    hit(h) {
      hits.push(h)
      return []
    },
    state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never,
  }
  return { impl, hitsOf: (type: string) => hits.filter((h) => h.type === type).length, reached: () => hits.filter((h) => h.type === 'explosive').reduce((sum, h) => sum + (h.energy ?? 0), 0) }
}

const reachedWith = (height: number, soilCover?: number, groundHeight = 0): number => {
  const world = createDestruction({ seed: 1, groundHeight })
  const body = witness('body')
  world.register(body.impl)
  world.explode([0, height, 0], CHARGE_JOULES, BLAST_RADIUS, 'test', soilCover === undefined ? undefined : { soilCover })
  return body.reached()
}

describe('a charge under soil', () => {
  it('passes everything with no cover and less the deeper the cover', () => {
    expect(buriedTransmission({ cover: 0, tntKilograms: TNT })).toBe(1)
    expect(buriedTransmission({ cover: -1, tntKilograms: TNT })).toBe(1)
    const shallow = buriedTransmission({ cover: 0.3, tntKilograms: TNT })
    const deep = buriedTransmission({ cover: 1.5, tntKilograms: TNT })
    expect(shallow).toBeLessThan(1)
    expect(deep).toBeLessThan(shallow)
    expect(deep).toBeGreaterThan(0)
  })

  it('a bigger charge under the same cover gets more of its energy out', () => {
    expect(buriedTransmission({ cover: BURIAL_DEPTH, tntKilograms: TNT * 100 })).toBeGreaterThan(buriedTransmission({ cover: BURIAL_DEPTH, tntKilograms: TNT }))
  })

  it('a body beside the blast feels far less of the same charge when it is covered by soil', () => {
    const open = reachedWith(0.5)
    const covered = reachedWith(0.5, BURIAL_DEPTH)
    expect(open).toBeGreaterThan(0)
    expect(covered).toBeLessThan(open * 0.5)
  })

  it('a charge below y = 0 with no soil cover (a basement, a crater floor) is not damped', () => {
    expect(reachedWith(-0.8)).toBe(reachedWith(0.5))
    expect(reachedWith(0.5, undefined, 2)).toBe(reachedWith(0.5))
  })

  it('the soil stops the fragments of a cased charge', () => {
    const casing = { mass: 0.4, material: 'steel', fragments: 200, chargeMass: 0.2, gurneyVelocity: 2440 }
    const reach = (soilCover: number): number => {
      const world = createDestruction({ seed: 1 })
      const body = witness('body')
      world.register(body.impl)
      world.explode([0, 0.9, 0], 200000, 10, 'test', { soilCover, charge: { tnt: 0.24, casing } })
      return body.hitsOf('ballistic')
    }
    expect(reach(0)).toBeGreaterThan(0)
    expect(reach(BURIAL_DEPTH)).toBe(0)
  })
})
