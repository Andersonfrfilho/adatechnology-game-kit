import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleImpl } from '../src'
import { plate } from './helpers'

describe('setPartPose', () => {
  it('moves the raycast shape: hits the new pose, misses the old one', () => {
    const w = createDestruction()
    w.add(plate('steel', 0.4, 0.4, 0.05, 'door'), { id: 'd' })
    expect(w.raycast([0, 0, 2], [0, 0, -1])?.part).toBe('door')
    w.setPartPose('d', 'door', [1, 0, 0])
    expect(w.raycast([0, 0, 2], [0, 0, -1])).toBeNull()
    expect(w.raycast([1, 0, 2], [0, 0, -1])?.part).toBe('door')
    // rotated 90 degrees about Y: the thin side now faces +Z
    w.setPartPose('d', 'door', [0, 0, 0], [0, Math.PI / 2, 0])
    expect(w.raycast([0, 0, 2], [0, 0, -1])?.distance).toBeCloseTo(2 - 0.2, 3)
  })

  it('forwards to a registered impl and keeps its raycast in sync', () => {
    const calls: unknown[] = []
    const spec = plate('steel', 0.4, 0.4, 0.05, 'door')
    const impl: DestructibleImpl = {
      id: 'm', describe: () => spec, hit: () => [], state: () => ({ id: 'm', position: [0, 0, 0], rotation: [0, 0, 0, 1], parts: [], joints: [], groups: [], destroyed: false }),
      setPartPose: (...a) => { calls.push(a) },
    }
    const w = createDestruction()
    w.register(impl)
    w.setPartPose('m', 'door', [1, 0, 0])
    expect(calls).toEqual([['door', [1, 0, 0], undefined]])
    expect(w.raycast([0, 0, 2], [0, 0, -1])).toBeNull()
    expect(w.raycast([1, 0, 2], [0, 0, -1])?.part).toBe('door')
  })
})
