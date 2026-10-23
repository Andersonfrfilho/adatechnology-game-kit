import { describe, expect, it } from 'vitest'
import { createWorld } from '../src'
import type { ObjectSpec } from '../src'

const spec: ObjectSpec = { type: 'pane', damage: [{ target: 'glass', kind: 'glass', hp: 10 }] }

describe('destruction delegate', () => {
  it('forwards damage to hitPart and skips its own hp bookkeeping', () => {
    const calls: unknown[][] = []
    const w = createWorld({
      destruction: {
        hitPart: (...a) => {
          calls.push(a)
          return { events: [{ type: 'fracture', part: 'glass' }] }
        },
      },
    })
    w.add('p', spec, { x: 2, y: 0, z: 3, ry: 0 })
    const r = w.damage('p', 'glass', 7, 'glass')
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('p')
    expect(calls[0][1]).toBe('glass')
    expect(calls[0][2]).toMatchObject({ type: 'blunt', energy: 7, source: 'interactables' })
    expect((calls[0][2] as { point: number[] }).point[0]).toBeCloseTo(2)
    expect(r?.destroyed).toBe(true)
    expect(w.hp('p', 'glass')).toBeNull()
  })

  it('keeps the deprecated hp bookkeeping without a delegate', () => {
    const w = createWorld({})
    w.add('p', spec, { x: 0, y: 0, z: 0, ry: 0 })
    expect(w.damage('p', 'glass', 4)?.hp).toBe(6)
    expect(w.hp('p', 'glass')).toBe(6)
  })
})
