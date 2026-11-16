import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import { buriedTransmission } from '../src/buried-charge'
import type { DestructibleImpl, DestructibleSpec, Hit } from '../src'

const CHARGE_JOULES = 8e6
const BLAST_RADIUS = 12
const TARGET_DISTANCE = 3
const BURIAL_DEPTH = 0.8

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
  return { impl, reached: () => hits.filter((h) => h.type === 'explosive').reduce((sum, h) => sum + (h.energy ?? 0), 0) }
}

const reachedAt = (height: number): number => {
  const world = createDestruction({ seed: 1 })
  const body = witness('body')
  world.register(body.impl)
  world.explode([0, height, 0], CHARGE_JOULES, BLAST_RADIUS, 'test')
  return body.reached()
}

describe('a charge buried under the ground', () => {
  it('passes everything at or above the ground and less the deeper it sits', () => {
    expect(buriedTransmission(0, CHARGE_JOULES)).toBe(1)
    expect(buriedTransmission(-1, CHARGE_JOULES)).toBe(1)
    const shallow = buriedTransmission(0.3, CHARGE_JOULES)
    const deep = buriedTransmission(1.5, CHARGE_JOULES)
    expect(shallow).toBeLessThan(1)
    expect(deep).toBeLessThan(shallow)
    expect(deep).toBeGreaterThan(0)
  })

  it('a bigger charge at the same depth gets more of its energy out than a small one', () => {
    expect(buriedTransmission(BURIAL_DEPTH, CHARGE_JOULES * 100)).toBeGreaterThan(buriedTransmission(BURIAL_DEPTH, CHARGE_JOULES))
  })

  it('a body beside the blast feels far less of the same charge when it goes off under the ground', () => {
    const open = reachedAt(0.5)
    const buried = reachedAt(-BURIAL_DEPTH)
    expect(open).toBeGreaterThan(0)
    expect(buried).toBeLessThan(open * 0.5)
  })

  it('the ground height of the world sets where the soil starts', () => {
    const world = createDestruction({ seed: 1, groundHeight: 2 })
    const body = witness('body')
    world.register(body.impl)
    world.explode([0, 0.5, 0], CHARGE_JOULES, BLAST_RADIUS, 'test')
    expect(body.reached()).toBeLessThan(reachedAt(0.5) * 0.5)
  })
})
