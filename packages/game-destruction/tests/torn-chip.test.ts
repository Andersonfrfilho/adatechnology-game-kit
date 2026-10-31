import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

describe('a shot that tears lumps off an MDF board', () => {
  it('reports them as a torn chip and keeps the hole on the board', () => {
    const world = createDestruction()
    const id = world.add({ parts: [{ id: 'board', material: 'mdf', shape: { kind: 'box', size: [1.2, 2, 0.02] }, position: [0, 1, 0], anchored: true }] }, { id: 'case' })
    const chips: DestructionEvent[] = []
    world.on('chip', (event) => chips.push(event))
    world.shoot([0, 1, 3], [0, 0, -1], 500, 9)
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every((event) => event.type === 'chip' && event.torn === true)).toBe(true)
    expect(world.part(id, 'board')!.holes.length).toBe(1)
  })
})
