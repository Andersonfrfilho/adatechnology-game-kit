import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'

import type { TestRoom, TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

const TOP = 0.78
const AT: [number, number, number] = [0, 0, -2]
/** A table `length` m long standing free on the floor: a top screwed on four legs. */
const tableSpec = (length: number): DestructibleSpec => ({
  name: 'table',
  parts: [
    { id: 'top', material: 'wood_hard', mass: 10, shape: { kind: 'box', size: [length, 0.04, 0.7] }, position: [0, TOP - 0.02, 0] },
    ...[-1, 1].flatMap((sx, i) => [-0.3, 0.3].map((z, j) => ({ id: `leg_${i}${j}`, material: 'wood_hard', mass: 1.2, shape: { kind: 'box' as const, size: [0.05, TOP - 0.04, 0.05] as [number, number, number] }, position: [sx * (length / 2 - 0.05), (TOP - 0.04) / 2, z] as [number, number, number] }))),
  ],
  joints: ['00', '01', '10', '11'].map((leg) => ({ a: `leg_${leg}`, b: 'top', kind: 'screw' as const })),
})
const box = (name: string, material: string, mass: number, size: [number, number, number]): DestructibleSpec => ({ name, parts: [{ id: 'body', material, mass, shape: { kind: 'box', size }, position: [0, size[1] / 2, 0] }], joints: [] })
const can: DestructibleSpec = { name: 'can', parts: [{ id: 'body', material: 'steel', mass: 0.4, shape: { kind: 'cylinder', radius: 0.035, height: 0.12 }, position: [0, 0.06, 0] }], joints: [] }
const phone = box('phone', 'plastic', 0.18, [0.075, 0.009, 0.15])
const jarSpec = box('jar', 'glass', 0.3, [0.08, 0.1, 0.08])
const CATALOG: TestRoomItem[] = [
  { id: 'can', name: 'can', group: 'test', build: (T) => buildFromSpec(T, can), spec: can },
  { id: 'phone', name: 'phone', group: 'test', build: (T) => buildFromSpec(T, phone), spec: phone },
  {
    id: 'jar',
    name: 'jar',
    group: 'test',
    build: (T) => buildFromSpec(T, jarSpec),
    spec: jarSpec,
    fluid: { part: 'body', offset: [0, 0.01, 0], container: { shape: { kind: 'cylinder', radius: 0.035, height: 0.09 }, opening: 0.03, capacity: 0.35, liquid: 'juice', liters: 0.3 } },
  },
]

/** No frame budget on wall time: every event and its drawing run in the frame it comes in. */
const EVERY_EVENT_IN_ITS_FRAME = { frameBudgetMs: Infinity, debris: { eventBudgetMs: Infinity } } as const
const run = (room: TestRoom, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60)
}
const bottom = (root: THREE.Object3D): number => new THREE.Box3().setFromObject(root).min.y
const laid = (length: number): TestRoom => makeRoom({ ...EVERY_EVENT_IN_ITS_FRAME, catalog: CATALOG, scenery: { shelf: null, table: { spec: tableSpec(length), position: AT, free: true, top: { part: 'top', y: TOP } } } })
/** The legs of the left end knocked out: the top goes down on that end. */
const tip = (room: TestRoom, length: number): void => {
  for (const leg of ['leg_00', 'leg_01']) {
    for (let i = 0; i < 40 && room.world.part('table', leg)!.status !== 'broken'; i++) {
      room.world.hitPart('table', leg, { type: 'blunt', point: [AT[0] - length / 2 + 0.05, 0.3, AT[2] + (leg === 'leg_00' ? -0.3 : 0.3)], direction: [1, 0, 0], energy: 3e6, radius: 0.05 })
    }
  }
}

describe('a vessel that breaks lets its liquid fall', () => {
  it('a jar of juice shot on the table: the juice lies on the top or the floor, no container is left where the jar was', () => {
    const room = laid(1.6)
    const jar = room.spawn('jar', [0.3, TOP, AT[2]], 0)
    run(room, 1)
    expect(room.fluids.containers().some((c) => c.liquid === 'juice')).toBe(true)
    for (let i = 0; i < 40 && room.world.part(jar.objectId, 'body')!.status !== 'broken'; i++) {
      room.world.hitPart(jar.objectId, 'body', { type: 'blunt', point: [0.3, TOP + 0.05, AT[2]], direction: [0, -1, 0], energy: 2000, radius: 0.05 })
    }
    expect(room.world.part(jar.objectId, 'body')!.status).toBe('broken')
    run(room, 2)
    expect(room.fluids.containers().filter((c) => c.liquid === 'juice' && c.liters > 0)).toHaveLength(0)
    const juice = room.fluids.stains().filter((s) => s.liquid === 'juice')
    expect(juice.length).toBeGreaterThan(0)
    for (const s of juice) expect([TOP, 0].some((y) => Math.abs(s.center[1] - y) < 0.03)).toBe(true)
  })
})

describe('what lies on a top that tips over slides as its friction says', () => {
  it('a short table on its broken end (~40 degrees): the can and the phone slide down to the floor', () => {
    const room = laid(1.2)
    const things = [room.spawn('can', [0.2, TOP, AT[2] - 0.1], 0), room.spawn('phone', [0.25, TOP, AT[2] + 0.15], 0)]
    run(room, 2)
    tip(room, 1.2)
    run(room, 6)
    const top = room.renderer.shownBoxes('table', 'top')
    expect(Math.min(...top.map((b) => b[1]))).toBeLessThan(0.1)
    for (const thing of things) expect(bottom(thing.root as THREE.Object3D)).toBeLessThan(0.1)
  })
  it('a long table on its broken end (~10 degrees, under the 22-26 degrees the friction holds): an upright can stays, a can lying on its side rolls down', () => {
    const room = laid(4.4)
    const upright = room.spawn('can', [0.6, TOP, AT[2] - 0.15], 0)
    const lying = room.spawn('can', [0.9, TOP, AT[2] + 0.15], 0)
    // on its side, its axis across the slope: it rolls down the top
    const root = lying.root as THREE.Object3D
    root.rotation.set(Math.PI / 2, 0, 0)
    root.position.y = TOP + 0.036
    room.renderer.markMoved(lying.objectId)
    run(room, 2)
    tip(room, 4.4)
    run(room, 8)
    expect(bottom(root)).toBeLessThan(0.1)
    expect(bottom(upright.root as THREE.Object3D)).toBeGreaterThan(0.2)
  })
})
