import { describe, expect, it } from 'vitest'

import { createVfx, patchSpriteKinds, SPRITE_KINDS } from '../src'

const step = (world: ReturnType<typeof createVfx>, seconds: number): void => {
  for (let at = 0; at < seconds; at += 1 / 60) world.update(1 / 60)
}

describe('sprite kinds', () => {
  it('has the 14 kinds of the destruction renderer with their numbers', () => {
    expect(Object.keys(SPRITE_KINDS)).toEqual(['fire', 'smoke', 'sparks', 'dust', 'shards', 'splinters', 'chips', 'fibers', 'leaves', 'drips', 'ash', 'steam', 'flash', 'foam'])
    expect(SPRITE_KINDS.fire).toMatchObject({ additive: true, life: [0.45, 0.9], c0: 0xffc040, c1: 0xc02000, flicker: 0.35 })
    expect(SPRITE_KINDS.drips.ground).toBe('land')
    expect(SPRITE_KINDS.leaves.flutter).toBe(2.8)
  })

  it('patches a kind, adds one and removes one', () => {
    const kinds = patchSpriteKinds(SPRITE_KINDS, { fire: { alpha: 0.5 }, smoke: null })
    expect(kinds.fire!.alpha).toBe(0.5)
    expect(kinds.fire!.life).toEqual([0.45, 0.9])
    expect(kinds.smoke).toBeUndefined()
  })
})

describe('VfxWorld sprites', () => {
  it('bursts the count asked, in the pool of its blending', () => {
    const world = createVfx({ seed: 1, sprites: { capacity: 100 } })
    world.burst('fire', [0, 1, 0], [0, 1, 0], 10)
    world.burst('dust', [0, 1, 0], [0, 1, 0], 7)
    expect(world.sprites().additive.live).toBe(10)
    expect(world.sprites().normal.live).toBe(7)
    expect(() => world.burst('nope', [0, 0, 0], [0, 1, 0], 1)).toThrow(/nope/)
  })

  it('scales a burst by the density and keeps to the capacity', () => {
    const world = createVfx({ sprites: { capacity: 10, density: 0.5 } })
    world.burst('dust', [0, 1, 0], [0, 1, 0], 8)
    expect(world.sprites().live).toBe(4)
    world.burst('dust', [0, 1, 0], [0, 1, 0], 100)
    expect(world.sprites().normal.live).toBeLessThanOrEqual(6)
  })

  it('repeats the same sprites from the same seed', () => {
    const run = (): number[] => {
      const world = createVfx({ seed: 9 })
      world.burst('sparks', [1, 1, 1], [0, 1, 0], 6, 4)
      step(world, 0.2)
      const pool = world.sprites().additive
      return [...pool.position.slice(0, pool.drawCount * 3)]
    }
    expect(run()).toEqual(run())
    expect(run().length).toBeGreaterThan(0)
  })

  it('lets sparks bounce and ash stop on the ground, and ends the life', () => {
    const world = createVfx({ seed: 2 })
    world.burst('sparks', [0, 0.05, 0], [0, 1, 0], 20, 3)
    world.burst('ash', [0, 0.05, 0], [0, 1, 0], 10, 1)
    step(world, 1)
    const pool = world.sprites().additive
    for (let at = 0; at < pool.drawCount; at++) expect(pool.position[at * 3 + 1]!).toBeGreaterThanOrEqual(0.0049)
    step(world, 6)
    expect(world.sprites().live).toBe(0)
  })

  it('tells the owner where a tagged drip landed, and nobody else', () => {
    const world = createVfx({ seed: 3 })
    const landed: number[][] = []
    const stranger: number[][] = []
    world.onLand('destruction', (x, y, z, color, tag) => landed.push([x, y, z, color, tag]))
    world.onLand('fluids', (x, y, z, color, tag) => stranger.push([x, y, z, color, tag]))
    world.spawn('drips', [0, 0.5, 0], [0, -0.1, 0], { owner: 'destruction', tag: 4, color: 0x884400 })
    world.spawn('drips', [1, 0.5, 0], [0, -0.1, 0], { owner: 'destruction' })
    step(world, 2)
    expect(landed).toHaveLength(1)
    expect(landed[0]![3]).toBe(0x884400)
    expect(landed[0]![4]).toBe(4)
    expect(landed[0]![1]).toBeCloseTo(0.005, 3)
    expect(stranger).toHaveLength(0)
  })

  it('shoves sprites away from a blast and clears with the world', () => {
    const world = createVfx({ seed: 4 })
    world.spawn('dust', [1, 1, 0], [0, 0, 0])
    world.push([0, 1, 0], 3, 6)
    world.update(0.1)
    expect(world.sprites().normal.position[0]!).toBeGreaterThan(1.3)
    world.clear()
    expect(world.sprites().live).toBe(0)
  })
})
