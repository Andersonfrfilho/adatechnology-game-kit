import { describe, expect, it } from 'vitest'
import type { ModuleHost } from '@adatechnology/game-contracts'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

const TABLE_AT = -2
const TOP = 0.78
const box = (name: string, material: string, mass: number, size: [number, number, number]): DestructibleSpec => ({
  name,
  parts: [{ id: 'body', material, mass, shape: { kind: 'box', size }, position: [0, size[1] / 2, 0] }],
  joints: [],
})
const table = (): DestructibleSpec => box('table', 'wood_hard', 30, [1.6, TOP, 0.8])
const item = (id: string, spec: DestructibleSpec, pushable?: true): TestRoomItem => ({ id, name: id, group: 'test', build: (T) => buildFromSpec(T, spec), spec, ...(pushable ? { pushable } : {}) })
const CATALOG = [item('can', box('can', 'steel', 0.4, [0.07, 0.12, 0.07])), item('cabinet', box('cabinet', 'wood_hard', 242, [1, 1.8, 0.5]), true), item('crate', box('crate', 'wood_soft', 30, [1, 1.6, 0.6]), true)]

type Room = ReturnType<typeof makeRoom>
const run = (room: Room, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) room.update(1 / 60)
}
const zOf = (room: Room, objectId: string): number => room.world.state(objectId)!.position[2]

/** The room's table, pushable, with a can on its top; an optional wall of steel `wallAt` metres ahead. */
function tableWithCan(wallAt?: number, mode: 'first' | 'third' = 'first') {
  const scenery = {
    table: { spec: table(), position: [0, 0, TABLE_AT] as [number, number, number], free: true, pushable: true },
    shelf: null,
    ...(wallAt === undefined ? {} : { wall: { spec: box('wall', 'steel', 2000, [4, 2, 0.2]), position: [0, 0, wallAt] as [number, number, number] } }),
  }
  const room = makeRoom({ catalog: CATALOG, scenery })
  room.setTool('hand')
  room.setCameraMode(mode)
  const can = room.spawn('can', [0, TOP, TABLE_AT], 0)
  run(room, 0.5)
  room.look([0, 1.7, TABLE_AT + 0.9], [0, 0.7, TABLE_AT])
  expect(room.push.begin()).toBe(true)
  run(room, 2)
  expect(room.push.state?.phase).toBe('push')
  return { room, can: can.objectId }
}

describe('a pushed table carries what rests on its top', () => {
  it.each(['first', 'third'] as const)('the can rides with the table, and its mass is pushed too (%s person)', (mode) => {
    const { room, can } = tableWithCan(undefined, mode)
    expect(room.push.state?.massKg).toBeCloseTo(30.4, 1)
    const offset = zOf(room, can) - zOf(room, 'table')
    room.push.setWalk([0, -1])
    run(room, 2)
    room.push.setWalk(null)
    expect(zOf(room, 'table')).toBeLessThan(TABLE_AT - 1)
    expect(zOf(room, can) - zOf(room, 'table')).toBeCloseTo(offset, 2)
    room.push.end()
    run(room, 1)
    // it stays on the top after the push
    expect(room.world.state(can)!.position[1]).toBeGreaterThan(TOP - 0.05)
  })

  it('a second push carries the can again (it is a body on the top by then)', () => {
    const { room, can } = tableWithCan()
    room.push.setWalk([0, -1])
    run(room, 1.5)
    room.push.setWalk(null)
    run(room, 1)
    room.push.end()
    run(room, 1)
    const z = zOf(room, 'table')
    const offset = zOf(room, can) - z
    room.setCameraMode('third')
    room.look([0, 1.7, z + 0.9], [0, 0.7, z])
    expect(room.push.begin()).toBe(true)
    run(room, 2)
    room.push.setWalk([0, -1])
    run(room, 1.5)
    room.push.setWalk(null)
    run(room, 1)
    expect(zOf(room, 'table')).toBeLessThan(z - 0.8)
    expect(zOf(room, can) - zOf(room, 'table')).toBeCloseTo(offset, 2)
    expect(room.world.state(can)!.position[1]).toBeGreaterThan(TOP - 0.05)
  })

  it('the table hits a wall and stops at once: the can slides on toward it', () => {
    const { room, can } = tableWithCan(TABLE_AT - 2.2)
    const offset = zOf(room, can) - zOf(room, 'table')
    room.push.setWalk([0, -1])
    run(room, 3)
    expect(room.push.state?.block).toBe('obstacle')
    room.push.setWalk(null)
    run(room, 1)
    expect(zOf(room, can) - zOf(room, 'table')).toBeLessThan(offset - 0.05)
    // the table is still leaned on (held): the can slid on its top, it did not fall through it
    expect(room.push.state).not.toBeNull()
    expect(room.world.state(can)!.position[1]).toBeGreaterThan(TOP - 0.05)
  })
})

describe('the bodies of a module shove furniture (ModuleHost.shove)', () => {
  const hostOf = (room: Room): ModuleHost => {
    let lent: ModuleHost | null = null
    room.loadModule({ id: 'probe', name: 'probe', group: 'probe', items: () => [], attach: (host) => {
      lent = host
      return () => undefined
    } })
    return lent!
  }
  const roomWith = (itemId: string) => {
    const room = makeRoom({ catalog: CATALOG, scenery: { table: null, shelf: null } })
    const piece = room.spawn(itemId, [0, 0, -3], 0)
    run(room, 0.3)
    return { room, host: hostOf(room), objectId: piece.objectId }
  }
  const shoveFor = (room: Room, host: ModuleHost, objectId: string, forceN: number, pushers: number, seconds: number): void => {
    for (let i = 0; i < seconds * 60; i++) {
      host.shove!(objectId, { direction: [0, -1], forceN, pushers, dt: 1 / 60 })
      room.update(1 / 60)
    }
  }

  it('lists what stands on the floor and may be pushed', () => {
    const { host, objectId } = roomWith('crate')
    const list = host.movables!()
    expect(list.map((m) => m.objectId)).toEqual([objectId])
    expect(list[0]!.top).toBeCloseTo(1.6, 1)
  })

  it('a pushable piece a module lays as scenery (addObject) is listed and shoved too', () => {
    const { room, host } = roomWith('can')
    const laid = host.addObject!('crate', { position: [2, 0, -3] })
    expect(laid).not.toBeNull()
    expect(host.movables!().map((m) => m.objectId)).toContain(laid!.objectId)
    shoveFor(room, host, laid!.objectId, 450, 1, 1)
    expect(zOf(room, laid!.objectId)).toBeLessThan(-3.5)
  })

  it('one body moves a light crate along its push', () => {
    const { room, host, objectId } = roomWith('crate')
    shoveFor(room, host, objectId, 450, 1, 1)
    expect(zOf(room, objectId)).toBeLessThan(-3.5)
  })

  it('the 242 kg cabinet does not budge for one body, and moves when three add their force', () => {
    const { room, host, objectId } = roomWith('cabinet')
    shoveFor(room, host, objectId, 450, 1, 1)
    expect(zOf(room, objectId)).toBeCloseTo(-3, 2)
    expect(room.log.entries({ type: 'push_shove_too_heavy' }).length).toBe(1)
    shoveFor(room, host, objectId, 1350, 3, 1)
    expect(zOf(room, objectId)).toBeLessThan(-3.2)
    expect(room.log.entries({ type: 'push_shoved' }).length).toBe(1)
  })

  it('a shoved piece stops at the player', () => {
    const { room, host, objectId } = roomWith('crate')
    room.look([0, 1.7, -4.2], [0, 1.7, -10])
    shoveFor(room, host, objectId, 450, 1, 2)
    expect(zOf(room, objectId)).toBeGreaterThan(-4.2 + 0.3 + 0.3 - 0.05)
  })
})
