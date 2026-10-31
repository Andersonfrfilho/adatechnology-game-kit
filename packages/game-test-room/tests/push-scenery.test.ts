import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

const CRATE_AT = -2
/** Wider than the renderer's solid boxes: the room keeps a footprint for it. */
const WIDE = 9
const crate = (width = 1): DestructibleSpec => ({
  name: 'crate',
  parts: [{ id: 'body', material: 'wood_soft', mass: 30, shape: { kind: 'box', size: [width, 1.6, 0.6] }, position: [0, 0.8, 0] }],
  joints: [],
})

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) room.update(1 / 60)
}

/** A free-standing crate of the scenery, pushed 2 m away from where the room put it. */
function pushedCrate(width = 1) {
  const room = makeRoom({ scenery: { crate: { spec: crate(width), position: [0, 0, CRATE_AT], free: true, pushable: true }, table: null, shelf: null } })
  room.setTool('hand')
  room.look([0, 1.7, CRATE_AT + 0.9], [0, 1, CRATE_AT])
  expect(room.push.begin()).toBe(true)
  run(room, 2)
  expect(room.push.state?.phase).toBe('push')
  room.push.setWalk([0, -1])
  run(room, 2)
  room.push.setWalk(null)
  return room
}
const crateZ = (room: ReturnType<typeof makeRoom>): number => room.world.state('crate')!.position[2]

describe('pushing what stands free in the scenery', () => {
  it('the push does not stop at the footprint it left when it comes back', () => {
    const room = pushedCrate()
    const far = crateZ(room)
    expect(far).toBeLessThan(CRATE_AT - 1)
    room.push.setWalk([0, 1])
    run(room, 3)
    room.push.setWalk(null)
    expect(crateZ(room)).toBeGreaterThan(CRATE_AT - 0.1)
  })

  it.each([['a piece the renderer draws boxes for', 1], ['a piece too wide for them', WIDE]])('%s: the player walks free over where it stood and is stopped where it stands now', (_, width) => {
    const room = pushedCrate(width)
    room.push.end()
    run(room, 0.5)
    const now = crateZ(room)
    room.look([0, 1.7, CRATE_AT + 1], [0, 1.7, CRATE_AT - 10])
    room.walk([0, 0, CRATE_AT], 1)
    run(room, 1.2)
    expect(room.playerPosition[2]).toBeCloseTo(CRATE_AT, 1)
    room.walk([0, 0, now - 2], 2)
    run(room, 2.2)
    expect(room.playerPosition[2]).toBeGreaterThan(now)
  })

  it('a reset puts the footprint back with the piece', async () => {
    const room = pushedCrate(WIDE)
    await room.runScenarios([{ id: 'reset', name: 'reset', run: () => undefined }])
    expect(room.push.state).toBeNull()
    expect(crateZ(room)).toBeCloseTo(CRATE_AT)
    room.look([0, 1.7, CRATE_AT + 1.5], [0, 1.7, CRATE_AT - 10])
    room.walk([0, 0, CRATE_AT - 2], 2)
    run(room, 2.2)
    expect(room.playerPosition[2]).toBeGreaterThan(CRATE_AT)
  })

  it('touching it by a hair does not let the player through', () => {
    const room = pushedCrate()
    room.push.end()
    run(room, 1)
    const now = crateZ(room)
    // a hair inside the reach of the body: a piece still settling leaves the player like this
    room.look([0, 1.7, now + 0.3 + 0.3 - 0.002], [0, 1.7, now - 10])
    room.walk([0, 0, now - 2], 2)
    run(room, 2.2)
    expect(room.playerPosition[2]).toBeGreaterThan(now)
  })
})

describe('only what its definition says is pushed', () => {
  const can = (): DestructibleSpec => ({ name: 'can', parts: [{ id: 'body', material: 'steel', mass: 0.4, shape: { kind: 'box', size: [0.07, 0.12, 0.07] }, position: [0, 0.06, 0] }], joints: [] })
  const sofa = (): DestructibleSpec => crate(2)
  const item = (id: string, spec: DestructibleSpec, pushable?: true): TestRoomItem => ({ id, name: id, group: 'test', build: (T) => buildFromSpec(T, spec), spec, ...(pushable ? { pushable } : {}) })
  const room = (): ReturnType<typeof makeRoom> => {
    const r = makeRoom({ catalog: [item('can', can()), item('sofa', sofa(), true)], scenery: { table: null, shelf: null } })
    r.setTool('hand')
    return r
  }

  it('a can aimed at is not leaned on: no ring, E grabs it', () => {
    const r = room()
    r.spawn('can', [0, 0, -2], 0)
    r.look([0, 1.7, -1.2], [0, 0.06, -2])
    expect(r.push.begin()).toBe(false)
    expect(r.push.state).toBeNull()
  })

  it('a can right ahead does not answer the fallback of the closest thing', () => {
    const r = room()
    r.spawn('can', [0, 0, -2], 0)
    r.look([0, 1.7, -1.2], [0, 1.7, -10])
    expect(r.push.begin()).toBe(false)
  })

  it('a can on the floor by a sofa wins the aim, and the sofa is still pushed when aimed at', () => {
    const r = room()
    const sofaObject = r.spawn('sofa', [0, 0, -2], 0)
    r.spawn('can', [0, 0, -1.4], 0)
    r.look([0, 1.7, -0.9], [0, 0.06, -1.4])
    expect(r.push.begin()).toBe(false)
    r.look([0, 1.7, -0.9], [0, 1.2, -2])
    expect(r.push.begin()).toBe(true)
    expect(r.push.state?.objectId).toBe(sofaObject.objectId)
  })

  it('a pushable piece answers the fallback when the aim falls beside it', () => {
    const r = room()
    const sofaObject = r.spawn('sofa', [0, 0, -2], 0)
    r.look([0, 1.7, -1.1], [0, 1.7, -10])
    expect(r.push.begin()).toBe(true)
    expect(r.push.state?.objectId).toBe(sofaObject.objectId)
  })
})
