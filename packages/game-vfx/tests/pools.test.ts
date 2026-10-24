import { describe, expect, it } from 'vitest'
import { OrderedPool, lehmer } from '../src'
import { createChunkPool, spawnChunk } from '../src/pools/chunks'
import { createGlowPool, spawnGlow, updateGlows } from '../src/pools/glows'
import { createPuffPool, spawnPuff, updatePuffs } from '../src/pools/puffs'
import { createSparkPool, spawnSpark, updateSparks } from '../src/pools/sparks'

const WIND = { x: 0.55, z: 0.2 }

describe('OrderedPool', () => {
  const make = (capacity: number) => new OrderedPool<{ id: number }>(capacity, () => ({ id: -1 }))

  it('keeps the live records in the order they were added', () => {
    const pool = make(8)
    for (let id = 0; id < 5; id++) pool.acquire().id = id
    expect(pool.items.map((item) => item.id)).toEqual([0, 1, 2, 3, 4])
  })

  it('compacts in place without changing the order of the survivors', () => {
    const pool = make(8)
    for (let id = 0; id < 6; id++) pool.acquire().id = id
    pool.compact((item) => item.id % 2 === 1, undefined)
    expect(pool.items.map((item) => item.id)).toEqual([1, 3, 5])
  })

  it('reuses a dead record instead of allocating a new one', () => {
    const pool = make(4)
    const first = pool.acquire()
    first.id = 1
    pool.compact(() => false, undefined)
    expect(pool.count).toBe(0)
    expect(pool.acquire()).toBe(first)
  })

  it('drops the oldest record when it is full, and keeps the order of the rest', () => {
    const pool = make(3)
    for (let id = 0; id < 5; id++) pool.acquire().id = id
    expect(pool.items.map((item) => item.id)).toEqual([2, 3, 4])
    expect(pool.count).toBe(3)
  })

  it('lets a pool choose who goes when it is full', () => {
    const pool = make(3)
    for (let id = 0; id < 3; id++) pool.acquire().id = id
    pool.acquire((items) => items.findIndex((item) => item.id === 1)).id = 9
    expect(pool.items.map((item) => item.id)).toEqual([0, 2, 9])
  })
})

describe('puffs', () => {
  it('draw their seed on every spawn, even when the caller gives one, and the oldest goes when the pool is full', () => {
    const pool = createPuffPool(3)
    const stream = lehmer(10)
    const reference = lehmer(10)
    for (let index = 0; index < 5; index++) {
      const puff = spawnPuff(pool, stream, { x: index, ph: 99 })
      expect(puff.seed).toBe(reference.next())
    }
    expect(pool.items.map((puff) => puff.x)).toEqual([2, 3, 4])
  })

  it('age, rise with their buoyancy, drift with the wind and end by their life', () => {
    const pool = createPuffPool(8)
    const puff = spawnPuff(pool, lehmer(3), { x: 0, y: 1, z: 0, life: 1, buoy: 1, drag: 0, wind: 1, s0: 0.1, s1: 0.5, gk: 4, sg: 0 })
    updatePuffs(pool, 0.5, WIND)
    expect(puff.t).toBe(0.5)
    expect(puff.age).toBe(0.5)
    expect(puff.y).toBeGreaterThan(1)
    expect(puff.x).toBeCloseTo(0.55 * 0.5 * 0.5, 12)
    expect(puff.size).toBeCloseTo((0.1 + 0.4 * (1 - Math.exp(-2))) * 1, 12)
    updatePuffs(pool, 0.6, WIND)
    expect(pool.count).toBe(0)
  })

  it('a hot puff cools along its heat curve and the heat lifts it more', () => {
    const pool = createPuffPool(2)
    const hot = spawnPuff(pool, lehmer(3), { h0: 1, hl: 1, life: 4, drag: 0 })
    updatePuffs(pool, 0.5, WIND)
    expect(hot.heat).toBeCloseTo(Math.pow(0.5, 1.25), 12)
    expect(hot.vy).toBeCloseTo(0.5 * 1.6 * 0.5, 12)
  })

  it('stay above the floor and lose their downward speed', () => {
    const pool = createPuffPool(2)
    const puff = spawnPuff(pool, lehmer(3), { y: 0, s0: 1, vy: -5, buoy: 0, drag: 0, life: 5 })
    updatePuffs(pool, 0.1, WIND)
    expect(puff.y).toBeCloseTo(0.4, 12)
    expect(puff.vy).toBeCloseTo(1, 12)
  })
})

describe('sparks and glows', () => {
  it('a spark bounces on the ground and loses speed', () => {
    const pool = createSparkPool(4)
    const spark = spawnSpark(pool, { y: 0.05, vy: -4, vx: 2, life: 5, drag: 0, g: 0, bounce: 0.5 })
    updateSparks(pool, { dt: 0.1, groundAt: () => 0 })
    expect(spark.y).toBeCloseTo(0.02, 12)
    expect(spark.vy).toBeCloseTo(2, 12)
    expect(spark.vx).toBeCloseTo(1.1, 12)
  })

  it('a glow grows by an ease-out and fades by its curve', () => {
    const pool = createGlowPool(4)
    const glow = spawnGlow(pool, { s: 1, s1: 3, i: 2, life: 1, curve: 2 })
    updateGlows(pool, 0.5)
    expect(glow.outSize).toBeCloseTo(1 + 2 * (1 - Math.pow(0.5, 3)), 12)
    expect(glow.outIntensity).toBeCloseTo(2 * 0.25, 12)
  })
})

describe('chunks', () => {
  const placeholder = lehmer(1)

  it('draw their rotation and spin first, always (six numbers), then the caller adds a halo with its own draw', () => {
    const pool = createChunkPool(4, placeholder)
    const stream = lehmer(8)
    const reference = lehmer(8)
    const chunk = spawnChunk(pool, stream, { x: 1 })
    expect([chunk.rx, chunk.ry, chunk.rz]).toEqual([reference.next() * 6, reference.next() * 6, reference.next() * 6])
    expect([chunk.ax, chunk.ay, chunk.az]).toEqual([reference.between(-12, 12), reference.between(-12, 12), reference.between(-12, 12)])
  })

  it('a full pool drops a resting chunk first, else the oldest', () => {
    const pool = createChunkPool(3, placeholder)
    const stream = lehmer(1)
    const spawned = [0, 1, 2].map((x) => spawnChunk(pool, stream, { x }))
    spawned[1]!.rest = true
    spawnChunk(pool, stream, { x: 3 })
    expect(pool.items.map((chunk) => chunk.x)).toEqual([0, 2, 3])
    for (const chunk of pool.items) chunk.rest = false
    spawnChunk(pool, stream, { x: 4 })
    expect(pool.items.map((chunk) => chunk.x)).toEqual([2, 3, 4])
  })

  it('a halo that follows a chunk stays where the chunk was when the chunk leaves the pool', () => {
    const chunks = createChunkPool(1, placeholder)
    const glows = createGlowPool(4)
    const first = spawnChunk(chunks, lehmer(1), { x: 5, y: 1, z: 2 })
    first.glow = spawnGlow(glows, { follow: first, life: 5 })
    updateGlows(glows, 0.1)
    expect(first.glow.outX).toBe(5)
    spawnChunk(chunks, lehmer(1), { x: 9 })
    const frozen = glows.items[0]!
    expect(frozen.follow).toBeNull()
    updateGlows(glows, 0.1)
    expect([frozen.outX, frozen.outY, frozen.outZ]).toEqual([5, 1, 2])
  })
})
