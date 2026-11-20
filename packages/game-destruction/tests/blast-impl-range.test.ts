import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec, Hit } from '../src'

const body = (id: string, xs: readonly number[]): { impl: DestructibleImpl; hits: Hit[] } => {
  const hits: Hit[] = []
  const spec: DestructibleSpec = { parts: xs.map((x, index) => ({ id: `p${index}`, material: 'leather', shape: { kind: 'box' as const, size: [0.4, 0.4, 0.4] as [number, number, number] }, position: [x, 0, 0] as [number, number, number] })) }
  return { hits, impl: { id, describe: () => spec, hit: (h) => (hits.push(h), []), state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never } }
}

const hitsAt = (xs: readonly number[], radius: number): number => {
  const world = createDestruction({ seed: 1 })
  const target = body('b', xs)
  world.register(target.impl)
  world.explode([0, 0, 0], 1000, radius)
  return target.hits.filter((h) => h.type === 'explosive').length
}

describe('a hosted body in the reach of a blast', () => {
  it('is hit when the nearest face is inside the radius and not when it is outside', () => {
    expect(hitsAt([3], 2.79)).toBe(0)
    expect(hitsAt([3], 2.81)).toBe(1)
  })

  it('is hit through a later part when the first parts are out of reach', () => {
    expect(hitsAt([9, 8, 3], 2.81)).toBe(1)
    expect(hitsAt([9, 8, 3], 2.79)).toBe(0)
  })
})
