import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleImpl } from '../src'
import { plate } from './helpers'

describe('removing a registered impl', () => {
  it('lets the impl dispose once, and an impl without dispose is removed all the same', () => {
    const spec = plate('steel', 0.4, 0.4, 0.05, 'door')
    const state = (id: string) => ({ id, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], parts: [], joints: [], groups: [], destroyed: false })
    let disposed = 0
    const withDispose: DestructibleImpl = { id: 'a', describe: () => spec, hit: () => [], state: () => state('a'), dispose: () => void disposed++ }
    const without: DestructibleImpl = { id: 'b', describe: () => spec, hit: () => [], state: () => state('b') }
    const world = createDestruction()
    world.register(withDispose)
    world.register(without)
    world.remove('a')
    world.remove('a')
    world.remove('b')
    expect(disposed).toBe(1)
    expect(world.has('a') || world.has('b')).toBe(false)
  })
})
