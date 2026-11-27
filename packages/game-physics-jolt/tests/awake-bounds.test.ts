import { describe, expect, it } from 'vitest'

import { AWAKE_BOUNDS_STRIDE, AWAKE_KIND_BODY, AWAKE_KIND_CHARACTER, KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'

const newWorld = async () => (await createJoltEngine()).createWorld(KIT_WORLD)
const rowOf = (out: Float64Array, row: number): number[] => Array.from(out.subarray(row * AWAKE_BOUNDS_STRIDE, (row + 1) * AWAKE_BOUNDS_STRIDE))

describe('readAwakeBounds (spec 008, TS.1b)', () => {
  it('lists the awake dynamic bodies and the characters with bounds and horizontal speed, not the fixed, the kinematic or the asleep', async () => {
    const world = await newWorld()
    world.createBody({ shape: { kind: 'box', half: [20, 0.5, 20] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    world.createBody({ shape: { kind: 'box', half: [1, 1, 1] }, motion: 'kinematic', position: [10, 1, 0], user: 1 })
    const sleeper = world.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 5, position: [-5, 0.5, 0], sleeping: true, user: 2 })
    const mover = world.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 5, position: [3, 0.6, 2], user: 3 })
    world.setVelocity(mover, [4, 0, -2], [0, 0, 0])
    const character = world.createCharacter({ halfHeight: 0.5, radius: 0.3, mass: 80, strength: 100, position: [-3, 0, 6] })
    const out = new Float64Array(5 * AWAKE_BOUNDS_STRIDE)
    expect(world.isSleeping(sleeper)).toBe(true)
    const count = world.readAwakeBounds(out)
    expect(count).toBe(2)
    const body = rowOf(out, 0)
    expect(body.slice(0, 2)).toEqual([AWAKE_KIND_BODY, mover])
    expect(body[2]).toBeCloseTo(2.5, 5)
    expect(body[7]).toBeCloseTo(2.5, 5)
    expect(body[8]).toBeCloseTo(4, 5)
    expect(body[9]).toBeCloseTo(-2, 5)
    const walker = rowOf(out, 1)
    expect(walker.slice(0, 2)).toEqual([AWAKE_KIND_CHARACTER, character])
    expect(walker[2]).toBeCloseTo(-3.3, 5)
    expect(walker[3]).toBeCloseTo(0, 5)
    expect(walker[5]).toBeCloseTo(-2.7, 5)
    expect(walker[6]).toBeCloseTo(1.6, 5)
    world.dispose()
  })

  it('leaves out the bodies in skip before the engine, and writes only the rows that fit while it returns them all', async () => {
    const world = await newWorld()
    const ids: BodyId[] = []
    for (let i = 0; i < 4; i++) ids.push(world.createBody({ shape: { kind: 'sphere', radius: 0.2 }, motion: 'dynamic', mass: 1, position: [i * 2, 3, 0], user: i }))
    const small = new Float64Array(2 * AWAKE_BOUNDS_STRIDE)
    expect(world.readAwakeBounds(small)).toBe(4)
    expect(rowOf(small, 1)[1]).toBeGreaterThan(0)
    expect(world.readAwakeBounds(small, new Set([ids[0] as BodyId, ids[3] as BodyId]))).toBe(2)
    const out = new Float64Array(4 * AWAKE_BOUNDS_STRIDE)
    world.readAwakeBounds(out, new Set([ids[1] as BodyId]))
    expect([0, 1, 2].map((row) => rowOf(out, row)[1])).toEqual([ids[0], ids[2], ids[3]])
    world.dispose()
  })
})
