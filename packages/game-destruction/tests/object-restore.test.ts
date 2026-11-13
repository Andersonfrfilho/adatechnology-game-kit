import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

const spec: DestructibleSpec = {
  parts: [
    { id: 'handle', material: 'wood_hard', shape: { kind: 'box', size: [0.9, 0.035, 0.035] }, position: [0, 0, 0] },
    { id: 'blade', material: 'steel', shape: { kind: 'box', size: [0.3, 0.012, 0.22] }, position: [0.5, 0, 0], thickness: 0.002 },
  ],
}

describe('an object taken out of the world and put back', () => {
  it('keeps the damage it had, under a new id too', () => {
    const world = createDestruction({ seed: 1, groundHeight: -Infinity })
    const id = world.add(spec)
    world.hitPart(id, 'blade', { type: 'blunt', point: [0.5, 0.006, 0], direction: [0, -1, 0], energy: 130, radius: 0.05 })
    world.hitPart(id, 'handle', { type: 'blunt', point: [-0.2, 0.0175, 0], direction: [0, -1, 0], energy: 300, radius: 0.05 })
    const saved = world.serializeObject(id)!
    expect(world.serializeObject('nothing')).toBeNull()
    world.remove(id)
    expect(world.has(id)).toBe(false)
    world.loadObject(saved, 'again')
    const back = world.snapshot('again')!
    const before = saved.state
    expect(back.parts.map((part) => [part.id, part.status, part.bend ?? 0])).toEqual(before.parts.map((part) => [part.id, part.status, part.bend ?? 0]))
    expect(back.parts.find((part) => part.id === 'blade')!.bend).toBeGreaterThan(0.3)
    expect(back.parts.find((part) => part.id === 'handle')!.status).toBe('broken')
  })
})
