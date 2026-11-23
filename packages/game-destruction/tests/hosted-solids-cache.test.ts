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

describe('hostedSolids keeps the solid of a piece that did not change (spec 018 D2)', () => {
  it('a list made again for one new piece hands back the very solids of the unchanged ones, with the same numbers', () => {
    const door = piece('door')
    let drawn = [door, piece('hood')]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    const first = world.hostedSolids?.('car') ?? []
    drawn = [door, piece('hood')]
    const second = world.hostedSolids?.('car') ?? []
    expect(second).not.toBe(first)
    expect(second[0]).toBe(first[0])
    expect(second[1]).not.toBe(first[1])
    expect(second[1]).toEqual(first[1])
  })

  it('a moved body, or a piece without a key at another place in the list, gets a new solid', () => {
    const door = piece('door')
    const loose = { ...piece('x'), key: undefined } as unknown as Piece
    let drawn: Piece[] = [door, loose]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    const first = world.hostedSolids?.('car') ?? []
    drawn = [loose, door]
    const swapped = world.hostedSolids?.('car') ?? []
    expect(swapped[1]).toBe(first[0])
    expect(swapped[0]).not.toBe(first[1])
    expect(swapped[0]?.key).toBe('x:0')
    world.setTransform('car', [1, 0, 0], [0, 0, 0, 1])
    expect(world.hostedSolids?.('car')?.[1]).not.toBe(first[0])
  })

  it('a solid handed back is the one a fresh world makes of the same pieces at the same place, number for number', () => {
    const door = piece('door')
    let drawn = [door, piece('hood')]
    const world = createDestruction()
    world.register(burning(() => [...drawn]))
    world.setTransform('car', [0.5, 0, -2], [0, 0.3826834, 0, 0.9238795])
    world.hostedSolids?.('car')
    drawn = [door, piece('trunk')]
    const reused = world.hostedSolids?.('car') ?? []
    const fresh = createDestruction()
    fresh.register(burning(() => [piece('door'), piece('trunk')]))
    fresh.setTransform('car', [0.5, 0, -2], [0, 0.3826834, 0, 0.9238795])
    expect(reused).toEqual(fresh.hostedSolids?.('car'))
  })
})
