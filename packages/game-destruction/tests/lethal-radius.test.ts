import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec, Hit } from '../src'

const person = (id: string, at: [number, number, number]): { impl: DestructibleImpl; hits: Hit[] } => {
  const hits: Hit[] = []
  const spec: DestructibleSpec = { parts: [{ id: 'torso', material: 'leather', shape: { kind: 'box', size: [0.4, 1.7, 0.3] }, position: [at[0], at[1] + 0.85, at[2]] }] }
  return { hits, impl: { id, describe: () => spec, hit: (h) => (hits.push(h), []), state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never } }
}

describe('explodes.lethalRadius', () => {
  it('rides on the explode event and on the blast hit a hosted body takes', () => {
    const world = createDestruction({ seed: 3 })
    const body = person('p', [3, 0, 0])
    world.register(body.impl)
    const id = world.add({ parts: [{ id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.17, height: 0.49 }, position: [0, 0.245, 0], thickness: 0.002, fill: 0.03, explodes: { energy: 200000, radius: 14, lethalRadius: 5, chain: { shot: 0.2, fire: 1, explosion: 1 } } }] }, { id: 'p13' })
    const events: Array<{ type: string; lethalRadius?: number }> = []
    world.on('*', (e) => events.push(e as never))
    world.hitPart(id, 'tank', { type: 'ballistic', point: [0.17, 0.2, 0], direction: [-1, 0, 0], energy: 500, caliber: 9 })
    for (let i = 0; i < 10; i++) world.update(0.1)
    expect(events.find((e) => e.type === 'explode')?.lethalRadius).toBe(5)
    expect(body.hits.some((h) => h.type === 'explosive' && h.lethalRadius === 5 && h.radius === 14)).toBe(true)
  })
})
