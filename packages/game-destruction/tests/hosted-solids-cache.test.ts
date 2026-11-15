import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleImpl } from '../src'
import { plate } from './helpers'

type Piece = NonNullable<DestructibleImpl['colliders']> extends () => readonly (infer P)[] ? P : never

const spec = plate('steel', 0.4, 0.4, 0.05, 'door')
const piece = (key: string): Piece => ({ id: key, center: [0, 0, 0], half: [0.2, 0.2, 0.025], rotation: [0, 0, 0, 1], key, mesh: { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) } }) as Piece

/** A hosted body that draws `pieces` and whose state is a new object on every read, as a burning vehicle's is (the contract allows it: it changed). */
const burning = (pieces: () => readonly Piece[]): DestructibleImpl => ({
  id: 'car',
  describe: () => spec,
  hit: () => [],
  state: () => ({ id: 'car', position: [0, 0, 0], rotation: [0, 0, 0, 1], parts: [], joints: [], groups: [], destroyed: false }),
  colliders: pieces,
})

describe('hostedSolids of a body that draws pieces (T3.8b)', () => {
  it('hands back the same list while its pieces are the same, though its state is a new object each time: an engine measured its hundreds of parts again every update', () => {
    const drawn = [piece('door'), piece('hood')]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    const first = world.hostedSolids?.('car')
    const second = world.hostedSolids?.('car')
    expect(first).toBeDefined()
    expect(second).toBe(first)
  })

  it('makes a new list when a piece changed, and the old one is not handed back', () => {
    let drawn = [piece('door'), piece('hood')]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    const first = world.hostedSolids?.('car')
    drawn = [piece('door'), piece('hood')]
    const second = world.hostedSolids?.('car')
    expect(second).not.toBe(first)
    expect(second?.length).toBe(2)
    drawn = [drawn[0] as Piece]
    expect(world.hostedSolids?.('car')?.length).toBe(1)
  })

  it('makes a new list when the body moves', () => {
    const drawn = [piece('door')]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    const first = world.hostedSolids?.('car')
    world.setTransform('car', [1, 0, 0], [0, 0, 0, 1])
    const second = world.hostedSolids?.('car')
    expect(second).not.toBe(first)
    expect(second?.[0]?.center[0]).toBeCloseTo(1, 9)
  })
})
