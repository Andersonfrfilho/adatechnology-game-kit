import { describe, expect, it } from 'vitest'

import { createVfx } from '../src'
import type { VfxWorld } from '../src'
import { TEST_CATALOGUE } from './fixtures'

const run = (world: VfxWorld, seconds: number): void => {
  for (let frame = 0; frame < seconds * 60; frame++) world.update(1 / 60)
}

/** What a source left alive: its fires, the records of the pools that carry it, and its sprites. */
const left = (world: VfxWorld, source: string): number => {
  const pools = world.pools()
  const records = [...pools.puffs.items, ...pools.sparks.items, ...pools.chunks.items, ...pools.glows.items]
  return world.fires().filter((fire) => fire.source === source).length + records.filter((record) => record.source === source).length
}

describe('clearSource', () => {
  it('takes away at once the fire, the flames, the smoke, the embers, the blast and the sprites made for one thing, and keeps the rest', () => {
    const world = createVfx({ seed: 3, profile: 'high', explosions: TEST_CATALOGUE })
    world.fire({ point: [0, 0, 0], radius: 1, life: 60, source: 'house' })
    world.fire({ point: [10, 0, 0], radius: 1, life: 60, source: 'car' })
    world.explosion('test_blast', [0, 1, 0], { source: 'house' })
    world.burst('dust', [0, 1, 0], [0, 1, 0], 30, 1, { source: 'house' })
    world.burst('dust', [10, 1, 0], [0, 1, 0], 30, 1, { source: 'car' })
    world.burst('sparks', [5, 1, 0], [0, 1, 0], 10, 1)
    run(world, 0.5)
    expect(left(world, 'house')).toBeGreaterThan(0)
    const carRecords = left(world, 'car')
    const sprites = world.sprites().live
    expect(carRecords).toBeGreaterThan(0)

    const cleared = world.clearSource('house')

    expect(cleared).toBeGreaterThan(0)
    expect(left(world, 'house')).toBe(0)
    expect(world.sprites().clearSource('house')).toBe(0)
    expect(left(world, 'car')).toBe(carRecords)
    expect(world.sprites().live).toBeGreaterThan(0)
    expect(world.sprites().live).toBeLessThan(sprites)
    // the house gives off nothing more; the car's fire goes on
    run(world, 1)
    expect(left(world, 'house')).toBe(0)
    expect(world.fires().some((fire) => fire.source === 'car')).toBe(true)
  })

  it('keeps no name of a source it cleared, and a sprite made for that name later is cleared again', () => {
    const world = createVfx({ seed: 3 })
    world.burst('dust', [0, 1, 0], [0, 1, 0], 10, 1, { source: 'piece_1' })
    expect(world.clearSource('piece_1')).toBeGreaterThan(0)
    world.burst('dust', [0, 1, 0], [0, 1, 0], 10, 1, { source: 'piece_1' })
    expect(world.sprites().clearSource('piece_1')).toBeGreaterThan(0)
    expect(world.sprites().live).toBe(0)
  })
})
