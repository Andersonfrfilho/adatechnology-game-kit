import { describe, expect, it } from 'vitest'
import type * as THREE_NS from 'three'
import type { ItemSeat, TestableModule } from '@adatechnology/game-contracts'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'
import type { TestRoomItem } from '../src'

const SEAT_HEIGHT = 0.45
const SEATS: ItemSeat[] = [
  { id: 'left', pose: 'sit', pos: [-0.4, SEAT_HEIGHT, 0], ry: 0, exit: [-0.4, 0, 0.8] },
  { id: 'right', pose: 'sit', pos: [0.4, SEAT_HEIGHT, 0], ry: 0, exit: [0.4, 0, 0.8] },
]
const benchSpec = { name: 'bench', parts: [{ id: 'seat', material: 'wood_hard', mass: 18, shape: { kind: 'box' as const, size: [1.4, 0.06, 0.45] as [number, number, number] }, position: [0, SEAT_HEIGHT - 0.03, 0] as [number, number, number] }], joints: [] }
const buildBench = (T: typeof THREE_NS): THREE_NS.Object3D => {
  const root = new T.Group()
  const seat = new T.Mesh(new T.BoxGeometry(1.4, 0.06, 0.45), new T.MeshStandardMaterial())
  seat.name = 'seat'
  seat.position.y = SEAT_HEIGHT - 0.03
  root.add(seat)
  return root
}
const bench = (seats: ItemSeat[] = SEATS): TestRoomItem => ({ id: 'bench', name: 'Bench', group: 'Furniture', build: buildBench, spec: benchSpec, movable: false, seats })

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) room.update(1 / 60)
}
const roomWithBench = (rotationY = 0, seats?: ItemSeat[]) => {
  const room = makeRoom({ catalog: [...demoItems('en'), bench(seats)], scenery: { table: null, shelf: null } })
  const so = room.spawn('bench', [0, 0, -2], rotationY)
  return { room, objectId: so.objectId }
}

describe('sitting on the seats an item brings', () => {
  it('sits on the seat nearest the player, the eye over the hips and facing the front of the item', () => {
    const { room, objectId } = roomWithBench()
    room.look([0.6, 1.7, -0.5], [0.4, 0.5, -2])
    const seat = room.sit(objectId)
    expect(seat).toMatchObject({ objectId, seatId: 'right', pose: 'sit' })
    run(room, 0.5)
    expect(room.camera.position.x).toBeCloseTo(0.4, 2)
    expect(room.camera.position.z).toBeCloseTo(-2, 2)
    expect(room.camera.position.y).toBeCloseTo(SEAT_HEIGHT + 0.62, 1)
    // the front of the bench is +z: the player looks that way
    const look = room.camera.getWorldDirection(new (room.camera.position.constructor as typeof THREE_NS.Vector3)())
    expect(look.z).toBeGreaterThan(0.9)
    expect(room.seat).toEqual(seat)
  })

  it('a walk key gets up at the seat exit, and the keys walk again after', () => {
    const { room, objectId } = roomWithBench()
    room.sit(objectId, 'left')
    run(room, 0.3)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    room.update(1 / 60)
    expect(room.seat).toBeNull()
    // on its feet at the exit; the held key has taken at most one step
    expect(room.playerPosition[0]).toBeCloseTo(-0.4, 1)
    expect(Math.abs(room.playerPosition[2] + 1.2)).toBeLessThan(0.1)
    run(room, 0.3)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    expect(room.playerPosition[2]).toBeGreaterThan(-1.1)
    run(room, 0.5)
    expect(room.camera.position.y).toBeGreaterThan(1.5)
  })

  it('the seat and its exit turn with the item', () => {
    const { room, objectId } = roomWithBench(Math.PI / 2)
    room.sit(objectId, 'left')
    // turned a quarter: local -x goes to +z, the front (+z) goes to +x
    expect(room.camera.position.x).toBeCloseTo(0, 2)
    expect(room.camera.position.z).toBeCloseTo(-2 + 0.4, 2)
    expect(room.stand()).toBe(true)
    expect(room.playerPosition[0]).toBeCloseTo(0.8, 1)
    expect(room.playerPosition[2]).toBeCloseTo(-1.6, 1)
  })

  it('a thing without seats, an unknown seat and standing while not seated do nothing', () => {
    const { room, objectId } = roomWithBench()
    const crate = room.spawn(demoItems('en')[0]!.id, [2, 0, -2], 0)
    expect(room.sit(crate.objectId)).toBeNull()
    expect(room.sit(objectId, 'middle')).toBeNull()
    expect(room.stand()).toBe(false)
    expect(room.seat).toBeNull()
  })

  it('the log says who sat and got up', () => {
    const { room, objectId } = roomWithBench()
    room.sit(objectId)
    room.stand()
    const types = room.log.entries().map((e) => e.type)
    expect(types).toContain('sit')
    expect(types).toContain('stand')
  })

  it('a reset of the room lets go of the seat', async () => {
    const { room, objectId } = roomWithBench()
    room.sit(objectId)
    await room.runScenarios([{ id: 'reset', name: 'reset', run: () => undefined }])
    expect(room.seat).toBeNull()
  })

  it('a module item brings its seats to the room', () => {
    const room = makeRoom({ scenery: { table: null, shelf: null } })
    const module: TestableModule = { id: 'seats_module', name: 'Seats', group: 'Seats', items: () => [{ id: 'module_bench', name: 'Bench', build: (T) => buildBench(T as typeof THREE_NS), spec: benchSpec, movable: false, seats: SEATS }] }
    room.loadModule(module)
    const so = room.spawn('module_bench', [0, 0, -2], 0)
    expect(room.sit(so.objectId, 'right')?.seatId).toBe('right')
  })
})
